import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ExternalLink,
  RefreshCw,
  Search,
  Download,
  Pin,
  PinOff,
  EyeOff,
  Eye,
  ChevronDown,
  ChevronRight,
  LayoutList,
  List,
  Globe,
  SlidersHorizontal,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";

const STORAGE_KEY = "aihm_monitor_state_v5";

const GROUPS = [
  { key: "all", label: "All" },
  { key: "dev", label: "Developer releases" },
  { key: "watchdogs", label: "Watchdogs & monitors" },
  { key: "gov", label: "Gov / HMG signals" },
  { key: "harms", label: "Operational harms" },
  { key: "research", label: "Academic & futures" },
  { key: "media", label: "Media & broad" },
];

const SECTIONS = [
  { key: "dev_releases", group: "dev", title: "Developer releases & model cards", subtitle: "Model/system cards, releases, weights.", tone: "blue" },
  { key: "watchdogs", group: "watchdogs", title: "Watchdogs & safety monitors", subtitle: "AISI/CETaS/Ada/Oxford/IWF outputs.", tone: "maroon" },
  { key: "gov_signals", group: "gov", title: "Government / HMG signals", subtitle: "GO‑Science, Ofcom, DSIT, NCSC, NCA.", tone: "maroon" },
  { key: "harms_csea", group: "harms", title: "CSEA / IBSA signals", subtitle: "Nudification, sextortion, child safety harms.", tone: "red" },
  { key: "harms_fraud", group: "harms", title: "Fraud & impersonation", subtitle: "Voice cloning, scams, synthetic identity.", tone: "red" },
  { key: "harms_cyber", group: "harms", title: "Cybercrime enablement", subtitle: "Phishing, malware, ransomware.", tone: "red" },
  { key: "research_futures", group: "research", title: "Academic & futures signals", subtitle: "Research/think-tank outputs.", tone: "blue" },
  { key: "media_broad", group: "media", title: "Broad media capture", subtitle: "Guaranteed baseline: AI + harms keywords.", tone: "blue" },
];

// Helper Functions
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const Pill = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] bg-white text-slate-700 border-slate-200">{children}</span>
);
const PriorityPill = ({ value }) => {
  const cls = value === "High" ? "bg-red-100 text-red-800 border-red-200" : value === "Medium" ? "bg-amber-100 text-amber-900 border-amber-200" : "bg-emerald-100 text-emerald-900 border-emerald-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${cls}`}>{value} priority</span>;
};

export default function App() {
  const [data, setData] = useState({});
  const [lastScan, setLastScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [group, setGroup] = useState("all");
  const [viewMode, setViewMode] = useState("comfortable");
  const [pinned, setPinned] = useState(new Set());
  const [hidden, setHidden] = useState(new Set());
  const [collapsed, setCollapsed] = useState({});

  // 1. SYNC LOGIC: Reads from the file created by GitHub Actions
  const syncData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/news_data.json");
      setData(res.data.sections || {});
      setLastScan(res.data.last_updated);
    } catch (err) {
      console.error("News data not found. Run GitHub Action first.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  // 2. FILTERING LOGIC
  const filteredView = useMemo(() => {
    const out = {};
    SECTIONS.forEach((s) => {
      let items = data[s.key] || [];
      
      // Filter by Search
      if (search) {
        items = items.filter(it => it.title.toLowerCase().includes(search.toLowerCase()));
      }
      
      // Filter by Priority (Logic handled in Python script normally, but we can verify here)
      if (priority !== "All") {
        // Simple client-side priority filter if your script adds it
        items = items.filter(it => (it.priority || "Low") === priority);
      }

      // Handle Pinned/Hidden
      const pinnedItems = items.filter(it => pinned.has(it.link));
      const rest = items.filter(it => !pinned.has(it.link) && !hidden.has(it.link));
      
      out[s.key] = [...pinnedItems, ...rest];
    });
    return out;
  }, [data, search, priority, pinned, hidden]);

  const visibleSections = useMemo(() => 
    SECTIONS.filter(s => group === "all" || s.group === group), 
  [group]);

  if (loading) return <div className="flex items-center justify-center h-screen font-serif animate-pulse text-slate-500">Synchronising Intelligence Briefing...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-serif">
      <div className="max-w-6xl mx-auto px-6 py-10">
        
        {/* HEADER */}
        <header className="bg-teal-800 text-white p-8 rounded-t-2xl shadow-lg border-b-4 border-black">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter italic">AIHM Horizon Scanning</h1>
              <p className="text-sm font-sans opacity-80 mt-2 tracking-widest uppercase">Intelligence Report • Updated: {lastScan}</p>
            </div>
            <button onClick={syncData} className="bg-white text-teal-900 px-4 py-2 rounded-lg font-sans font-bold text-sm flex items-center gap-2 hover:bg-slate-100 transition">
              <RefreshCw size={16} /> Sync Latest
            </button>
          </div>
        </header>

        {/* CONTROLS */}
        <div className="bg-white border-x border-slate-200 p-6 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              className="w-full pl-10 pr-4 py-2 border rounded-lg font-sans text-sm focus:ring-2 focus:ring-teal-500 outline-none" 
              placeholder="Search reports..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="border rounded-lg p-2 font-sans text-sm" value={group} onChange={(e) => setGroup(e.target.value)}>
            {GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <select className="border rounded-lg p-2 font-sans text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="All">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
          </select>
          <button onClick={() => setViewMode(v => v === "compact" ? "comfortable" : "compact")} className="border rounded-lg p-2 font-sans text-sm flex items-center justify-center gap-2">
            {viewMode === "compact" ? <LayoutList size={16} /> : <List size={16} />} Toggle Density
          </button>
        </div>

        {/* MAIN FEED */}
        <main className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-6 shadow-sm min-h-[500px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {visibleSections.map(s => (
              <section key={s.key} className="border-t-2 border-slate-100 pt-6 first:border-t-0 lg:first:border-t-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className={`text-xl font-black uppercase tracking-tight ${s.tone === 'red' ? 'text-red-800' : 'text-teal-800'}`}>
                      {s.title}
                    </h2>
                    <p className="text-xs text-slate-500 font-sans">{s.subtitle}</p>
                  </div>
                  <Pill>{filteredView[s.key]?.length || 0} hits</Pill>
                </div>

                <ul className="space-y-4">
                  {filteredView[s.key]?.map((item, i) => (
                    <li key={i} className={`group border-l-2 pl-4 transition-all ${pinned.has(item.link) ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <a href={item.link} target="_blank" className="font-bold text-slate-900 hover:text-teal-700 leading-tight block">
                          {item.title}
                        </a>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => {
                            const next = new Set(pinned);
                            next.has(item.link) ? next.delete(item.link) : next.add(item.link);
                            setPinned(next);
                          }} className="text-slate-400 hover:text-teal-600">
                            {pinned.has(item.link) ? <PinOff size={14} /> : <Pin size={14} />}
                          </button>
                        </div>
                      </div>
                      
                      {viewMode !== "compact" && (
                        <div className="flex gap-3 mt-2 items-center">
                          <span className="text-[10px] uppercase font-sans font-bold text-slate-400">{item.source}</span>
                          <PriorityPill value={item.priority || "Low"} />
                        </div>
                      )}
                    </li>
                  ))}
                  {filteredView[s.key]?.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No reports found for this section.</p>
                  )}
                </ul>
              </section>
            ))}
          </div>
        </main>

        <footer className="mt-8 text-center text-xs text-slate-400 font-sans uppercase tracking-[0.2em]">
          Automated Horizon Scan • AIHM Internal Report • Proprietary Data
        </footer>
      </div>
    </div>
  );
}
