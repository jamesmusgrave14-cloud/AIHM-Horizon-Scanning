import feedparser
import json
import os
import requests
import time
import re
import hashlib
from datetime import datetime
from urllib.parse import quote_plus
from difflib import SequenceMatcher

BASE_DIR = os.path.dirname(__file__)

# ---------- CONFIG DEFAULTS ----------
DEFAULT_HARM_QUERIES = {
    "Fraud": "AI scam OR AI fraud OR AI phishing OR voice cloning scam",
    "Cyber": "AI malware OR LLM exploit OR prompt injection OR jailbreak",
    "Terrorism": "AI extremism OR AI radicalisation OR synthetic propaganda",
    "VAWG": "AI harassment OR deepfake abuse OR image-based abuse",
    "CSAM": "AI-generated child abuse material OR CSAM AI",
    "Other": "AI violence OR AI weapons OR AI drugs OR AI crime instructions",
}

DEFAULT_FORUM_FEEDS = [
    # You can override with scripts/forum_feeds.json
    {
        "name": "Reddit: netsec (new)",
        "url": "https://old.reddit.com/r/netsec/new/.rss",
        "tags": ["forum", "reddit", "cyber"],
    },
    {
        "name": "HN: AI agents",
        "url": "https://hnrss.org/newest?q=AI+agent+OR+agentic",
        "tags": ["forum", "hn", "agents"],
    },
]

# ---------- SETTINGS ----------
LOCALE_HL = os.getenv("NEWS_HL", "en-GB")
LOCALE_GL = os.getenv("NEWS_GL", "GB")
LOCALE_CEID = os.getenv("NEWS_CEID", "GB:en")

TIME_WINDOW = os.getenv("TIME_WINDOW", "7d")
MAX_PER_HARM = int(os.getenv("MAX_PER_HARM", "25"))
MAX_RELEASES = int(os.getenv("MAX_RELEASES", "30"))
MAX_AI_ID = int(os.getenv("MAX_AI_ID", "50"))
MAX_FORUM_ITEMS = int(os.getenv("MAX_FORUM_ITEMS", "40"))
SIGNAL_SIM_THRESHOLD = float(os.getenv("SIGNAL_SIM_THRESHOLD", "0.86"))

HEADERS = {
    # A descriptive UA reduces blocks on some sites.
    "User-Agent": "AIHM-Horizon-Scanning/1.0 (contact: internal) Mozilla/5.0",
    "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
}


# ---------- HELPERS ----------
def load_json_if_exists(path, fallback):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return fallback
    return fallback


def parse_date(date_str):
    if not date_str:
        return datetime.utcnow()
    for fmt in [
        "%a, %d %b %Y %H:%M:%S %Z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
    ]:
        try:
            return datetime.strptime(date_str, fmt)
        except Exception:
            pass
    return datetime.utcnow()


def google_rss_url(q: str) -> str:
    q2 = f"{q} when:{TIME_WINDOW}"
    return (
        "https://news.google.com/rss/search?q="
        + quote_plus(q2)
        + f"&hl={LOCALE_HL}&gl={LOCALE_GL}&ceid={quote_plus(LOCALE_CEID)}"
    )


def fetch_feed(url, retries=3, base_sleep=1.0):
    """
    Fetch RSS with backoff. Respect 429 by sleeping (don’t try to dodge it).
    """
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 429:
                retry_after = r.headers.get("Retry-After")
                sleep_s = (
                    int(retry_after)
                    if (retry_after and retry_after.isdigit())
                    else (base_sleep * (i + 2))
                )
                time.sleep(sleep_s)
                continue
            r.raise_for_status()
            return feedparser.parse(r.content)
        except Exception:
            if i == retries - 1:
                return feedparser.parse(b"")
            time.sleep(base_sleep * (i + 1))
    return feedparser.parse(b"")


def strip_source_suffix(title: str) -> str:
    if not title:
        return ""
    return title.rsplit(" - ", 1)[0].strip()


