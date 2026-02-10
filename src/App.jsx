import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Shield, Database, Cpu, RefreshCw, Search, TrendingUp, MessageSquare, Filter } from "lucide-react";

const CAT_STYLE = (cat) => {
  const key = (cat || "").toLowerCase();
  if (key.includes("fraud")) return { border: "border-amber-600", text: "text-amber-700" };
  if (key.includes("cyber")) return { border: "border-sky-600", text: "text-sky-700" };
  if (key.includes("terror")) return { border: "border-rose-600", text: "text-rose-700" };
  if (key.includes("vawg")) return { border: "border-fuchsia-600", text: "text-fuchsia-700" };
  if (key.includes("csam") || key.includes("child")) return { border: "border-violet-600", text: "text-violet-700" };
  if (key.includes("other")) return { border: "border-slate-600", text: "text-slate-700" };
  return { border: "border-slate-900", text: "text-slate-700" };
};

const withinWindow = (timestamp, windowKey) => {
  if (!timestamp) return true;
  const now = Date.now() / 1000;
  const age = now - timestamp;
  if (windowKey === "24h") return age <= 24 * 3600;
  if (windowKey === "7d") return age <= 7 * 24 * 3600;
  if (windowKey === "30d") return age <= 30 * 24 * 3600;
  return true;
};

