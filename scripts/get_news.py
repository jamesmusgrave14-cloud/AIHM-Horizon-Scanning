import feedparser, json, os, requests, time, re, hashlib
from datetime import datetime
from urllib.parse import quote_plus
from difflib import SequenceMatcher
from collections import defaultdict

# ----------------------------
# CONFIG
# ----------------------------

# Keep your existing categories, but (optionally) override by putting a harm_queries.json
# next to this script. This avoids hardcoding sensitive query strings here.
DEFAULT_HARM_CATEGORIES = {
    "Fraud": "AI scam OR AI fraud OR phishing OR deepfake finance",
    "Category_2": "YOUR_QUERY_HERE",
    "Category_3": "YOUR_QUERY_HERE",
    "Category_4": "YOUR_QUERY_HERE",
    "Category_5": "YOUR_QUERY_HERE",
}

# Forum feeds (RSS). You can override with forum_feeds.json too.
# Reddit supports adding .rss to subreddit URLs. [1](https://www.howtogeek.com/320264/how-to-get-an-rss-feed-for-any-subreddit/)
# Hacker News: use hnrss search feeds. [2](https://hnrss.github.io/)
DEFAULT_FORUM_FEEDS = [
    # Reddit subreddit "new" feeds (example placeholders)
    # Replace SUBREDDIT with ones you care about.
    # Example format: https://www.reddit.com/r/SUBREDDIT/new/.rss
    {"name": "Reddit: example_subreddit", "url": "https://www.reddit.com/r/example_subreddit/new/.rss", "tags": ["forum", "reddit"]},

    # Hacker News keyword search (replace KEYWORDS)
    # Example format: https://hnrss.org/newest?q=KEYWORD+OR+KEYWORD2
    {"name": "HN search: AI misuse", "url": "https://hnrss.org/newest?q=AI+misuse", "tags": ["forum", "hn"]},
]

# Google News RSS locale & recency window
LOCALE_HL = os.getenv("NEWS_HL", "en-GB")
LOCALE_GL = os.getenv("NEWS_GL", "GB")
LOCALE_CEID = os.getenv("NEWS_CEID", "GB:en")

# How far back should Google News searches look (e.g. 1h, 24h, 7d, 30d)
# Google News RSS commonly supports `when:` constraints in queries. [3](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7BC2817573-EBB1-4A86-A565-A44977B44928%7D&file=AI%20Harms%20Quantification%20Summary%20%28Off-Sen%20-%20Not%20for%20onward%20sharing%29%20-%20130625.docx&action=default&mobileredirect=true&DefaultItemOpen=1)[4](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B8C8EE97B-B995-4221-B7F7-874B867D8D36%7D&file=Bespoke%20Research%20Planning.docx&action=default&mobileredirect=true&DefaultItemOpen=1)
TIME_WINDOW = os.getenv("TIME_WINDOW", "7d")

# How many items to pull per feed before clustering
MAX_PER_HARM = int(os.getenv("MAX_PER_HARM", "25"))
MAX_RELEASES = int(os.getenv("MAX_RELEASES", "30"))
MAX_AI_ID = int(os.getenv("MAX_AI_ID", "30"))
MAX_FORUM_ITEMS = int(os.getenv("MAX_FORUM_ITEMS", "40"))

# Signal clustering threshold (0-1). Higher = more strict (less merging)
SIGNAL_SIM_THRESHOLD = float(os.getenv("SIGNAL_SIM_THRESHOLD", "0.86"))

HEADERS = {
    "User-Agent": "Mozilla/5.0 MonitorBot/2.0 (+https://example.invalid)"
}

# ----------------------------
# HELPERS
# ----------------------------

def load_json_if_exists(path, fallback):
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            return fallback
    return fallback

def parse_date(date_str):
    """
    RSS dates vary. Keep it forgiving.
    """
    if not date_str:
        return datetime.utcnow()
    # Common RSS format: 'Tue, 10 Feb 2026 11:05:00 GMT'
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
    # Google may ignore parentheses for grouping in queries, so prefer ORs/quotes. [5](https://ukhomeoffice-my.sharepoint.com/personal/james_musgrave_homeoffice_gov_uk/_layouts/15/Doc.aspx?action=edit&mobileredirect=true&wdorigin=Sharepoint&DefaultItemOpen=1&sourcedoc={2ff8063c-3452-43c9-93c2-c9cb158f0c68}&wd=target%28/Horizon%20Scanning.one/%29&wdpartid={dbc01bc1-8cc9-401e-9ffc-2f743d351677}{1}&wdsectionfileid={0f3adac6-8222-461c-9c0a-4c6db062a93f})
    q2 = f"{q} when:{TIME_WINDOW}"
    return (
        "https://news.google.com/rss/search?q="
        + quote_plus(q2)
        + f"&hl={LOCALE_HL}&gl={LOCALE_GL}&ceid={quote_plus(LOCALE_CEID)}"
    )

