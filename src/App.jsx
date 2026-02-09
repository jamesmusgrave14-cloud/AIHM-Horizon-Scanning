import React, { useEffect, useState } from "react";
import axios from "axios";
import { Shield, Code, Terminal, AlertCircle, FileText, Lock } from "lucide-react";

export default function App() {
  const [data, setData] = useState({ harms: [], aiid: [], technical: [] });
  const [activeTab, setActiveTab] = useState("harms");

  useEffect(() => {
    axios.get("/news_data.json").then(res => setData(res.data.sections));
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      {/* PROFESSIONAL HEADER */}
      <header className="border-b border-slate-200 py-4 px-8 bg-white sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield className="text-slate-900" size={20} />
          <h1 className="font-bold text-sm uppercase tracking-tight">AI Harm & Risk Monitor</h1>
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Consolidated Oversight // 2026
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className="border-b border-slate-100 flex px-8 gap-8 bg-slate-50/50">
        {["harms", "aiid", "technical"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-4 text-xs font-bold uppercase tracking-wide border-b-2 transition-all ${
              activeTab === tab ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400"
            }`}
          >
            {tab === "harms" ? "Harm Categories" : tab === "aiid" ? "Incident Database" : "Technical Signals"}
          </button>
        ))}
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {/* HARMS BY CATEGORY VIEW */}
        {activeTab === "harms" && (
          <div className="space-y-12">
            {["Fraud", "CSAM", "Terrorism", "Cyber", "VAWG"].map(cat => (
              <section key={cat}>
                <h2 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-slate-200 rounded-full"></span> {cat}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.harms.filter(h => h.category === cat).map((item, i) => (
                    <div key={i} className="border border-slate-100 p-4 rounded hover:bg-slate-50 transition-colors">
                      <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase">{item.source}</p>
                      <a href={item.link} className="text-sm font-bold leading-snug hover:text-blue-600 block">{item.title}</a>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* TECHNICAL SIGNALS SNIPPET VIEW */}
        {activeTab === "technical" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex gap-3 mb-8">
              <Lock size={18} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Internalized View:</strong> External forum links are restricted. Snippets below show sanitized technical payloads regarding model jailbreaks and guardrail bypasses.
              </p>
            </div>
            {data.technical.map((sig, i) => (
              <div key={i} className="bg-slate-900 rounded-lg p-6 shadow-sm border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-mono text-emerald-500/70 uppercase tracking-widest">{sig.source}</span>
                </div>
                <h3 className="text-slate-100 font-bold text-sm mb-4">{sig.title}</h3>
                <div className="bg-black/50 p-4 rounded font-mono text-[11px] text-slate-400 border border-white/5">
                  {sig.snippet}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
