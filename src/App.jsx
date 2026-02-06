import React, { useCallback, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { ShieldAlert, Cpu, Database, MessageSquare, Clock, RefreshCw, ChevronRight, AlertTriangle, Filter, LayoutGrid } from "lucide-react";

const TAB_CONFIG = {
  harms: { label: "Harm Monitor", icon: ShieldAlert, theme: "red" },
  aiid: { label: "Incident Database", icon: Database, theme: "orange" },
  dev_releases: { label: "Model Releases", icon: Cpu, theme: "blue" },
  forums: { label: "Signal Pulse", icon: MessageSquare, theme: "emerald" },
};

export default function App() {
  const [data, setData] = useState({});
  const [activeTab, setActiveTab] = useState("harms");
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(12);
  const [sortOrder, setSortOrder] = useState("newest");

  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/news_data.json?v=" + Date.now());
      setData(res.data.sections || {});
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  // Data Processing: Sort and Limit
  const processedContent = useMemo(() => {
    let items = [...(data[activeTab] || [])];
    
    // Sort logic
    items.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return items.slice(0, limit);
  }, [data, activeTab, limit, sortOrder]);

  if (loading && Object.keys(data).length === 0) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-blue-400">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse tracking-widest text-xs uppercase">Initializing Intelligence Core...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* 2026 GLASSMORPHIC HEADER */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-blue-600 rounded-xl blur opacity-40 animate-pulse"></div>
              <div className="relative w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-700 shadow-2xl">
                <ShieldAlert size={30} className="text-red-500" />
              </div>
            </div>
            <div>
              <h1 className="font-black text-3xl tracking-tighter text-white leading-none">AI HARMS MONITOR</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Operational Phase 2.6</span>
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700">
            <select 
              value={limit} 
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-transparent text-xs font-bold px-3 py-1 outline-none border-r border-slate-700"
            >
              <option value="6">Show 6</option>
              <option value="12">Show 12</option>
              <option value="24">Show 24</option>
            </select>
            <button onClick={syncData} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      {/* NAVIGATION & SORTING */}
      <div className="bg-slate-900/40 border-b border-slate-800/50 sticky top-24 z-40">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <nav className="flex gap-8">
            {Object.keys(TAB_CONFIG).map(key => {
              const config = TAB_CONFIG[key];
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 py-6 border-b-2 transition-all text-xs font-black uppercase tracking-widest ${
                    isActive ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <config.icon size={14} /> {config.label}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${isActive ? "bg-blue-500/10" : "bg-slate-800"}`}>
                    {data[key]?.length || 0}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 pb-4 md:pb-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
              <Filter size={12} />
              <span>Sort:</span>
              <button 
                onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                className="text-blue-400 hover:underline"
              >
                {sortOrder === "newest" ? "Most Recent" : "Oldest First"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT GRID */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {processedContent.map((item, i) => {
            const isHighRisk = item.risk?.priority === "High";
            return (
              <div 
                key={i} 
                className={`group relative bg-slate-800/30 border rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between ${
                  isHighRisk 
                  ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:border-red-500" 
                  : "border-slate-700 hover:border-blue-500/50 shadow-xl"
                }`}
              >
                {isHighRisk && (
                  <div className="absolute -top-2 -right-2 bg-red-600 text-[8px] font-black px-2 py-1 rounded shadow-lg animate-pulse z-10">
                    THREAT DETECTED
                  </div>
                )}
                
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[9px] font-bold text-blue-400/80 uppercase tracking-tighter bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">
                      {item.source}
                    </span>
                    {isHighRisk && <AlertTriangle size={14} className="text-red-500" />}
                  </div>
                  
                  <a href={item.link} target="_blank" rel="noreferrer" className="text-[15px] font-bold leading-snug text-white group-hover:text-blue-400 transition-colors line-clamp-3 mb-6">
                    {item.title}
                  </a>
                </div>

                <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-mono">
                    <Clock size={12} />
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <div className="w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-all">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {processedContent.length === 0 && (
          <div className="text-center py-40 border-2 border-dashed border-slate-800 rounded-3xl">
            <div className="inline-flex p-4 bg-slate-800/50 rounded-full mb-4">
              <LayoutGrid size={32} className="text-slate-600" />
            </div>
            <p className="text-slate-500 font-mono text-sm tracking-tight italic">
              Sector Scan Complete: 0 direct matches in this frequency.
            </p>
          </div>
        )}
      </main>

      {/* FOOTER INFO */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-800 text-center">
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
          Scanning {Object.values(data).flat().length} AI signals across global sectors
        </p>
      </footer>
    </div>
  );
}
