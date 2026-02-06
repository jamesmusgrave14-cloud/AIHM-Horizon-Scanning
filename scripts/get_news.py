# get_news.py (schema v2.2)
import feedparser
import json
import os
import re
import time
import hashlib
import requests
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

USER_AGENT = os.getenv("HS_USER_AGENT", "HO-AIHM-HorizonScan/2.2 (+contact)")
OUT_DIR = "public"
OUT_JSON = os.path.join(OUT_DIR, "news_data.json")
OUT_DIGEST = os.path.join(OUT_DIR, "weekly_digest.md")

# -------------------------
# 0) Sources
# -------------------------
# Core Google News RSS (broad)
GOOGLE_NEWS_RSS = {
    "harms": "https://news.google.com/rss/search?q=AI+(harm+OR+incident+OR+abuse+OR+scam+OR+fraud+OR+voice+cloning+OR+deepfake+OR+nudify+OR+jailbreak+OR+prompt+injection)+-stock&hl=en-GB&gl=GB&ceid=GB:en",
    "models": "https://news.google.com/rss/search?q=(model+card+OR+system+card+OR+technical+report+OR+safety+report+OR+evals+OR+benchmark)+AND+(AI+OR+frontier+model)+-price&hl=en-GB&gl=GB&ceid=GB:en",
    "watchdogs": "https://news.google.com/rss/search?q=(AI+Safety+Institute+OR+AISI+OR+Ofcom+OR+ICO+OR+CMA)+AND+(AI+OR+foundation+model)&hl=en-GB&gl=GB&ceid=GB:en",
}

# Targeted “site:” fallbacks to match your plan’s source list. [6](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
# (Use Google News RSS because many of these sites don't expose RSS consistently.)
SITE_SCOPED = {
    "uk_regulators": [
        ("ICO (site)", "site:ico.org.uk (AI OR Grok OR agentic OR deepfake OR synthetic)"),
        ("Ofcom (site)", "site:ofcom.org.uk (AI OR deepfake OR synthetic OR online safety)"),
        ("CMA (site)", "site:gov.uk/cma (AI OR foundation model)"),
    ],
    "uk_research_policy": [
        ("CETaS (site)", "site:cetas.turing.ac.uk (AI OR deepfake OR disinformation OR cybersecurity OR agents)"),
        ("Ada Lovelace (site)", "site:adalovelaceinstitute.org (AI OR agents OR harms OR governance)"),
        ("NSSIF (site)", "site:nssif.gov.uk (AI OR disinformation OR privacy OR security)"),
        ("OII (site)", "site:oii.ox.ac.uk (AI OR ChatGPT OR online safety OR inequality)"),
        ("Oxford Ethics in AI (site)", "site:oxford-aiethics.ox.ac.uk (AI OR elections OR rights OR agency)"),
        ("IWF (site)", "site:iwf.org.uk (AI OR nudification OR child sexual abuse OR CSAM)"),
        ("UCL Dawes (site)", "site:ucl.ac.uk/engineering/future-crime (AI OR future crime OR fraud OR deepfake)"),
    ]
}

# Reddit via RSS to avoid brittle unauth JSON access. [4](https://cetas.turing.ac.uk/cetas-news)[5](https://cetas.turing.ac.uk/about/cetas-network)
REDDIT_RSS = [
    ("netsec", "https://www.reddit.com/r/netsec/new/.rss"),
    ("artificial", "https://www.reddit.com/r/artificial/new/.rss"),
    ("openai", "https://www.reddit.com/r/openai/new/.rss"),
]

# -------------------------
# 1) Helpers: time + URL
# -------------------------
def utcnow():
    return datetime.now(timezone.utc)

def utcnow_iso():
    return utcnow().isoformat().replace("+00:00", "Z")

def parse_entry_datetime(entry) -> str:
    for key in ("published", "updated"):
        if key in entry and entry[key]:
            try:
                dt = parsedate_to_datetime(entry[key])
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            except Exception:
                pass
    for key in ("published_parsed", "updated_parsed"):
        if key in entry and entry[key]:
            try:
                dt = datetime(*entry[key][:6], tzinfo=timezone.utc)
                return dt.isoformat().replace("+00:00", "Z")
            except Exception:
                pass
    return utcnow_iso()

