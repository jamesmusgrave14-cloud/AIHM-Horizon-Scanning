import feedparserengineering/new/.rss", "tags": ["forum", "reddit", "fraud"]},
    {"name": "Reddit: netsec (new)", "url": "https://old.reddit.com/r/netsec/new/.rss", "tags": ["forum", "reddit", "cyber"]},
    {"name": "Reddit: cybersecurity (new)", "url": "https://old.reddit.com/r/cybersecurity/new/.rss", "tags": ["forum", "reddit", "cyber"]},
    {"name": "Reddit: malware (new)", "url": "https://old.reddit.com/r/Malware/new/.rss", "tags": ["forum", "reddit", "cyber"]},
    {"name": "HN: phishing/scams", "url": "https://hnrss.org/newest?q=phishing+OR+scam+OR+fraud", "tags": ["forum", "hn", "fraud"]},
    {"name": "HN: prompt injection/jailbreak", "url": "https://hnrss.org/newest?q=prompt+injection+OR+jailbreak", "tags": ["forum", "hn", "cyber"]},
    {"name": "HN: malware/exploit", "url": "https://hnrss.org/newest?q=malware+OR+exploit+OR+vulnerability", "tags": ["forum", "hn", "cyber"]},
]

# ---------- SETTINGS ----------

LOCALE_HL = os.getenv("NEWS_HL", "en-GB")
LOCALE_GL = os.getenv("NEWS_GL", "GB")
LOCALE_CEID = os.getenv("NEWS_CEID", "GB:en")

TIME_WINDOW = os.getenv("TIME_WINDOW", "7d")

# Releases are rare -> longer window is sane
RELEASE_TIME_WINDOW = os.getenv("RELEASE_TIME_WINDOW", "365d")

MAX_PER_HARM = int(os.getenv("MAX_PER_HARM", "25"))
MAX_RELEASES = int(os.getenv("MAX_RELEASES", "50"))
MAX_FORUM_ITEMS = int(os.getenv("MAX_FORUM_ITEMS", "30"))

SIGNAL_SIM_THRESHOLD = float(os.getenv("SIGNAL_SIM_THRESHOLD", "0.86"))

# Dedupe strategy label for UI debug
DEDUPE_MODE = os.getenv("DEDUPE_MODE", "title_fingerprint_v4_policy_filtered")

# Optional: true LLM summary (keep empty for deterministic-only)
SUMMARY_OPENAI_API_KEY = os.getenv("SUMMARY_OPENAI_API_KEY", "").strip()
SUMMARY_OPENAI_MODEL = os.getenv("SUMMARY_OPENAI_MODEL", "gpt-4.1-mini").strip()

# Sources for releases
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
    "said","says","also","only","some","most","very","much","onto"
}

HARM_CATEGORIES = set(DEFAULT_HARM_QUERIES.keys())

# Release-only filters (tighten to "new model releases", avoid funding/partnership noise)
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

# UK prioritisation keywords (simple heuristic)
UK_TOKENS = [
    " uk ", " united kingdom ", " britain ", " british ", " england ", " scotland ", " wales ",
    " northern ireland ", " nhs ", " nca ", " metropolitan police ", " met police ", " home office ",
    " ofcom ", " ico ", " cps ", " crown prosecution ", " westminster ", " parliament "
]

# Policy / LE / national security relevance
POLICY_TOKENS = [
    "home office", "law enforcement", "police", "national crime agency", "nca", "ncsc", "ofcom", "ico",
    "cps", "crown prosecution", "border force", "government", "minister", "parliament", "regulation",
    "regulator", "policy", "national security", "security", "terrorism", "extremism", "radicalisation",
    "fraud", "phishing", "scam", "money laundering", "ransomware", "malware", "cybercrime", "cyber attack",
    "grooming", "harassment", "stalking", "abuse", "child abuse material", "exploitation",
    "weapons", "firearms", "drugs", "false evidence", "identity documents", "public safety",
    "court", "prosecution", "investigation", "criminal", "offender", "violent", "deepfake"
]

POLICY_SOURCE_TOKENS = [
    "bbc", "reuters", "ap", "associated press", "financial times", "the guardian", "telegraph",
    "gov.uk", "europol", "interpol", "nca", "ncsc", "ofcom", "ico", "home office",
    "therecord", "recorded future", "bellingcat"
]

