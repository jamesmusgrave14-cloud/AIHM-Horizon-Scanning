import feedparser, json, os, requests, re
from datetime import datetime

# Configurations
HARM_CATEGORIES = {
    "Fraud": "AI+(scam+OR+fraud+OR+phishing+OR+deepfake+finance)",
    "CSAM": "AI+generated+child+abuse+OR+CSAM+AI+legislation",
    "Terrorism": "AI+extremism+OR+terrorist+use+of+AI+OR+radicalization",
    "Cyber": "AI+malware+OR+automated+hacking+OR+LLM+exploit",
    "VAWG": "AI+non-consensual+intimate+images+OR+deepfake+harassment+OR+VAWG"
}

# Technical Target: Specialized Subreddits for Jailbreaks/Exploits
TECH_SOURCES = [
    "https://www.reddit.com/r/PromptEngineering/search.rss?q=jailbreak+OR+exploit+OR+injection&sort=new",
    "https://www.reddit.com/r/netsec/search.rss?q=AI+OR+LLM+OR+adversarial&sort=new",
    "https://www.reddit.com/r/LocalLLaMA/search.rss?q=bypass+OR+jailbreak&sort=new"
]

def parse_date(date_str):
    try: return datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S %Z')
    except: return datetime.utcnow()

def run():
    report = {"last_updated": datetime.utcnow().isoformat(), "sections": {"harms": [], "aiid": [], "dev_releases": [], "technical": []}}
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MonitorBot/2.0'}

    # 1. Harms & Model Releases (Google News RSS)
    for cat, q in HARM_CATEGORIES.items():
        feed = feedparser.parse(requests.get(f"https://news.google.com/rss/search?q={q}&hl=en-GB", headers=headers).content)
        for e in feed.entries[:8]:
            report["sections"]["harms"].append({
                "category": cat, "title": e.title.rsplit(' - ', 1)[0], "link": e.link, 
                "source": e.source.title if hasattr(e, 'source') else "News",
                "timestamp": parse_date(e.published).timestamp(), "date": e.published
            })

    # RESTORED: Model Releases
    release_q = "(OpenAI+OR+Anthropic+OR+DeepSeek+OR+Meta+Llama+OR+Mistral)+release+model"
    release_feed = feedparser.parse(requests.get(f"https://news.google.com/rss/search?q={release_q}&hl=en-GB", headers=headers).content)
    report["sections"]["dev_releases"] = [{
        "title": e.title.rsplit(' - ', 1)[0], "link": e.link, "source": "Release Log",
        "timestamp": parse_date(e.published).timestamp(), "date": e.published
    } for e in release_feed.entries[:15]]

    # 2. Technical Signals (Reddit/Forum Focus)
    for url in TECH_SOURCES:
        feed = feedparser.parse(requests.get(url, headers=headers).content)
        for e in feed.entries[:10]:
            title = e.title.lower()
            # Keyword Flags
            flags = []
            if "jailbreak" in title: flags.append("JAILBREAK")
            if "injection" in title or "bypass" in title: flags.append("EXPLOIT")
            if "rce" in title or "malware" in title: flags.append("CRITICAL")
            
            report["sections"]["technical"].append({
                "title": e.title,
                "link": e.link,
                "source": "Reddit Community",
                "flags": flags if flags else ["MONITOR"],
                "timestamp": parse_date(e.published).timestamp(),
                "date": e.published,
                "summary": f"Signal detected in {url.split('/r/')[1].split('/')[0]}. Pattern suggests {', '.join(flags) if flags else 'general research'} activity."
            })

    # Sort all by newest
    for k in report["sections"]:
        report["sections"][k].sort(key=lambda x: x['timestamp'], reverse=True)

    with open('public/news_data.json', 'w') as f:
        json.dump(report, f, indent=2)

if __name__ == "__main__":
    run()
