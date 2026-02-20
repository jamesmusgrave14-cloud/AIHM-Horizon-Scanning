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

# ---------- SETTINGS ----------

LOCALE_HL = os.getenv("NEWS_HL", "en-GB")
LOCALE_GL = os.getenv("NEWS_GL", "GB")
LOCALE_CEID = os.getenv("NEWS_CEID", "GB:en")

TIME_WINDOW = os.getenv("TIME_WINDOW", "7d")
RELEASE_TIME_WINDOW = os.getenv("RELEASE_TIME_WINDOW", "365d")
INCIDENT_TIME_WINDOW = os.getenv("INCIDENT_TIME_WINDOW", "365d")

MAX_PER_HARM = int(os.getenv("MAX_PER_HARM", "25"))
MAX_RELEASES = int(os.getenv("MAX_RELEASES", "60"))
MAX_AI_ID = int(os.getenv("MAX_AI_ID", "60"))
MAX_FORUM_ITEMS = int(os.getenv("MAX_FORUM_ITEMS", "40"))

SIGNAL_SIM_THRESHOLD = float(os.getenv("SIGNAL_SIM_THRESHOLD", "0.86"))

# Dedupe strategy label for UI debug
DEDUPE_MODE = os.getenv("DEDUPE_MODE", "title_fingerprint_v2")

# Optional: true LLM summary (keep empty for deterministic-only)
SUMMARY_OPENAI_API_KEY = os.getenv("SUMMARY_OPENAI_API_KEY", "").strip()
SUMMARY_OPENAI_MODEL = os.getenv("SUMMARY_OPENAI_MODEL", "gpt-4.1-mini").strip()

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

# Release-only filters
RELEASE_INCLUDE = [
    "introducing", "released", "launch", "rollout", "preview", "system card", "model card",
    "open weights", "weights", "new model", "foundation model", "gemini", "gpt", "opus", "sonnet",
    "haiku", "llama", "mistral", "qwen", "deepseek", "gemma"
]
RELEASE_EXCLUDE = [
    "funding", "raises", "series", "valuation", "partners", "partnership", "opens office",
    "mou", "board", "appoint", "donating"
]

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


def google_rss_url(q, window):
    q2 = f"{q} when:{window}"
    return (
        "https://news.google.com/rss/search?q="
        + quote_plus(q2)
        + f"&hl={LOCALE_HL}&gl={LOCALE_GL}&ceid={quote_plus(LOCALE_CEID)}"
    )


def fetch_url(url, retries=3, base_sleep=1.0, allow_html=False):
    hdrs = dict(HEADERS)
    if allow_html:
        hdrs["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    for i in range(retries):
        try:
            r = requests.get(url, headers=hdrs, timeout=30)
            if r.status_code == 429:
                retry_after = r.headers.get("Retry-After")
                sleep_s = int(retry_after) if (retry_after and retry_after.isdigit()) else base_sleep * (i + 2)
                time.sleep(sleep_s)
                continue
            r.raise_for_status()
            return r.content
        except Exception:
            if i == retries - 1:
                return b""
            time.sleep(base_sleep * (i + 1))
    return b""


def fetch_feed(url, retries=3, base_sleep=1.0):
    content = fetch_url(url, retries=retries, base_sleep=base_sleep, allow_html=False)
    if not content:
        return feedparser.parse(b"")
    return feedparser.parse(content)


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
    """
    Reduce URL uniqueness (helps dedupe Google News redirects).
    - removes utm_ params
    - normalizes google news ?url= redirect patterns if present
    """
    if not url:
        return ""
    try:
        p = urlparse(url)
        qs = [(k, v) for (k, v) in parse_qsl(p.query, keep_blank_values=True) if not k.lower().startswith("utm_")]
        qsd = dict(qs)
        # If google news provides ?url= real url, use it
        if "url" in qsd and qsd["url"].startswith("http"):
            return qsd["url"]
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


def query_keywords(q):
    q = (q or "").lower()
    q = q.replace("site:", " ")
    q = re.sub(r'["()]', " ", q)
    q = re.sub(r"\bor\b|\band\b", " ", q)
    tokens = re.findall(r"[a-z]{4,}", q)
    tokens = [t for t in tokens if t not in STOPWORDS and t not in {"when"}]
    out = []
    for t in tokens:
        if t not in out:
            out.append(t)
    return out[:14]


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


def fingerprint_title(title):
    """
    Aggressive normalization for dedupe: title-only fingerprint.
    """
    t = norm_text(strip_source_suffix(title or ""))
    # remove very generic tokens to reduce false uniqueness
    for w in ["ai", "artificial intelligence", "model", "models", "llm", "chatbot"]:
        t = t.replace(w, "")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def extract_keywords(text, max_words=6):
    words = re.findall(r"[a-z]{4,}", (text or "").lower())
    words = [w for w in words if w not in STOPWORDS]
    freq = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    return [w for w, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:max_words]]


def summarize_list(titles, max_kws=6):
    joined = " ".join(titles[:25])
    kws = extract_keywords(joined, max_words=max_kws)
    if not kws:
        return "No clear recurring themes detected."
    return "Recurring themes: " + ", ".join(kws) + "."


def looks_like_release(title):
    t = (title or "").lower()
    if any(x in t for x in RELEASE_EXCLUDE):
        return False
    return any(x in t for x in RELEASE_INCLUDE)


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
        title_key = fingerprint_title(it.get("title", ""))
        if not title_key:
            continue
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
