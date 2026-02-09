import feedparser
import json
import os
import requests
from datetime import datetime

# Expanded 2026 search queries for maximum results
queries = {
    "harms": "AI+(harm+OR+incident+OR+deepfake+OR+scam+OR+misinformation)",
    "aiid": "AI+incident+database+OR+algorithm+harm+OR+AI+safety+report",
    "dev_releases": "Anthropic+Claude+OR+OpenAI+GPT+OR+Gemini+AI+OR+Meta+Llama",
    "forums": "AI+jailbreak+OR+LLM+exploit+OR+prompt+injection+OR+GitHub+AI"
}

def run():
    print("🛰️ Scanning Frequencies...")
    report = {"last_updated": datetime.utcnow().isoformat() + "Z", "sections": {}}
    
    # Critical: This mimics a real web browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    for key, q in queries.items():
        url = f"https://news.google.com/rss/search?q={q}&hl=en-GB&gl=GB&ceid=GB:en"
        try:
            # We fetch the XML content first, then parse it
            response = requests.get(url, headers=headers, timeout=15)
            feed = feedparser.parse(response.content)
            
            report["sections"][key] = [{
                "title": e.title.rsplit(' - ', 1)[0],
                "link": e.link,
                "source": e.source.title if hasattr(e, 'source') else "Intelligence",
                "date": e.published if hasattr(e, 'published') else datetime.utcnow().isoformat(),
                "priority": "High" if any(x in e.title.lower() for x in ["urgent", "exploit", "scam", "breach", "warning", "attack"]) else "Medium"
            } for e in feed.entries[:20]]
            print(f"✅ {key}: {len(report['sections'][key])} signals found.")
        except Exception as e:
            print(f"❌ {key} failed: {e}")
            report["sections"][key] = []

    # Save the file to the public folder
    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w') as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run()
