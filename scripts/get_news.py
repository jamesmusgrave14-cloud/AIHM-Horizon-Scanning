import feedparser
import json
import os
import requests
from datetime import datetime
import time

# 1. Targeted Queries for the Risk Dashboard
queries = {
    "csam_vawg": "https://news.google.com/rss/search?q=AI+CSAM+OR+NCII+OR+%22simulated+undressing%22+OR+%22deepfake+abuse%22+OR+VAWG+online+safety&hl=en-GB&gl=GB&ceid=GB:en",
    "radicalisation": "https://news.google.com/rss/search?q=AI+radicalisation+OR+%22extremist+narrative%22+OR+%22accelerationalist%22+OR+%22terrorist+recruitment%22+AI&hl=en-GB&gl=GB&ceid=GB:en",
    "fraud": "https://news.google.com/rss/search?q=AI+%22voice+cloning%22+fraud+OR+deepfake+scam+OR+vishing+OR+%22synthetic+identity%22&hl=en-GB&gl=GB&ceid=GB:en",
    "cyber_attacks": "https://news.google.com/rss/search?q=AI+malware+OR+%22automated+phishing%22+OR+%22LLM+exploit%22+OR+jailbreak+OR+%22data+poisoning%22&hl=en-GB&gl=GB&ceid=GB:en",
    "dev_releases": "https://news.google.com/rss/search?q=OpenAI+OR+Anthropic+OR+Mistral+AI+model+release&hl=en-GB&gl=GB&ceid=GB:en",
    "watchdogs": "https://news.google.com/rss/search?q=UK+AI+Safety+Institute+OR+Ofcom+AI+report&hl=en-GB&gl=GB&ceid=GB:en"
}

# 2. Advanced Risk Detection Engine
def get_risk_intel(title):
    title = title.lower()
    risk_profile = {"priority": "Medium", "tag": None}
    
    # Critical Risk Mapping (2026 Focus)
    mapping = {
        "CSAM/NCII": ["csam", "ncii", "undressing", "nudify", "abuse", "non-consensual", "vawg", "victim"],
        "FRAUD": ["scam", "fraud", "cloning", "vishing", "synthetic", "impersonation", "bank"],
        "RADICAL": ["radical", "extremist", "terror", "accelerationalist", "incitement", "propaganda", "isis"],
        "CYBER": ["jailbreak", "exploit", "malware", "phishing", "injection", "breach", "poisoning"]
    }

    for tag, keywords in mapping.items():
        if any(k in title for k in keywords):
            risk_profile["priority"] = "High"
            risk_profile["tag"] = tag
            break
            
    return risk_profile

# 3. Official AI Incident Database Connection (Direct API)
def fetch_aiid_direct():
    print("Connecting to AI Incident Database...")
    url = "https://incidentdatabase.ai/api/graphql"
    query = "{ incidents(limit: 15, order: {date: DESC}) { incident_id title date } }"
    try:
        res = requests.post(url, json={'query': query}, timeout=10)
        if res.status_code == 200:
            data = res.json().get('data', {}).get('incidents', [])
            return [{
                "title": i['title'],
                "link": f"https://incidentdatabase.ai/cite/{i['incident_id']}",
                "source": "AIID Official",
                "date": f"{i['date']}T00:00:00Z",
                "risk": get_risk_intel(i['title'])
            } for i in data]
    except: return []

# 4. Forum/Social Pulse Scanner (Reddit JSON)
def fetch_social():
    print("Scanning social frequencies...")
    subs = ["netsec", "artificial", "MachineLearning", "openai"]
    signals = []
    headers = {'User-Agent': 'Mozilla/5.0 AI-Horizon-Bot/1.0'}
    for sub in subs:
        try:
            url = f"https://www.reddit.com/r/{sub}/new.json?limit=10"
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200:
                for post in res.json()['data']['children']:
                    data = post['data']
                    risk = get_risk_intel(data['title'])
                    # We only include social chatter if it matches a risk keyword
                    if risk['priority'] == "High":
                        signals.append({
                            "title": f"[{sub.upper()}] {data['title']}",
                            "link": f"https://reddit.com{data['permalink']}",
                            "source": "Reddit Chatter",
                            "date": datetime.fromtimestamp(data['created_utc']).isoformat() + "Z",
                            "risk": risk
                        })
        except: continue
    return signals

def fetch_intelligence():
    print("Initiating Global Intelligence Scan...")
    report = {"last_updated": datetime.utcnow().isoformat() + "Z", "sections": {}}
    
    # Merge all feeds
    report["sections"]["ai_incidents"] = fetch_aiid_direct()
    report["sections"]["social_signals"] = fetch_social()
    
    for key, url in queries.items():
        feed = feedparser.parse(url)
        articles = []
        for entry in feed.entries[:30]:
            dt = datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') else datetime.utcnow()
            articles.append({
                "title": entry.title.rsplit(' - ', 1)[0],
                "link": entry.link,
                "source": entry.source.title if hasattr(entry, 'source') else "News",
                "date": dt.isoformat() + "Z",
                "risk": get_risk_intel(entry.title)
            })
        report["sections"][key] = articles

    os.makedirs('public', exist_ok=True)
    with open('public/news_data.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=4)
    print("Intelligence stored in public/news_data.json")

if __name__ == "__main__":
    fetch_intelligence()
