import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ShieldAlert, Cpu, Database, MessageSquare, Clock, RefreshCw,
  ChevronRight, AlertTriangle, Search, Layers, Newspaper
} from "lucide-react";

const TABS = [
  { id: "triage", label: "Triage", icon: Layers },
  { id: "horizon_board", label: "Horizon Board", icon: ShieldAlert },
  { id: "harms", label: "Harms", icon: AlertTriangle },
  { id: "aiid", label: "AIID", icon: Database },
  { id: "models", label: "Model Cards", icon: Cpu },
  { id: "forums", label: "Forums", icon: MessageSquare },
  { id: "uk_regulators", label: "UK Regulators", icon: ShieldAlert },
  { id: "uk_research_policy", label: "UK Research/Policy", icon: Newspaper },
];

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const HORIZONS = ["Now", "Short-term emerging", "Longer-term uncertain"];

function Badge({ children }) {
  return <span className="px-2 py-0.5 bg-slate-50 border rounded text-[10px] text-slate-600">{children}</span>;
}

function Card({ item }) {
  const isHigh = item?.risk?.priority === "High";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-lg hover:border-red-200 transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.source}</span>
          {isHigh ? (
            <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1">
              <AlertTriangle size={10} /> {item.risk.tag}
            </span>
          ) : (
            <span className="bg-slate-100 text-slate-600 text-[8px] font-black px-2 py-0.5 rounded uppercase">
              {item?.risk?.tag || "GENERAL"}
            </span>
          )}
        </div>

        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="text-[14px] font-bold text-slate-800 leading-tight group-hover:text-red-600 transition block mb-3"
        >
          {item.title}
        </a>

        <div className="flex flex-wrap gap-2 mb-2">
          {item?.risk?.time_horizon && <Badge>{item.risk.time_horizon}</Badge>}
          {(item?.risk?.workstreams || []).map(w => <Badge key={w}>{w}</Badge>)}
          {item?.confidence && <Badge>{item.confidence} conf</Badge>}
        </div>

        {(item?.rmf?.length > 0 || item?.atlas?.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {(item?.rmf || []).slice(0, 2).map(x => <Badge key={x}>RMF:{x}</Badge>)}
            {(item?.atlas || []).slice(0, 2).map(x => <Badge key={x}>ATLAS:{x}</Badge>)}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-50 text-slate-400">
        <span className="text-[10px] flex items-center gap-1 font-mono">
          <Clock size={12} /> {(item.date || "").split("T")[0]}
        </span>
        <div className="bg-slate-100 p-1 rounded group-hover:bg-red-600 group-hover:text-white transition">
          <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [sections, setSections] = useState({});
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("triage");
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [horizonFilter, setHorizonFilter] = useState("All");
  const [workstreamFilter, setWorkstreamFilter] = useState("All");

  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`./news_data.json?t=${Date.now()}`);
      setSections(res.data.sections || {});
      setSummary(res.data.summary || null);
    } catch (err) {
      console.error("Data fetch failed. Ensure news_data.json exists in public folder.", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const baseItems = useMemo(() => {
    if (activeTab === "horizon_board") return sections["triage"] || [];
    return sections[activeTab] || [];
  }, [sections, activeTab]);

  const workstreams = useMemo(() => {
    const ws = new Set();
    (sections["triage"] || []).forEach(i => (i?.risk?.workstreams || []).forEach(w => ws.add(w)));
    return ["All", ...Array.from(ws)];
  }, [sections]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (baseItems || [])
      .filter(i => !q || (i.title || "").toLowerCase().includes(q))
      .filter(i => priorityFilter === "All" || i?.risk?.priority === priorityFilter)
      .filter(i => horizonFilter === "All" || i?.risk?.time_horizon === horizonFilter)
      .filter(i => workstreamFilter === "All" || (i?.risk?.workstreams || []).includes(workstreamFilter))
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a?.risk?.priority] ?? 9;
        const pb = PRIORITY_ORDER[b?.risk?.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        return (b.date || "").localeCompare(a.date || "");
      });
  }, [baseItems, search, priorityFilter, horizonFilter, workstreamFilter]);

  const boardBuckets = useMemo(() => {
    const buckets = { "Now": [], "Short-term emerging": [], "Longer-term uncertain": [] };
    filtered.forEach(i => {
      const h = i?.risk?.time_horizon || "Now";
      if (!buckets[h]) buckets[h] = [];
      buckets[h].push(i);
    });
    return buckets;
  }, [filtered]);

  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center font-mono text-slate-400 uppercase tracking-widest animate-pulse">
        Synchronizing Feeds...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center text-white shadow-lg">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tighter leading-none">AIHM HORIZON SCAN</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                Horizon-first triage board
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                placeholder="Search signals..."
                className="pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded text-xs w-64 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <a
              href="./weekly_digest.md"
              className="text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 transition flex items-center gap-2"
              target="_blank" rel="noreferrer"
              title="Open weekly digest"
            >
              <Newspaper size={14} /> Digest
            </a>

            <button onClick={syncData} className="p-2 hover:bg-slate-100 rounded-full transition">
              <RefreshCw size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        {summary && (
          <div className="max-w-7xl mx-auto px-6 pb-3">
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
              <span className="px-2 py-1 bg-white border rounded">High: <b>{summary.by_priority?.High || 0}</b></span>
              <span className="px-2 py-1 bg-white border rounded">Medium: <b>{summary.by_priority?.Medium || 0}</b></span>
              <span className="px-2 py-1 bg-white border rounded">Low: <b>{summary.by_priority?.Low || 0}</b></span>
              {HORIZONS.map(h => (
                <span key={h} className="px-2 py-1 bg-white border rounded">{h}: <b>{summary.by_horizon?.[h] || 0}</b></span>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* NAV */}
      <nav className="bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 flex overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-4 border-b-2 transition whitespace-nowrap text-sm font-bold uppercase tracking-tight ${
                activeTab === tab.id
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {activeTab === "horizon_board"
                  ? (sections["triage"]?.length || 0)
                  : (sections[tab.id]?.length || 0)}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* FILTERS */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <select className="bg-white border rounded px-2 py-1" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            {["All", "High", "Medium", "Low"].map(p => <option key={p} value={p}>{p === "All" ? "All priorities" : `${p} priority`}</option>)}
          </select>

          <select className="bg-white border rounded px-2 py-1" value={horizonFilter} onChange={e => setHorizonFilter(e.target.value)}>
            {["All", ...HORIZONS].map(h => <option key={h} value={h}>{h === "All" ? "All horizons" : h}</option>)}
          </select>

          <select className="bg-white border rounded px-2 py-1" value={workstreamFilter} onChange={e => setWorkstreamFilter(e.target.value)}>
            {workstreams.map(w => <option key={w} value={w}>{w === "All" ? "All workstreams" : w}</option>)}
          </select>
        </div>
      </div>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "horizon_board" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {HORIZONS.map(h => (
              <div key={h}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-black uppercase tracking-tight text-slate-700">{h}</h2>
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{boardBuckets[h]?.length || 0}</span>
                </div>
                <div className="flex flex-col gap-4">
                  {(boardBuckets[h] || []).map((item, idx) => <Card key={item.id || idx} item={item} />)}
                  {(boardBuckets[h] || []).length === 0 && (
                    <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-mono italic">
                      No items
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item, i) => <Card key={item.id || i} item={item} />)}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-mono italic">
                No items match your filters.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
