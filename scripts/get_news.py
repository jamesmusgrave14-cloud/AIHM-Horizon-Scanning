import feedparser
import json
import os
from datetime import datetime

# Define the search queries for each section
# These use Google News RSS format
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
    high_risk = ["harm", "scam", "fraud", "victim", "exploit", "breach", "csea"]
    if any(word in title for word in high_risk):
        return "High"
    return "Medium"

def fetch_intelligence():
    print("Starting Intelligence Scan...")
    report = {
        "last_updated": datetime.now().strftime("%d %b %Y, %H:%M"),
        "sections": {}
    }

    for key, url in queries.items():
        print(f"Fetching {key}...")
        feed = feedparser.parse(url)
        articles = []
        
        # Take the top 10 articles per section
        for entry in feed.entries[:10]:
            articles.append({
                "title": entry.title.rsplit(' - ', 1)[0], # Removes the source from the title string
                "link": entry.link,
                "source": entry.source.title if hasattr(entry, 'source') else "Intelligence Feed",
                "published": entry.published if hasattr(entry, 'published') else "",
                "priority": get_priority(entry.title)
            })
        
        report["sections"][key] = articles
        print(f"Found {len(articles)} items for {key}")

    # Ensure the public directory exists
    os.makedirs('public', exist_ok=True)
    
    # Save the file
    with open('public/news_data.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=4)
    
    print("Scan Complete. File saved to public/news_data.json")

if __name__ == "__main__":
    fetch_intelligence()
