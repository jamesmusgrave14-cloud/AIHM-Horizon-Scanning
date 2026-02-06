import React, { useCallback, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { RefreshCw, Search, Clock, Zap, ShieldAlert, ArrowUpDown, LayoutGrid } from "lucide-react";

const SECTIONS = [
  { key: "dev_releases", title: "Model Releases", color: "border-blue-500" },
  { key: "watchdogs", title: "Safety Monitors", color: "border-purple-500" },
  { key: "gov_signals", title: "Gov Signals", color: "border-slate-500" },
  { key: "harms_csea", title: "CSEA Harms", color: "border-red-600" },
  { key: "harms_fraud", title: "Fraud/Scams", color: "border-orange-500" },
  { key: "harms_cyber", title: "Cyber Threats", color: "border-red-400" },
  { key: "research_futures", title: "Research", color: "border-emerald-500" },
  { key: "media_broad", title: "Media Signals", color: "border-slate-400" },
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

  // DATE LOGIC: Handles "2h ago" vs "Oct 12"
  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recent";
    const diffHours = Math.floor(Math.abs(new Date() - d) / 36e5);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const isFresh = (dateStr) => {
    const d = new Date(dateStr);
    return (new Date() - d) / 36e5 < 24; // True if < 24 hours old
  };

  // SUMMARY LOGIC: Picks top 3 High Priority, Newest items
  const summaryItems = useMemo(() => {
    return Object.values(data).flat()
      .filter(item => item.priority === "High")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
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
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-teal-500 font-mono">
      <RefreshCw className="animate-spin mb-4" size={32} />
      <span className="tracking-[0.4em] uppercase text-[10px]">Decrypting Intelligence Feed...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-teal-500/30">
      {/* GLOBAL HEADER */}
      <nav className="sticky top-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-teal-500" fill="currentColor" />
          <h1 className="font-black text-xl tracking-tighter uppercase italic text-white">AIHM <span className="text-teal-500 not-italic">Horizon</span></h1>
        </div>
        <div className="flex items-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
          <span className="hidden md:block">System Status: <span className="text-teal-500">Active</span></span>
          <span className="flex items-center gap-2 border-l border-slate-800 pl-6">
            <Clock size={14} className="text-teal-500" />
            Scan Time: {lastScan ? new Date(lastScan).toLocaleTimeString() : "--:--"}
          </span>
          <button onClick={syncData} className="hover:text-teal-400 transition transform active:scale-95">
            <RefreshCw size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12">
        {/* SIDEBAR CONTROLS */}
        <aside className="lg:col-span-2 border-r border-slate-800 p-6 bg-[#020617] hidden lg:block">
          <div className="sticky top-28 space-y-10">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 mb-4 block tracking-widest">Master Filter</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-600" size={14} />
                <input 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded text-xs focus:border-teal-500 outline-none text-slate-200 transition" 
                  placeholder="Filter signals..." 
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 mb-4 block tracking-widest">Scan Depth</label>
              <input type="range" min="1" max="50" value={limit} onChange={e => setLimit(e.target.value)} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500" />
              <div className="flex justify-between mt-2 font-mono text-[9px] text-slate-500">
                <span>01</span>
                <span>{limit} ITEMS</span>
                <span>50</span>
              </div>
            </div>

            <button 
              onClick={() => setSortOrder(s => s === "newest" ? "oldest" : "newest")}
              className="w-full flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded text-[10px] font-bold uppercase tracking-widest hover:border-teal-500 transition"
            >
              <ArrowUpDown size={14} className="text-teal-500"/>
              Sort: {sortOrder}
            </button>
          </div>
        </aside>

        {/* FEED CONTENT */}
        <main className="lg:col-span-10 p-6 space-y-8 h-[calc(100vh-69px)] overflow-y-auto">
          
          {/* INTELLIGENCE BRIEFING (SUMMARY) */}
          <section className="bg-gradient-to-r from-teal-900/20 to-transparent border border-teal-500/20 rounded-lg p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <ShieldAlert className="text-teal-400" size={18} />
              <h2 className="font-black text-[11px] uppercase tracking-[0.4em] text-teal-400">High-Priority Command Briefing</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {summaryItems.length > 0 ? summaryItems.map((item, i) => (
                <div key={i} className="bg-slate-900/40 p-4 border-l-2 border-teal-500 rounded-r hover:bg-slate-900/60 transition group">
                  <span className="text-[9px] font-mono text-teal-600 uppercase mb-2 block tracking-widest">{item.source}</span>
                  <a href={item.link} target="_blank" rel="noreferrer" className="text-xs font-bold leading-relaxed text-slate-200 group-hover:text-white group-hover:underline">
                    {item.title}
                  </a>
                </div>
              )) : (
                <div className="col-span-3 text-xs text-slate-600 italic">No critical anomalies detected in current search parameters.</div>
              )}
            </div>
          </section>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {SECTIONS.map(s => {
              const items = processItems(data[s.key]);
              return (
                <div key={s.key} className="bg-[#0f172a] border border-slate-800/50 rounded-sm flex flex-col">
                  <div className={`border-t-2 ${s.color} px-4 py-3 bg-slate-900/80 flex justify-between items-center`}>
                    <h2 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">{s.title}</h2>
                    <span className="font-mono text-[10px] text-teal-500 bg-teal-500/5 px-2 py-0.5 rounded">{items.length}</span>
                  </div>
                  
                  <div className="divide-y divide-slate-800/40">
                    {items.map((item, i) => (
                      <div key={i} className="p-4 hover:bg-slate-800/30 transition-all group">
                        <a href={item.link} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-slate-300 group-hover:text-white leading-tight block mb-3 italic group-hover:not-italic">
                          {item.title}
                        </a>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-black text-teal-600 uppercase tracking-tighter truncate max-w-[100px]">{item.source}</span>
                          <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock size={10}/> {formatDisplayDate(item.date)}
                          </span>
                          {isFresh(item.date) && (
                            <span className="text-[8px] font-black bg-teal-500 text-slate-950 px-1.5 py-0.5 rounded-sm animate-pulse">NEW</span>
                          )}
                          {item.priority === "High" && (
                            <span className="ml-auto text-[8px] font-black border border-red-900 text-red-500 px-1.5 py-0.5 rounded uppercase shadow-[0_0_10px_rgba(153,27,27,0.3)]">Critical</span>
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