def canonicalize_url(url: str) -> str:
    try:
        p = urlparse(url)
        query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
                 if k.lower() not in {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"}]
        new_query = urlencode(query, doseq=True)
        return urlunparse((p.scheme, p.netloc, p.path, p.params, new_query, p.fragment))
    except Exception:
        return url

def normalize_title(s: str) -> str:
    s = re.sub(r"\s+", " ", (s or "")).strip()
    s = re.sub(r"\s-\s.*$", "", s)  # strip common " - Outlet" suffix
    return s

def stable_id(title: str, url: str) -> str:
    base = (normalize_title(title).lower() + "|" + canonicalize_url(url).lower()).encode("utf-8")
    return hashlib.sha256(base).hexdigest()[:16]

# -------------------------
# 2) Classifiers: HO horizon scanning lens
# -------------------------
# Threat tier framing grounded in your governance material. [1](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7BF86793D9-8116-465D-8FCB-933F42F6C059%7D&file=101125%20-%20Nov%20AIHM%20research%20overview.docx&action=default&mobileredirect=true&DefaultItemOpen=1)
RISK_RULES = [
    # Well-established harms: CSAM/NCII/VAWG (Now)
    {"tag":"CSEA/NCII/VAWG","priority":"High","time_horizon":"Now","workstreams":["PSG"],
     "terms":["csam","csea","child sexual","ncii","nudify","nudification","undressing","sexual extortion","vawg","non-consensual intimate"]},
    # Fraud/FIN (Now)
    {"tag":"FRAUD/FIN","priority":"High","time_horizon":"Now","workstreams":["PSG"],
     "terms":["scam","fraud","money laundering","aml","vishing","voice cloning","impersonation","authorised push payment","bank transfer"]},
    # Cyber / exploit / jailbreak (Now)
    {"tag":"CYBER/EXPLOIT","priority":"High","time_horizon":"Now","workstreams":["HSG","PSG"],
     "terms":["jailbreak","prompt injection","exploit","malware","phishing","credential","leak","ransomware","model extraction"]},
    # Terrorism / extremism & synthetic media (Short-term emerging)
    {"tag":"CT/EXTREMISM","priority":"High","time_horizon":"Short-term emerging","workstreams":["HSG"],
     "terms":["terror","isis","extrem","radical","propaganda","synthetic media","deepfake video","deepfake audio"]},
    # Evidence manipulation / justice / immigration (Short-term emerging)
    {"tag":"EVIDENCE/INTEGRITY","priority":"High","time_horizon":"Short-term emerging","workstreams":["PSG","M&B"],
     "terms":["evidence","court","forensic","chain of custody","immigration","border","asylum","document fraud","identity document"]},
    # Agentic AI + convergence (Longer-term uncertain)
    {"tag":"AGENTS/CONVERGENCE","priority":"Medium","time_horizon":"Longer-term uncertain","workstreams":["HSG","PSG","M&B","AIHM"],
     "terms":["agentic","autonomous agent","computer use","tool use","multi-agent","drones","autonomous vehicle","quantum"]},
    # Capability milestone / model cards / safety reports (Now)
    {"tag":"CAPABILITY/MILESTONE","priority":"Medium","time_horizon":"Now","workstreams":["AIHM"],
     "terms":["model card","system card","technical report","safety report","benchmark","eval","evaluation","red team","release","frontier model"]},
]

# Lightweight NIST AI RMF function tagging (heuristic). [14](https://codingtechroom.com/question/-reddit-api-login-issues)
RMF_KEYWORDS = {
    "GOVERN": ["policy","governance","accountability","oversight","regulator","compliance","code of practice","strategy"],
    "MAP": ["use case","context","impact","stakeholder","risk landscape","threat assessment","taxonomy"],
    "MEASURE": ["benchmark","eval","evaluation","testing","red team","assurance","validation","metrics"],
    "MANAGE": ["mitigation","controls","incident response","takedown","enforcement","safeguard","monitoring","removal"],
}

# Lightweight MITRE ATLAS “themes” (NOT technique IDs; just a hint). [15](https://assets.publishing.service.gov.uk/media/66c4493f057d859c0e8fa778/futures-toolkit-edition-2.pdf)
ATLAS_THEMES = {
    "Prompt injection / tool misuse": ["prompt injection","tool use attack","agent jailbreak"],
    "Data poisoning / training abuse": ["data poisoning","poisoned dataset","training data leak"],
    "Model extraction / theft": ["model extraction","model stealing","weights leak"],
    "Evasion / adversarial inputs": ["adversarial example","evasion attack"],
    "Supply chain / integration risk": ["supply chain","dependency","plugin","connector","rag"],
}

def classify_risk(title: str) -> dict:
    t = (title or "").lower()
    matched_terms = []
    best = None
    best_score = 0
    for rule in RISK_RULES:
        score = sum(1 for term in rule["terms"] if term in t)
        if score > best_score:
            best_score = score
            best = rule
        if score > 0:
            matched_terms.extend([term for term in rule["terms"] if term in t])

    if best_score == 0:
        return {"priority":"Low","tag":"GENERAL","time_horizon":"Now","workstreams":["AIHM"],"matched_terms":[], "score":0}

    return {
        "priority": best["priority"],
        "tag": best["tag"],
        "time_horizon": best["time_horizon"],
        "workstreams": best["workstreams"],
        "matched_terms": matched_terms[:10],
        "score": best_score
    }

def classify_rmf(title: str):
    t = (title or "").lower()
    hits = []
    for fn, kws in RMF_KEYWORDS.items():
        if any(k in t for k in kws):
            hits.append(fn)
    return hits

def classify_atlas(title: str):
    t = (title or "").lower()
    hits = []
    for theme, kws in ATLAS_THEMES.items():
        if any(k in t for k in kws):
            hits.append(theme)
    return hits

def source_confidence(source: str) -> str:
    s = (source or "").lower()
    if "incident database" in s:
        return "High"
    if "ofcom" in s or "ico" in s or "gov.uk" in s:
        return "High"
    if "reddit" in s:
        return "Low"
    return "Medium"

# -------------------------
# 3) Fetchers
# -------------------------
def request_json(url, payload=None, timeout=15, retries=2):
    headers = {"User-Agent": USER_AGENT}
    for attempt in range(retries + 1):
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=timeout) if payload else \
                requests.get(url, headers=headers, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == retries:
                raise
            time.sleep(1.5 * (attempt + 1))

def fetch_aiid(limit=25):
    """
    AI Incident Database GraphQL.
    Note: your plan flags AIID may be blocked on HO systems. [6](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
    """
    url = "https://incidentdatabase.ai/api/graphql"
    query = f"{{ incidents(limit: {limit}, order: {{date: DESC}}) {{ incident_id title date }} }}"
    out = []
    try:
        data = request_json(url, payload={"query": query}, timeout=20, retries=2)
        incidents = data.get("data", {}).get("incidents", []) or []
        for i in incidents:
            title = i.get("title", "")
            link = f"https://incidentdatabase.ai/cite/{i.get('incident_id')}"
            date = (i.get("date") or "").strip()
            iso = f"{date}T00:00:00Z" if date else utcnow_iso()
            risk = classify_risk(title)
            out.append({
                "id": stable_id(title, link),
                "title": title,
                "link": link,
                "source": "AI Incident Database",
                "date": iso,
                "risk": risk,
                "rmf": classify_rmf(title),
                "atlas": classify_atlas(title),
                "confidence": source_confidence("AI Incident Database"),
            })
    except Exception as e:
        print(f"AIID Error: {e}")
    return out

def fetch_rss(url, max_items=60, section=""):
    feed = feedparser.parse(url)
    items = []
    for e in (feed.entries or [])[:max_items]:
        title = normalize_title(getattr(e, "title", "") or "")
        link = canonicalize_url(getattr(e, "link", "") or "")
        source = "News"
        try:
            if hasattr(e, "source") and getattr(e.source, "title", None):
                source = e.source.title
        except Exception:
            pass
        date = parse_entry_datetime(e)
        risk = classify_risk(title)
        items.append({
            "id": stable_id(title, link),
            "title": title,
            "link": link,
            "source": source,
            "date": date,
            "risk": risk,
            "rmf": classify_rmf(title),
            "atlas": classify_atlas(title),
            "confidence": source_confidence(source if section != "forums" else "reddit"),
        })
    return items

def google_news_site_query(q: str) -> str:
    # q should already contain "site:..." etc
    # keep it simple; rely on hl/gl/ceid to reduce consent redirects
    from urllib.parse import quote_plus
    return f"https://news.google.com/rss/search?q={quote_plus(q)}&hl=en-GB&gl=GB&ceid=GB:en"

# -------------------------
# 4) Dedupe + digest
# -------------------------
def dedupe(items):
    seen = set()
    out = []
    for it in sorted(items, key=lambda x: x.get("date", ""), reverse=True):
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        out.append(it)
    return out

def summarize(sections):
    summary = {"by_priority": {}, "by_tag": {}, "by_workstream": {}, "by_horizon": {}}
    for sec_items in sections.values():
        for it in sec_items:
            r = it.get("risk", {}) or {}
            p = r.get("priority", "Low")
            t = r.get("tag", "GENERAL")
            h = r.get("time_horizon", "Now")
            summary["by_priority"][p] = summary["by_priority"].get(p, 0) + 1
            summary["by_tag"][t] = summary["by_tag"].get(t, 0) + 1
            summary["by_horizon"][h] = summary["by_horizon"].get(h, 0) + 1
            for w in r.get("workstreams", []) or []:
                summary["by_workstream"][w] = summary["by_workstream"].get(w, 0) + 1
    return summary

def parse_iso(dt_str: str):
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return None

def build_weekly_digest(triage_items):
    now = utcnow()
    cutoff = now - timedelta(days=7)

    recent = []
    for it in triage_items:
        dt = parse_iso(it.get("date", ""))
        if dt and dt >= cutoff:
            recent.append(it)

    # Prioritise: High first, then Capability/Milestone, then recency
    prio_rank = {"High": 0, "Medium": 1, "Low": 2}
    recent.sort(key=lambda x: (
        prio_rank.get(x.get("risk", {}).get("priority", "Low"), 9),
        0 if x.get("risk", {}).get("tag") == "CAPABILITY/MILESTONE" else 1,
        x.get("date", "")
    ))

    top_high = [x for x in recent if x.get("risk", {}).get("priority") == "High"][:10]
    top_caps = [x for x in recent if x.get("risk", {}).get("tag") == "CAPABILITY/MILESTONE"][:10]

    def line(it):
        d = (it.get("date","").split("T")[0]) if it.get("date") else ""
        r = it.get("risk", {})
        ws = ",".join(r.get("workstreams", []) or [])
        return f"- **{it.get('title','').strip()}** ({d}) — *{r.get('tag')} / {r.get('time_horizon')} / {ws}*  \n  {it.get('link')}"

    md = []
    md.append(f"# Weekly Horizon Scan Digest\n\nGenerated: **{utcnow_iso()}**\n")
    md.append("## Top High-Priority Signals (last 7 days)\n")
    md.append("\n".join([line(x) for x in top_high]) if top_high else "_No high-priority items in the last 7 days._")
    md.append("\n\n## Capability / Milestone Signals (last 7 days)\n")
    md.append("\n".join([line(x) for x in top_caps]) if top_caps else "_No capability/milestone items in the last 7 days._")
    md.append("\n\n## Notes\n- `rmf` labels are heuristic tags aligned to NIST AI RMF functions (Govern/Map/Measure/Manage).")
    md.append("- `atlas` labels are heuristic themes inspired by MITRE ATLAS; they are not authoritative technique IDs.\n")
    return "\n".join(md)

# -------------------------
# 5) Run
# -------------------------
def run():
    print("Gathering horizon scanning signals...")
    report = {"schema_version": "2.2", "last_updated": utcnow_iso(), "sections": {}}

    # AIID
    report["sections"]["aiid"] = fetch_aiid(limit=25)

    # Forums (Reddit RSS)
    forums = []
    for sub, url in REDDIT_RSS:
        items = fetch_rss(url, max_items=25, section="forums")
        for it in items:
            it["source"] = f"Reddit/{sub}"
        forums.extend(items)
    report["sections"]["forums"] = dedupe(forums)

    # Broad Google News sections
    for key, url in GOOGLE_NEWS_RSS.items():
        report["sections"][key] = dedupe(fetch_rss(url, max_items=80, section=key))

    # Site-scoped sections (from your plan’s source list) [6](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
    for sec, items in SITE_SCOPED.items():
        sec_items = []
        for label, q in items:
            url = google_news_site_query(q)
            got = fetch_rss(url, max_items=40, section=sec)
            for it in got:
                # Preserve the intended “source group” label
                it["source"] = label
            sec_items.extend(got)
        report["sections"][sec] = dedupe(sec_items)

    # Build triage roll-up
    all_items = []
    for sec, sec_items in report["sections"].items():
        for it in sec_items:
            it2 = dict(it)
            it2["section"] = sec
            all_items.append(it2)
    report["sections"]["triage"] = dedupe(all_items)

    # Summary + weekly digest
    report["summary"] = summarize(report["sections"])
    digest_md = build_weekly_digest(report["sections"]["triage"])

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    with open(OUT_DIGEST, "w", encoding="utf-8") as f:
        f.write(digest_md)

    print(f"Done! Wrote {OUT_JSON} and {OUT_DIGEST}")

if __name__ == "__main__":
    run()
