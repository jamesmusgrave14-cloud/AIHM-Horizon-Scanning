import feedparser
import json
import os
from datetime import datetime
import time

queries = {
    "dev_releases": "https://news.google.com/rss/search?q=OpenAI+OR+Anthropic+OR+Mistral+AI+model+release&hl=en-GB&gl=GB&ceid=GB:en",
    "watchdogs": "https://news.google.com/rss/search?q=AI+Safety+Institute+OR+Ofcom+AI+report&hl=en-GB&gl=GB&ceid=GB:en",
    "gov_signals": "https://news.google.com/rss/search?q=UK+Government+AI+regulation+DSIT&hl=en-GB&gl=GB&ceid=GB:en",
    "harms_csea": "https://news.google.com/rss/search?q=AI+deepfake+online+safety+harm&hl=en-GB&gl=GB&ceid=GB:en",
    "harms_fraud": "https://news.google.com/rss/search?q=AI+voice+cloning+fraud+scam&hl=en-GB&gl=GB&ceid=GB:en",
    "harms_cyber": "https://news.google.com/rss/search?q=AI+malware+phishing+cybersecurity&hl=en-GB&gl=GB&ceid=GB:en",
    "research_futures": "https://news.google.com/rss/search?q=AI+safety+research+paper+evaluation&hl=en-GB&gl=GB&ceid=GB:en",
    "media_broad": "https://news.google.com/rss/search?q=artificial+intelligence+risks&hl=en-GB&gl=GB&ceid=GB:en"
}

def fetch_intelligence():
    report = {
        "last_updated": datetime.now().isoformat(), # Standardized ISO
        "sections": {}
    }

    for key, url in queries.items():
        feed = feedparser.parse(url)
        articles = []
        
        for entry in feed.entries[:50]:
            # Convert feed timestamp to ISO string
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                dt = datetime.fromtimestamp(time.mktime(entry.published_parsed))
            else:
                dt = datetime.now()
            
            articles.append({
                "title": entry.title.rsplit(' - ', 1)[0],
                "link": entry.link,
                "source": entry.source.title if hasattr(entry, 'source') else "Intelligence Feed",
                "date": dt.isoformat(), # Standardized ISO
                "priority": "High" if any(x in entry.title.lower() for x in ["harm", "scam", "fraud", "victim"]) else "Medium"
            })
        
        report["sections"][key] = articles

    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=4)

if __name__ == "__main__":
    fetch_intelligence()
