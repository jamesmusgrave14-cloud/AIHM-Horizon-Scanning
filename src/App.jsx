import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Shield, Database, Cpu, Terminal, Clock, ExternalLink, Filter, Lock } from "lucide-react";

export default function App() {
  const [data, setData] = useState({ harms: [], aiid: [], dev_releases: [], technical: [] });
  const [activeTab, setActiveTab] = useState("harms");
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/news_data.json?v=" + Date.now()).then(res => {
      setData(res.data.sections);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const items = useMemo(() => (data[activeTab] || []).slice(0, limit), [data, activeTab, limit]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      <header className="border-b border-slate-200 py-4 px-8 sticky top-0 bg-white/80 backdrop-blur-md z-50 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-tight">
          <Shield size={18} /> AI Horizon Scanning
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase">
          <Filter size={12} />
          {[15, 30, 50].map(n => (
            <button key={n} onClick={() => setLimit(n)} className={limit === n ? "text-slate-900 underline" : ""}>{n}</button>
          ))}
        </div>
      </header>

      <nav className="flex px-8 border-b border-slate-100 bg-slate-50/50 gap-8">
        {[
          { id: "harms", label: "Harms Monitor", icon: Shield },
          { id: "aiid", label: "Incident DB", icon: Database },
          { id: "dev_releases", label: "Model Releases", icon: Cpu },
          { id: "technical", label: "Technical Signals", icon: Terminal }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-4 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === tab.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {activeTab === "harms" && (
          <div className="space-y-12">
            {["Fraud", "CSAM", "Terrorism", "Cyber", "VAWG"].map(cat => (
              <section key={cat} className="border-t border-slate-100 pt-6 first:border-0 first:pt-0">
                <h2 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em]">{cat}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.harms.filter(h => h.category === cat).map((item, i) => (
                    <article key={i} className="group">
                      <span className="text-[9px] font-bold text-slate-300 uppercase block mb-1">{item.source}</span>
                      <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-bold leading-snug hover:text-blue-600 transition-colors">{item.title}</a>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {(activeTab === "aiid" || activeTab === "dev_releases") && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((item, i) => (
              <article key={i} className="border-b border-slate-100 pb-6 hover:bg-slate-50/50 p-2 -m-2 rounded transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.source}</span>
                  <Clock size={12} className="text-slate-200" />
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-bold leading-snug hover:text-blue-600">{item.title}</a>
              </article>
            ))}
          </div>
        )}

        {activeTab === "technical" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 p-4 rounded text-[10px] font-mono text-emerald-500 flex items-center gap-2 border border-slate-800">
              <Lock size={12} /> RESTRICTED_FEED // SANITIZED_VIEW // 2026
            </div>
            {data.technical.map((sig, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
                <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{sig.source}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                </div>
                <div className="p-6">
                  <h3 className="text-slate-100 font-bold text-sm mb-4 leading-tight">{sig.title}</h3>
                  <div className="bg-black/50 p-4 rounded border border-white/5 font-mono text-[11px] text-slate-400 leading-relaxed">
                    {sig.snippet}
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