def fetch_feed(url, retries=3, base_sleep=0.8):
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
            return feedparser.parse(r.content)
        except Exception:
            if i == retries - 1:
                return feedparser.parse(b"")  # empty on failure
            time.sleep(base_sleep * (i + 1))
    return feedparser.parse(b"")

def strip_source_suffix(title: str) -> str:
    # Google News often appends " - Source"
    if not title:
        return ""
    return title.rsplit(" - ", 1)[0].strip()

def norm_title(t: str) -> str:
    t = (t or "").lower()
    t = re.sub(r"[\u2018\u2019\u201C\u201D]", "'", t)
    t = re.sub(r"[\u2013\u2014\-]", " ", t)
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    # Remove ultra-common fluff tokens to help clustering
    for w in ["ai", "artificial intelligence", "model", "release"]:
        t = t.replace(w, "")
    return re.sub(r"\s+", " ", t).strip()

def similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()

def stable_id(key: str) -> str:
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]

def cluster_to_signals(items, threshold=SIGNAL_SIM_THRESHOLD):
    """
    Cluster near-duplicate headlines into "signals".
    Each signal contains multiple links/sources and a first/last seen.
    """
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
            clusters.append({
                "key": nt,
                "title": it.get("title", ""),
                "items": [it],
                "sources": set([it.get("source", "")]),
                "tags": set(it.get("tags", [])),
                "first_seen": it.get("timestamp", 0),
                "last_seen": it.get("timestamp", 0),
            })

    signals = []
    for c in clusters:
        sorted_items = sorted(c["items"], key=lambda x: x.get("timestamp", 0), reverse=True)
        signals.append({
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
            ]
        })

    # Sort by newest, then by number of sources (proxy for "signal strength")
    signals.sort(key=lambda s: (s["last_seen"], s["source_count"]), reverse=True)
    return signals

def dedupe_items(items):
    """
    Remove obvious duplicates by link or title.
    """
    seen = set()
    out = []
    for it in items:
        key = (it.get("link") or "") + "||" + (it.get("title") or "")
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out

# ----------------------------
# MAIN
# ----------------------------