export default function App() {
  const [data, setData] = useState({ harms: [], signals: [], forums: [], dev_releases: [], aiid: [] });
  const [coverage, setCoverage] = useState({ by_harm: {} });
  const [activeTab, setActiveTab] = useState("harms");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All"); // All | News | Forum
  const [timeFilter, setTimeFilter] = useState("All"); // All | 24h | 7d | 30d

  // Triage for signals
  const [triage, setTriage] = useState(() => {
    try { return JSON.parse(localStorage.getItem("triage") || "{}"); }
    catch { return {}; }
  });

  const setStatus = (signalId, status) => {
    const next = { ...triage, [signalId]: status };
    setTriage(next);
    localStorage.setItem("triage", JSON.stringify(next));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/news_data.json?v=" + Date.now());
      setData(res.data.sections || {});
      setCoverage(res.data.coverage || { by_harm: {} });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const harmCategories = useMemo(() => {
    const cats = new Set((data.harms || []).map(h => h.category).filter(Boolean));
    const arr = Array.from(cats);
    // Put Other last if present
    arr.sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
    return arr;
  }, [data.harms]);

  const applyCommonFilters = (items) => {
    const q = searchTerm.toLowerCase().trim();
    return (items || []).filter(item => {
      // time
      if (!withinWindow(item.timestamp, timeFilter)) return false;

      // source type (for forums list + signals links)
      if (sourceFilter !== "All") {
        const st = (item.source_type || "").toLowerCase();
        if (sourceFilter === "News" && st !== "news") return false;
        if (sourceFilter === "Forum" && st !== "forum") return false;
      }

      // category filter (harms only)
      if (categoryFilter !== "All" && item.category && item.category !== categoryFilter) return false;

      // text
      if (!q) return true;
      const t = (item.title || "").toLowerCase();
      const s = (item.source || "").toLowerCase();
      const tags = (item.tags || []).join(" ").toLowerCase();
      return t.includes(q) || s.includes(q) || tags.includes(q);
    });
  };

  const tabs = [
    { id: "harms", label: "Harms Monitor", icon: Shield },
    { id: "signals", label: "Signals", icon: TrendingUp },
    { id: "forums", label: "Forums", icon: MessageSquare },
    { id: "dev_releases", label: "Model Releases", icon: Cpu },
    { id: "aiid", label: "Incident Database", icon: Database }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      <header className="border-b border-slate-200 py-6 px-8 sticky top-0 bg-white/95 backdrop-blur z-50 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Shield size={22} className="text-slate-900 fill-slate-900" />
            <h1 className="font-bold text-base uppercase tracking-tight">AI Harms Intelligence</h1>
            <span className="text-[10px] text-slate-400 font-mono">
              updated: {(data?.last_updated || "").slice(0, 19)}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Filter…"
                className="w-full bg-slate-50 border border-slate-200 rounded-full py-2 pl-9 pr-4 text-xs focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-full border border-slate-200 transition">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter size={14} /> Filters:
          </div>

          <select
            className="text-xs border border-slate-200 rounded-full px-3 py-1 bg-white"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            disabled={activeTab !== "harms"}
            title="Category (Harms tab only)"
          >
            <option value="All">All categories</option>
            {harmCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            className="text-xs border border-slate-200 rounded-full px-3 py-1 bg-white"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            title="Recency"
          >
            <option value="All">Any time</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>

          <select
            className="text-xs border border-slate-200 rounded-full px-3 py-1 bg-white"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            disabled={activeTab === "harms" || activeTab === "aiid" || activeTab === "dev_releases"}
            title="Source type (Signals/Forums)"
          >
            <option value="All">All sources</option>
            <option value="News">News only</option>
            <option value="Forum">Forum only</option>
          </select>
        </div>
      </header>

      <nav className="flex px-8 border-b border-slate-100 bg-white gap-8 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-4 text-[10px] font-bold uppercase tracking-widest border-b-2 whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === tab.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {/* HARMS */}
        {activeTab === "harms" && (
          <div className="space-y-12">
            {harmCategories.map(cat => {
              const style = CAT_STYLE(cat);
              const list = applyCommonFilters((data.harms || []).filter(h => h.category === cat));
              if (list.length === 0 && searchTerm) return null;

              return (
                <section key={cat}>
                  <h2 className={`text-[10px] font-black uppercase mb-6 tracking-[0.2em] border-l-2 pl-3 ${style.border} text-slate-500`}>
                    <span className={style.text}>{cat}</span>
                    {coverage?.by_harm?.[cat]?.count ? (
                      <span className="ml-2 text-slate-400">({coverage.by_harm[cat].count})</span>
                    ) : null}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {list.map((item, i) => (
                      <article key={i} className={`group border p-5 rounded-lg transition-colors bg-slate-50/30 hover:border-slate-300 ${style.border}`}>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[8px] font-bold uppercase tracking-tighter ${style.text}`}>{item.source}</span>
                          <span className="text-[9px] text-slate-400 font-mono italic">
                            {(item.date || "").split(" ").slice(1,4).join(" ")}
                          </span>
                        </div>
                        <a href={item.link} target="_blank" rel="noreferrer" className="text-[14px] font-bold leading-snug hover:underline block">
                          {item.title}
                        </a>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* SIGNALS */}
        {activeTab === "signals" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applyCommonFilters(data.signals || []).filter(s => (triage[s.signal_id] || "new") !== "archived").map(s => {
              const status = triage[s.signal_id] || "new";
              return (
                <article key={s.signal_id} className="border border-slate-100 p-5 rounded-lg bg-white hover:border-slate-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      {(s.tags || []).slice(0,3).join(" · ") || "Signal"}{s.source_count ? ` · ${s.source_count} sources` : ""}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {(s.latest_date || "").split(" ").slice(1,4).join(" ")}
                    </div>
                  </div>

                  <div className="text-[14px] font-bold leading-snug">{s.title}</div>

                  <div className="mt-3 space-y-2">
                    {(s.links || []).slice(0,6).map((lnk, idx) => (
                      <a key={idx} href={lnk.link} target="_blank" rel="noreferrer" className="block text-[12px] text-blue-700 hover:underline">
                        {(lnk.source_type === "forum" ? "Forum" : "News")} · {lnk.source}: {lnk.title}
                      </a>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {["new","watching","actionable","archived"].map(st => (
                      <button
                        key={st}
                        onClick={() => setStatus(s.signal_id, st)}
                        className={`text-[10px] px-3 py-1 rounded-full border transition ${
                          status === st ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-transparent hover:bg-slate-50"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* FORUMS */}
        {activeTab === "forums" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {applyCommonFilters(data.forums || []).map((item, i) => (
              <article key={i} className="border-b border-slate-100 pb-6 group">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.source}</span>
                  <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                  <span className="text-[9px] text-slate-300 font-mono">{item.date}</span>
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-[15px] font-bold leading-relaxed group-hover:text-blue-600 transition-colors">
                  {item.title}
                </a>
                {item.tags?.length ? (
                  <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-widest">
                    {item.tags.join(" · ")}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {/* MODEL RELEASES */}
        {activeTab === "dev_releases" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {applyCommonFilters(data.dev_releases || []).map((item, i) => (
              <article key={i} className="border-b border-slate-100 pb-6 group">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.source}</span>
                  <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                  <span className="text-[9px] text-slate-300 font-mono">{item.date}</span>
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-[15px] font-bold leading-relaxed group-hover:text-blue-600 transition-colors">
                  {item.title}
                </a>
              </article>
            ))}
          </div>
        )}

        {/* AIID */}
        {activeTab === "aiid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(data.aiid || []).map((item, i) => (
              <article key={i} className="border-b border-slate-100 pb-6 group">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AIID</span>
                  <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                  <span className="text-[9px] text-slate-300 font-mono">Incident {item.incident_no}</span>
                </div>
                <a href={item.link} target="_blank" rel="noreferrer" className="text-[15px] font-bold leading-relaxed group-hover:text-blue-600 transition-colors">
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
