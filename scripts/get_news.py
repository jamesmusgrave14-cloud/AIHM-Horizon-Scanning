import feedparser
import json
import os
import requests
import time
import re
import hashlib
from datetime import datetime
from urllib.parse import quote_plus, urlparse, parse_qsl, urlunparse, urlencode
from difflib import SequenceMatcher

BASE_DIR = os.path.dirname(__file__)

# ---------- DEFAULTS ----------

DEFAULT_HARM_QUERIES = {
    "Fraud": "AI scam OR AI fraud OR AI phishing OR voice cloning scam",
    "Cyber": "AI malware OR LLM exploit OR prompt injection OR jailbreak",
    "Terrorism": "AI extremism OR AI radicalisation OR synthetic propaganda",
    "VAWG": "AI harassment OR deepfake abuse OR image-based abuse",
    "CSAM": "AI-generated child abuse material OR CSAM AI",
    "Other": "AI violence OR AI weapons OR AI drugs OR AI crime instructions",
}

DEFAULT_FORUM_FEEDS = [
    {"name": "Reddit: netsec (new)", "url": "https://old.reddit.com/r/netsec/new/.rss", "tags": ["forum", "reddit", "cyber"]},
    {"name": "HN: AI agents", "url": "https://hnrss.org/newest?q=AI+agent+OR+agentic", "tags": ["forum", "hn", "agents"]},
]

# ---------- SETTINGS (ENV OVERRIDES) ----------

LOCALE_HL = os.getenv("NEWS_HL", "en-GB")
LOCALE_GL = os.getenv("NEWS_GL", "GB")
LOCALE_CEID = os.getenv("NEWS_CEID", "GB:en")

TIME_WINDOW = os.getenv("TIME_WINDOW", "7d")

MAX_PER_HARM = int(os.getenv("MAX_PER_HARM", "25"))
MAX_RELEASES = int(os.getenv("MAX_RELEASES", "40"))
MAX_AI_ID = int(os.getenv("MAX_AI_ID", "50"))
MAX_FORUM_ITEMS = int(os.getenv("MAX_FORUM_ITEMS", "40"))

SIGNAL_SIM_THRESHOLD = float(os.getenv("SIGNAL_SIM_THRESHOLD", "0.86"))

HEADERS = {
    "User-Agent": "AIHM-Horizon-Scanning/1.0 (rss fetch)",
    "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
}

STOPWORDS = {
    "about","after","their","there","would","could","which","these","those","because",
    "while","where","when","with","from","into","over","under","more","than","this",
    "that","have","has","been","were","what","your","they","them","will","just",
    "said","says","also","only","some","most","very","much","onto"
}

HARM_CATEGORIES = set(DEFAULT_HARM_QUERIES.keys())

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


def google_rss_url(q):
    q2 = f"{q} when:{TIME_WINDOW}"
    return (
        "https://news.google.com/rss/search?q="
        + quote_plus(q2)
        + f"&hl={LOCALE_HL}&gl={LOCALE_GL}&ceid={quote_plus(LOCALE_CEID)}"
    )


def fetch_feed(url, retries=3, base_sleep=1.0):
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 429:
                retry_after = r.headers.get("Retry-After")
                sleep_s = int(retry_after) if (retry_after and retry_after.isdigit()) else base_sleep * (i + 2)
                time.sleep(sleep_s)
                continue
            r.raise_for_status()
            return feedparser.parse(r.content)
        except Exception:
            if i == retries - 1:
                return feedparser.parse(b"")
            time.sleep(base_sleep * (i + 1))
    return feedparser.parse(b"")


def strip_source_suffix(title):
    if not title:
        return ""
    return title.rsplit(" - ", 1)[0].strip()


def norm_text(t):
    t = (t or "").lower()
    t = re.sub(r"[‘’“”]", "'", t)
    t = re.sub(r"[–—-]", " ", t)
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def stable_id(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def similar(a, b):
    return SequenceMatcher(None, a, b).ratio()


def clean_url(url):
    if not url:
        return ""
    try:
        p = urlparse(url)
        qs = [(k, v) for (k, v) in parse_qsl(p.query, keep_blank_values=True) if not k.lower().startswith("utm_")]
        p2 = p._replace(query=urlencode(qs))
        return urlunparse(p2)
    except Exception:
        return url


def ensure_old_reddit(url):
    if not url:
        return ""
    if "www.reddit.com" in url:
        return url.replace("www.reddit.com", "old.reddit.com")
    return url


def extract_keywords(text, max_words=6):
    words = re.findall(r"[a-z]{4,}", (text or "").lower())
    words = [w for w in words if w not in STOPWORDS]
    freq = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    return [w for w, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:max_words]]


