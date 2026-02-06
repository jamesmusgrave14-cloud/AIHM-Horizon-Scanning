import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { 
  RefreshCw, Search, Calendar, ChevronUp, ChevronDown, 
  Filter, Newspaper, Clock, ArrowUpDown 
} from "lucide-react";

const SECTIONS = [
  { key: "dev_releases", title: "Model Releases", color: "border-blue-500" },
  { key: "watchdogs", title: "Safety Monitors", color: "border-purple-500" },
  { key: "gov_signals", title: "Gov Signals", color: "border-slate-700" },
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
  const [sortOrder, setSortOrder] = useState("newest"); // "newest" or "oldest"

  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/news_data.json?t=${Date.now()}`);
      setData(res.data.sections || {});
      setLastScan(res.data.last_updated);
    } catch (err) {
      console.error("Data sync failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const processItems = (items) => {
    let filtered = [...(items || [])];
    if (search) {
      filtered = filtered.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
    }
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return filtered.slice(0, limit);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 font-sans text-slate-500">
      <RefreshCw className="animate-spin mb-4" size={32} />
      <p className="font-bold tracking-widest uppercase text-xs">Loading Intelligence</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-teal-100">
      {/* TOP NAV */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 text-white p-1 rounded">
            <Newspaper size={20} />
          </div>
          <h1 className="font-black text-lg tracking-tighter uppercase">AIHM <span className="text-teal-600">Horizon</span></h1>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1"><Clock size={14}/> Updated: {new Date(lastScan).toLocaleString()}</span>
          <button onClick={syncData} className="p-2 hover:bg-slate-100 rounded-full transition">
            <RefreshCw size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
        
        {/* SIDEBAR CONTROLS */}
        <aside className="lg:col-span-3 border-r border-slate-200 h-[calc(100vh-57px)] sticky top-[57px] bg-white p-6 hidden lg:block">
          <div className="space-y-8">
            <section>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block tracking-widest">Search Intelligence</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input 
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" 
                  placeholder="Keyword scan..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </section>

            <section>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block tracking-widest">View Settings</label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Results: {limit}</span>
                  <input type="range" min="1" max="50" value={limit} onChange={(e) => setLimit(e.target.value)} className="w-24 accent-teal-600" />
                </div>
                <button 
                  onClick={() => setSortOrder(s => s === "newest" ? "oldest" : "newest")}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm transition"
                >
                  <span className="flex items-center gap-2"><ArrowUpDown size={14}/> Sort by</span>
                  <span className="font-bold text-teal-600 uppercase text-[10px]">{sortOrder}</span>
                </button>
              </div>
            </section>
          </div>
        </aside>

        {/* FEED GRID */}
        <main className="lg:col-span-9 p-6 lg:p-10 h-[calc(100vh-57px)] overflow-y-auto bg-[#f1f5f9]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SECTIONS.map(s => {
              const items = processItems(data[s.key]);
              return (
                <div key={s.key} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className={`border-l-4 ${s.color} px-5 py-4 bg-white border-b border-slate-50 flex justify-between items-center`}>
                    <h2 className="font-black text-sm uppercase tracking-tight text-slate-700">{s.title}</h2>
                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">{items.length}</span>
                  </div>
                  
                  <div className="divide-y divide-slate-100 overflow-y-auto max-h-[400px]">
                    {items.map((item, i) => (
                      <div key={i} className="p-4 hover:bg-slate-50 transition group">
                        <div className="flex justify-between items-start gap-3">
                          <a href={item.link} target="_blank" className="text-sm font-bold text-slate-800 group-hover:text-teal-700 leading-snug">
                            {item.title}
                          </a>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[100px]">{item.source}</span>
                          <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                            <Calendar size={10}/> {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          {item.priority === "High" && (
                            <span className="ml-auto text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">High Risk</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="p-10 text-center text-slate-400 text-xs italic">No matching signals found.</div>
                    )}
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
