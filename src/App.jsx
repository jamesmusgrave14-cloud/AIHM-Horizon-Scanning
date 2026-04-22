import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  TrendingUp,
  Cpu,
  MessageSquare,
  Search,
  SlidersHorizontal,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

/* ------------------------- helpers ------------------------- */

function fmtDateShort(d) {
  if (!d) return "";
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return String(d).slice(0, 10);
  return new Date(t).toISOString().slice(0, 10);
}

function withinWindow(timestamp, windowKey) {
  if (!timestamp) return true;
  const now = Date.now() / 1000;
  const age = now - timestamp;
  if (windowKey === "24h") return age <= 24 * 3600;
  if (windowKey === "7d") return age <= 7 * 24 * 3600;
  if (windowKey === "30d") return age <= 30 * 24 * 3600;
  return true;
}

function compareDatesDesc(a, b) {
  const ta = Date.parse(a || "") || 0;
  const tb = Date.parse(b || "") || 0;
  return tb - ta;
}

function compareDatesAsc(a, b) {
  const ta = Date.parse(a || "") || 0;
  const tb = Date.parse(b || "") || 0;
  return ta - tb;
}

function confidenceRank(label) {
  if (label === "High") return 3;
  if (label === "Medium") return 2;
  return 1;
}

function confidenceChip(level) {
  if (level === "High") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (level === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function catChip(cat) {
  const key = (cat || "").toLowerCase();
  if (key.includes("fraud")) return "border-amber-200 bg-amber-50 text-amber-800";
  if (key.includes("cyber")) return "border-cyan-200 bg-cyan-50 text-cyan-900";
  if (key.includes("terror")) return "border-rose-200 bg-rose-50 text-rose-900";
  if (key.includes("vawg")) return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
  if (key.includes("csam") || key.includes("child")) return "border-violet-200 bg-violet-50 text-violet-900";
  if (key.includes("model")) return "border-indigo-200 bg-indigo-50 text-indigo-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function mechanismChip(mechanism) {
  const key = (mechanism || "").toLowerCase();
  if (key.includes("synthetic")) return "border-pink-200 bg-pink-50 text-pink-900";
  if (key.includes("offender")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (key.includes("automation") || key.includes("scale")) return "border-violet-200 bg-violet-50 text-violet-900";
  if (key.includes("targeting")) return "border-cyan-200 bg-cyan-50 text-cyan-900";
  if (key.includes("model misuse") || key.includes("evasion")) return "border-indigo-200 bg-indigo-50 text-indigo-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function subtypeChip(subtype) {
  const key = (subtype || "").toLowerCase();
  if (key.includes("fraud") || key.includes("scam")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (key.includes("grooming") || key.includes("exploitation")) return "border-orange-200 bg-orange-50 text-orange-900";
  if (key.includes("synthetic-image")) return "border-pink-200 bg-pink-50 text-pink-900";
  if (key.includes("stalking") || key.includes("harassment")) return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
  if (key.includes("propaganda") || key.includes("radicalisation") || key.includes("recruitment")) {
    return "border-rose-200 bg-rose-50 text-rose-900";
  }
  if (key.includes("attack planning")) return "border-red-200 bg-red-50 text-red-900";
  if (key.includes("drugs") || key.includes("firearms")) return "border-violet-200 bg-violet-50 text-violet-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function viewTheme(view) {
  if (view === "harms") return { ring: "ring-rose-100", band: "from-rose-50 to-white", accent: "text-rose-700", border: "border-rose-100" };
  if (view === "signals") return { ring: "ring-sky-100", band: "from-sky-50 to-white", accent: "text-sky-700", border: "border-sky-100" };
  if (view === "forums") return { ring: "ring-fuchsia-100", band: "from-fuchsia-50 to-white", accent: "text-fuchsia-700", border: "border-fuchsia-100" };
  if (view === "releases") return { ring: "ring-indigo-100", band: "from-indigo-50 to-white", accent: "text-indigo-700", border: "border-indigo-100" };
  return { ring: "ring-slate-100", band: "from-slate-50 to-white", accent: "text-slate-700", border: "border-slate-100" };
}

function pageBg(view) {
  if (view === "harms") return "bg-gradient-to-b from-rose-50 via-slate-50 to-slate-50";
  if (view === "signals") return "bg-gradient-to-b from-sky-50 via-slate-50 to-slate-50";
  if (view === "forums") return "bg-gradient-to-b from-fuchsia-50 via-slate-50 to-slate-50";
  if (view === "releases") return "bg-gradient-to-b from-indigo-50 via-slate-50 to-slate-50";
  return "bg-gradient-to-b from-rose-50 via-slate-50 to-slate-50";
}

function getItemDateISO(item, kind) {
  const raw = (kind === "signals" ? item?.latest_date || item?.date : item?.date) || (item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : "");
  return fmtDateShort(raw) || "";
}

/* ---------------------------- App ---------------------------- */

export default function App() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("harms");
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [minUkScore, setMinUkScore] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [mechanismFilter, setMechanismFilter] = useState("All");
  const [subtypeFilter, setSubtypeFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [ukOnly, setUkOnly] = useState(false);
  const [showAiSummaries, setShowAiSummaries] = useState(false);
  const [showN, setShowN] = useState(36);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("aihm_ui_prefs_v8");
      if (!raw) return;
      const p = JSON.parse(raw);
      const allowed = new Set(["harms", "signals", "forums", "releases"]);
      if (p?.view && allowed.has(p.view)) setView(p.view);
      if (typeof p?.showN === "number") setShowN(p.showN);
      if (typeof p?.showAiSummaries === "boolean") setShowAiSummaries(p.showAiSummaries);
    } catch { /* ignore */ }
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.BASE_URL}news_data.json?ts=${Date.now()}`);
      setPayload(res.data);
    } catch (e) {
      console.error(e);
      setPayload(null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const sections = payload?.sections || {};
  const errors = payload?.meta?.errors || {};

  function matchesSearch(item) {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const blob = [item?.title || "", item?.source || "", item?.category || item?.primary_category || "", item?.mechanism || "", item?.harm_subtype || "", item?.ai_summary || "", ...(item?.tags || [])].join(" ").toLowerCase();
    return blob.includes(q);
  }

  function passesCommon(item, kind) {
    // Basic implementation for filters
    return matchesSearch(item);
  }

  return (
    <div className={`min-h-screen ${pageBg(view)}`}>
      <div className="max-w-7xl mx-auto px-5 py-5">
        <div className="card p-5 bg-white/80 backdrop-blur border border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">AI Harms Horizon Scan</h1>
              {errors && Object.keys(errors).length > 0 && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Some sources returned errors.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={load} className="pill px-4 py-2 text-sm bg-white/70" type="button">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button onClick={() => setFiltersOpen((v) => !v)} className="pill px-4 py-2 text-sm bg-white/70" type="button">
                <SlidersHorizontal size={16} />
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-4 card p-4 bg-white/70 border border-slate-200">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4">
                  <label className="text-xs text-[var(--muted)]">Search</label>
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Time window</label>
                  <select
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                  >
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                    <option value="All">All time</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