def norm_title(t: str) -> str:
    t = (t or "").lower()
    t = re.sub(r"[\u2018\u2019\u201C\u201D]", "'", t)
    t = re.sub(r"[\u2013\u2014\-]", " ", t)
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    for w in ["ai", "artificial intelligence", "model", "release"]:
        t = t.replace(w, "")
    return re.sub(r"\s+", " ", t).strip()


def similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def stable_id(key: str) -> str:
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def dedupe_items(items):
    seen = set()
    out = []
    for it in items:
        key = (it.get("link") or "") + "||" + (it.get("title") or "")
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


def cluster_to_signals(items, threshold=SIGNAL_SIM_THRESHOLD):
    clusters = []
    for it in items:
        nt = norm_title(it.get("title", ""))
        if not nt:
            continue

        placed = False
        for c in clusters:
            if similar(nt, c["key"]) >= threshold:
                c["items"].append(it)
                c["sources"].add(it.get("source", ""))
                c["tags"].update(it.get("tags", []))
                c["last_seen"] = max(c["last_seen"], it.get("timestamp", 0))
                c["first_seen"] = min(c["first_seen"], it.get("timestamp", 0))
                placed = True
                break

        if not placed:
            clusters.append(
                {
                    "key": nt,
                    "title": it.get("title", ""),
                    "items": [it],
                    "sources": set([it.get("source", "")]),
                    "tags": set(it.get("tags", [])),
                    "first_seen": it.get("timestamp", 0),
                    "last_seen": it.get("timestamp", 0),
                }
            )

    signals = []
    for c in clusters:
        sorted_items = sorted(
            c["items"], key=lambda x: x.get("timestamp", 0), reverse=True
        )
        signals.append(
            {
                "signal_id": stable_id(c["key"]),
                "title": c["title"],
                "tags": sorted([t for t in c["tags"] if t]),
                "source_count": len([s for s in c["sources"] if s]),
                "first_seen": c["first_seen"],
                "last_seen": c["last_seen"],
                "latest_date": sorted_items[0].get("date"),
                "links": [
                    {
                        "title": x.get("title"),
                        "link": x.get("link"),
                        "source": x.get("source"),
                        "date": x.get("date"),
                        "source_type": x.get("source_type", "news"),
                    }
                    for x in sorted_items[:8]
                ],
            }
        )

    signals.sort(key=lambda s: (s["last_seen"], s["source_count"]), reverse=True)
    return signals


def ensure_old_reddit(url: str) -> str:
    if "www.reddit.com" in url:
        return url.replace("www.reddit.com", "old.reddit.com")
    return url


