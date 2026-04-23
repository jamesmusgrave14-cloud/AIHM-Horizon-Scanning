import json "Reddit: Scams (new)", "url": "https://old.reddit.com/r/Scams/new/.rss", "tags": ["forum", "reddit", "fraud"]},
    {"name": "Reddit: netsec (new)", "url": "https://old.reddit.com/r/netsec/new/.rss", "tags": ["forum", "reddit", "cyber"]},
    {"name": "Reddit: cybersecurity (new)", "url": "https://old.reddit.com/r/cybersecurity/new/.rss", "tags": ["forum", "reddit", "cyber"]},
    {"name": "Reddit: Malware (new)", "url": "https://old.reddit.com/r/Malware/new/.rss", "tags": ["forum", "reddit", "cyber"]},
    {"name": "HN: phishing / scams", "url": "https://hnrss.org/newest?q=phishing+OR+scam+OR+fraud", "tags": ["forum", "hn", "fraud"]},
    {"name": "HN: prompt injection / jailbreak", "url": "https://hnrss.org/newest?q=prompt+injection+OR+jailbreak", "tags": ["forum", "hn", "cyber"]},
    {"name": "HN: malware / exploit", "url": "https://hnrss.org/newest?q=malware+OR+exploit+OR+vulnerability", "tags": ["forum", "hn", "cyber"]},
]

# ---------- SETTINGS ----------
LOCALE_HL = os.getenv("NEWS_HL", "en-GB")
LOCALE_GL = os.getenv("NEWS_GL", "GB")
LOCALE_CEID = os.getenv("NEWS_CEID", "GB:en")
TIME_WINDOW = os.getenv("TIME_WINDOW", "7d")
RELEASE_TIME_WINDOW = os.getenv("RELEASE_TIME_WINDOW", "365d")
MAX_PER_HARM = int(os.getenv("MAX_PER_HARM", "25"))
MAX_RELEASES = int(os.getenv("MAX_RELEASES", "50"))
MAX_FORUM_ITEMS = int(os.getenv("MAX_FORUM_ITEMS", "30"))
SIGNAL_SIM_THRESHOLD = float(os.getenv("SIGNAL_SIM_THRESHOLD", "0.86"))
DEDUP_MODE = os.getenv("DEDUP_MODE", "title_fingerprint_v5_ho_owned")

OPENAI_NEWS_RSS = "https://openai.com/news/rss.xml"
RUNDOWN_RSS = "https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml"

HEADERS = {
    "User-Agent": "AIHM-Horizon-Scanning/1.0 (rss fetch)",
    "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
}

STOPWORDS = {
    "about","after","their","there","would","could","which","these","those","because",
    "while","where","when","with","from","into","over","under","more","than","this",
    "that","have","has","been","were","what","your","they","them","will","just",
    "said","says","also","only","some","most","very","much","onto","when"
}

UK_TOKENS = [
    " uk ", " united kingdom ", " britain ", " british ", " england ", " scotland ", " wales ",
    " northern ireland ", " nhs ", " nca ", " metropolitan police ", " met police ", " home office ",
    " ofcom ", " ico ", " cps ", " crown prosecution ", " westminster ", " parliament "
]

