import React, { useCallback, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { ShieldAlert, Cpu, Database, MessageSquare, Clock, RefreshCw, ChevronRight, AlertTriangle } from "lucide-react";

// This mapping ensures that no matter what the JSON key is, we show a pretty label
const TAB_CONFIG = {
  harms: { label: "Harm Monitor", icon: ShieldAlert, color: "text-red-600" },
  aiid: { label: "Incident Database", icon: Database, color: "text-orange-500" },
  dev_releases: { label: "Model Releases", icon: Cpu, color: "text-blue-500" },
  models: { label: "Model Releases", icon: Cpu, color: "text-blue-500" }, // Support both naming styles
  forums: { label: "Signal Pulse", icon: MessageSquare, color: "text-emerald-500" },
  social_signals: { label: "Signal Pulse", icon: MessageSquare, color: "text-emerald-500" },
  watchdogs: { label: "Regulators", icon: ShieldAlert, color: "text-slate-500" }
};

export default function App() {
  const [data, setData] = useState({});
  const [activeTab, setActiveTab] = useState(""); // Will set dynamically
  const [loading, setLoading] = useState(true);

  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      // The ?v= forces Vercel to give us the new version you saw in the URL
      const res = await axios.get("/news_data.json?v=" + Date.now());
      const sections = res.data.sections || {};
      setData(sections);
      
      // Auto-select the first tab that actually has data
      const availableKeys = Object.keys(sections);
      if (availableKeys.length > 0 && !activeTab) {
        setActiveTab(availableKeys[0]);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { syncData(); }, [syncData]);

  const activeContent = useMemo(() => data[activeTab] || [], [data, activeTab]);

  if (loading && Object.keys(data).length === 0) {
    return <div className="h-screen flex items-center justify-center font-mono text-slate-400">CONNECTING...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h1 className="font-black text-2xl tracking-tight text-slate-900">AI HARMS MONITOR</h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">Live 2026 Intelligence Feed</span>
            </div>
          </div>
          <button onClick={syncData} className="p-2 hover:bg-slate-50 rounded-full border transition">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 sticky top-20 z-40 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-6 flex gap-6">
          {Object.keys(data).map(key => {
            const config = TAB_CONFIG[key] || { label: key, icon: MessageSquare, color: "text-slate-400" };
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 py-5 border-b-2 transition text-sm font-bold uppercase whitespace-nowrap ${
                  activeTab === key ? "border-red-600 text-red-600" : "border-transparent text-slate-400"
                }`}
              >
                <config.icon size={16} /> {config.label}
                <span className="bg-slate-100 text-[10px] px-2 py-0.5 rounded-full">{data[key].length}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeContent.map((item, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl transition-all group flex flex-col justify-between hover:border-red-200">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.source}</span>
                  {item.priority === "High" || item.risk?.priority === "High" ? (
                    <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-md uppercase animate-pulse">CRITICAL</span>
                  ) : null}
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-md font-bold leading-tight text-slate-800 group-hover:text-red-600 transition block mb-6">
                  {item.title}
                </a>
              </div>
              <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-slate-400 text-[11px] font-mono">
                <span>{item.date?.split('T')[0]}</span>
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>

        {activeContent.length === 0 && (
          <div className="text-center py-40 border-2 border-dashed border-slate-200 rounded-3xl">
            <p className="text-slate-400 italic">This frequency is currently quiet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
