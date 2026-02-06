import feedparser
import json
import os
from datetime import datetime

# The RSS feeds used by the "Media Monitor" style sites
feeds = {
    "uk_regulation": "https://news.google.com/rss/search?q=AI+regulation+UK+Online+Safety+Act&hl=en-GB&gl=GB&ceid=GB:en",
    "ai_incidents": "https://news.google.com/rss/search?q=site:incidentdatabase.ai+OR+%22AI+incident%22&hl=en-US&gl=US&ceid=US:en",
    "us_policy": "https://news.google.com/rss/search?q=AI+policy+US+Executive+Order&hl=en-US&gl=US&ceid=US:en"
}

def fetch():
    report = {
        "last_updated": datetime.now().strftime("%b %d, %Y - %H:%M"),
        "sections": {}
    }
    for category, url in feeds.items():
        feed = feedparser.parse(url)
        articles = []
        for entry in feed.entries[:8]:
            articles.append({
                "title": entry.title.rsplit(' - ', 1)[0],
                "link": entry.link,
                "source": entry.source.title if hasattr(entry, 'source') else "News Source"
            })
        report["sections"][category] = articles

    # Save to the public folder so Vite can serve it
    with open('public/news_data.json', 'w') as f:
        json.dump(report, f, indent=4)

if __name__ == "__main__":
    fetch()
