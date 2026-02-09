import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { ShieldAlert, Cpu, Database, MessageSquare, ExternalLink, RefreshCw, Clock, Filter } from "lucide-react";

const CONFIG = {
  harms: { label: "Harm Monitor", icon: ShieldAlert },
  aiid: { label: "AIID Reports", icon: Database },
  dev_releases: { label: "Model Releases", icon: Cpu },
  forums: { label: "Technical Signals", icon: MessageSquare }
};

export default function App() {
  const [data, setData] = useState({});
  const [activeTab, setActiveTab] = useState("harms");
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(15);
  const [showHighOnly, setShowHighOnly] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/news_data.json?v=" + Date.now());
      setData(res.data.sections || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const items = useMemo(() => {
    let filtered = [...(data[activeTab] || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (showHighOnly) filtered = filtered.filter(i => i.priority === "High");
    return filtered.slice(0, limit);
  }, [data, activeTab, limit, showHighOnly]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert size={20} className="text-slate-800" />
            <h1 className="text-sm font-bold tracking-tight uppercase">AI Harms Monitor</h1>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-slate-400">
            <span>Official Feed</span>
            <button onClick={fetchData} className="p-2 hover:bg-slate-50 rounded-full border border-slate-100 transition">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-100 bg-slate-50/30">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
          <nav className="flex gap-8 h-full">
            {Object.keys(CONFIG).map(key => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative h-full px-1 transition-colors hover:text-slate-900 ${activeTab === key ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600' : ''}`}
              >
                {CONFIG[key].label} ({data[key]?.length || 0})
              </button>
            ))}
          </nav>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Filter size={12} />
              <span>Limit:</span>
              {[15, 30, 50].map(n => (
                <button key={n} onClick={() => setLimit(n)} className={`hover:text-slate-900 ${limit === n ? 'text-blue-600 underline' : ''}`}>{n}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 border-l border-slate-200 pl-6">
              <input type="checkbox" checked={showHighOnly} onChange={() => setShowHighOnly(!showHighOnly)} className="rounded border-slate-300 text-blue-600" />
              High Priority
            </label>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
          {items.map((item, i) => (
            <article key={i} className="group border-b border-slate-100 pb-6 last:border-0 hover:bg-slate-50/50 p-2 -m-2 rounded-lg transition-colors flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.source}</span>
                  {item.priority === "High" && (
                    <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase">Priority</span>
                  )}
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="block mb-4">
                  <h3 className="text-sm font-bold leading-snug text-slate-800 group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>
                </a>
              </div>
              
              <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </article>
          ))}
        </div>

        {items.length === 0 && (
          <div className="py-24 text-center border-2 border-dashed border-slate-50 rounded-xl">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">No matching signals found</p>
          </div>
        )}
      </main>
    </div>
  );
}