RELEASE_INCLUDE = [
    "introducing", "released", "launch", "rollout", "preview", "system card", "model card",
    "open weights", "open-weight", "weights", "new model", "foundation model",
    "gpt", "o1", "o3", "codex", "gemini", "opus", "sonnet", "haiku", "llama",
    "mistral", "qwen", "deepseek", "gemma", "mixtral", "phi", "seed", "kimi"
]
RELEASE_EXCLUDE = [
    "funding", "raises", "series", "valuation", "partners", "partnership", "opens office",
    "mou", "board", "appoint", "donating", "contract", "investment", "acquires", "acquisition"
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


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_date(date_str):
    if not date_str:
        return datetime.now(timezone.utc)
    try:
        dt = parsedate_to_datetime(date_str)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def google_rss_url(q, window):
    q2 = f"{q} when:{window}"
    return (
        "https://news.google.com/rss/search?q="
        + quote_plus(q2)
        + f"&hl={quote_plus(LOCALE_HL)}&gl={quote_plus(LOCALE_GL)}&ceid={quote_plus(LOCALE_CEID)}"
    )


def fetch_url(url, retries=3, base_sleep=1.0):
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 429:
                time.sleep(base_sleep * (i + 2))
                continue
            r.raise_for_status()
            return r.content
        except Exception:
            if i == retries - 1:
                return b""
            time.sleep(base_sleep * (i + 1))
    return b""


def fetch_feed(url):
    content = fetch_url(url)
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


def clean_url(url):
    if not url:
        return ""
    try:
        p = urlparse(url)
        qs = [(k, v) for (k, v) in parse_qsl(p.query, keep_blank_values=True) if not k.lower().startswith("utm_")]
        qsd = dict(qs)
        if "url" in qsd and qsd["url"].startswith("http"):
            return qsd["url"]
        return urlunparse(p._replace(query=urlencode(qs)))
    except Exception:
        return url


def query_keywords(q):
    q = (q or "").lower().replace("site:", " ")
    q = re.sub(r'[\")(|]', " ", q)
    q = re.sub(r"\bor\b|\band\b", " ", q)
    tokens = re.findall(r"[a-z]{4,}", q)
    out = []
    for t in tokens:
        if t not in STOPWORDS and t not in out:
            out.append(t)
    return out[:16]


def relevance_score(title, keywords):
    t = norm_text(title)
    if not t:
        return 0
    return sum(1 for kw in keywords if kw in t)


def fingerprint_title(title):
    t = norm_text(strip_source_suffix(title or ""))
    for w in ["ai", "artificial intelligence", "model", "models", "llm", "chatbot", "chatbots"]:
        t = t.replace(w, "")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def uk_score_for_item(title, link, source):
    t = f" {norm_text(title)} "
    s = f" {norm_text(source)} "
    u = f" {link or ''} ".lower()
    score = 0
    for tok in UK_TOKENS:
        if tok in t or tok in s or tok.strip() in u:
            score += 1
    return min(score, 3)


def extract_keywords(text, max_words=6):
    words = re.findall(r"[a-z]{4,}", (text or "").lower())
    words = [w for w in words if w not in STOPWORDS]
    freq = Counter(words)
    return [w for w, _ in freq.most_common(max_words)]


def summarize_list(titles, max_kws=7):
    joined = " ".join(titles[:30])
    kws = extract_keywords(joined, max_words=max_kws)
    return "Recurring themes: " + ", ".join(kws) + "." if kws else "No clear recurring themes detected."


def looks_like_release(title):
    t = (title or "").lower()
    if any(x in t for x in RELEASE_EXCLUDE):
        return False
    return any(x in t for x in RELEASE_INCLUDE)


def derive_subtype(title, category):
    t = norm_text(title)
    if any(x in t for x in ["fraud", "scam", "money laundering", "phishing", "impersonation", "voice clone"]):
        return "Impersonation / phishing / scam scripts"
    if any(x in t for x in ["csam", "child abuse", "child sexual", "grooming"]):
        return "CSAM / CSEA"
    if any(x in t for x in ["ncii", "synthetic image", "deepfake abuse", "image abuse", "intimate image", "revenge porn"]):
        return "NCII / sexualised deepfake imagery"
    if any(x in t for x in ["stalking", "harassment", "coercion", "sextortion", "audio abuse"]):
        return "VAWG / stalking / harassment / coercion"
    if any(x in t for x in ["terrorist", "extremist", "radicalisation", "radicalization", "propaganda", "recruitment"]):
        return "Propaganda / radicalisation / recruitment"
    if any(x in t for x in ["attack planning", "attack preparation", "crime instructions", "weapon", "explosive"]):
        return "Attack planning / operational guidance"
    if any(x in t for x in ["drugs", "firearms", "weapons", "illicit items", "dark web", "counterfeit"]):
        return "Illegal items / drugs / firearms"
    if any(x in t for x in ["ransomware", "malware", "jailbreak", "prompt injection", "exploit"]):
        return "Cyber-enabled criminal methods / attack enablement"
    if any(x in t for x in ["false evidence", "identity documents", "court", "bank statements", "birth certificates", "border", "immigration"]):
        return "Evidential risk / false documents / border exploitation"
    if category == "RA09 – AI use in financial crime, fraud and exploitation":
        return "General fraud / financial crime"
    if category == "RA11 – AI Use for Sexual Crime and Abuse":
        return "General sexual crime / abuse"
    if category == "RA13 – AI use in terrorism":
        return "General terrorism / extremism use case"
    if category == "RA14 – AI increases illegal item creation and acquisition":
        return "General illegal item / crime-enablement use case"
    if category == "Cross-cutting / unassigned":
        return "Legacy / cross-cutting"
    return "Other"


def assign_harm_category_from_text(title, harm_query_map):
    t = norm_text(title)
    best_cat = None
    best = 0
    for cat, q in harm_query_map.items():
        kws = query_keywords(q)
        score = sum(1 for kw in kws if kw in t)
        if score > best:
            best = score
            best_cat = cat
    if best_cat and best >= 2:
        return best_cat, best
    return None, 0


def build_harm_items(harm_queries):
    items = []
    seen = set()
    errors = {}
    for category, query in harm_queries.items():
        url = google_rss_url(query, TIME_WINDOW)
        feed = fetch_feed(url)
        if getattr(feed, "bozo", 0):
            errors[f"google:{category}"] = str(getattr(feed, "bozo_exception", "feed parse error"))
        keywords = query_keywords(query)
        for e in getattr(feed, "entries", []):
            title = strip_source_suffix(getattr(e, "title", "") or "")
            if not title:
                continue
            link = clean_url(getattr(e, "link", "") or "")
            source = getattr(getattr(e, "source", None), "title", "") or "Google News"
            date_str = getattr(e, "published", "") or getattr(e, "updated", "") or ""
            dt = parse_date(date_str)
            fp = f"{category}::{fingerprint_title(title)}"
            if fp in seen:
                continue
            seen.add(fp)
            rel = relevance_score(title, keywords)
            uk_score = uk_score_for_item(title, link, source)
            items.append({
                "category": category,
                "title": title,
                "link": link,
                "source": source,
                "timestamp": dt.timestamp(),
                "date": dt.strftime("%a, %d %b %Y %H:%M:%S GMT"),
                "relevance_score": rel,
                "uk_score": uk_score,
                "uk_relevance": uk_score >= 2,
                "harm_subtype": derive_subtype(title, category),
            })
    by_cat = defaultdict(list)
    for it in items:
        by_cat[it["category"]].append(it)
    out = []
    for cat, vals in by_cat.items():
        vals = sorted(vals, key=lambda x: (x.get("uk_score", 0), x.get("relevance_score", 0), x.get("timestamp", 0)), reverse=True)
        out.extend(vals[:MAX_PER_HARM])
    return out, errors


def build_forum_items(harm_queries, forum_feeds):
    items = []
    seen = set()
    errors = {}
    for feed_cfg in forum_feeds:
        feed = fetch_feed(feed_cfg["url"])
        if getattr(feed, "bozo", 0):
            errors[f"forum:{feed_cfg['name']}"] = str(getattr(feed, "bozo_exception", "feed parse error"))
        for e in getattr(feed, "entries", []):
            title = strip_source_suffix(getattr(e, "title", "") or "")
            if not title:
                continue
            cat, score = assign_harm_category_from_text(title, harm_queries)
            if not cat:
                cat = "Cross-cutting / unassigned"
            link = clean_url(getattr(e, "link", "") or "")
            date_str = getattr(e, "published", "") or getattr(e, "updated", "") or ""
            dt = parse_date(date_str)
            fp = f"forum::{fingerprint_title(title)}"
            if fp in seen:
                continue
            seen.add(fp)
            items.append({
                "category": cat,
                "title": title,
                "link": link,
                "source": feed_cfg["name"],
                "source_type": "forum",
                "timestamp": dt.timestamp(),
                "date": dt.isoformat(),
                "uk_score": uk_score_for_item(title, link, feed_cfg["name"]),
                "uk_relevance": uk_score_for_item(title, link, feed_cfg["name"]) >= 2,
                "harm_subtype": derive_subtype(title, cat),
                "tags": feed_cfg.get("tags", []),
            })
    items = sorted(items, key=lambda x: x.get("timestamp", 0), reverse=True)
    return items[:MAX_FORUM_ITEMS], errors


def build_release_items():
    items = []
    seen = set()
    for source_name, url in [("OpenAI News", OPENAI_NEWS_RSS), ("The Rundown", RUNDOWN_RSS)]:
        feed = fetch_feed(url)
        for e in getattr(feed, "entries", []):
            title = strip_source_suffix(getattr(e, "title", "") or "")
            if not title or not looks_like_release(title):
                continue
            link = clean_url(getattr(e, "link", "") or "")
            date_str = getattr(e, "published", "") or getattr(e, "updated", "") or ""
            dt = parse_date(date_str)
            fp = fingerprint_title(title)
            if fp in seen:
                continue
            seen.add(fp)
            items.append({
                "title": title,
                "link": link,
                "source": source_name,
                "timestamp": dt.timestamp(),
                "date": dt.strftime("%a, %d %b %Y %H:%M:%S GMT"),
                "source_type": "news",
            })
    items = sorted(items, key=lambda x: x.get("timestamp", 0), reverse=True)
    return items[:MAX_RELEASES]


def cluster_to_signals(items):
    groups = defaultdict(list)
    for it in items:
        title_fp = fingerprint_title(it.get("title", ""))
        primary = it.get("category") or "Cross-cutting / unassigned"
        groups[(primary, title_fp)].append(it)
    signals = []
    for (primary, title_fp), vals in groups.items():
        vals = sorted(vals, key=lambda x: x.get("timestamp", 0), reverse=True)
        joined_titles = " ".join(v.get("title", "") for v in vals[:6])
        signal = {
            "signal_id": stable_id(f"{primary}::{title_fp}"),
            "title": vals[0].get("title", ""),
            "primary_category": primary,
            "tags": [primary, vals[0].get("harm_subtype", "Other")],
            "cluster_size": len(vals),
            "source_count": len(set(v.get("source") for v in vals)),
            "first_seen": min(v.get("timestamp", 0) for v in vals),
            "last_seen": max(v.get("timestamp", 0) for v in vals),
            "latest_date": vals[0].get("date", ""),
            "links": [
                {
                    "title": v.get("title", ""),
                    "link": v.get("link", ""),
                    "source": v.get("source", ""),
                    "date": v.get("date", ""),
                    "source_type": v.get("source_type", "news"),
                    "category": v.get("category", primary),
                    "uk_score": v.get("uk_score", 0),
                }
                for v in vals[:5]
            ],
            "confidence": 0.311 if len(vals) > 1 else 0.256,
            "confidence_label": "Low",
            "ai_summary": f"Potential {primary} harm: {summarize_list([v.get('title','') for v in vals], max_kws=6)}",
            "harm_subtype": vals[0].get("harm_subtype", "Other"),
        }
        signals.append(signal)
    signals.sort(key=lambda x: x.get("last_seen", 0), reverse=True)
    return signals


def build_coverage(harms):
    by_harm = {}
    for it in harms:
        c = it.get("category", "Cross-cutting / unassigned")
        by_harm.setdefault(c, {"count": 0, "uk_count": 0})
        by_harm[c]["count"] += 1
        if it.get("uk_relevance"):
            by_harm[c]["uk_count"] += 1
    return {"by_harm": by_harm}


def build_summaries(harms):
    grouped = defaultdict(list)
    for it in harms:
        grouped[it.get("category", "Cross-cutting / unassigned")].append(it)
    harm_summaries = {}
    for cat, vals in grouped.items():
        subtype_counts = Counter(v.get("harm_subtype", "Other") for v in vals)
        top_bits = ", ".join([f"{k} ({v})" for k, v in subtype_counts.most_common(3)])
        uk_n = sum(1 for v in vals if v.get("uk_relevance"))
        harm_summaries[cat] = f"{len(vals)} harms item(s), {uk_n} UK-relevant. Main subtypes: {top_bits}."
    return {"harms_by_category": harm_summaries}


def run():
    harm_queries = load_json_if_exists(os.path.join(BASE_DIR, "harm_queries.json"), DEFAULT_HARM_QUERIES)
    forum_feeds = load_json_if_exists(os.path.join(BASE_DIR, "forum_feeds.json"), DEFAULT_FORUM_FEEDS)

    harms, harm_errors = build_harm_items(harm_queries)
    forums, forum_errors = build_forum_items(harm_queries, forum_feeds)
    releases = build_release_items()
    signals = cluster_to_signals(harms + forums)

    payload = {
        "last_updated": now_iso(),
        "disclaimer": "Automated horizon-scanning prototype. Items indicate emerging discussion, not verified risk, intent, or prevalence.",
        "meta": {
            "limits": {
                "TIME_WINDOW": TIME_WINDOW,
                "RELEASE_TIME_WINDOW": RELEASE_TIME_WINDOW,
                "MAX_PER_HARM": MAX_PER_HARM,
                "MAX_RELEASES": MAX_RELEASES,
                "MAX_FORUM_ITEMS": MAX_FORUM_ITEMS,
                "SIGNAL_SIM_THRESHOLD": SIGNAL_SIM_THRESHOLD,
            },
            "dedupe_mode": DEDUP_MODE,
            "taxonomy_version": "ho_owned_risk_areas_v3_no_ra10",
            "taxonomy_note": "Visible top-level categories use only current HO-owned risk areas from the current HO-owned sheet (RA09, RA11, RA13, RA14) plus Cross-cutting / unassigned.",
            "errors": {**harm_errors, **forum_errors},
        },
        "sections": {
            "harms": harms,
            "signals": signals,
            "forums": forums,
            "dev_releases": releases,
        },
        "coverage": build_coverage(harms),
        "summaries": build_summaries(harms),
    }

    out_path = os.path.join(BASE_DIR, "news_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    run()
``
import os
import re
import time
import hashlib
from collections import Counter, defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus, urlparse, parse_qsl, urlencode, urlunparse

import feedparser
import requests

BASE_DIR = os.path.dirname(__file__)

# ---------- DEFAULTS ----------
DEFAULT_HARM_QUERIES = {
    "RA09 – AI use in financial crime, fraud and exploitation": (
        "AI scam OR AI fraud OR AI phishing OR voice cloning scam OR AI impersonation "
        "OR AI money laundering OR mule recruitment"
    ),
    "RA11 – AI Use for Sexual Crime and Abuse": (
        "deepfake abuse OR image-based abuse OR NCII OR non-consensual intimate imagery OR AI harassment "
        "OR AI stalking OR AI sextortion OR AI grooming OR AI-generated child abuse material OR CSAM AI"
    ),
    "RA13 – AI use in terrorism": (
        "AI extremism OR AI radicalisation OR synthetic propaganda OR extremist chatbot "
        "OR terrorist recruitment AI OR terrorist attack planning AI"
    ),
    "RA14 – AI increases illegal item creation and acquisition": (
        "AI weapons OR AI drugs OR AI crime instructions OR AI malware OR LLM exploit OR prompt injection "
        "OR jailbreak OR ransomware AI OR dark web AI OR counterfeit goods AI"
    ),
    "Cross-cutting / unassigned": (
        "AI violence OR AI-enabled crime OR false evidence AI OR liar's dividend OR fake identity documents AI "
        "OR border exploitation AI OR immigration abuse chatbot"
    ),
}

DEFAULT_FORUM_FEEDS = [
