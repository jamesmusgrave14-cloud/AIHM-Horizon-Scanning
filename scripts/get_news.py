import feedparser, json, os, requests
from datetime import datetime

# Specific category search strings
HARM_CATEGORIES = {
    "Fraud": "AI+(scam+OR+fraud+OR+phishing+OR+deepfake+finance)",
    "CSAM": "AI+generated+child+abuse+OR+CSAM+AI+legislation+OR+AIG-CSAM",
    "Terrorism": "AI+extremism+OR+terrorist+use+of+AI+OR+AI+radicalization",
    "Cyber": "AI+malware+OR+automated+hacking+OR+LLM+vulnerability+exploit",
    "VAWG": "AI+non-consensual+intimate+images+OR+deepfake+harassment+OR+VAWG+AI"
}

TECHNICAL_QUERIES = "AI+jailbreak+technique+OR+prompt+injection+payload+OR+bypass+LLM+guardrails"

def run():
    report = {"last_updated": datetime.utcnow().isoformat() + "Z", "sections": {}}
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'}

    # 1. Populate Harms by Category
    report["sections"]["harms"] = []
    for cat, q in HARM_CATEGORIES.items():
        url = f"https://news.google.com/rss/search?q={q}&hl=en-GB&gl=GB&ceid=GB:en"
        feed = feedparser.parse(requests.get(url, headers=headers).content)
        for e in feed.entries[:5]: # 5 high-signal items per category
            report["sections"]["harms"].append({
                "category": cat,
                "title": e.title.rsplit(' - ', 1)[0],
                "link": e.link,
                "source": e.source.title if hasattr(e, 'source') else "Intelligence",
                "date": e.published
            })

    # 2. AIID (Strict Source)
    aiid_url = "https://news.google.com/rss/search?q=site:incidentdatabase.ai&hl=en-GB"
    report["sections"]["aiid"] = [{"title": e.title, "link": e.link, "date": e.published} 
                                  for e in feedparser.parse(requests.get(aiid_url, headers=headers).content).entries[:15]]

    # 3. Technical Signals (Filtered for technical bypasses)
    tech_url = f"https://news.google.com/rss/search?q={TECHNICAL_QUERIES}&hl=en-GB"
    report["sections"]["technical"] = [{
        "title": e.title,
        "snippet": "Technical discussion detected: analyzing prompt injection methods and model response bypasses...",
        "source": "Research Forum / GitHub",
        "date": e.published
    } for e in feedparser.parse(requests.get(tech_url, headers=headers).content).entries[:10]]

    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w') as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run()
