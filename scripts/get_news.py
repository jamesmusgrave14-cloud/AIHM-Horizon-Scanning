import feedparser
import json
import os
import requests
from datetime import datetime
import time

# Defined queries mapped to your new Tab structure
queries = {
    "harms": "https://news.google.com/rss/search?q=(AI+CSAM+OR+NCII+OR+fraud+OR+radicalisation+OR+jailbreak+OR+vawg)+-stock+-investment&hl=en-GB&gl=GB&ceid=GB:en",
    "models": "https://news.google.com/rss/search?q=(OpenAI+OR+Anthropic+OR+Mistral+OR+Llama+OR+DeepSeek)+release+OR+model+card+OR+technical+report&hl=en-GB&gl=GB&ceid=GB:en",
    "watchdogs": "https://news.google.com/rss/search?q=AI+Safety+Institute+OR+Ofcom+AI+regulation&hl=en-GB&gl=GB&ceid=GB:en"
}

def get_risk_intel(title):
    title = title.lower()
    mapping = {
        "CSAM/NCII": ["csam", "ncii", "undressing", "abuse", "vawg"],
        "FRAUD": ["scam", "fraud", "cloning", "vishing", "impersonation"],
        "RADICAL": ["radical", "extremist", "terror", "propaganda"],
        "CYBER": ["jailbreak", "exploit", "malware", "phishing", "breach"]
    }
    for tag, keywords in mapping.items():
        if any(k in title for k in keywords):
            return {"priority": "High", "tag": tag}
    return {"priority": "Medium", "tag": "General"}

def fetch_aiid():
    url = "https://incidentdatabase.ai/api/graphql"
    query = "{ incidents(limit: 20, order: {date: DESC}) { incident_id title date description } }"
    try:
        res = requests.post(url, json={'query': query}, timeout=10)
        return [{
            "title": i['title'],
            "link": f"https://incidentdatabase.ai/cite/{i['incident_id']}",
            "source": "AIID Official",
            "date": f"{i['date']}T00:00:00Z",
            "risk": get_risk_intel(i['title'])
        } for i in res.json()['data']['incidents']]
    except: return []

def fetch_reddit():
    subs = ["netsec", "artificial", "openai"]
    signals = []
    headers = {'User-Agent': 'Mozilla/5.0 AI-Horizon-Bot/1.0'}
    for sub in subs:
        try:
            res = requests.get(f"https://www.reddit.com/r/{sub}/new.json?limit=10", headers=headers, timeout=10)
            for post in res.json()['data']['children']:
                data = post['data']
                signals.append({
                    "title": f"[{sub.upper()}] {data['title']}",
                    "link": f"https://reddit.com{data['permalink']}",
                    "source": "Reddit",
                    "date": datetime.fromtimestamp(data['created_utc']).isoformat() + "Z",
                    "risk": get_risk_intel(data['title'])
                })
        except: continue
    return signals

def fetch_intelligence():
    report = {"last_updated": datetime.utcnow().isoformat() + "Z", "sections": {}}
    report["sections"]["aiid"] = fetch_aiid()
    report["sections"]["forums"] = fetch_reddit()
    
    for key, url in queries.items():
        feed = feedparser.parse(url)
        report["sections"][key] = [{
            "title": e.title.rsplit(' - ', 1)[0],
            "link": e.link,
            "source": e.source.title if hasattr(e, 'source') else "News",
            "date": (datetime(*e.published_parsed[:6]) if hasattr(e, 'published_parsed') else datetime.utcnow()).isoformat() + "Z",
            "risk": get_risk_intel(e.title)
        } for e in feed.entries[:40]]

    with open('public/news_data.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=4)

if __name__ == "__main__":
    fetch_intelligence()
