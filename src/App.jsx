import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Shield, Database, Cpu, RefreshCw, Search, TrendingUp, MessageSquare, Hash } from "lucide-react";

export default function App() {
  const [data, setData] = useState({
    harms: [],
    signals: [],
    forums: [],
    dev_releases: [],
    aiid: [],
    x_watchlist: {}
  });
  const [coverage, setCoverage] = useState({ by_harm: {} });
  const [activeTab, setActiveTab] = useState("harms");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Local triage for signals (static-site friendly)
  const [triage, setTriage] = useState(() => {
    try { return JSON.parse(localStorage.getItem("triage") || "{}"); }
    catch { return {}; }
  });

  const setStatus = (signalId, status) => {
    const next = { ...triage, [signalId]: status };
    setTriage(next);
    localStorage.setItem("triage", JSON.stringify(next));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/news_data.json?v=" + Date.now());
      setData(res.data.sections || {});
      setCoverage(res.data.coverage || { by_harm: {} });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredItems = (items) => {
    if (!items) return [];
    const q = searchTerm.toLowerCase().trim();
    if (!q) return items;
    return items.filter(item => {
      const t = (item.title || "").toLowerCase();
      const s = (item.source || "").toLowerCase();
      const tags = (item.tags || []).join(" ").toLowerCase();
      return t.includes(q) || s.includes(q) || tags.includes(q);
    });
  };

  const harmCategories = useMemo(() => {
    const cats = new Set((data.harms || []).map(h => h.category).filter(Boolean));
    return Array.from(cats);
  }, [data.harms]);

  const signalsVisible = useMemo(() => {
    const items = filteredItems(data.signals || []);
    return items.filter(s => (triage[s.signal_id] || "new") !== "archived");
  }, [data.signals, triage, searchTerm]);

  const xWatchlistEntries = useMemo(() => {
    const xw = data.x_watchlist || {};
    return Object.entries(xw); // [category, [keywords]]
  }, [data.x_watchlist]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      <header className="border-b border-slate-200 py-6 px-8 sticky top-0 bg-white/95 backdrop-blur z-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Shield size={22} className="text-slate-900 fill-slate-900" />
          <h1 className="font-bold text-base uppercase tracking-tight">AI Harms Intelligence</h1>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Filter titles / sources / tags…"
              className="w-full bg-slate-50 border border-slate-200 rounded-full py-2 pl-9 pr-4 text-xs focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-full border border-slate-200 transition">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <nav className="flex px-8 border-b border-slate-100 bg-white gap-8 overflow-x-auto no-scrollbar">
        {[
          { id: "harms", label: "Harms Monitor", icon: Shield },
          { id: "signals", label: "Signals", icon: TrendingUp },
          { id: "forums", label: "Forums", icon: MessageSquare },
          { id: "x_watchlist", label: "X Watchlist", icon: Hash },
          { id: "dev_releases", label: "Model Releases", icon: Cpu },
          { id: "aiid", label: "Incident Database", icon: Database },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-4 text-[10px] font-bold uppercase tracking-widest border-b-2 whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === tab.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-8 max-w-7xl mx-auto">

        {/* HARMS MONITOR */}
        {activeTab === "harms" && (
          <div className="space-y-12">
            {harmCategories.map(cat => {
              const list = filteredItems((data.harms || []).filter(h => h.category === cat));
              if (list.length === 0 && searchTerm) return null;

              const cov = coverage?.by_harm?.[cat];
              const covText = cov?.last_seen
                ? ` · ${cov.count} items · last: ${new Date(cov.last_seen * 1000).toUTCString().slice(5, 16)}`
                : "";

              return (
                <section key={cat}>
                  <h2 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em] border-l-2 border-slate-900 pl-3">
                    {cat}{covText}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {list.map((item, i) => (
                      <article key={i} className="group border border-slate-100 p-5 rounded-lg hover:border-slate-300 transition-colors bg-slate-50/30">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-[8px] font-bold text-blue-600 uppercase tracking-tighter">{item.source}</span>
                          <span className="text-[9px] text-slate-400 font-mono italic">
                            {(item.date || "").split(" ").slice(1, 4).join(" ")}
                          </span>
                        </div>
                        <a href={item.link} target="_blank" rel="noreferrer" className="text-[14px] font-bold leading-snug hover:underline block">
                          {item.title}
                        </a>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* SIGNALS */}
        {activeTab === "signals" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {signalsVisible.map((s) => {
              const status = triage[s.signal_id] || "new";
              return (