# Things you explicitly do NOT want
COMMERCIAL_TITLE_PATTERNS = [
    "top ", "best ", "tool ", "tools ", "software ", "platform ", "platforms ",
    "pricing", "features", "review", "reviews", "comparison", "compare", "buyer guide",
    "buyer's guide", "for seo", "seo agencies", "seo agency", "seo tool", "marketing tool",
    "marketing tools", "for marketers", "growth hacking", "content marketing", "crm",
    "productivity", "saas", "startup", "agency", "agencies", "ecommerce", "e commerce",
    "visibility tools", "keyword tool", "social media scheduler", "email marketing",
    "ppc", "affiliate", "how to choose", "flexible pricing", "powerful features"
]

COMMERCIAL_SOURCE_TOKENS = [
    "businesscloud", "martech", "search engine journal", "search engine land",
    "techradar pro", "venturebeat", "product hunt", "g2", "capterra"
]

# If a title contains these, it is likely genuinely in scope even if some commercial-ish words appear
HARD_HARM_TOKENS = [
    "fraud", "phishing", "money laundering", "terrorism", "extremism", "radicalisation",
    "grooming", "stalking", "harassment", "abuse", "child abuse material",
    "ransomware", "malware", "jailbreak", "prompt injection", "weapons", "firearms",
    "drugs", "crime instructions", "false evidence", "identity documents", "deepfake"
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
    Reduce URL uniqueness (helps dedupe Google News redirects):
    - removes utm_ params
    - if query has ?url=<real>, return that
    """
    if not url:
        return ""
    try:
        p = urlparse(url)
        qs = [(k, v) for (k, v) in parse_qsl(p.query, keep_blank_values=True) if not k.lower().startswith("utm_")]
        qsd = dict(qs)
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


def summarize_list(titles, max_kws=7):
    joined = " ".join(titles[:30])
    kws = extract_keywords(joined, max_words=max_kws)
    if not kws:
        return "No clear recurring themes detected."
    return "Recurring themes: " + ", ".join(kws) + "."


def looks_like_release(title):
    t = (title or "").lower()
    if any(x in t for x in RELEASE_EXCLUDE):
        return False
    return any(x in t for x in RELEASE_INCLUDE)


def uk_score_for_item(title, link, source):
    t = f" {norm_text(title)} "
    s = f" {norm_text(source)} "
    u = (link or "").lower()
    score = 0

    for tok in UK_TOKENS:
        if tok in t:
            score += 2
        if tok in s:
            score += 1

    if ".uk/" in u or u.endswith(".uk"):
        score += 2

    return score


def policy_score_for_item(title, link, source):
    t = f" {norm_text(title)} "
    s = f" {norm_text(source)} "
    u = (link or "").lower()
    score = 0

    for tok in POLICY_TOKENS:
        tok_n = f" {norm_text(tok)} "
        if tok_n in t:
            score += 2
        if tok_n in s:
            score += 1

    for tok in POLICY_SOURCE_TOKENS:
        tok_n = norm_text(tok)
        if tok_n in s:
            score += 2
        if tok_n in u:
            score += 2

    if ".gov.uk" in u or "gov.uk/" in u:
        score += 3

    return score


def is_low_value_commercial(title, link, source):
    t = f" {norm_text(title)} "
    s = f" {norm_text(source)} "
    u = (link or "").lower()

    commercial_hits = 0
    for pat in COMMERCIAL_TITLE_PATTERNS:
        pat_n = f" {norm_text(pat)} "
        if pat_n in t:
            commercial_hits += 1

    for pat in COMMERCIAL_SOURCE_TOKENS:
        pat_n = norm_text(pat)
        if pat_n in s or pat_n in u:
            commercial_hits += 1

    hard_harm_hits = 0
    for tok in HARD_HARM_TOKENS:
        tok_n = f" {norm_text(tok)} "
        if tok_n in t:
            hard_harm_hits += 1

    # Reject if it looks clearly like a product / SEO / martech article
    # and does not contain strong harm / security content
    if commercial_hits >= 2 and hard_harm_hits == 0:
        return True

    if commercial_hits >= 1 and hard_harm_hits == 0 and (
        " seo " in t or
        " marketers " in t or
        " agencies " in t or
        " agency " in t or
        " pricing " in t or
        " features " in t
    ):
        return True

    return False


def passes_editorial_relevance(title, link, source, rel, uk_score, policy_score, category):
    """
    Gate to keep only items that are meaningfully relevant to:
    - the harm query, and/or
    - policy / national security / law enforcement.
    """
    if is_low_value_commercial(title, link, source):
        return False

    title_n = norm_text(title)

    # Always keep very strong policy / LE / natsec relevance
    if policy_score >= 3:
        return True

    # Strong direct query match
    if rel >= 2:
        return True

    # UK + some policy relevance
    if uk_score >= 2 and policy_score >= 1:
        return True

    # Category-specific fallbacks
    if category == "Fraud" and any(x in title_n for x in ["fraud", "scam", "phishing", "impersonation", "money laundering"]):
        return True
    if category == "Cyber" and any(x in title_n for x in ["malware", "ransomware", "jailbreak", "prompt injection", "exploit", "cyber"]):
        return True
    if category == "Terrorism" and any(x in title_n for x in ["terror", "extrem", "radical", "propaganda", "attack planning"]):
        return True
    if category == "VAWG" and any(x in title_n for x in ["stalking", "harassment", "deepfake abuse", "synthetic image", "coercion"]):
        return True
    if category == "CSAM" and any(x in title_n for x in ["child abuse material", "grooming", "child exploitation", "csam"]):
        return True
    if category == "Other" and any(x in title_n for x in ["weapons", "drugs", "crime instructions", "false evidence", "identity documents"]):
        return True

    return False


def derive_mechanism(title):
    t = norm_text(title)

    if any(x in t for x in [
        "deepfake", "synthetic", "voice clone", "voice cloning", "fake image", "fake video",
        "fake audio", "impersonation", "synthetic image"
    ]):
        return "Synthetic media / realistic fake"

    if any(x in t for x in [
        "bot", "bots", "automation", "automated", "at scale", "mass", "bulk", "industrial scale"
    ]):
        return "Automation / scale"

    if any(x in t for x in [
        "targeting", "targeted", "micro targeting", "micro-targeting", "personalised",
        "personalized", "hyper targeting", "hyper-targeting"
    ]):
        return "Targeting / personalisation"

    if any(x in t for x in [
        "jailbreak", "prompt injection", "bypass", "evade detection", "wormgpt", "fraudgpt"
    ]):
        return "Model misuse / evasion"

    if any(x in t for x in [
        "instructions", "guidance", "planning", "preparation", "grooming", "phishing", "ransomware"
    ]):
        return "Offender capability uplift"

    return "Other / mixed"


def derive_subtype(title, category):
    t = norm_text(title)

    if any(x in t for x in ["fraud", "scam", "money laundering", "phishing", "impersonation", "voice clone"]):
        return "Fraud / scams / impersonation"

    if any(x in t for x in ["grooming", "exploitation", "coercion", "sextortion"]):
        return "Grooming / exploitation / coercion"

    if any(x in t for x in ["synthetic image", "deepfake abuse", "image abuse"]):
        return "Synthetic-image abuse"

    if any(x in t for x in ["stalking", "harassment", "audio abuse"]):
        return "Stalking / harassment / coercion"

    if any(x in t for x in ["terrorist", "extremist", "radicalisation", "radicalization", "propaganda", "recruitment"]):
        return "Propaganda / radicalisation / recruitment"

    if any(x in t for x in ["attack planning", "attack preparation", "crime instructions", "weapon", "explosive"]):
        return "Attack planning / operational guidance"

    if any(x in t for x in ["drugs", "firearms", "weapons", "illicit items", "dark web"]):
        return "Illegal items / drugs / firearms"

    if any(x in t for x in ["ransomware", "malware", "jailbreak", "prompt injection", "exploit"]):
        return "Cyber / phishing / ransomware enablement"

    if any(x in t for x in ["false evidence", "identity documents", "court", "bank statements", "birth certificates"]):
        return "False evidence / false documents / identity abuse"

    # fallback from current category names
    if category == "Fraud":
        return "Fraud / scams / impersonation"
    if category == "Cyber":
        return "Cyber / phishing / ransomware enablement"
    if category == "Terrorism":
        return "Propaganda / radicalisation / recruitment"
    if category == "VAWG":
        return "Stalking / harassment / coercion"
    if category == "CSAM":
        return "Grooming / exploitation / coercion"

    return "Other"


def assign_harm_category_from_text(title, harm_query_map):
    """
    Assign a harm category to a forum item by checking overlap with that category's keywords.
    Uses the harm_queries.json terms -> keywords.
    """
    t = norm_text(title)
    best_cat = None
    best = 0
    for cat, q in harm_query_map.items():
        kws = query_keywords(q)
        score = 0
        for kw in kws:
            if kw in t:
                score += 1
        if score > best:
            best = score
            best_cat = cat
    if best_cat and best >= 2:
        return best_cat, best
    return None, 0


def summarize_signal(signal):
    tags = signal.get("tags") or []
    src_count = int(signal.get("source_count") or 0)
    links = signal.get("links") or []
    joined = " ".join([(l.get("title") or "") for l in links[:6]])
    kws = extract_keywords(joined)
    primary = signal.get("primary_category") or (tags[0] if tags else "Other")
    subtype = signal.get("harm_subtype") or ""
    if kws and subtype:
        return f"{primary}: {subtype.lower()}. Recurring themes include {', '.join(kws)} ({src_count} sources)."
    if kws:
        return f"{primary}: recurring themes include {', '.join(kws)} ({src_count} sources)."
    return f"{primary}: clustered coverage detected ({src_count} sources)."


def cluster_to_signals(items, threshold=SIGNAL_SIM_THRESHOLD):
    clusters = []
    for it in items:
        title_key = fingerprint_title(it.get("title", ""))
        if not title_key:
            continue
        primary = it.get("primary_category") or it.get("category") or "Other"
        cluster_key = f"{primary}::{title_key}"

        placed = False
        for c in clusters:
            if similar(cluster_key, c["key"]) >= threshold:
                c["items"].append(it)
                c["sources"].add(it.get("source", ""))
                c["tags"].update(it.get("tags", []))
                c["last_seen"] = max(c["last_seen"], it.get("timestamp", 0))
                c["first_seen"] = min(c["first_seen"], it.get("timestamp", 0))
                placed = True
                break

        if not placed:
            clusters.append({
                "key": cluster_key,
                "items": [it],
                "sources": set([it.get("source", "")]),
                "tags": set(it.get("tags", [])),
                "first_seen": it.get("timestamp", 0),
                "last_seen": it.get("timestamp", 0),
            })

    signals = []
    for c in clusters:
        items_sorted = sorted(c["items"], key=lambda x: x.get("timestamp", 0), reverse=True)
        tags_sorted = sorted([t for t in c["tags"] if t])
        primary = items_sorted[0].get("primary_category") or items_sorted[0].get("category") or "Other"
        source_count = len([s for s in c["sources"] if s])

        signal = {
            "signal_id": stable_id(c["key"]),
            "title": items_sorted[0].get("title"),
            "primary_category": primary,
            "mechanism": items_sorted[0].get("mechanism", "Other / mixed"),
            "harm_subtype": items_sorted[0].get("harm_subtype", "Other"),
            "tags": tags_sorted if tags_sorted else ([primary] if primary else []),
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
                    "mechanism": x.get("mechanism", "Other / mixed"),
                    "harm_subtype": x.get("harm_subtype", "Other"),
                    "uk_score": x.get("uk_score", 0),
                }
                for x in items_sorted[:8]
            ],
        }

        confidence = min(1.0, (source_count / 5.0) + (len(items_sorted) / 18.0))
        signal["confidence"] = round(confidence, 3)
        signal["confidence_label"] = "High" if confidence > 0.8 else "Medium" if confidence > 0.4 else "Low"
        signal["ai_summary"] = summarize_signal(signal)
        signals.append(signal)

    signals.sort(key=lambda s: (s.get("last_seen", 0), s.get("source_count", 0), s.get("cluster_size", 0)), reverse=True)
    return signals


def openai_summarise(prompt):
    """
    Optional true LLM summary via OpenAI API. Only used if SUMMARY_OPENAI_API_KEY is set.
    Safe: if it fails, we fall back to deterministic summaries.
    """
    if not SUMMARY_OPENAI_API_KEY:
        return None
    try:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {SUMMARY_OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": SUMMARY_OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": "You are a concise analyst. Summarise strictly from provided titles. Avoid speculation."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 180,
        }
        r = requests.post(url, headers=headers, json=payload, timeout=25)
        r.raise_for_status()
        data = r.json()
        return (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip() or None
    except Exception:
        return None


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
                "MAX_PER_HARM": MAX_PER_HARM,
                "MAX_RELEASES": MAX_RELEASES,
                "MAX_FORUM_ITEMS": MAX_FORUM_ITEMS,
                "SIGNAL_SIM_THRESHOLD": SIGNAL_SIM_THRESHOLD,
            },
            "dedupe_mode": DEDUPE_MODE,
        },
        "sections": {
            "harms": [],
            "signals": [],
            "forums": [],
            "dev_releases": [],
        },
        "coverage": {"by_harm": {}},
        "summaries": {
            "harms_by_category": {},
            "signals_top": "",
            "releases_top": "",
        }
    }

    # 1) HARMS (Google News RSS, UK-prioritised sorting + policy filter)
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

                uk_score = uk_score_for_item(title, link, src or "")
                policy_score = policy_score_for_item(title, link, src or "")
                rel = relevance_score(title, kws)

                if not passes_editorial_relevance(
                    title=title,
                    link=link,
                    source=src or "",
                    rel=rel,
                    uk_score=uk_score,
                    policy_score=policy_score,
                    category=cat,
                ):
                    continue

                item = {
                    "category": cat,
                    "primary_category": cat,
                    "mechanism": derive_mechanism(title),
                    "harm_subtype": derive_subtype(title, cat),
                    "title": title,
                    "link": link,
                    "source": src or "News",
                    "timestamp": dt.timestamp(),
                    "date": published,
                    "source_type": "news",
                    "tags": [cat],
                    "relevance_score": rel,
                    "policy_score": policy_score,
                    "uk_score": uk_score,
                    "uk_relevance": True if uk_score >= 2 else False,
                }
                raw_harm_items.append(item)
        except Exception as ex:
            errors[f"harms:{cat}"] = str(ex)

    raw_harm_items = dedupe_by_key(
        raw_harm_items,
        lambda x: f"{x.get('category')}|{fingerprint_title(x.get('title'))}"
    )

    raw_harm_items.sort(
        key=lambda x: (
            x.get("policy_score", 0),
            x.get("uk_score", 0),
            x.get("relevance_score", 0),
            x.get("timestamp", 0),
        ),
        reverse=True
    )

    report["sections"]["harms"] = [
        {
            "category": x["category"],
            "primary_category": x["primary_category"],
            "mechanism": x["mechanism"],
            "harm_subtype": x["harm_subtype"],
            "title": x["title"],
            "link": x["link"],
            "source": x["source"],
            "timestamp": x["timestamp"],
            "date": x["date"],
            "relevance_score": x["relevance_score"],
            "policy_score": x["policy_score"],
            "uk_score": x["uk_score"],
            "uk_relevance": x["uk_relevance"],
        }
        for x in raw_harm_items
    ]

    cov = {}
    for it in report["sections"]["harms"]:
        c = it.get("category", "Other")
        cov.setdefault(c, {"count": 0, "uk_count": 0, "last_seen": None})
        cov[c]["count"] += 1
        if it.get("uk_relevance"):
            cov[c]["uk_count"] += 1
        cov[c]["last_seen"] = max(cov[c]["last_seen"] or 0, it.get("timestamp", 0))
    report["coverage"]["by_harm"] = cov

    for cat in harm_queries.keys():
        titles = [h["title"] for h in report["sections"]["harms"] if h["category"] == cat]
        report["summaries"]["harms_by_category"][cat] = summarize_list(titles)

    if SUMMARY_OPENAI_API_KEY:
        try:
            top3 = sorted(cov.items(), key=lambda kv: kv[1]["count"], reverse=True)[:3]
            for cat, _ in top3:
                titles = [h["title"] for h in report["sections"]["harms"] if h["category"] == cat][:20]
                prompt = f"Summarise these headlines into 2 sentences for a policy audience. Category: {cat}\n- " + "\n- ".join(titles)
                llm = openai_summarise(prompt)
                if llm:
                    report["summaries"]["harms_by_category"][cat] = llm
        except Exception:
            pass

    # 2) FORUMS (harms-tagged only + policy filter)
    raw_forum_items = []
    try:
        for f in forum_feeds:
            name = f.get("name", "Forum")
            url = ensure_old_reddit((f.get("url") or "").strip())
            base_tags = f.get("tags", ["forum"])
            if not url:
                continue

            feed = fetch_feed(url, retries=4, base_sleep=1.0)
            for e in feed.entries[:MAX_FORUM_ITEMS]:
                title = strip_source_suffix(getattr(e, "title", "")) or getattr(e, "title", "")
                published = getattr(e, "published", "") or getattr(e, "updated", "")
                dt = parse_date(published)
                link = clean_url(getattr(e, "link", ""))

                cat, score = assign_harm_category_from_text(title, harm_queries)
                if not cat:
                    continue

                uk_score = uk_score_for_item(title, link, name)
                policy_score = policy_score_for_item(title, link, name)

                if not passes_editorial_relevance(
                    title=title,
                    link=link,
                    source=name,
                    rel=score,
                    uk_score=uk_score,
                    policy_score=policy_score,
                    category=cat,
                ):
                    continue

                item = {
                    "category": cat,
                    "primary_category": cat,
                    "mechanism": derive_mechanism(title),
                    "harm_subtype": derive_subtype(title, cat),
                    "title": title,
                    "link": link,
                    "source": name,
                    "timestamp": dt.timestamp(),
                    "date": published,
                    "source_type": "forum",
                    "tags": list(set(base_tags + [cat])),
                    "uk_score": uk_score,
                    "policy_score": policy_score,
                    "uk_relevance": True if uk_score >= 2 else False,
                    "forum_match_score": score,
                }
                raw_forum_items.append(item)

    except Exception as ex:
        errors["forums"] = str(ex)

    raw_forum_items = dedupe_by_key(raw_forum_items, lambda x: f"{x.get('category')}|{fingerprint_title(x.get('title'))}")
    raw_forum_items.sort(
        key=lambda x: (
            x.get("policy_score", 0),
            x.get("uk_score", 0),
            x.get("forum_match_score", 0),
            x.get("timestamp", 0),
        ),
        reverse=True
    )

    report["sections"]["forums"] = [
        {
            "category": x["category"],
            "primary_category": x["primary_category"],
            "mechanism": x["mechanism"],
            "harm_subtype": x["harm_subtype"],
            "title": x["title"],
            "link": x["link"],
            "source": x["source"],
            "timestamp": x["timestamp"],
            "date": x["date"],
            "tags": x["tags"],
            "source_type": "forum",
            "policy_score": x["policy_score"],
            "uk_score": x["uk_score"],
            "uk_relevance": x["uk_relevance"],
        }
        for x in raw_forum_items
    ]

    # 3) MODEL RELEASES
    raw_release_items = []

    def ingest_release_feed(feed_url, source_label):
        out = []
        feed = fetch_feed(feed_url, retries=3, base_sleep=1.0)
        for e in feed.entries[:MAX_RELEASES]:
            title = strip_source_suffix(getattr(e, "title", "")) or getattr(e, "title", "")
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
                "source": source_label,
                "timestamp": dt.timestamp(),
                "date": published,
                "source_type": "news",
                "tags": ["Model Releases"],
            })
        return out

    try:
        raw_release_items.extend(ingest_release_feed(OPENAI_NEWS_RSS, "OpenAI"))
    except Exception as ex:
        errors["dev_releases_openai_rss"] = str(ex)

    try:
        raw_release_items.extend(ingest_release_feed(RUNDOWN_RSS, "The Rundown AI"))
    except Exception as ex:
        errors["dev_releases_rundown_rss"] = str(ex)

    try:
        q = "new model released OR introducing model OR system card OR model card OR open weights"
        feed = fetch_feed(google_rss_url(q, RELEASE_TIME_WINDOW), retries=3, base_sleep=1.0)
        for e in feed.entries[:MAX_RELEASES]:
            title = strip_source_suffix(getattr(e, "title", ""))
            if not looks_like_release(title):
                continue
            published = getattr(e, "published", "")
            dt = parse_date(published)
            src = None
            if hasattr(e, "source"):
                src = getattr(getattr(e, "source", None), "title", None)
            link = clean_url(getattr(e, "link", ""))
            raw_release_items.append({
                "title": title,
                "link": link,
                "source": src or "News",
                "timestamp": dt.timestamp(),
                "date": published,
                "source_type": "news",
                "tags": ["Model Releases"],
            })
    except Exception as ex:
        errors["dev_releases_google"] = str(ex)

    raw_release_items = dedupe_by_key(raw_release_items, lambda x: fingerprint_title(x.get("title")))
    raw_release_items.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    report["sections"]["dev_releases"] = [
        {
            "title": x["title"],
            "link": x["link"],
            "source": x["source"],
            "timestamp": x["timestamp"],
            "date": x["date"],
        }
        for x in raw_release_items[:MAX_RELEASES]
    ]

    report["summaries"]["releases_top"] = summarize_list([r["title"] for r in report["sections"]["dev_releases"]])

    if SUMMARY_OPENAI_API_KEY and report["sections"]["dev_releases"]:
        titles = [r["title"] for r in report["sections"]["dev_releases"]][:20]
        prompt = "Summarise the following model release headlines into 3 bullet points for a policy audience:\n- " + "\n- ".join(titles)
        llm = openai_summarise(prompt)
        if llm:
            report["summaries"]["releases_top"] = llm

    # 4) SIGNALS
    all_for_signals = []
    all_for_signals.extend(raw_harm_items)
    all_for_signals.extend(raw_forum_items)

    for r in raw_release_items:
        all_for_signals.append({
            "category": "Model Releases",
            "primary_category": "Model Releases",
            "mechanism": "Other / mixed",
            "harm_subtype": "Other",
            "title": r["title"],
            "link": r["link"],
            "source": r["source"],
            "timestamp": r["timestamp"],
            "date": r["date"],
            "source_type": "news",
            "tags": ["Model Releases"],
            "uk_score": 0,
        })

    all_for_signals = dedupe_by_key(
        all_for_signals,
        lambda x: f"{x.get('category','')}|{fingerprint_title(x.get('title'))}|{norm_text(x.get('source'))}"
    )

    report["sections"]["signals"] = cluster_to_signals(all_for_signals)

    report["summaries"]["signals_top"] = summarize_list([s["title"] for s in report["sections"]["signals"]])

    if SUMMARY_OPENAI_API_KEY and report["sections"]["signals"]:
        titles = [s["title"] for s in report["sections"]["signals"]][:15]
        prompt = "Summarise these signal titles into 3 short bullets. Focus on harms/misuse patterns, not hype:\n- " + "\n- ".join(titles)
        llm = openai_summarise(prompt)
        if llm:
            report["summaries"]["signals_top"] = llm

    if errors:
        report["meta"]["errors"] = errors

    os.makedirs("public", exist_ok=True)
    with open("public/news_data.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    run()
``
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
    "Fraud": "AI fraud OR AI phishing OR voice cloning scam OR deepfake impersonation fraud OR AI money laundering",
    "Cyber": "AI malware OR AI ransomware OR LLM exploit OR prompt injection OR jailbreak",
    "Terrorism": "AI extremism OR AI radicalisation OR synthetic propaganda OR AI terrorist recruitment OR AI attack planning",
    "VAWG": "AI stalking OR AI harassment OR deepfake abuse OR synthetic-image abuse",
    "CSAM": "AI-generated child abuse material OR AI grooming OR CSAM AI",
    "Other": "AI weapons OR AI drugs OR AI crime instructions OR AI false evidence OR AI identity documents",
}

# Forums: deliberately harms-adjacent only (avoid generic AI subs)
DEFAULT_FORUM_FEEDS = [
    {"name": "Reddit: scams (new)", "url": "https://old.reddit.com/r/Scams/new/.rss", "tags": ["forum", "reddit", "fraud"]},