def query_keywords(q):
    q = (q or "").lower()
    q = q.replace("site:", " ")
    q = re.sub(r'["()]', " ", q)
    q = re.sub(r"\bor\b|\band\b", " ", q)
    tokens = re.findall(r"[a-z]{4,}", q)
    tokens = [t for t in tokens if t not in STOPWORDS and t not in {"when"}]
    # Keep a small, high-signal set
    out = []
    for t in tokens:
        if t not in out:
            out.append(t)
    return out[:12]


def relevance_score(title, keywords):
    t = norm_text(title)
    if not t or not keywords:
        return 0
    score = 0
    for kw in keywords:
        if kw in t:
            score += 1
    return score


def dedupe_by_key(items, key_fn):
    seen = set()
    out = []
    for it in items:
        k = key_fn(it)
        if k in seen:
            continue
        seen.add(k)
        out.append(it)
    return out


def signal_primary_category(tags):
    tags = tags or []
    for t in tags:
        if t in HARM_CATEGORIES:
            return t
    if tags:
        return tags[0]
    return "Other"


def summarize_signal(signal):
    tags = signal.get("tags") or []
    src_count = int(signal.get("source_count") or 0)
    links = signal.get("links") or []
    joined = " ".join([(l.get("title") or "") for l in links[:6]])
    kws = extract_keywords(joined)
    primary = signal.get("primary_category") or signal_primary_category(tags)
    harm_txt = f"Potential {primary} harm" if primary in HARM_CATEGORIES else primary
    if kws:
        return f"{harm_txt}: recurring themes include {', '.join(kws)} ({src_count} sources)."
    return f"{harm_txt}: clustered coverage detected ({src_count} sources)."


def cluster_to_signals(items):
    clusters = []
    for it in items:
        title_key = norm_text(it.get("title", ""))
        if not title_key:
            continue

        # Prevent cross-category over-clustering: include primary tag in the key
        tags = it.get("tags", []) or []
        primary = signal_primary_category(tags)
        cluster_key = f"{primary}::{title_key}"

        placed = False
        for c in clusters:
            if similar(cluster_key, c["key"]) >= SIGNAL_SIM_THRESHOLD:
                c["items"].append(it)
                c["sources"].add(it.get("source", ""))
                c["tags"].update(tags)
                c["last_seen"] = max(c["last_seen"], it.get("timestamp", 0))
                c["first_seen"] = min(c["first_seen"], it.get("timestamp", 0))
                placed = True
                break

        if not placed:
            clusters.append({
                "key": cluster_key,
                "items": [it],
                "sources": set([it.get("source", "")]),
                "tags": set(tags),
                "first_seen": it.get("timestamp", 0),
                "last_seen": it.get("timestamp", 0),
            })

    signals = []
    for c in clusters:
        items_sorted = sorted(c["items"], key=lambda x: x.get("timestamp", 0), reverse=True)
        tags_sorted = sorted([t for t in c["tags"] if t])

        primary = signal_primary_category(tags_sorted)
        source_count = len([s for s in c["sources"] if s])

        signal = {
            "signal_id": stable_id(c["key"]),
            "title": items_sorted[0].get("title"),
            "primary_category": primary,
            "tags": tags_sorted,
            "cluster_size": len(items_sorted),
            "source_count": source_count,
            "first_seen": c["first_seen"],
            "last_seen": c["last_seen"],
            "latest_date": items_sorted[0].get("date"),
            "links": [
                {
                    "title": x.get("title"),
                    "link": x.get("link"),
                    "source": x.get("source"),
                    "date": x.get("date"),
                    "source_type": x.get("source_type", "news"),
                    "category": x.get("category"),
                    "relevance_score": x.get("relevance_score", 0),
                }
                for x in items_sorted[:8]
            ],
        }

        # heuristic confidence: more sources + larger cluster => higher
        confidence = min(1.0, (source_count / 5.0) + (len(items_sorted) / 20.0))
        signal["confidence"] = round(confidence, 3)
        signal["confidence_label"] = "High" if confidence > 0.8 else "Medium" if confidence > 0.4 else "Low"

        signal["ai_summary"] = summarize_signal(signal)
        signal["why_this_is_a_signal"] = (
            "Clustered by headline similarity within the same primary category; "
            f"{signal['cluster_size']} items across {signal['source_count']} sources."
        )

        signals.append(signal)

    # Rank by recency + momentum
    signals.sort(
        key=lambda s: (s.get("last_seen", 0), s.get("source_count", 0), s.get("cluster_size", 0)),
        reverse=True
    )
    return signals


