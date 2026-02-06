import React, { useCallback, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { RefreshCw, Search, Clock, ShieldAlert, AlertCircle, ArrowUpDown, Zap, TriangleAlert } from "lucide-react";

const SECTIONS = [
  { key: "ai_incidents", title: "Official Incident Database", color: "border-orange-500" },
  { key: "csam_vawg", title: "CSAM / NCII / VAWG", color: "border-red-600" },
  { key: "radicalisation", title: "Radicalisation Alerts", color: "border-purple-600" },
  { key: "fraud", title: "Fraud & Voice Cloning", color: "border-yellow-500" },
  { key: "cyber_attacks", title: "Cyber Attacks / Jailbreaks", color: "border-cyan-500" },
  { key: "social_signals", title: "Risk Chatter (Forums)", color: "border-pink-500" },
  { key: "watchdogs", title: "Regulator Watch", color: "border-slate-500" },
  { key: "dev_releases", title: "New Model Releases", color: "border-blue-500" },
];

export default function App() {
  const [data, setData] = useState({});
  const [lastScan, setLastScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const [sortOrder, setSortOrder] = useState("newest");

  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/news_data.json?t=${Date.now()}`);
      setData(res.data.sections || {});
      setLastScan(res.data.last_updated);
    } catch (err) { console.error("Sync Error:", err); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr);
    const diffHours = Math.floor(Math.abs(new Date() - d) / 36e5);
    return diffHours < 24 ? `${diffHours}h ago` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const summaryItems = useMemo(() => {
    return Object.values(data).flat()
      .filter(item => item.risk?.priority === "High")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 4);
  }, [data]);

  const processItems = (items) => {
    let filtered = [...(items || [])];
    if (search) filtered = filtered.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
    filtered.sort((a, b) => {
      const diff = new Date(a.date) - new Date(b.date);
      return sortOrder === "newest" ? -diff : diff;
    });
    return filtered.slice(0, limit);
  };

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-red-500 font-mono tracking-widest">
      <RefreshCw className="animate-spin mb-4" />
      <span>LOADING SAFETY PROTOCOLS...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-red-500/30">
      <nav className="sticky top-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-3">
          <ShieldAlert size={22} className="text-red-500" />
          <h1 className="font-black text-xl tracking-tighter uppercase italic text-white">SAFETY <span className="text-red-500 not-italic">HORIZON</span></h1>
        </div>
        <div className="flex items-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <span className="flex items-center gap-2 border-l border-slate-800 pl-6">
            <Clock size={14} className="text-red-500" />
            LAST SCAN: {lastScan ? new Date(lastScan).toLocaleTimeString() : "--:--"}
          </span>
          <button onClick={syncData} className="hover:text-red-400 transition transform active:scale-95">
            <RefreshCw size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12">
        {/* SIDEBAR */}
        <aside className="lg:col-span-2 border-r border-slate-800 p-6 bg-[#020617] hidden lg:block">
          <div className="sticky top-28 space-y-10">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 mb-4 block tracking-widest">Master Filter</label>
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-xs focus:border-red-500 outline-none text-slate-200" 
                placeholder="Search Risk..." 
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 mb-4 block tracking-widest">Depth: {limit}</label>
              <input type="range" min="1" max="50" value={limit} onChange={e => setLimit(e.target.value)} className="w-full accent-red-500" />
            </div>
            <button onClick={() => setSortOrder(s => s === "newest" ? "oldest" : "newest")} className="w-full p-3 bg-slate-900 border border-slate-800 rounded text-[10px] font-bold uppercase tracking-widest hover:border-red-500 transition">
              Sort: {sortOrder}
            </button>
            <div className="pt-10 space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-600 block mb-4">External Pulse</label>
              <a href="https://x.com/search?q=AI+jailbreak+OR+deepfake+scam&f=live" target="_blank" className="block text-[9px] bg-slate-900 border border-slate-800 p-2 rounded hover:border-red-500 text-center">X / Twitter Live</a>
              <a href="https://www.google.com/search?q=site:lesswrong.com+incident" target="_blank" className="block text-[9px] bg-slate-900 border border-slate-800 p-2 rounded hover:border-red-500 text-center">Safety Forums</a>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="lg:col-span-10 p-6 space-y-8 h-[calc(100vh-69px)] overflow-y-auto">
          {/* HIGH RISK BRIEFING */}
          <section className="bg-red-950/20 border border-red-500/30 rounded-lg p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <AlertCircle className="text-red-500 animate-pulse" size={18} />
              <h2 className="font-black text-[11px] uppercase tracking-[0.4em] text-red-500">Critical Risk Briefing</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {summaryItems.length > 0 ? summaryItems.map((item, i) => (
                <div key={i} className="bg-slate-900/60 p-4 border-l-4 border-red-500 rounded hover:bg-slate-900/80 transition group">
                  <span className="text-[8px] font-mono text-red-500 uppercase font-black mb-2 block tracking-widest">{item.risk?.tag}</span>
                  <a href={item.link} target="_blank" className="text-xs font-bold leading-tight text-slate-200 group-hover:text-white group-hover:underline">{item.title}</a>
                </div>
              )) : <div className="text-[10px] text-slate-600 italic">Scanning for high-severity signals...</div>}
            </div>
          </section>

          {/* GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {SECTIONS.map(s => {
              const items = processItems(data[s.key]);
              return (
                <div key={s.key} className="bg-[#0f172a] border border-slate-800 rounded-sm overflow-hidden">
                  <div className={`border-t-2 ${s.color} px-4 py-3 bg-slate-900/80 flex justify-between items-center`}>
                    <h2 className="font-black text-[10px] uppercase tracking-widest text-slate-400">{s.title}</h2>
                    <span className="font-mono text-[10px] text-red-500 bg-red-500/5 px-2 py-0.5 rounded">{items.length}</span>
                  </div>
                  <div className="divide-y divide-slate-800/40">
                    {items.map((item, i) => (
                      <div key={i} className="p-4 hover:bg-slate-800/30 transition group">
                        <a href={item.link} target="_blank" className="text-[13px] font-semibold text-slate-300 group-hover:text-white leading-tight block mb-3 uppercase tracking-tight italic group-hover:not-italic">
                          {item.title}
                        </a>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter truncate max-w-[100px]">{item.source}</span>
                          <span className="text-[9px] font-mono text-slate-500">{formatDisplayDate(item.date)}</span>
                          {item.risk?.priority === "High" && (
                            <span className="ml-auto text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(220,38,38,0.4)]">CRITICAL: {item.risk.tag}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
