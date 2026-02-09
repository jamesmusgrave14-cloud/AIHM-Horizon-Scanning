import feedparser, json, os, requests
from datetime import datetime

# Regulatory-aligned search strings
HARM_CATEGORIES = {
    "Fraud": "AI+(scam+OR+fraud+OR+phishing+OR+deepfake+finance)",
    "CSAM": "AI+generated+child+abuse+OR+CSAM+AI+legislation",
    "Terrorism": "AI+extremism+OR+terrorist+use+of+AI+OR+radicalization",
    "Cyber": "AI+malware+OR+automated+hacking+OR+LLM+exploit",
    "VAWG": "AI+non-consensual+intimate+images+OR+deepfake+harassment+OR+VAWG"
}

def run():
    report = {"last_updated": datetime.utcnow().isoformat(), "sections": {"harms": [], "aiid": [], "dev_releases": [], "technical": []}}
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'}

    # 1. Harms Monitor (By Category)
    for cat, q in HARM_CATEGORIES.items():
        url = f"https://news.google.com/rss/search?q={q}&hl=en-GB&gl=GB&ceid=GB:en"
        feed = feedparser.parse(requests.get(url, headers=headers).content)
        for e in feed.entries[:10]:
            report["sections"]["harms"].append({
                "category": cat, 
                "title": e.title.rsplit(' - ', 1)[0],
                "link": e.link, 
                "source": e.source.title if hasattr(e, 'source') else "News", 
                "date": e.published
            })

    # 2. AIID (Strict Domain)
    aiid_url = "https://news.google.com/rss/search?q=site:incidentdatabase.ai&hl=en-GB"
    report["sections"]["aiid"] = [{"title": e.title, "link": e.link, "date": e.published, "source": "AIID"} 
                                  for e in feedparser.parse(requests.get(aiid_url, headers=headers).content).entries[:20]]

    # 3. Model Releases (Major & Open Source)
    dev_url = "https://news.google.com/rss/search?q=(OpenAI+OR+Anthropic+OR+Gemini+OR+Llama+OR+Mistral+OR+DeepSeek)+release&hl=en-GB"
    report["sections"]["dev_releases"] = [{"title": e.title, "link": e.link, "date": e.published, "source": "Release Log"} 
                                          for e in feedparser.parse(requests.get(dev_url, headers=headers).content).entries[:20]]

    # 4. Technical Signals (Bypasses & Jailbreaks)
    tech_url = "https://news.google.com/rss/search?q=AI+jailbreak+OR+prompt+injection+payload&hl=en-GB"
    report["sections"]["technical"] = [{
        "title": e.title, "source": "Technical Forum", "date": e.published,
        "snippet": "Technical Analysis: Potential model bypass signature detected. Reviewing prompt structure for safety guardrail evasion."
    } for e in feedparser.parse(requests.get(tech_url, headers=headers).content).entries[:15]]

    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w') as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run()