# ---------- MAIN ----------
def run():
    harm_queries = load_json_if_exists(
        os.path.join(BASE_DIR, "harm_queries.json"), DEFAULT_HARM_QUERIES
    )
    forum_feeds = load_json_if_exists(
        os.path.join(BASE_DIR, "forum_feeds.json"), DEFAULT_FORUM_FEEDS
    )

    report = {
        "last_updated": datetime.utcnow().isoformat(),
        "sections": {
            "harms": [],
            "signals": [],
            "forums": [],
            "dev_releases": [],
            "aiid": [],
        },
        "coverage": {"by_harm": {}},
    }

    # 1) Harms (raw)
    raw_harm_items = []
    for cat, q in harm_queries.items():
        feed = fetch_feed(google_rss_url(q))
        for e in feed.entries[:MAX_PER_HARM]:
            title = strip_source_suffix(getattr(e, "title", ""))
            published = getattr(e, "published", "")
            dt = parse_date(published)
            src = (
                getattr(getattr(e, "source", None), "title", None)
                if hasattr(e, "source")
                else None
            )

            raw = {
                "category": cat,
                "title": title,
                "link": getattr(e, "link", ""),
                "source": src or "News",
                "timestamp": dt.timestamp(),
                "date": published,
                "source_type": "news",
                "tags": [cat],
            }

            raw_harm_items.append(raw)
            report["sections"]["harms"].append(
                {
                    "category": cat,
                    "title": title,
                    "link": raw["link"],
                    "source": raw["source"],
                    "timestamp": raw["timestamp"],
                    "date": raw["date"],
                }
            )

    report["sections"]["harms"] = dedupe_items(report["sections"]["harms"])
    report["sections"]["harms"].sort(key=lambda x: x["timestamp"], reverse=True)

    # coverage
    cov = {}
    for it in report["sections"]["harms"]:
        cat = it["category"]
        cov.setdefault(cat, {"count": 0, "last_seen": None})
        cov[cat]["count"] += 1
        cov[cat]["last_seen"] = max(cov[cat]["last_seen"] or 0, it["timestamp"])
    report["coverage"]["by_harm"] = cov

    # 2) Model releases (raw) — stricter search + title filtering
    release_q = (
        '("model card" OR "release notes" OR released OR launches OR "open weights") '
        '(OpenAI OR Anthropic OR DeepMind OR Google OR Meta OR Llama OR Mistral OR xAI)'
    )
    release_feed = fetch_feed(google_rss_url(release_q))
    raw_release_items = []
    keep_words = [
        "release",
        "released",
        "launch",
        "model card",
        "weights",
        "preview",
        "version",
        "rollout",
    ]
    for e in release_feed.entries[:MAX_RELEASES]:
        title = strip_source_suffix(getattr(e, "title", ""))
        if not any(w in title.lower() for w in keep_words):
            continue
        published = getattr(e, "published", "")
        dt = parse_date(published)
        src = (
            getattr(getattr(e, "source", None), "title", None)
            if hasattr(e, "source")
            else None
        )
        item = {
            "title": title,
            "link": getattr(e, "link", ""),
            "source": src or "News",
            "timestamp": dt.timestamp(),
            "date": published,
            "source_type": "news",
            "tags": ["Model Releases"],
        }
        raw_release_items.append(item)
        report["sections"]["dev_releases"].append(
            {
                "title": item["title"],
                "link": item["link"],
                "source": item["source"],
                "timestamp": item["timestamp"],
                "date": item["date"],
            }
        )

    report["sections"]["dev_releases"] = dedupe_items(report["sections"]["dev_releases"])
    report["sections"]["dev_releases"].sort(key=lambda x: x["timestamp"], reverse=True)

    # 3) AIID — keep only "Incident ####" and sort most recent first
    # AIID pages commonly present incidents as "Incident 1360: ..."
    aiid_query = 'site:incidentdatabase.ai inurl:incident "Incident"'
    aiid_feed = fetch_feed(google_rss_url(aiid_query))

    aiid_items = []
    rx = re.compile(r"Incident\s+(\d+)", re.IGNORECASE)
    for e in aiid_feed.entries[:MAX_AI_ID]:
        title = strip_source_suffix(getattr(e, "title", "")) or getattr(e, "title", "")
        m = rx.search(title)
        if not m:
            continue
        incident_no = int(m.group(1))
        published = getattr(e, "published", "")
        dt = parse_date(published)
        aiid_items.append(
            {
                "incident_no": incident_no,
                "title": title,
                "link": getattr(e, "link", ""),
                "date": published,
                "source": "AIID",
                "timestamp": dt.timestamp(),
            }
        )

    # Prefer incident number descending; fallback timestamp
    aiid_items.sort(key=lambda x: (x["incident_no"], x["timestamp"]), reverse=True)
    report["sections"]["aiid"] = aiid_items

    # 4) Forums (raw RSS)
    raw_forum_items = []
    for f in forum_feeds:
        name = f.get("name", "Forum")
        url = ensure_old_reddit(f.get("url", ""))
        tags = f.get("tags", ["forum"])
        if not url:
            continue

        feed = fetch_feed(url, retries=4)
        for e in feed.entries[:MAX_FORUM_ITEMS]:
            title = strip_source_suffix(getattr(e, "title", "")) or getattr(e, "title", "")
            published = getattr(e, "published", "") or getattr(e, "updated", "")
            dt = parse_date(published)
            item = {
                "title": title,
                "link": getattr(e, "link", ""),
                "source": name,
                "timestamp": dt.timestamp(),
                "date": published,
                "source_type": "forum",
                "tags": tags,
            }
            raw_forum_items.append(item)
            report["sections"]["forums"].append(
                {