def run():
    harm_queries = load_json_if_exists("harm_queries.json", DEFAULT_HARM_CATEGORIES)
    forum_feeds = load_json_if_exists("forum_feeds.json", DEFAULT_FORUM_FEEDS)

    report = {
        "last_updated": datetime.utcnow().isoformat(),
        "sections": {
            "harms": [],         # raw articles grouped by category (your existing tab)
            "signals": [],       # clustered signals across harms + releases + forums
            "forums": [],        # raw forum items
            "dev_releases": [],  # raw model releases items (your existing tab)
            "aiid": [],          # raw AIID items (your existing tab)
        },
        "coverage": {
            "by_harm": {},       # counts & last seen by harm category
        }
    }

    # 1) Harms Monitor (raw)
    raw_harm_items = []
    for cat, q in harm_queries.items():
        url = google_rss_url(q)
        feed = fetch_feed(url)
        for e in feed.entries[:MAX_PER_HARM]:
            title = strip_source_suffix(getattr(e, "title", ""))
            published = getattr(e, "published", "")
            dt = parse_date(published)
            src = getattr(getattr(e, "source", None), "title", None) if hasattr(e, "source") else None
            raw = {
                "category": cat,
                "title": title,
                "link": getattr(e, "link", ""),
                "source": src or "News",
                "timestamp": dt.timestamp(),
                "date": published,
                "source_type": "news",
                "tags": [cat]
            }
            raw_harm_items.append(raw)
            report["sections"]["harms"].append({
                "category": cat,
                "title": title,
                "link": raw["link"],
                "source": raw["source"],
                "timestamp": raw["timestamp"],
                "date": raw["date"],
            })

    report["sections"]["harms"] = dedupe_items(report["sections"]["harms"])
    report["sections"]["harms"].sort(key=lambda x: x["timestamp"], reverse=True)

    # Coverage by harm
    cov = defaultdict(lambda: {"count": 0, "last_seen": None})
    for it in report["sections"]["harms"]:
        cov[it["category"]]["count"] += 1
        cov[it["category"]]["last_seen"] = max(cov[it["category"]]["last_seen"] or 0, it["timestamp"])
    report["coverage"]["by_harm"] = cov

    # 2) Model Releases (raw)
    # Note: Google may ignore parentheses; keep query simple with ORs. [5](https://ukhomeoffice-my.sharepoint.com/personal/james_musgrave_homeoffice_gov_uk/_layouts/15/Doc.aspx?action=edit&mobileredirect=true&wdorigin=Sharepoint&DefaultItemOpen=1&sourcedoc={2ff8063c-3452-43c9-93c2-c9cb158f0c68}&wd=target%28/Horizon%20Scanning.one/%29&wdpartid={dbc01bc1-8cc9-401e-9ffc-2f743d351677}{1}&wdsectionfileid={0f3adac6-8222-461c-9c0a-4c6db062a93f})
    release_q = "OpenAI OR Anthropic OR DeepSeek OR Meta OR Llama OR Mistral release model"
    release_feed = fetch_feed(google_rss_url(release_q))
    raw_release_items = []
    for e in release_feed.entries[:MAX_RELEASES]:
        title = strip_source_suffix(getattr(e, "title", ""))
        published = getattr(e, "published", "")
        dt = parse_date(published)
        src = getattr(getattr(e, "source", None), "title", None) if hasattr(e, "source") else None
        item = {
            "title": title,
            "link": getattr(e, "link", ""),
            "source": src or "Release Log",
            "timestamp": dt.timestamp(),
            "date": published,
            "source_type": "news",
            "tags": ["Model Releases"]
        }
        raw_release_items.append(item)
        report["sections"]["dev_releases"].append({
            "title": item["title"],
            "link": item["link"],
            "source": item["source"],
            "timestamp": item["timestamp"],
            "date": item["date"]
        })

    report["sections"]["dev_releases"] = dedupe_items(report["sections"]["dev_releases"])
    report["sections"]["dev_releases"].sort(key=lambda x: x["timestamp"], reverse=True)

    # 3) AIID (raw)
    aiid_feed = fetch_feed(google_rss_url("site:incidentdatabase.ai"))
    for e in aiid_feed.entries[:MAX_AI_ID]:
        published = getattr(e, "published", "")
        dt = parse_date(published)
        report["sections"]["aiid"].append({
            "title": getattr(e, "title", ""),
            "link": getattr(e, "link", ""),
            "date": published,
            "source": "AIID",
            "timestamp": dt.timestamp()
        })
    report["sections"]["aiid"] = dedupe_items(report["sections"]["aiid"])
    report["sections"]["aiid"].sort(key=lambda x: x["timestamp"], reverse=True)

    # 4) Forums (raw RSS ingestion)
    # Reddit supports .rss endpoints; Hacker News has hnrss search feeds. [1](https://www.howtogeek.com/320264/how-to-get-an-rss-feed-for-any-subreddit/)[2](https://hnrss.github.io/)
    raw_forum_items = []
    for f in forum_feeds:
        name = f.get("name", "Forum")
        url = f.get("url")
        tags = f.get("tags", ["forum"])
        if not url:
            continue

        feed = fetch_feed(url)
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
                "tags": tags
            }
            raw_forum_items.append(item)
            report["sections"]["forums"].append({
                "title": item["title"],
                "link": item["link"],
                "source": item["source"],
                "timestamp": item["timestamp"],
                "date": item["date"],
                "tags": tags
            })

    report["sections"]["forums"] = dedupe_items(report["sections"]["forums"])
    report["sections"]["forums"].sort(key=lambda x: x["timestamp"], reverse=True)

    # 5) Signals tab (cluster across harms + releases + forums)
    all_for_signals = []
    all_for_signals.extend(raw_harm_items)
    all_for_signals.extend(raw_release_items)
    all_for_signals.extend(raw_forum_items)

    all_for_signals = dedupe_items(all_for_signals)
    report["sections"]["signals"] = cluster_to_signals(all_for_signals, threshold=SIGNAL_SIM_THRESHOLD)

    # Write output
    os.makedirs("public", exist_ok=True)
    with open("public/news_data.json", "w") as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run()
