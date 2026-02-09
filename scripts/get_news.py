import feedparser, json, os, requests
from datetime import datetime

HARM_CATEGORIES = {
    "Fraud": "AI+(scam+OR+fraud+OR+phishing+OR+deepfake+finance)",
    "CSAM": "AI+generated+child+abuse+OR+CSAM+AI+legislation",
    "Terrorism": "AI+extremism+OR+terrorist+use+of+AI+OR+radicalization",
    "Cyber": "AI+malware+OR+automated+hacking+OR+LLM+exploit",
    "VAWG": "AI+non-consensual+intimate+images+OR+deepfake+harassment+OR+VAWG"
}

def parse_date(date_str):
    try:
        # Standard RSS date format
        return datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S %Z')
    except:
        return datetime.utcnow()

def run():
    report = {"last_updated": datetime.utcnow().isoformat(), "sections": {"harms": [], "aiid": [], "dev_releases": [], "technical": []}}
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'}

    # 1. Harms Monitor
    for cat, q in HARM_CATEGORIES.items():
        feed = feedparser.parse(requests.get(f"https://news.google.com/rss/search?q={q}&hl=en-GB", headers=headers).content)
        for e in feed.entries[:10]:
            report["sections"]["harms"].append({
                "category": cat, "title": e.title.rsplit(' - ', 1)[0],
                "link": e.link, "source": e.source.title if hasattr(e, 'source') else "News",
                "date": e.published, "timestamp": parse_date(e.published).timestamp()
            })

    # 2. AIID
    aiid_feed = feedparser.parse(requests.get("https://news.google.com/rss/search?q=site:incidentdatabase.ai&hl=en-GB", headers=headers).content)
    report["sections"]["aiid"] = [{
        "title": e.title, "link": e.link, "date": e.published, "source": "AIID", 
        "timestamp": parse_date(e.published).timestamp()
    } for e in aiid_feed.entries[:20]]

    # 3. Technical Signals - Specialized Risk Logic
    tech_url = "https://news.google.com/rss/search?q=AI+jailbreak+OR+prompt+injection+payload+OR+adversarial+attack+forum&hl=en-GB"
    tech_feed = feedparser.parse(requests.get(tech_url, headers=headers).content)
    
    for e in tech_feed.entries[:15]:
        title = e.title.lower()
        risk_level = "Medium"
        if any(x in title for x in ["multimodal", "indirect", "rce", "exfiltrate", "bypass"]):
            risk_level = "CRITICAL"
        elif "jailbreak" in title or "dan" in title:
            risk_level = "High"

        report["sections"]["technical"].append({
            "title": e.title, "source": "Technical Thread / Research", "date": e.published,
            "timestamp": parse_date(e.published).timestamp(),
            "risk": risk_level,
            "summary": f"Detected potential {risk_level} threat. Thread discusses adversarial techniques to bypass system guardrails. Monitoring for specific payload strings."
        })

    # SORT EVERYTHING BY DATE (Newest First)
    for section in report["sections"]:
        report["sections"][section].sort(key=lambda x: x['timestamp'], reverse=True)

    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w') as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run()
