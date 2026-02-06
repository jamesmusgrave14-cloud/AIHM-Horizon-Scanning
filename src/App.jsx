import React, { useCallback, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { ShieldAlert, Cpu, Database, MessageSquare, Clock, RefreshCw, ChevronRight, AlertTriangle, Search } from "lucide-react";

const TABS = [
  { id: "harms", label: "Harm Monitor", icon: ShieldAlert, color: "text-red-500" },
  { id: "aiid", label: "Incident Database", icon: Database, color: "text-orange-500" },
  { id: "models", label: "Model Cards", icon: Cpu, color: "text-blue-500" },
  { id: "forums", label: "Forum Scrape", icon: MessageSquare, color: "text-emerald-500" },
];

export default function App() {
  const [data, setData] = useState({});
  const [activeTab, setActiveTab] = useState("harms");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      // FIXED PATH: './' ensures it works on GitHub Pages subfolders
      const res = await axios.get(`./news_data.json?t=${Date.now()}`);
      setData(res.data.sections || {});
    } catch (err) { 
      console.error("Data fetch failed. Ensure news_data.json exists in public folder.", err); 
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const activeContent = useMemo(() => {
    const items = data[activeTab] || [];
    if (!search) return items;
    return items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
  }, [data, activeTab, search]);

  if (loading) return <div className="h-screen bg-white flex items-center justify-center font-mono text-slate-400 uppercase tracking-widest animate-pulse">Synchronizing Feeds...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* BRAND HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center text-white shadow-lg">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tighter leading-none">AI HARMS MONITOR</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">2026 Critical Safety Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input 
                placeholder="Search signals..." 
                className="pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded text-xs w-64 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={syncData} className="p-2 hover:bg-slate-100 rounded-full transition"><RefreshCw size={18} className="text-slate-400" /></button>
          </div>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className="bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 flex overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-4 border-b-2 transition whitespace-nowrap text-sm font-bold uppercase tracking-tight ${
                activeTab === tab.id ? "border-red-600 text-red-600" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {data[tab.id]?.length || 0}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* FEED GRID */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeContent.map((item, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-xl hover:border-red-200 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.source}</span>
                  {item.risk?.priority === "High" && (
                    <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1 animate-pulse">
                      <AlertTriangle size={10} /> {item.risk.tag}
                    </span>
                  )}
                </div>
                <a href={item.link} target="_blank" className="text-[15px] font-bold text-slate-800 leading-tight group-hover:text-red-600 transition block mb-6">
                  {item.title}
                </a>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50 text-slate-400">
                <span className="text-[10px] flex items-center gap-1 font-mono"><Clock size={12} /> {item.date.split('T')[0]}</span>
                <div className="bg-slate-100 p-1 rounded group-hover:bg-red-600 group-hover:text-white transition">
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          ))}

          {activeContent.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-mono italic">
              Frequency empty. Re-scan in progress...
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
