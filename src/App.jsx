import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Shield, Database, Cpu, Terminal, Clock, RefreshCw, Lock, ChevronRight } from "lucide-react";

export default function App() {
  const [data, setData] = useState({ harms: [], aiid: [], dev_releases: [], technical: [] });
  const [activeTab, setActiveTab] = useState("harms");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/news_data.json?v=" + Date.now());
      setData(res.data.sections);
    } catch (e) { console.error("Fetch error:", e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      {/* HEADER */}
      <header className="border-b border-slate-200 py-5 px-8 sticky top-0 bg-white/90 backdrop-blur-md z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center text-white">
            <Shield size={18} />
          </div>
          <h1 className="font-black text-sm uppercase tracking-tighter">AI Harms Monitor</h1>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-full border border-slate-200 transition">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* NAVIGATION */}
      <nav className="flex px-8 border-b border-slate-100 bg-slate-50 gap-10">
        {[
          { id: "harms", label: "Harms Monitor", icon: Shield },
          { id: "aiid", label: "AIID Reports", icon: Database },
          { id: "dev_releases", label: "Model Releases", icon: Cpu },
          { id: "technical", label: "Technical Signals", icon: Terminal }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-4 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
              activeTab === tab.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {/* CATEGORIZED HARMS VIEW */}
        {activeTab === "harms" && (
          <div className="space-y-16">
            {["Fraud", "CSAM", "Terrorism", "Cyber", "VAWG"].map(cat => (
              <section key={cat}>
                <h2 className="text-[10px] font-black uppercase text-blue-600 mb-6 tracking-[0.3em] flex items-center gap-2">
                  <div className="w-4 h-[1px] bg-blue-600"></div> {cat}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {data.harms.filter(h => h.category === cat).map((item, i) => (
                    <article key={i} className="group border-l border-slate-100 pl-6 hover:border-blue-500 transition-all">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block mb-2">{item.source}</span>
                      <a href={item.link} target="_blank" rel="noreferrer" className="text-[15px] font-bold leading-snug hover:text-blue-600 block transition-colors">
                        {item.title}
                      </a>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* GENERAL GRID VIEW (AIID & RELEASES) */}
        {(activeTab === "aiid" || activeTab === "dev_releases") && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {data[activeTab]?.map((item, i) => (
              <article key={i} className="border-b border-slate-100 pb-8 group">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.source}</span>
                  <ChevronRight size={14} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-bold leading-relaxed hover:text-blue-600">
                  {item.title}
                </a>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-300 font-medium uppercase">
                  <Clock size={12} /> {item.date ? new Date(item.date).toLocaleDateString() : 'Recent'}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* TECHNICAL SNIPPET VIEW */}
        {activeTab === "technical" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded text-[10px] font-bold text-slate-500 flex items-center gap-2 uppercase tracking-widest">
              <Lock size={14} /> Internal Sanitized Snapshot // No External Redirects
            </div>
            {data.technical?.map((sig, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sig.source}</span>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-slate-900 font-bold text-base mb-4 leading-tight">{sig.title}</h3>
                  <div className="bg-slate-900 p-5 rounded font-mono text-[11px] text-emerald-400 leading-relaxed border border-slate-800 shadow-inner">
                    <span className="text-emerald-700 select-none mr-2">$</span> {sig.snippet}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