# ---------- MAIN ----------

def run():
    harm_queries = load_json_if_exists(os.path.join(BASE_DIR, "harm_queries.json"), DEFAULT_HARM_QUERIES)
    forum_feeds = load_json_if_exists(os.path.join(BASE_DIR, "forum_feeds.json"), DEFAULT_FORUM_FEEDS)

    report = {
        "last_updated": datetime.utcnow().isoformat(),
        "disclaimer": (
            "Automated horizon-scanning prototype. "
            "Items indicate emerging discussion, not verified risk, intent, or prevalence."
        ),
        "meta": {
            "limits": {
                "TIME_WINDOW": TIME_WINDOW,
                "MAX_PER_HARM": MAX_PER_HARM,
                "MAX_RELEASES": MAX_RELEASES,
                "MAX_AI_ID": MAX_AI_ID,
                "MAX_FORUM_ITEMS": MAX_FORUM_ITEMS,
                "SIGNAL_SIM_THRESHOLD": SIGNAL_SIM_THRESHOLD,
            }
        },
        "sections": {
            "harms": [],
            "signals": [],
            "forums": [],
            "dev_releases": [],
            "aiid": [],
        },
        "coverage": {"by_harm": {}},
    }

    errors = {}

    # 1) Harms
    raw_harm_items = []
    for cat, q in harm_queries.items():
        try:
            kws = query_keywords(q)
            feed = fetch_feed(google_rss_url(q))
            for e in feed.entries[:MAX_PER_HARM]:
                title = strip_source_suffix(getattr(e, "title", ""))
                published = getattr(e, "published", "")
                dt = parse_date(published)

                src = None
                if hasattr(e, "source"):
                    src = getattr(getattr(e, "source", None), "title", None)

                link = clean_url(getattr(e, "link", ""))

                rel = relevance_score(title, kws)

                raw = {
                    "category": cat,
                    "title": title,
                    "link": link,
                    "source": src or "News",
                    "timestamp": dt.timestamp(),
                    "date": published,
                    "source_type": "news",
                    "tags": [cat],
                    "relevance_score": rel,
                }
                raw_harm_items.append(raw)

                report["sections"]["harms"].append({
                    "category": cat,
                    "title": title,
                    "link": link,
                    "source": raw["source"],
                    "timestamp": raw["timestamp"],
                    "date": raw["date"],
                    "relevance_score": rel,
                })
        except Exception as ex:
            errors[f"harms:{cat}"] = str(ex)

    # Dedupe harms by title+source+category
    report["sections"]["harms"] = dedupe_by_key(
        report["sections"]["harms"],
        lambda x: f"{x.get('category')}|{norm_text(x.get('title'))}|{norm_text(x.get('source'))}"
    )
    report["sections"]["harms"].sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # Coverage
    cov = {}
    for it in report["sections"]["harms"]:
        cat = it.get("category", "Other")
        cov.setdefault(cat, {"count": 0, "last_seen": None})
        cov[cat]["count"] += 1
        cov[cat]["last_seen"] = max(cov[cat]["last_seen"] or 0, it.get("timestamp", 0))
    report["coverage"]["by_harm"] = cov

    # 2) Model releases (relaxed; no over-aggressive keep_words gate)
    raw_release_items = []
    release_queries = [
        '("model card" OR "release notes" OR "system card" OR "safety report") (OpenAI OR Anthropic OR DeepMind OR Google OR Meta OR Mistral OR xAI)',
        '(released OR launch OR rollout OR preview) ("frontier model" OR "open weights" OR "model")',
        '("open weights" OR "open-source model" OR "model weights") (Llama OR Meta OR Mistral OR Qwen OR DeepSeek)',
    ]
    try:
        for rq in release_queries:
            feed = fetch_feed(google_rss_url(rq))
            for e in feed.entries[:MAX_RELEASES]:
                title = strip_source_suffix(getattr(e, "title", ""))
                published = getattr(e, "published", "")
                dt = parse_date(published)

                src = None
                if hasattr(e, "source"):
                    src = getattr(getattr(e, "source", None), "title", None)

                link = clean_url(getattr(e, "link", ""))

                item = {
                    "title": title,
                    "link": link,
                    "source": src or "News",
                    "timestamp": dt.timestamp(),
                    "date": published,
                    "source_type": "news",
                    "tags": ["Model Releases"],
                }
                raw_release_items.append(item)
                report["sections"]["dev_releases"].append({
                    "title": title,
                    "link": link,
                    "source": item["source"],
                    "timestamp": item["timestamp"],
                    "date": item["date"],
                })
    except Exception as ex:
        errors["dev_releases"] = str(ex)

    report["sections"]["dev_releases"] = dedupe_by_key(
        report["sections"]["dev_releases"],
        lambda x: f"{norm_text(x.get('title'))}|{norm_text(x.get('source'))}"
    )
    report["sections"]["dev_releases"].sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # 3) AIID (extract incident number from title or URL)
    aiid_items = []
    try:
        aiid_query = 'site:incidentdatabase.ai (incident OR "Incident")'
        feed = fetch_feed(google_rss_url(aiid_query))
        rx_title = re.compile(r"incident\s+(\d+)", re.IGNORECASE)
        rx_url = re.compile(r"/(?:incident|incidents)/(\d+)", re.IGNORECASE)

        for e in feed.entries[:MAX_AI_ID]:
            raw_title = strip_source_suffix(getattr(e, "title", "")) or getattr(e, "title", "")
            link = clean_url(getattr(e, "link", ""))

            incident_no = None
            m1 = rx_title.search(raw_title or "")
            if m1:
                incident_no = int(m1.group(1))
            else:
                m2 = rx_url.search(link or "")
                if m2:
                    incident_no = int(m2.group(1))

            if incident_no is None:
                continue

            published = getattr(e, "published", "")
            dt = parse_date(published)

            aiid_items.append({
                "incident_no": incident_no,
                "title": raw_title,
                "link": link,
                "date": published,
                "source": "AIID",
                "timestamp": dt.timestamp(),
            })

        aiid_items.sort(key=lambda x: (x.get("incident_no", 0), x.get("timestamp", 0)), reverse=True)
        report["sections"]["aiid"] = aiid_items
    except Exception as ex:
        errors["aiid"] = str(ex)

    # 4) Forums
    raw_forum_items = []
    try:
        for f in forum_feeds:
            name = f.get("name", "Forum")
            url = ensure_old_reddit((f.get("url") or "").strip())
            tags = f.get("tags", ["forum"])
            if not url:
                continue

            feed = fetch_feed(url, retries=4)
            for e in feed.entries[:MAX_FORUM_ITEMS]:
                title = strip_source_suffix(getattr(e, "title", "")) or getattr(e, "title", "")
                published = getattr(e, "published", "") or getattr(e, "updated", "")
                dt = parse_date(published)
                link = clean_url(getattr(e, "link", ""))

                item = {
                    "title": title,
                    "link": link,
                    "source": name,
                    "timestamp": dt.timestamp(),
                    "date": published,
                    "source_type": "forum",
                    "tags": tags,
                }
                raw_forum_items.append(item)
                report["sections"]["forums"].append({
                    "title": title,
                    "link": link,
                    "source": name,
                    "timestamp": item["timestamp"],
                    "date": published,
                    "tags": tags,
                    "source_type": "forum",
                })
    except Exception as ex:
        errors["forums"] = str(ex)

    report["sections"]["forums"] = dedupe_by_key(
        report["sections"]["forums"],
        lambda x: f"{norm_text(x.get('title'))}|{norm_text(x.get('source'))}"
    )
    report["sections"]["forums"].sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # 5) Signals (cluster across harms + releases + forums)
    all_for_signals = []
    all_for_signals.extend(raw_harm_items)
    all_for_signals.extend(raw_release_items)
    all_for_signals.extend(raw_forum_items)

    # Dedupe input to clustering to reduce duplicate signal inflation
    all_for_signals = dedupe_by_key(
        all_for_signals,
        lambda x: f"{x.get('source_type')}|{x.get('category','')}|{norm_text(x.get('title'))}|{norm_text(x.get('source'))}"
    )

    report["sections"]["signals"] = cluster_to_signals(all_for_signals)

    if errors:
        report["meta"]["errors"] = errors

    os.makedirs("public", exist_ok=True)
    with open("public/news_data.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    run()
