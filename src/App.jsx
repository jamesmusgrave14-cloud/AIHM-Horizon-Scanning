import React, { useEffect, useState } from "react";
import axios from "axios";
import { ShieldAlert, Cpu, ExternalLink, RefreshCw } from "lucide-react";

/* -----------------------------
   SIMPLE STRUCTURE
------------------------------ */

const TABS = ["Harms", "Capabilities"];

const SUBCATEGORIES = {
  Harms: [
    "Manipulative Media",
    "Fraud & Scams",
    "Cybercrime",
    "Privacy & Identity",
    "Bias & Rights",
    "Safety Incidents (AIID)"
  ],
  Capabilities: [
    "Model Releases",
    "Policy & Law",
    "Agents & Tools"
  ]
};

/* -----------------------------
   SEARCH QUERIES (GNews)
------------------------------ */

const GNEWS_QUERIES = {
  "Manipulative Media":
    '"deepfake" OR "voice cloning" OR "synthetic media"',
  "Fraud & Scams":
    '"AI scam" OR "deepfake fraud" OR "voice cloning fraud"',
  Cybercrime:
    '"AI cyberattack" OR "AI malware" OR "automated phishing"',
  "Privacy & Identity":
    '"synthetic identity" OR "biometric fraud"',
  "Bias & Rights":
    '"algorithmic bias" OR "AI discrimination"',
  "Model Releases":
    '"GPT" OR "Claude" OR "Gemini" OR "LLM release"',
  "Policy & Law":
    '"AI regulation" OR "AI Act"',
  "Agents & Tools":
    '"AI agents" OR "agentic AI"'
};

/* -----------------------------
   FALLBACK DATA (DEMO SAFE)
------------------------------ */

const DUMMY_ITEMS = [
  {
    title: "Synthetic voice used in executive impersonation scam",
    description: "Audio deepfake reportedly used to authorise a transfer.",
    source: "Demo Source",
    date: "2026‑02‑03",
    url: "#",
    type: "Harms",
    category: "Fraud & Scams"
  },
  {
    title: "AI‑enabled malware shows rapid mutation patterns",
    description: "Researchers observe automated iteration techniques.",
    source: "Demo Source",
    date: "2026‑02‑02",
    url: "#",
    type: "Harms",
    category: "Cybercrime"
  },
  {
    title: "AI Incident Database records autonomous system failure",
    description: "Incident logged involving unsafe automated decision‑making.",
    source: "AI Incident Database",
    date: "2026‑02‑01",
    url: "#",
    type: "Harms",
    category: "Safety Incidents (AIID)"
  },
  {
    title: "New agent framework released with safety constraints",
    description: "Tooling supports evaluation‑driven agent orchestration.",
    source: "Demo Source",
    date: "2026‑02‑03",
    url: "#",
    type: "Capabilities",
    category: "Agents & Tools"
  }
];

/* -----------------------------
   CARD COMPONENT
------------------------------ */

function Card({ item }) {
  return (
    <div className="border border-slate-800 bg-slate-900 rounded-lg p-4">
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <span>{item.source}</span>
        <span>{item.date}</span>
      </div>
      <h3 className="font-semibold text-slate-100 mb-2">
        {item.title}
      </h3>
      <p className="text-slate-400 text-sm mb-3">
        {item.description}
      </p>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-blue-400 hover:underline flex items-center gap-1"
      >
        Read source <ExternalLink size={12} />
      </a>
    </div>
  );
}

/* -----------------------------
   MAIN APP
------------------------------ */

export default function App() {
  const [tab, setTab] = useState("Harms");
  const [subcategory, setSubcategory] = useState(
    SUBCATEGORIES.Harms[0]
  );
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);

    try {
      // AI Incident Database uses its own endpoint
      if (subcategory === "Safety Incidents (AIID)") {
        const r = await axios.get("/api/aiid");
        setItems(r.data.articles || []);
        setLoading(false);
        return;
      }

      // Everything else uses GNews
      const query = GNEWS_QUERIES[subcategory];
      const r = await axios.get(
        `/api/gnews?q=${encodeURIComponent(query)}&lang=en&max=6`
      );

      const mapped =
        r.data.articles?.map(a => ({
          title: a.title,
          description: a.description,
          source: a.source?.name || "Unknown",
          date: a.publishedAt?.split("T")[0],
          url: a.url,
          type: tab,
          category: subcategory
        })) || [];

      setItems(mapped.length ? mapped : DUMMY_ITEMS.filter(
        d => d.type === tab && d.category === subcategory
      ));
    } catch {
      // Always fall back to demo data
      setItems(
        DUMMY_ITEMS.filter(
          d => d.type === tab && d.category === subcategory
        )
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [tab, subcategory]);

  return (
    <div className="min-h-screen bg-black text-slate-200 p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            AI Horizon Scanning
          </h1>
          <p className="text-xs text-slate-400">
            Harms & capabilities monitoring
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded hover:bg-slate-800"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setSubcategory(SUBCATEGORIES[t][0]);
            }}
            className={`px-3 py-1 rounded text-sm ${
              tab === t
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Subcategories */}
      <div className="flex gap-2 flex-wrap mb-6">
        {SUBCATEGORIES[tab].map(sc => (
          <button
            key={sc}
            onClick={() => setSubcategory(sc)}
            className={`px-2 py-1 rounded text-xs border ${
              sc === subcategory
                ? "border-slate-500 text-white"
                : "border-slate-800 text-slate-400"
            }`}
          >
            {sc}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <Card key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
