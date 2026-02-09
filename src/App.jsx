import React, { useCallback, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { ShieldAlert, Cpu, Database, MessageSquare, Clock, RefreshCw, ChevronRight } from "lucide-react";

const TAB_CONFIG = {
  harms: { label: "Harm Monitor", icon: ShieldAlert },
  aiid: { label: "Incident DB", icon: Database },
  dev_releases: { label: "Model Releases", icon: Cpu },
  forums: { label: "Signal Pulse", icon: MessageSquare }
};

export default function App() {
  const [data, setData] = useState({});
  const [activeTab, setActiveTab] = useState("harms");
  const [loading, setLoading] = useState(true);

  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/news_data.json?v=" + Date.now());
      setData(res.data.sections || {});
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const items = useMemo(() => {
    return [...(data[activeTab] || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [data, activeTab]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tighter uppercase">AI Harms Monitor</h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-[0.2em] uppercase">Intelligence Node Active</p>
            </div>
          </div>
          <button onClick={syncData} className="p-2.5 hover:bg-white/5 rounded-full border border-white/10 transition-all">
            <RefreshCw size={16} className={loading ? "animate-spin text-blue-400" : "text-slate-400"} />
          </button>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <nav className="bg-[#020617]/40 border-b border-white/5 sticky top-20 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          {Object.keys(TAB_CONFIG).map(key => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2.5 py-5 border-b-2 transition-all text-[11px] font-bold uppercase tracking-widest ${
                activeTab === key ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>{TAB_CONFIG[key].label}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === key ? "bg-blue-500/10" : "bg-white/5"}`}>
                {data[key]?.length || 0}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN CONTENT GRID */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <div key={i} className={`group bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/20 transition-all flex flex-col justify-between ${item.priority === "High" ? 'ring-1 ring-red-500/30 bg-red-500/[0.02]' : ''}`}>
              <div>
                <div className="flex justify-between items-center mb-5">
                  <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-widest bg-blue-400/5 px-2 py-1 rounded">{item.source}</span>
                  {item.priority === "High" && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>}
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-[15px] font-bold leading-relaxed text-slate-100 group-hover:text-white block mb-8 transition-colors underline-offset-4 hover:underline">{item.title}</a>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase">
                <div className="flex items-center gap-1.5"><Clock size={12} /><span>{new Date(item.date).toLocaleDateString()}</span></div>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
