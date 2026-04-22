import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Shield,
  TrendingUp,
  Cpu,
  MessageSquare,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

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
function confidenceChip(level) {
  if (level === "High") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (level === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}
function riskAreaChip(label) {
  const key = (label || "").toLowerCase();
  if (key.includes("ra09") || key.includes("financial crime")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (key.includes("ra11") || key.includes("sexual crime")) return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
  if (key.includes("ra13") || key.includes("terror")) return "border-rose-200 bg-rose-50 text-rose-900";
  if (key.includes("ra14") || key.includes("illegal item")) return "border-cyan-200 bg-cyan-50 text-cyan-900";
  if (key.includes("model release")) return "border-indigo-200 bg-indigo-50 text-indigo-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}
function subtypeChip(label) {
  if (!label) return "border-slate-200 bg-slate-50 text-slate-600";
  const key = String(label).toLowerCase();
  if (key.includes("csam") || key.includes("child sexual")) return "border-violet-200 bg-violet-50 text-violet-900";
  if (key.includes("ncii") || key.includes("deepfake") || key.includes("vawg")) return "border-pink-200 bg-pink-50 text-pink-900";
  if (key.includes("phishing") || key.includes("impersonation") || key.includes("fraud")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (key.includes("evidence") || key.includes("identity") || key.includes("border") || key.includes("immigration")) return "border-slate-200 bg-slate-50 text-slate-700";
  if (key.includes("terror") || key.includes("radical")) return "border-rose-200 bg-rose-50 text-rose-900";
  if (key.includes("drug") || key.includes("weapon") || key.includes("illicit") || key.includes("counterfeit") || key.includes("cyber")) return "border-cyan-200 bg-cyan-50 text-cyan-900";
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
  const raw = (kind === "signals" ? (item?.latest_date || item?.date) : item?.date) || (item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : "");
  return fmtDateShort(raw) || "";
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
function getTopRiskArea(item, kind) {
  if (kind === "signals") return item?.primary_risk_area_name || item?.primary_category || "Cross-cutting / unassigned";
  if (kind === "releases") return "Model Releases";
  return item?.risk_area_name || item?.category || "Cross-cutting / unassigned";
}
function getSubtype(item, kind) {
  if (kind === "signals") return item?.primary_subtype || item?.legacy_primary_category || "";
  if (kind === "releases") return "";
  return item?.risk_subtype || item?.legacy_category || "";
}
function getRiskCode(item, kind) {
  if (kind === "signals") return item?.primary_risk_area_code || "";
  if (kind === "releases") return "";
  return item?.risk_area_code || "";
}

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
  const [sourceFilter, setSourceFilter] = useState("All");
  const [ukOnly, setUkOnly] = useState(false);
  const [showAiSummaries, setShowAiSummaries] = useState(false);
  const [showN, setShowN] = useState(36);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [harmsFocusCat, setHarmsFocusCat] = useState("All");
  const [openBuckets, setOpenBuckets] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("aihm_ui_prefs_v7");
      if (!raw) return;
      const p = JSON.parse(raw);
      const allowed = new Set(["harms", "signals", "forums", "releases"]);
      if (p?.view && allowed.has(p.view)) setView(p.view);
      if (typeof p?.showN === "number") setShowN(p.showN);
      if (typeof p?.showAiSummaries === "boolean") setShowAiSummaries(p.showAiSummaries);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("aihm_ui_prefs_v7", JSON.stringify({ view, showN, showAiSummaries })); } catch {}
  }, [view, showN, showAiSummaries]);

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
  const coverage = payload?.coverage || {};
  const summaries = payload?.summaries || {};
  const meta = payload?.meta || {};
  const limits = meta?.limits || {};
  const errors = meta?.errors || {};

  const counts = useMemo(() => ({
    harms: (sections.harms || []).length,
    signals: (sections.signals || []).length,
    dev_releases: (sections.dev_releases || []).length,
    forums: (sections.forums || []).length,
  }), [sections]);

  const allCategories = useMemo(() => {
    const cats = new Set();
    (sections?.harms || []).forEach((h) => cats.add(getTopRiskArea(h, "harms")));
    (sections?.signals || []).forEach((s) => cats.add(getTopRiskArea(s, "signals")));
    (sections?.forums || []).forEach((f) => cats.add(getTopRiskArea(f, "forums")));
    (sections?.dev_releases || []).forEach(() => cats.add("Model Releases"));
    return ["All", ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
  }, [sections]);
  const harmCategories = useMemo(() => {
    const cats = new Set((sections.harms || []).map((h) => getTopRiskArea(h, "harms")).filter(Boolean));
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [sections.harms]);

  function matchesSearch(item, kind) {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const title = (item?.title || "").toLowerCase();
    const source = (item?.source || "").toLowerCase();
    const tags = (item?.tags || []).join(" ").toLowerCase();
    const riskArea = getTopRiskArea(item, kind).toLowerCase();
    const subtype = getSubtype(item, kind).toLowerCase();
    const riskCode = getRiskCode(item, kind).toLowerCase();
    const legacy = String(item?.legacy_category || item?.legacy_primary_category || "").toLowerCase();
    const summary = (item?.ai_summary || "").toLowerCase();
    return title.includes(q) || source.includes(q) || tags.includes(q) || riskArea.includes(q) || subtype.includes(q) || riskCode.includes(q) || legacy.includes(q) || summary.includes(q);
  }
  function passesDateRange(item, kind) {
    const d = getItemDateISO(item, kind);
    if (!d) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }
  function passesCommon(item, kind) {
    if (dateFrom || dateTo) {
      if (!passesDateRange(item, kind)) return false;
    } else {
      const ts = item?.timestamp;
      if (ts && !withinWindow(ts, timeFilter)) return false;
    }
    if (ukOnly) {
      const uk = item?.uk_relevance || (item?.uk_score >= 2);
      if (!uk) return false;
    }
    if (minUkScore > 0) {
      const score = item?.uk_score ?? (item?.uk_relevance ? 2 : 0);
      if (score < minUkScore) return false;
    }
    if (categoryFilter !== "All") {
      if (getTopRiskArea(item, kind) !== categoryFilter) return false;
    }
    if (sourceFilter !== "All") {
      if (kind === "signals") {
        const links = item?.links || [];
        const anyForum = links.some((l) => (l?.source_type || "").toLowerCase() === "forum");
        const anyNews = links.some((l) => (l?.source_type || "").toLowerCase() === "news");
        if (sourceFilter === "Forum" && !anyForum) return false;
        if (sourceFilter === "News" && !anyNews) return false;
      } else {
        const st = (item?.source_type || "news").toLowerCase();
        if (sourceFilter === "Forum" && st !== "forum") return false;
        if (sourceFilter === "News" && st !== "news") return false;
      }
    }
    return matchesSearch(item, kind);
  }
  function sortItems(items, kind) {
    if (sortBy === "relevance") return items;
    const copy = items.slice();
    if (sortBy === "newest") return copy.sort((a, b) => compareDatesDesc(getItemDateISO(a, kind), getItemDateISO(b, kind)));
    if (sortBy === "oldest") return copy.sort((a, b) => compareDatesAsc(getItemDateISO(a, kind), getItemDateISO(b, kind)));
    if (sortBy === "uk") return copy.sort((a, b) => (b?.uk_score ?? (b?.uk_relevance ? 2 : 0)) - (a?.uk_score ?? (a?.uk_relevance ? 2 : 0)));
    if (sortBy === "confidence" && kind === "signals") return copy.sort((a, b) => confidenceRank(b?.confidence_label) - confidenceRank(a?.confidence_label));
    return copy;
  }

  const harms = useMemo(() => sortItems((sections.harms || []).filter((x) => passesCommon(x, "harms")), "harms"), [sections.harms, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);
  const signals = useMemo(() => sortItems((sections.signals || []).filter((x) => passesCommon(x, "signals")), "signals"), [sections.signals, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);
  const forums = useMemo(() => sortItems((sections.forums || []).filter((x) => passesCommon(x, "forums")), "forums"), [sections.forums, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);
  const releases = useMemo(() => sortItems((sections.dev_releases || []).filter((x) => passesCommon(x, "releases")), "releases"), [sections.dev_releases, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);
  function toggleBucket(cat) { setOpenBuckets((s) => ({ ...s, [cat]: !s[cat] })); }

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (searchTerm.trim()) chips.push({ k: "search", label: `Search: ${searchTerm.trim()}` });
    if (dateFrom) chips.push({ k: "dateFrom", label: `From: ${dateFrom}` });
    if (dateTo) chips.push({ k: "dateTo", label: `To: ${dateTo}` });
    if (!dateFrom && !dateTo && timeFilter !== "All") chips.push({ k: "time", label: `Time: ${timeFilter}` });
    if (categoryFilter !== "All") chips.push({ k: "cat", label: `Risk area: ${categoryFilter}` });
    if (sourceFilter !== "All") chips.push({ k: "src", label: `Source: ${sourceFilter}` });
    if (sortBy !== "relevance") chips.push({ k: "sort", label: `Sort: ${sortBy}` });
    if (minUkScore > 0) chips.push({ k: "minUk", label: `Min UK: ${minUkScore}` });
    if (ukOnly) chips.push({ k: "ukOnly", label: "UK only" });
    if (showAiSummaries) chips.push({ k: "aiSum", label: "AI summaries" });
    return chips;
  }, [searchTerm, dateFrom, dateTo, timeFilter, categoryFilter, sourceFilter, sortBy, minUkScore, ukOnly, showAiSummaries]);
  function clearChip(k) {
    if (k === "search") setSearchTerm("");
    if (k === "dateFrom") setDateFrom("");
    if (k === "dateTo") setDateTo("");
    if (k === "time") setTimeFilter("7d");
    if (k === "cat") setCategoryFilter("All");
    if (k === "src") setSourceFilter("All");
    if (k === "sort") setSortBy("relevance");
    if (k === "minUk") setMinUkScore(0);
    if (k === "ukOnly") setUkOnly(false);
    if (k === "aiSum") setShowAiSummaries(false);
  }
  function clearAllFilters() {
    setSearchTerm(""); setTimeFilter("7d"); setDateFrom(""); setDateTo(""); setSortBy("relevance"); setMinUkScore(0); setCategoryFilter("All"); setSourceFilter("All"); setUkOnly(false);
  }

  return (
    <div className={`min-h-screen ${pageBg(view)}`}>
      <div className="max-w-7xl mx-auto px-5 py-5 animate-fadeUp">
        <div className="card p-5 bg-white/80 backdrop-blur border border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--a1)" }} />
                <h1 className="text-lg font-semibold">AI Harms Horizon Scan</h1>
                {payload?.last_updated ? <span className="text-sm text-[var(--muted)] font-mono">updated {String(payload.last_updated).slice(0, 19)}</span> : null}
              </div>
              <div className="mt-2 text-sm text-[var(--muted)] max-w-3xl leading-relaxed">{payload?.disclaimer || "Proof-of-concept dashboard for harms-focused horizon scanning."}</div>
              <div className="mt-2 text-xs text-slate-500">Visible top-level taxonomy uses only the current HO-owned risk areas from the current HO-owned sheet (RA09, RA11, RA13, RA14) plus Cross-cutting / unassigned. Subtypes sit underneath each item.</div>
              {errors && Object.keys(errors).length ? <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Some sources returned errors (see meta.errors in news_data.json): {Object.keys(errors).join(", ")}</div> : null}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} className="pill px-4 py-2 text-sm hover:bg-white transition inline-flex items-center gap-2 bg-white/70" title="Refresh"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Refresh</button>
              <button onClick={() => setFiltersOpen((v) => !v)} className="pill px-4 py-2 text-sm hover:bg-white transition inline-flex items-center gap-2 bg-white/70" title="Filters"><SlidersHorizontal size={16} />Filters</button>
            </div>
          </div>

          {!filtersOpen && activeFilterChips.length ? (
            <div className="mt-4"><div className="flex flex-wrap items-center gap-2"><div className="text-xs text-[var(--muted)] mr-1">Active filters:</div>{activeFilterChips.map((c) => (<button key={c.k} onClick={() => clearChip(c.k)} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white/70 hover:bg-white transition" title="Click to remove" type="button">{c.label}<X size={14} className="text-slate-400" /></button>))}<button onClick={clearAllFilters} className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition" title="Clear all filters" type="button">Clear all</button></div></div>
          ) : null}

          {filtersOpen ? (
            <div className="mt-4 card p-4 bg-white/70 border border-slate-200">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4"><label className="text-xs text-[var(--muted)]">Search</label><div className="relative mt-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="titles, risk areas, subtypes, sources…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" /></div></div>
                <div className="lg:col-span-2"><label className="text-xs text-[var(--muted)]">Time window</label><select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} disabled={!!(dateFrom || dateTo)} title={dateFrom || dateTo ? "Disabled when Date From/To is set" : ""}><option value="24h">Last 24h</option><option value="7d">Last 7d</option><option value="30d">Last 30d</option><option value="All">Any time</option></select></div>
                <div className="lg:col-span-2"><label className="text-xs text-[var(--muted)]">Date from</label><input type="date" className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
                <div className="lg:col-span-2"><label className="text-xs text-[var(--muted)]">Date to</label><input type="date" className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
                <div className="lg:col-span-2"><label className="text-xs text-[var(--muted)]">Show</label><select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={showN} onChange={(e) => setShowN(parseInt(e.target.value, 10))}>{[24, 36, 48, 72, 100].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                <div className="lg:col-span-3"><label className="text-xs text-[var(--muted)]">Risk area</label><select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>{allCategories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="lg:col-span-3"><label className="text-xs text-[var(--muted)]">Source type</label><select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="All">All</option><option value="News">News</option><option value="Forum">Forum</option></select></div>
                <div className="lg:col-span-3"><label className="text-xs text-[var(--muted)]">Sort</label><select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="relevance">Relevance (default)</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="uk">UK score first</option><option value="confidence">Confidence first (Signals)</option></select></div>
                <div className="lg:col-span-3"><label className="text-xs text-[var(--muted)]">Min UK score: {minUkScore}</label><input type="range" min="0" max="3" step="1" value={minUkScore} onChange={(e) => setMinUkScore(parseInt(e.target.value, 10))} className="mt-2 w-full" /></div>
                <div className="lg:col-span-12 flex flex-wrap gap-3 items-center mt-1"><label className="inline-flex items-center gap-2 text-sm pill px-3 py-2 bg-white"><input type="checkbox" checked={ukOnly} onChange={(e) => setUkOnly(e.target.checked)} />UK only (strict)</label><label className="inline-flex items-center gap-2 text-sm pill px-3 py-2 bg-white"><input type="checkbox" checked={showAiSummaries} onChange={(e) => setShowAiSummaries(e.target.checked)} />Show AI summaries</label><button onClick={() => { setDateFrom(""); setDateTo(""); }} className="pill px-3 py-2 text-sm hover:bg-white transition bg-white" title="Clear date range" type="button">Clear dates</button><button onClick={clearAllFilters} className="pill px-3 py-2 text-sm hover:bg-white transition bg-white" title="Clear all filters" type="button">Clear all</button><div className="text-xs text-[var(--muted)] font-mono">TIME_WINDOW={limits.TIME_WINDOW || "—"} · RELEASE_TIME_WINDOW={limits.RELEASE_TIME_WINDOW || "—"} · dedupe={meta.dedupe_mode || "—"}</div></div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-4">
          <aside className="card p-4 bg-white/70 backdrop-blur border border-slate-200 lg:sticky lg:top-4 lg:self-start">
            <NavItem icon={<Shield size={16} />} label="Harms" active={view === "harms"} onClick={() => setView("harms")} count={counts.harms} />
            <NavItem icon={<TrendingUp size={16} />} label="Signals" active={view === "signals"} onClick={() => setView("signals")} count={counts.signals} />
            <NavItem icon={<MessageSquare size={16} />} label="Forums" active={view === "forums"} onClick={() => setView("forums")} count={counts.forums} />
            <NavItem icon={<Cpu size={16} />} label="Model releases" active={view === "releases"} onClick={() => setView("releases")} count={counts.dev_releases} />
            <div className="hr my-3" />
            <div className="text-xs text-[var(--muted)]">Visible top-level buckets now exclude RA10 and use only the current HO-owned risk areas from the current HO-owned sheet, plus Cross-cutting / unassigned.</div>
          </aside>
          <main className="space-y-4">
            {loading && !payload ? <SkeletonDashboard /> : null}
            {!loading && payload && view === "harms" ? <HarmsView categories={harmCategories} harms={harms} coverage={coverage} summaries={summaries} openBuckets={openBuckets} toggleBucket={toggleBucket} showN={showN} showAiSummaries={showAiSummaries} harmsFocusCat={harmsFocusCat} setHarmsFocusCat={setHarmsFocusCat} /> : null}
            {!loading && payload && view === "signals" ? <SignalsView items={signals.slice(0, showN)} showAiSummaries={showAiSummaries} /> : null}
            {!loading && payload && view === "forums" ? <ForumsView items={forums.slice(0, showN)} /> : null}
            {!loading && payload && view === "releases" ? <ReleasesView items={releases.slice(0, showN)} /> : null}
            {!loading && !payload ? <div className="card p-4 text-sm bg-white/80 backdrop-blur border border-slate-200">Failed to load <span className="font-mono">news_data.json</span>.</div> : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, count }) {
  return <button onClick={onClick} className={`w-full text-left px-3 py-2 rounded-xl mb-1 transition flex items-center justify-between ${active ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50"}`} type="button"><span className="inline-flex items-center gap-2 text-sm"><span className="text-slate-500">{icon}</span><span className="font-medium">{label}</span></span>{count !== null && count !== undefined ? <span className="text-xs font-mono text-slate-500">{count}</span> : null}</button>;
}
function ViewHeader({ view, title, subtitle, right }) {
  const t = viewTheme(view);
  return <div className={`card p-4 bg-gradient-to-b ${t.band} border ${t.border} ring-1 ${t.ring} bg-white/70 backdrop-blur`}><div className="flex items-start justify-between gap-3"><div><div className={`text-sm font-semibold ${t.accent}`}>{title}</div><div className="text-sm text-[var(--muted)] mt-1">{subtitle}</div></div>{right ? <div>{right}</div> : null}</div></div>;
}
function HarmsView({ categories, harms, coverage, summaries, openBuckets, toggleBucket, showN, showAiSummaries, harmsFocusCat, setHarmsFocusCat }) {
  const byCat = useMemo(() => {
    const m = new Map();
    for (const h of harms) {
      const c = getTopRiskArea(h, "harms");
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(h);
    }
    return m;
  }, [harms]);
  const catsToRender = harmsFocusCat === "All" ? categories : [harmsFocusCat];
  return <div className="space-y-4"><ViewHeader view="harms" title="Harms (articles)" subtitle="Top-level buckets now use only current HO-owned risk areas plus Cross-cutting / unassigned. Subtypes sit underneath each item." right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600 bg-white/70">{harms.length} matches</span>} /><div className="card p-4 bg-white/80 backdrop-blur border border-slate-200"><div className="flex flex-wrap gap-2 items-center"><button type="button" onClick={() => setHarmsFocusCat("All")} className={`text-sm px-3 py-1.5 rounded-full border transition ${harmsFocusCat === "All" ? "bg-rose-700 text-white border-rose-700" : "bg-white/70 hover:bg-white border-slate-200 text-slate-700"}`} aria-pressed={harmsFocusCat === "All"}>All risk areas</button>{categories.map((cat) => <button key={cat} type="button" onClick={() => setHarmsFocusCat(cat)} className={`text-sm px-3 py-1.5 rounded-full border ${riskAreaChip(cat)} ${harmsFocusCat === cat ? "ring-2 ring-rose-200" : ""}`} aria-pressed={harmsFocusCat === cat} title="Focus this risk area">{cat}</button>)}</div><div className="hr my-4" /><div className="space-y-3">{catsToRender.map((cat) => { const items = (byCat.get(cat) || []).slice(0, showN); const cov = coverage?.by_harm?.[cat] || {}; const isOpen = openBuckets[cat] ?? true; return <div key={cat} className="border border-slate-100 rounded-2xl overflow-hidden bg-white"><button onClick={() => toggleBucket(cat)} className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between" type="button"><div className="flex items-center gap-2 flex-wrap">{isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}<span className={`text-xs px-2 py-1 rounded-full border ${riskAreaChip(cat)}`}>{cat}</span><span className="text-xs font-mono text-slate-600">shown {items.length}{typeof cov.uk_count === "number" ? ` · UK ${cov.uk_count}` : ""}</span></div><span className="text-xs text-slate-500 font-mono">{showAiSummaries && summaries?.harms_by_category?.[cat] ? "summary" : ""}</span></button>{isOpen ? <div className="p-4 bg-white">{showAiSummaries && summaries?.harms_by_category?.[cat] ? <div className="pill px-3 py-2 mb-3 bg-white/70"><div className="text-xs text-[var(--muted)] flex items-center gap-2"><Sparkles size={14} /> Risk area summary</div><div className="mt-1 text-sm">{summaries.harms_by_category[cat]}</div></div> : null}<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{items.map((h, i) => <article key={`${h.link}-${i}`} className="card-hover border border-slate-100 rounded-2xl p-4 bg-white"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 flex-wrap"><span className={`text-[10px] uppercase tracking-wide font-semibold rounded-full px-2 py-1 border ${riskAreaChip(getTopRiskArea(h, "harms"))}`}>{getRiskCode(h, "harms") || "Risk"}</span>{getSubtype(h, "harms") ? <span className={`text-[10px] rounded-full px-2 py-1 border ${subtypeChip(getSubtype(h, "harms"))}`}>{getSubtype(h, "harms")}</span> : null}<span className="text-xs text-slate-500 font-mono">{fmtDateShort(h.date)}</span></div>{h.uk_relevance ? <span className="text-xs px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800">UK‑relevant</span> : <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">Global</span>}</div><a href={h.link} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold hover:underline">{h.title}</a><div className="mt-2 text-xs text-slate-500">{h.source}<span className="ml-2 font-mono">uk_score {h.uk_score ?? 0}</span></div>{h.legacy_category && h.legacy_category !== h.category ? <div className="mt-2 text-[11px] text-slate-500">Legacy tag: {h.legacy_category}</div> : null}</article>)}</div>{!items.length ? <div className="text-sm text-[var(--muted)]">No items in this bucket with current filters.</div> : null}</div> : null}</div>; })}</div></div></div>;
}
function SignalsView({ items, showAiSummaries }) {
  return <div className="space-y-4"><ViewHeader view="signals" title="Signals (clusters)" subtitle="Signals now use only current HO-owned risk areas plus Cross-cutting / unassigned as the top-level visible category." right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600 bg-white/70">{items.length} shown</span>} /><div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">{!items.length ? <div className="text-sm text-[var(--muted)]">No signals match your filters.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{items.map((s) => <article key={s.signal_id} className="card-hover border border-slate-100 rounded-2xl p-4 bg-white"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] uppercase tracking-wide font-semibold text-sky-700 bg-sky-50 border border-sky-100 rounded-full px-2 py-1">Signal cluster</span><span className={`text-xs px-2 py-1 rounded-full border ${riskAreaChip(getTopRiskArea(s, "signals"))}`}>{getTopRiskArea(s, "signals")}</span>{getSubtype(s, "signals") ? <span className={`text-xs px-2 py-1 rounded-full border ${subtypeChip(getSubtype(s, "signals"))}`}>{getSubtype(s, "signals")}</span> : null}</div><span className={`text-xs px-2 py-1 rounded-full border ${confidenceChip(s.confidence_label)}`}>{s.confidence_label || "Low"}</span></div><div className="mt-2 text-sm font-semibold leading-snug">{s.title}</div>{showAiSummaries && s.ai_summary ? <div className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{s.ai_summary}</div> : null}<div className="mt-2 text-xs text-slate-500 font-mono">latest {fmtDateShort(s.latest_date)} · {s.source_count ?? 0} sources · {s.cluster_size ?? 0} items</div><div className="mt-3 space-y-1">{(s.links || []).slice(0, 5).map((l, i) => { const st = (l.source_type || "news").toLowerCase(); const badge = st === "forum" ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900" : "border-slate-200 bg-slate-50 text-slate-700"; return <a key={i} href={l.link} target="_blank" rel="noreferrer" className="block text-sm text-blue-700 hover:underline"><span className={`mr-2 inline-flex text-[10px] px-2 py-1 rounded-full border ${badge}`}>{st.toUpperCase()}</span>{l.source}: {l.title}</a>; })}</div></article>)}</div>}</div></div>;
}
function ForumsView({ items }) {
  return <div className="space-y-4"><ViewHeader view="forums" title="Forums (posts)" subtitle="Forum posts now use only current HO-owned risk areas plus Cross-cutting / unassigned as the top-level visible category." right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600 bg-white/70">{items.length} shown</span>} /><div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">{!items.length ? <div className="text-sm text-[var(--muted)]">No forum items match your filters.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{items.map((f, i) => <article key={`${f.link}-${i}`} className="card-hover border border-slate-100 rounded-2xl p-4 bg-white"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] uppercase tracking-wide font-semibold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-100 rounded-full px-2 py-1">Forum post</span><span className={`text-xs px-2 py-1 rounded-full border ${riskAreaChip(getTopRiskArea(f, "forums"))}`}>{getTopRiskArea(f, "forums")}</span>{getSubtype(f, "forums") ? <span className={`text-xs px-2 py-1 rounded-full border ${subtypeChip(getSubtype(f, "forums"))}`}>{getSubtype(f, "forums")}</span> : null}</div><span className="text-xs text-slate-500 font-mono">{fmtDateShort(f.date)}</span></div><a href={f.link} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold hover:underline">{f.title}</a><div className="mt-2 text-xs text-slate-500">{f.source}{f.uk_relevance ? <span className="ml-2 text-indigo-700">UK‑relevant</span> : null}</div>{f.tags?.length ? <div className="mt-2 text-xs text-slate-500">{f.tags.join(" · ")}</div> : null}</article>)}</div>}</div></div>;
}
function ReleasesView({ items }) {
  return <div className="space-y-4"><ViewHeader view="releases" title="Model releases" subtitle="Model releases / model cards / system cards." right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600 bg-white/70">{items.length} shown</span>} /><div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">{!items.length ? <div className="text-sm text-[var(--muted)]">No model releases match your filters (try widening RELEASE_TIME_WINDOW or removing the risk area filter).</div> : <div className="space-y-2">{items.map((r, i) => <a key={`${r.link}-${i}`} href={r.link} target="_blank" rel="noreferrer" className="block card-hover border border-slate-100 rounded-2xl p-4 bg-white"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wide font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-1">Release</span><span className={`text-xs px-2 py-1 rounded-full border ${riskAreaChip("Model Releases")}`}>Model release</span></div><span className="text-slate-500 font-mono">{fmtDateShort(r.date)}</span></div><div className="mt-2 text-sm font-semibold">{r.title}</div><div className="mt-1 text-xs text-slate-500">{r.source}</div></a>)}</div>}</div></div>;
}
function SkeletonDashboard() {
  return <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[120px]" />)}</div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="skeleton h-[280px]" /><div className="skeleton h-[280px]" /></div></div>;
}
