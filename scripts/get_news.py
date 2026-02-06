import feedparser
import json
import os
import requests
from datetime import datetime

# 1. Robust Queries (Broadened to ensure results)
queries = {
    "harms": "https://news.google.com/rss/search?q=AI+(harm+OR+incident+OR+abuse+OR+scam+OR+jailbreak)+-stock&hl=en-GB&gl=GB&ceid=GB:en",
    "models": "https://news.google.com/rss/search?q=AI+model+(release+OR+safety+card+OR+technical+report)+-price&hl=en-GB&gl=GB&ceid=GB:en",
    "watchdogs": "https://news.google.com/rss/search?q=(AI+Safety+Institute+OR+Ofcom+AI+regulation)&hl=en-GB&gl=GB&ceid=GB:en"
}

def get_risk_intel(title):
    t = title.lower()
    if any(k in t for k in ["csam", "ncii", "undressing", "abuse", "vawg"]): return {"priority": "High", "tag": "CSAM/NCII"}
    if any(k in t for k in ["scam", "fraud", "cloning", "vishing", "money"]): return {"priority": "High", "tag": "FRAUD"}
    if any(k in t for k in ["radical", "extremist", "terror", "isis"]): return {"priority": "High", "tag": "RADICAL"}
    if any(k in t for k in ["jailbreak", "exploit", "malware", "phishing", "leak"]): return {"priority": "High", "tag": "CYBER"}
    return {"priority": "Medium", "tag": "GENERAL"}

def fetch_aiid():
    # Direct GraphQL connection to the Official Incident Database
    url = "https://incidentdatabase.ai/api/graphql"
    query = "{ incidents(limit: 25, order: {date: DESC}) { incident_id title date } }"
    try:
        res = requests.post(url, json={'query': query}, timeout=15)
        data = res.json()['data']['incidents']
        return [{
            "title": i['title'],
            "link": f"https://incidentdatabase.ai/cite/{i['incident_id']}",
            "source": "AIID Official",
            "date": f"{i['date']}T00:00:00Z",
            "risk": get_risk_intel(i['title'])
        } for i in data]
    except Exception as e:
        print(f"AIID Error: {e}")
        return []

def fetch_reddit():
    # Stealth headers to avoid being blocked by Reddit
    subs = ["netsec", "artificial", "openai"]
    signals = []
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-Safety-Monitor/2.0'}
    for sub in subs:
        try:
            r = requests.get(f"https://www.reddit.com/r/{sub}/new.json?limit=15", headers=headers, timeout=10)
            posts = r.json().get('data', {}).get('children', [])
            for p in posts:
                d = p['data']
                signals.append({
                    "title": f"[{sub.upper()}] {d['title']}",
                    "link": f"https://reddit.com{d['permalink']}",
                    "source": "Reddit Chatter",
                    "date": datetime.fromtimestamp(d['created_utc']).isoformat() + "Z",
                    "risk": get_risk_intel(d['title'])
                })
        except: continue
    return signals

def run():
    print("Gathering intelligence...")
    report = {"last_updated": datetime.utcnow().isoformat() + "Z", "sections": {}}
    report["sections"]["aiid"] = fetch_aiid()
    report["sections"]["forums"] = fetch_reddit()
    
    for key, url in queries.items():
        feed = feedparser.parse(url)
        report["sections"][key] = [{
            "title": e.title.rsplit(' - ', 1)[0],
            "link": e.link,
            "source": e.source.title if hasattr(e, 'source') else "News",
            "date": datetime.utcnow().isoformat() + "Z", # Default to now if parse fails
            "risk": get_risk_intel(e.title)
        } for e in feed.entries[:40]]

    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w') as f:
        json.dump(report, f, indent=2)
    print("Done!")

if __name__ == "__main__":
    run()
