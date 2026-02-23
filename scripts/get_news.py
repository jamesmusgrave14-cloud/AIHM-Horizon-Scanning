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

# Harms are high volume; keep short
TIME_WINDOW = os.getenv("TIME_WINDOW", "7d")

# Model releases are low frequency; keep long
RELEASE_TIME_WINDOW = os.getenv("RELEASE_TIME_WINDOW", "365d")

# Incidents low frequency; keep long
INCIDENT_TIME_WINDOW = os.getenv("INCIDENT_TIME_WINDOW", "365d")

MAX_PER_HARM = int(os.getenv("MAX_PER_HARM", "25"))
MAX_RELEASES = int(os.getenv("MAX_RELEASES", "60"))
MAX_AI_ID = int(os.getenv("MAX_AI_ID", "60"))
MAX_FORUM_ITEMS = int(os.getenv("MAX_FORUM_ITEMS", "40"))

SIGNAL_SIM_THRESHOLD = float(os.getenv("SIGNAL_SIM_THRESHOLD", "0.86"))

# Dedupe strategy label for UI debug
DEDUPE_MODE = os.getenv("DEDUPE_MODE", "title_fingerprint_v3")

# Optional: true LLM summaries (safe to leave unset; deterministic summaries still produced)
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

# Release-only filters: keep "new model released" style items; exclude funding/partnership noise
RELEASE_INCLUDE = [
    "introducing", "released", "launch", "rollout", "preview", "system card", "model card",
    "open weights", "weights", "new model", "foundation model",
    "gpt", "o3", "o4", "codex", "sora",
    "gemini", "gemma",
    "opus", "sonnet", "haiku", "claude",
    "llama", "mistral", "pixtral", "codestral", "devstral",
    "qwen", "deepseek"
]
RELEASE_EXCLUDE = [
    "funding", "raises", "series", "valuation", "partners", "partnership", "opens office",
    "mou", "board", "appoint", "donating", "policy", "press", "contract"
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

def parse_date_loose(date_str):
    """
    For scraped pages where dates might look like:
      "Feb 17, 2026" or "February 4, 2026" or "Jan 27, 2026"
    """
    if not date_str:
        return datetime.utcnow()
    s = str(date_str).strip()
    for fmt in ["%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y"]:
        try:
            return datetime.strptime(s, fmt)
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
        if "url" in qsd and isinstance(qsd["url"], str) and qsd["url"].startswith("http"):
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
    Aggressive title fingerprint to dedupe across redirects and minor punctuation differences.
    """
    t = norm_text(strip_source_suffix(title or ""))
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

def classify_harm_subbucket(category, title):
    """
    Clearer buckets within a category (deterministic keyword rules).
    """
    t = (title or "").lower()

    if category == "Fraud":
        if any(x in t for x in ["voice", "cloning", "impersonat"]): return ("Impersonation / voice", "Matched voice/impersonation keywords")
        if any(x in t for x in ["phish", "credential", "login"]): return ("Phishing / credential theft", "Matched phishing/credential keywords")
        if any(x in t for x in ["scam", "fraud", "con", "romance"]): return ("Scams", "Matched scam/fraud keywords")
        return ("Other fraud", "No specific fraud sub-bucket match")

    if category == "Cyber":
        if any(x in t for x in ["prompt injection", "jailbreak"]): return ("Prompt injection / jailbreak", "Matched prompt injection/jailbreak keywords")
        if any(x in t for x in ["malware", "ransom", "exploit", "vulnerab"]): return ("Malware / exploits", "Matched malware/exploit keywords")
        if any(x in t for x in ["supply chain", "dependency", "package"]): return ("Supply chain", "Matched supply chain keywords")
        return ("Other cyber", "No specific cyber sub-bucket match")

    if category == "Terrorism":
        if any(x in t for x in ["propaganda", "radical", "extrem"]): return ("Propaganda / radicalisation", "Matched propaganda/radicalisation keywords")
        if any(x in t for x in ["attack", "weapon", "bomb"]): return ("Attack planning", "Matched attack-planning keywords")
        return ("Other terrorism", "No specific terrorism sub-bucket match")

    if category == "VAWG":
        if any(x in t for x in ["deepfake", "nudify", "sexual image"]): return ("Synthetic sexual imagery", "Matched deepfake/nudify keywords")
        if any(x in t for x in ["harass", "stalk", "abuse"]): return ("Harassment / stalking", "Matched harassment/stalking keywords")
        return ("Other VAWG", "No specific VAWG sub-bucket match")

    if category == "CSAM":
        if any(x in t for x in ["generated", "synthetic", "ai-generated"]): return ("Synthetic CSAM", "Matched synthetic/AI-generated keywords")
        return ("CSAM-related", "No specific CSAM sub-bucket match")

    return ("Other", "Default sub-bucket")

def openai_chat_summary(prompt, errors):
    """
    Optional LLM summary. If SUMMARY_OPENAI_API_KEY not set, caller should not call this.
    Uses OpenAI Chat Completions endpoint; errors are recorded and we fall back to deterministic.
    """
    try:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {SUMMARY_OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": SUMMARY_OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": "You produce short, neutral summaries for horizon scanning dashboards. Avoid speculation and avoid sensitive personal data."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        }
        r = requests.post(url, headers=headers, json=payload, timeout=30)
        r.raise_for_status()
        data = r.json()
        txt = data["choices"][0]["message"]["content"].strip()
        return txt
    except Exception as ex:
        errors["llm_summary"] = str(ex)
        return ""

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

        confidence = min(1.0, (source_count / 5.0) + (len(items_sorted) / 20.0))
        signal["confidence"] = round(confidence, 3)
        signal["confidence_label"] = "High" if confidence > 0.8 else "Medium" if confidence > 0.4 else "Low"

        signal["ai_summary"] = summarize_signal(signal)
        signal["why_this_is_a_signal"] = (
            "Clustered by headline similarity within the same primary category; "
            f"{signal['cluster_size']} items across {signal['source_count']} sources."
        )

        signals.append(signal)

    signals.sort(
        key=lambda s: (s.get("last_seen", 0), s.get("source_count", 0), s.get("cluster_size", 0)),
        reverse=True
    )
    return signals


# ---------- MODEL RELEASE SOURCES (avoid Google News noise) ----------

def releases_from_openai_rss(errors):
    """
    OpenAI official RSS: https://openai.com/news/rss.xml [1](https://community.openai.com/t/openai-website-rss-feed-inquiry/733747)[2](https://community.openai.com/t/rss-feed-openai-research-index-rss-feed/1088852)
    """
    url = "https://openai.com/news/rss.xml"
    out = []
    feed = fetch_feed(url, retries=3, base_sleep=1.0)
    for e in feed.entries[:MAX_RELEASES]:
        title = strip_source_suffix(getattr(e, "title", ""))
        if not looks_like_release(title):
            continue
        published = getattr(e, "published", "") or getattr(e, "updated", "")
        dt = parse_date(published)
        link = clean_url(getattr(e, "link", ""))
        if not title or not link:
            continue
        out.append({
            "title": title,
            "link": link,
            "source": "OpenAI",
            "timestamp": dt.timestamp(),
            "date": published,
            "source_type": "news",
            "tags": ["Model Releases"],
        })
    return out

def releases_from_deepmind_feed(errors):
    """
    DeepMind feed endpoint: https://deepmind.google/blog/feed/ [3](https://deepmind.google/blog/feed/)
    """
    url = "https://deepmind.google/blog/feed/"
    out = []
    feed = fetch_feed(url, retries=3, base_sleep=1.0)
    for e in feed.entries[:MAX_RELEASES]:
        title = strip_source_suffix(getattr(e, "title", ""))
        if not looks_like_release(title):
            continue
        published = getattr(e, "published", "") or getattr(e, "updated", "")
        dt = parse_date(published)
        link = clean_url(getattr(e, "link", ""))
        if not title or not link:
            continue
        out.append({
            "title": title,
            "link": link,
            "source": "Google DeepMind",
            "timestamp": dt.timestamp(),
            "date": published,
            "source_type": "news",
            "tags": ["Model Releases"],
        })
    return out

def scrape_list_page(url, errors, source_name):
    """
    Generic HTML list scraper: extracts (title, href, date-ish) from a list page.
    This is intentionally conservative to avoid breaking often.
    """
    html = fetch_url(url, retries=3, base_sleep=1.0, allow_html=True)
    if not html:
        errors[f"scrape:{source_name}"] = f"No HTML returned from {url}"
        return []
    text = html.decode("utf-8", errors="ignore")

    # Find candidate article links
    # Keep absolute URLs.
    links = re.findall(r'href="(https?://[^"]+)"', text, flags=re.IGNORECASE)
    links = [l for l in links if source_name in l or urlparse(l).netloc in urlparse(url).netloc]
    # Dedup while preserving order
    seen = set()
    links2 = []
    for l in links:
        if l in seen:
            continue
        seen.add(l)
        links2.append(l)

    # Extract titles near links (best-effort)
    items = []
    for l in links2[:200]:
        # Try to find a nearby <a ...>Title</a>
        m = re.search(r'href="' + re.escape(l) + r'".{0,200}>([^<]{4,140})<', text, flags=re.IGNORECASE | re.DOTALL)
        title = ""
        if m:
            title = re.sub(r"\s+", " ", m.group(1)).strip()
        if not title:
            continue

        # Try to find a nearby date string
        # (This is heuristic; we accept empty and set timestamp to now.)
        date_match = re.search(r'([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4})', text[m.start():m.start()+600], flags=re.IGNORECASE)
        date_str = date_match.group(1) if date_match else ""
        dt = parse_date_loose(date_str) if date_str else datetime.utcnow()

        items.append({
            "title": strip_source_suffix(title),
            "link": clean_url(l),
            "source": source_name,
            "timestamp": dt.timestamp(),
            "date": date_str or "",
            "source_type": "news",
            "tags": ["Model Releases"],
        })

    return items

def releases_from_anthropic(errors):
    """
    Anthropic releases/news page exists at https://www.anthropic.com/news [4](https://www.anthropic.com/news)[5](https://www.anthropic.com/news/claude-sonnet-4-6?cam=claude)
    We'll scrape and filter to release-like titles.
    """
    url = "https://www.anthropic.com/news"
    raw = scrape_list_page(url, errors, "anthropic.com")
    out = [x for x in raw if looks_like_release(x["title"])]
    return out

def releases_from_mistral(errors):
    """
    Mistral has structured list at https://mistral.ai/news [6](https://mistral.ai/news)[7](https://mistral.ai/news/mistral-vibe-2-0)
    We'll scrape and filter.
    """
    url = "https://mistral.ai/news"
    raw = scrape_list_page(url, errors, "mistral.ai")
    out = [x for x in raw if looks_like_release(x["title"])]
    return out


# ---------- MAIN ----------

def run():
    harm_queries = load_json_if_exists(os.path.join(BASE_DIR, "harm_queries.json"), DEFAULT_HARM_QUERIES)
    forum_feeds = load_json_if_exists(os.path.join(BASE_DIR, "forum_feeds.json"), DEFAULT_FORUM_FEEDS)

    errors = {}

    report = {
        "last_updated": datetime.utcnow().isoformat(),
        "disclaimer": (
            "Automated horizon-scanning prototype. Items indicate emerging discussion, "
            "not verified risk, intent, or prevalence."
        ),
        "meta": {
            "limits": {
                "TIME_WINDOW": TIME_WINDOW,
                "RELEASE_TIME_WINDOW": RELEASE_TIME_WINDOW,
                "INCIDENT_TIME_WINDOW": INCIDENT_TIME_WINDOW,
                "MAX_PER_HARM": MAX_PER_HARM,
                "MAX_RELEASES": MAX_RELEASES,
                "MAX_AI_ID": MAX_AI_ID,
                "MAX_FORUM_ITEMS": MAX_FORUM_ITEMS,
                "SIGNAL_SIM_THRESHOLD": SIGNAL_SIM_THRESHOLD,
            },
            "dedupe_mode": DEDUPE_MODE,
            "llm_summary_enabled": bool(SUMMARY_OPENAI_API_KEY),
        },
        "sections": {
            "harms": [],
            "signals": [],
            "forums": [],
            "dev_releases": [],
            "aiid": [],
        },
        "coverage": {"by_harm": {}},
        "summaries": {
            "harms_overview": "",
            "harms_by_category": {},
            "releases_overview": "",
        }
    }

    # Global seen keys to reduce duplicates across sections
    seen_global = set()

    def seen_key(kind, title, source, link):
        fp = fingerprint_title(title)
        src = norm_text(source)
        lk = clean_url(link)
        return f"{kind}|{fp}|{src}|{lk}"

    # 1) Harms (Google News RSS)
    raw_harm_items = []
    for cat, q in harm_queries.items():
        try:
            kws = query_keywords(q)
            feed = fetch_feed(google_rss_url(q, TIME_WINDOW))
            for e in feed.entries[:MAX_PER_HARM]:
                title = strip_source_suffix(getattr(e, "title", ""))
                published = getattr(e, "published", "")
                dt = parse_date(published)

                src = None
                if hasattr(e, "source"):
                    src = getattr(getattr(e, "source", None), "title", None)

                link = clean_url(getattr(e, "link", ""))
                rel = relevance_score(title, kws)

                sub_bucket, sub_reason = classify_harm_subbucket(cat, title)

                raw = {
                    "category": cat,
                    "sub_bucket": sub_bucket,
                    "sub_bucket_reason": sub_reason,
                    "title": title,
                    "link": link,
                    "source": src or "News",
                    "timestamp": dt.timestamp(),
                    "date": published,
                    "source_type": "news",
                    "tags": [cat, sub_bucket],
                    "relevance_score": rel,
                }

                k = seen_key("harms", raw["title"], raw["source"], raw["link"])
                if k in seen_global:
                    continue
                seen_global.add(k)

                raw_harm_items.append(raw)

                report["sections"]["harms"].append({
                    "category": cat,
                    "sub_bucket": sub_bucket,
                    "title": title,
                    "link": link,
                    "source": raw["source"],
                    "timestamp": raw["timestamp"],
                    "date": raw["date"],
                    "relevance_score": rel,
                })
        except Exception as ex:
            errors[f"harms:{cat}"] = str(ex)

    # Sort harms newest first
    report["sections"]["harms"].sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # Coverage by category + sub-bucket counts
    cov = {}
    sub_cov = {}
    for it in report["sections"]["harms"]:
        cat = it.get("category", "Other")
        cov.setdefault(cat, {"count": 0, "last_seen": None})
        cov[cat]["count"] += 1
        cov[cat]["last_seen"] = max(cov[cat]["last_seen"] or 0, it.get("timestamp", 0))

        sb = it.get("sub_bucket") or "Other"
        sub_cov.setdefault(cat, {})
        sub_cov[cat][sb] = sub_cov[cat].get(sb, 0) + 1

    report["coverage"]["by_harm"] = cov
    report["coverage"]["by_harm_subbucket"] = sub_cov

    # Deterministic “overview” summaries
    all_titles = [h["title"] for h in report["sections"]["harms"]]
    report["summaries"]["harms_overview"] = summarize_list(all_titles)

    by_cat = {}
    for cat in cov.keys():
        titles = [h["title"] for h in report["sections"]["harms"] if h.get("category") == cat]
        by_cat[cat] = summarize_list(titles)
    report["summaries"]["harms_by_category"] = by_cat

    # Optional LLM summaries (if key provided)
    if SUMMARY_OPENAI_API_KEY:
        # Short executive overview (harms)
        prompt = (
            "Write a 5-bullet executive summary of the most important AI-harms headlines in the last period. "
            "Be neutral, avoid speculation, and do not over-claim. "
            "Headlines:\n- " + "\n- ".join(all_titles[:40])
        )
        txt = openai_chat_summary(prompt, errors)
        if txt:
            report["summaries"]["harms_overview_llm"] = txt

    # 2) Forums (left as-is; you said handle separately)
    raw_forum_items = []
    try:
        for f in forum_feeds:
            name = f.get("name", "Forum")
            url = ensure_old_reddit((f.get("url") or "").strip())
            tags = f.get("tags", ["forum"])
            if not url:
                continue

            feed = fetch_feed(url, retries=4, base_sleep=1.0)
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

                k = seen_key("forums", item["title"], item["source"], item["link"])
                if k in seen_global:
                    continue
                seen_global.add(k)

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

    report["sections"]["forums"].sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # 3) Model releases (use official/primary sources + filter strongly)
    raw_release_items = []
    try:
        raw_release_items.extend(releases_from_openai_rss(errors))      # official RSS [1](https://community.openai.com/t/openai-website-rss-feed-inquiry/733747)[2](https://community.openai.com/t/rss-feed-openai-research-index-rss-feed/1088852)
        raw_release_items.extend(releases_from_deepmind_feed(errors))   # feed endpoint [3](https://deepmind.google/blog/feed/)
        raw_release_items.extend(releases_from_anthropic(errors))       # scrape /news [4](https://www.anthropic.com/news)[5](https://www.anthropic.com/news/claude-sonnet-4-6?cam=claude)
        raw_release_items.extend(releases_from_mistral(errors))         # scrape /news [6](https://mistral.ai/news)[7](https://mistral.ai/news/mistral-vibe-2-0)

        # Apply global dedupe
        raw_release_items = dedupe_by_key(
            raw_release_items,
            lambda x: f"{fingerprint_title(x.get('title'))}|{norm_text(x.get('source'))}"
        )
        raw_release_items.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

        # Trim to window by timestamp (coarse; RELEASE_TIME_WINDOW may be "365d")
        # We avoid strict parsing of "365d" for now; it remains a generation knob.

        for it in raw_release_items[:MAX_RELEASES]:
            k = seen_key("releases", it["title"], it["source"], it["link"])
            if k in seen_global:
                continue
            seen_global.add(k)

            report["sections"]["dev_releases"].append({
                "title": it["title"],
                "link": it["link"],
                "source": it["source"],
                "timestamp": it["timestamp"],
                "date": it["date"],
                "category": "Releases",
                "source_type": "news",
            })

    except Exception as ex:
        errors["dev_releases"] = str(ex)

    report["sections"]["dev_releases"].sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # Release overview summary
    rel_titles = [r["title"] for r in report["sections"]["dev_releases"]]
    report["summaries"]["releases_overview"] = summarize_list(rel_titles)

    if SUMMARY_OPENAI_API_KEY and rel_titles:
        prompt = (
            "Write a short paragraph (max 80 words) summarising the latest *model releases* only. "
            "Mention only what is in the headlines; do not invent features or dates. "
            "Headlines:\n- " + "\n- ".join(rel_titles[:25])
        )
        txt = openai_chat_summary(prompt, errors)
        if txt:
            report["summaries"]["releases_overview_llm"] = txt

    # 4) Incident DB (leave as-is for now; keep working)
    # If you later provide a stable dataset endpoint, we can switch.
    report["sections"]["aiid"] = []  # keep empty unless you later add a source

    # 5) Signals (cluster across harms + releases + forums)
    all_for_signals = []
    all_for_signals.extend(raw_harm_items)
    all_for_signals.extend(raw_release_items)
    all_for_signals.extend(raw_forum_items)

    all_for_signals = dedupe_by_key(
        all_for_signals,
        lambda x: f"{x.get('source_type')}|{x.get('category','')}|{fingerprint_title(x.get('title'))}|{norm_text(x.get('source'))}"
    )

    report["sections"]["signals"] = cluster_to_signals(all_for_signals)

    # Optional: LLM enhance signal summaries (very lightweight; only top few)
    if SUMMARY_OPENAI_API_KEY and report["sections"]["signals"]:
        top_signals = report["sections"]["signals"][:8]
        for s in top_signals:
            titles = [l["title"] for l in (s.get("links") or []) if l.get("title")]
            prompt = (
                "Summarise this emerging signal in 1 sentence (max 25 words). "
                "Do not speculate; base it only on these headlines:\n- " + "\n- ".join(titles[:10])
            )
            txt = openai_chat_summary(prompt, errors)
            if txt:
                s["ai_summary_llm"] = txt

    if errors:
        report["meta"]["errors"] = errors

    os.makedirs("public", exist_ok=True)
    with open("public/news_data.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    run()
