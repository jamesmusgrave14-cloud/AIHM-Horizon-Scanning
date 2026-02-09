import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Shield, Database, Cpu, Terminal, Clock, RefreshCw, Lock, ExternalLink } from "lucide-react";

export default function App() {
  const [data, setData] = useState({ harms: [], aiid: [], dev_releases: [], technical: [] });
  const [activeTab, setActiveTab] = useState("harms");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/news_data.json?v=" + Date.now());
      setData(res.data.sections);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      {/* HEADER */}
      <header className="border-b border-slate-200 py-6 px-8 sticky top-0 bg-white/90 backdrop-blur-md z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Shield size={22} className="text-slate-900" />
          <h1 className="font-bold text-base uppercase tracking-tight">AI Harms Monitoring</h1>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-full border border-slate-200 transition">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* NAVIGATION */}
      <nav className="flex px-8 border-b border-slate-100 bg-slate-50 gap-10">
        {[
          { id: "harms", label: "Monitor Categories", icon: Shield },
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
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {/* HARMS CATEGORIES VIEW */}
        {activeTab === "harms" && (
          <div className="space-y-16">
            {["Fraud", "CSAM", "Terrorism", "Cyber", "VAWG"].map(cat => (
              <section key={cat}>
                <h2 className="text-[11px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em] border-l-4 border-slate-900 pl-3">
                  {cat}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {data.harms.filter(h => h.category === cat).map((item, i) => (
                    <article key={i} className="group border-b border-slate-50 pb-6">
                      <span className="text-[9px] font-bold text-slate-300 uppercase block mb-2">{item.source}</span>
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

        {/* AIID & RELEASES VIEW */}
        {(activeTab === "aiid" || activeTab === "dev_releases") && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {data[activeTab]?.map((item, i) => (
              <article key={i} className="group">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.source}</span>
                  <Clock size={12} className="text-slate-200" />
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-[15px] font-bold leading-relaxed hover:text-blue-600">
                  {item.title}
                </a>
                <div className="mt-4 text-[10px] text-slate-400 font-medium">{new Date(item.date).toLocaleDateString()}</div>
              </article>
            ))}
          </div>
        )}

        {/* TECHNICAL SNIPPETS */}
        {activeTab === "technical" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded text-[10px] font-bold text-slate-500 flex items-center gap-2 uppercase tracking-widest">
              <Lock size={14} /> Internalized Snapshot View // Technical Analysis
            </div>
            {data.technical?.map((sig, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{sig.source}</span>
                  <ExternalLink size={12} className="text-slate-200" />
                </div>
                <div className="p-6">
                  <h3 className="text-slate-900 font-bold text-base mb-4 leading-tight">{sig.title}</h3>
                  <div className="bg-slate-900 p-5 rounded font-mono text-[11px] text-emerald-400 leading-relaxed border border-slate-800">
                    <span className="text-slate-600 mr-2">$</span> {sig.snippet}
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
