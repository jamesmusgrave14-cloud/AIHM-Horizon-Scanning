import React, { useEffect, useState } from "react";
import axios from "axios";
import { Shield, Database, Cpu, Terminal, Clock, RefreshCw, AlertTriangle, Lock } from "lucide-react";

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
      <header className="border-b border-slate-200 py-6 px-8 sticky top-0 bg-white/95 backdrop-blur z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Shield size={22} className="text-slate-900" />
          <h1 className="font-bold text-base uppercase tracking-tight">AI Harms Monitoring</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Feed // 2026</span>
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-full border border-slate-200 transition">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <nav className="flex px-8 border-b border-slate-100 bg-slate-50 gap-10 overflow-x-auto">
        {[
          { id: "harms", label: "Harms Monitor", icon: Shield },
          { id: "aiid", label: "AIID Reports", icon: Database },
          { id: "technical", label: "Technical Risk Signals", icon: Terminal }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-4 text-[11px] font-bold uppercase tracking-widest border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {/* CATEGORIZED HARMS */}
        {activeTab === "harms" && (
          <div className="space-y-16">
            {["Fraud", "CSAM", "Terrorism", "Cyber", "VAWG"].map(cat => (
              <section key={cat}>
                <h2 className="text-[11px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em] border-l-4 border-slate-900 pl-3">
                  {cat}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {data.harms?.filter(h => h.category === cat).map((item, i) => (
                    <article key={i} className="group border-b border-slate-50 pb-6">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-slate-300 uppercase">{item.source}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{item.date.split(' ').slice(1,4).join(' ')}</span>
                      </div>
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

        {/* TECHNICAL SIGNALS OVERHAUL */}
        {activeTab === "technical" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-amber-50 border border-amber-100 p-4 rounded text-[10px] font-bold text-amber-700 flex items-center gap-2 uppercase tracking-widest">
              <Lock size={14} /> Risk Analysis Module: Identifying High-Impact Exploits
            </div>
            {data.technical?.map((sig, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-slate-900 font-bold text-base leading-tight pr-4">{sig.title}</h3>
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${
                      sig.risk === 'CRITICAL' ? 'bg-red-600 text-white' : 
                      sig.risk === 'High' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {sig.risk} RISK
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-md mb-4">
                    <p className="text-[12px] text-slate-600 italic leading-relaxed">
                      "{sig.summary}"
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <Clock size={12} /> {sig.date}
                    </div>
                    <span className="text-slate-300">{sig.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AIID LIST */}
        {activeTab === "aiid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {data.aiid?.map((item, i) => (
              <article key={i} className="border-b border-slate-100 pb-6">
                 <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{item.source}</span>
                  <span className="text-[10px] text-slate-300">{item.date}</span>
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-bold leading-relaxed hover:text-blue-600">
                  {item.title}
                </a>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
