import feedparser, json, os, requests
from datetime import datetime

# Strictly targeted professional queries
queries = {
    "harms": "AI+harm+OR+deepfake+scam+OR+AI+misinformation+OR+AI+fraud",
    # Strictly limits results to the AIID domain
    "aiid": "site:incidentdatabase.ai", 
    # Captures both major corporate and open-source releases
    "dev_releases": "(OpenAI+OR+Anthropic+OR+Google+Gemini+OR+Meta+Llama+OR+Mistral+AI+OR+DeepSeek)+release+OR+model+card",
    "forums": "AI+jailbreak+OR+LLM+exploit+OR+prompt+injection+OR+AI+vulnerability"
}

def run():
    report = {"last_updated": datetime.utcnow().isoformat() + "Z", "sections": {}}
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

    for key, q in queries.items():
        url = f"https://news.google.com/rss/search?q={q}&hl=en-GB&gl=GB&ceid=GB:en"
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            feed = feedparser.parse(resp.content)
            
            report["sections"][key] = [{
                "title": e.title.rsplit(' - ', 1)[0],
                "link": e.link,
                "source": "AIID" if key == "aiid" else (e.source.title if hasattr(e, 'source') else "Industry News"),
                "date": e.published if hasattr(e, 'published') else datetime.utcnow().isoformat(),
                "priority": "High" if any(x in e.title.lower() for x in ["urgent", "exploit", "scam", "breach", "critical"]) else "Standard"
            } for e in feed.entries[:50]]
        except:
            report["sections"][key] = []

    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w') as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run()
