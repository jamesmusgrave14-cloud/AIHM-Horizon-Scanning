import React, { useCallback, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { 
  ShieldAlert, Cpu, Database, MessageSquare, Clock, RefreshCw, 
  ExternalLink, AlertTriangle, ChevronRight, Search 
} from "lucide-react";

const TABS = [
  { id: "harms", label: "Harm Monitor", icon: ShieldAlert, color: "text-red-500" },
  { id: "models", label: "Model Releases", icon: Cpu, color: "text-blue-500" },
  { id: "aiid", label: "Incident DB", icon: Database, color: "text-orange-500" },
  { id: "forums", label: "Signal Pulse", icon: MessageSquare, color: "text-emerald-500" },
];

export default function App() {
  const [data, setData] = useState({});
  const [activeTab, setActiveTab] = useState("harms");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/news_data.json?t=${Date.now()}`);
      setData(res.data.sections || {});
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const activeContent = useMemo(() => {
    let items = data[activeTab] || [];
    if (search) items = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [data, activeTab, search]);

  if (loading) return (
    <div className="h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-400 animate-pulse">
      Initializing Intelligence Core...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold italic">H</div>
            <h1 className="font-bold tracking-tight text-lg text-slate-900">HORIZON <span className="text-slate-400 font-light">INTEL</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input 
                placeholder="Search signals..." 
                className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-full text-xs w-64 focus:ring-2 focus:ring-slate-200 outline-none transition"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={syncData} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <nav className="bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 border-b-2 transition text-sm font-medium ${
                activeTab === tab.id 
                ? "border-slate-900 text-slate-900" 
                : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? tab.color : "text-slate-300"} />
              {tab.label}
              <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full">
                {data[tab.id]?.length || 0}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeContent.map((item, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition group flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.source}</span>
                  {item.risk?.priority === "High" && (
                    <span className="bg-red-50 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase">
                      <AlertTriangle size={10} /> {item.risk.tag}
                    </span>
                  )}
                </div>
                <a 
                  href={item.link} 
                  target="_blank" 
                  className="text-slate-800 font-semibold leading-snug group-hover:text-blue-600 transition block mb-4"
                >
                  {item.title}
                </a>
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock size={12} /> {new Date(item.date).toLocaleDateString()}
                </span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-900 transition" />
              </div>
            </div>
          ))}

          {activeContent.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 italic">
              No matching signals found in this frequency.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
