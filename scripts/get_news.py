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

def get_priority(title):
    title = title.lower()
    # High Risk Tripwires
    critical_keywords = ["exploit", "breach", "csea", "sextortion", "malware", "scam", "fraud", "weapon", "harm", "abuse"]
    if any(word in title for word in critical_keywords):
        return "High"
    return "Medium"

def fetch_intelligence():
    print("Initiating Global Intelligence Scan...")
    report = {
        "last_updated": datetime.utcnow().isoformat() + "Z", # Forced Zulu ISO
        "sections": {}
    }

    for key, url in queries.items():
        feed = feedparser.parse(url)
        articles = []
        
        for entry in feed.entries[:50]:
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                dt = datetime.fromtimestamp(time.mktime(entry.published_parsed))
                iso_date = dt.isoformat() + "Z"
            else:
                iso_date = datetime.utcnow().isoformat() + "Z"
            
            articles.append({
                "title": entry.title.rsplit(' - ', 1)[0],
                "link": entry.link,
                "source": entry.source.title if hasattr(entry, 'source') else "News Source",
                "date": iso_date,
                "priority": get_priority(entry.title)
            })
        
        report["sections"][key] = articles
    
    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=4)
    print("Scan complete. Data pushed to public/news_data.json")

if __name__ == "__main__":
    fetch_intelligence()
