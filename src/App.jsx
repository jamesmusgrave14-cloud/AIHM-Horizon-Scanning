import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LayoutDashboard,
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
  return true; // "All"
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
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

function viewTheme(view) {
  // Colour-coded distinction across Harms / Signals / Forums / Releases
  if (view === "harms") return { ring: "ring-rose-100", band: "from-rose-50 to-white", accent: "text-rose-700", border: "border-rose-100" };
  if (view === "signals") return { ring: "ring-sky-100", band: "from-sky-50 to-white", accent: "text-sky-700", border: "border-sky-100" };
  if (view === "forums") return { ring: "ring-fuchsia-100", band: "from-fuchsia-50 to-white", accent: "text-fuchsia-700", border: "border-fuchsia-100" };
  if (view === "releases") return { ring: "ring-indigo-100", band: "from-indigo-50 to-white", accent: "text-indigo-700", border: "border-indigo-100" };
  return { ring: "ring-slate-100", band: "from-slate-50 to-white", accent: "text-slate-700", border: "border-slate-100" };
}

function getItemDateISO(item, kind) {
  // Robustly pull a comparable date string for filtering/sorting.
  // Prefer explicit date strings; fall back to timestamp if available.
  const raw =
    (kind === "signals" ? (item?.latest_date || item?.date) : item?.date) ||
    (item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : "");
  const iso = fmtDateShort(raw);
  return iso || "";
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

export default function App() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  // Views
  const [view, setView] = useState("overview"); // overview | harms | signals | releases | forums

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("7d");
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState("");     // YYYY-MM-DD
  const [sortBy, setSortBy] = useState("relevance"); // relevance | newest | oldest | uk | confidence
  const [minUkScore, setMinUkScore] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All"); // All | News | Forum
  const [ukOnly, setUkOnly] = useState(false);
  const [showAiSummaries, setShowAiSummaries] = useState(false);
  const [showN, setShowN] = useState(36);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Harm bucket UI state
  const [openBuckets, setOpenBuckets] = useState(() => ({}));

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
    (sections?.harms || []).forEach((h) => h?.category && cats.add(h.category));
    (sections?.signals || []).forEach((s) => s?.primary_category && cats.add(s.primary_category));
    (sections?.forums || []).forEach((f) => f?.category && cats.add(f.category));
    (sections?.dev_releases || []).forEach(() => cats.add("Model Releases"));
    return ["All", ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
  }, [sections]);

  function matchesSearch(item) {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const title = (item?.title || "").toLowerCase();
    const source = (item?.source || "").toLowerCase();
    const tags = (item?.tags || []).join(" ").toLowerCase();
    const cat = (item?.category || item?.primary_category || "").toLowerCase();
    const summary = (item?.ai_summary || "").toLowerCase();
    return title.includes(q) || source.includes(q) || tags.includes(q) || cat.includes(q) || summary.includes(q);
  }

  function passesDateRange(item, kind) {
    const d = getItemDateISO(item, kind);
    if (!d) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }

  // View-aware filter application
  function passesCommon(item, kind) {
    // Date range overrides time window if set
    if (dateFrom || dateTo) {
      if (!passesDateRange(item, kind)) return false;
    } else {
      // time filter (if no timestamp, keep item)
      const ts = item?.timestamp;
      if (ts && !withinWindow(ts, timeFilter)) return false;
    }

    // UK-only toggle: uses backend uk_relevance where available
    if (ukOnly) {
      const uk = item?.uk_relevance || (item?.uk_score >= 2);
      if (!uk) return false;
    }

    // Min UK score (gentler than ukOnly)
    if (minUkScore > 0) {
      const score = item?.uk_score ?? (item?.uk_relevance ? 2 : 0);
      if (score < minUkScore) return false;
    }

    // category filter
    if (categoryFilter !== "All") {
      if (kind === "releases") {
        if (categoryFilter !== "Model Releases") return false;
      } else if (kind === "signals") {
        const cat = item?.primary_category || "";
        const tags = item?.tags || [];
        if (cat !== categoryFilter && !tags.includes(categoryFilter)) return false;
      } else {
        if ((item?.category || "") !== categoryFilter) return false;
      }
    }

    // source filter
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

    if (!matchesSearch(item)) return false;
    return true;
  }

  function sortItems(items, kind) {
    if (sortBy === "relevance") return items; // keep backend sort
    const copy = items.slice();

    if (sortBy === "newest") {
      copy.sort((a, b) => compareDatesDesc(getItemDateISO(a, kind), getItemDateISO(b, kind)));
      return copy;
    }
    if (sortBy === "oldest") {
      copy.sort((a, b) => compareDatesAsc(getItemDateISO(a, kind), getItemDateISO(b, kind)));
      return copy;
    }
    if (sortBy === "uk") {
      copy.sort((a, b) => ((b?.uk_score ?? (b?.uk_relevance ? 2 : 0)) - (a?.uk_score ?? (a?.uk_relevance ? 2 : 0))));
      return copy;
    }
    if (sortBy === "confidence" && kind === "signals") {
      copy.sort((a, b) => confidenceRank(b?.confidence_label) - confidenceRank(a?.confidence_label));
      return copy;
    }
    return copy;
  }

  // Filtered + sorted lists per view
  const harms = useMemo(() => sortItems((sections.harms || []).filter((x) => passesCommon(x, "harms")), "harms"), [sections.harms, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);
  const signals = useMemo(() => sortItems((sections.signals || []).filter((x) => passesCommon(x, "signals")), "signals"), [sections.signals, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);
  const forums = useMemo(() => sortItems((sections.forums || []).filter((x) => passesCommon(x, "forums")), "forums"), [sections.forums, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);
  const releases = useMemo(() => sortItems((sections.dev_releases || []).filter((x) => passesCommon(x, "releases")), "releases"), [sections.dev_releases, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);

  // Overview: simple "Latest feed" (no metric cards)
  const whatsNew = useMemo(() => {
    const pool = [];
    (sections.harms || []).slice(0, 60).forEach((h) => pool.push({
      kind: "Harms",
      title: h.title,
      link: h.link,
      date: h.date,
      category: h.category,
      uk: !!h.uk_relevance,
      uk_score: h.uk_score ?? 0,
      source: h.source
    }));
    (sections.dev_releases || []).slice(0, 40).forEach((r) => pool.push({
      kind: "Model releases",
      title: r.title,
      link: r.link,
      date: r.date,
      category: "Model Releases",
      uk: !!r.uk_relevance,
      uk_score: r.uk_score ?? 0,
      source: r.source
    }));
    (sections.signals || []).slice(0, 40).forEach((s) => pool.push({
      kind: "Signals",
      title: s.title,
      link: (s.links && s.links[0]?.link) || "",
      date: s.latest_date,
      category: s.primary_category,
      uk: !!s.uk_relevance,
      uk_score: s.uk_score ?? 0,
      source: (s.links && s.links[0]?.source) || ""
    }));
    (sections.forums || []).slice(0, 40).forEach((f) => pool.push({
      kind: "Forums",
      title: f.title,
      link: f.link,
      date: f.date,
      category: f.category,
      uk: !!f.uk_relevance,
      uk_score: f.uk_score ?? 0,
      source: f.source
    }));

    // Apply the same common filters to the overview feed (so it's consistent)
    const filtered = pool.filter((x) => {
      // Treat the pooled entry like an item for search/category/source/minUkScore/date/time
      // Minimal mapping: pass kind-specific handling via "kind" label
      const fakeKind = x.kind === "Signals" ? "signals" : x.kind === "Forums" ? "forums" : x.kind === "Model releases" ? "releases" : "harms";
      const item = {
        title: x.title,
        source: x.source,
        tags: [],
        category: x.category,
        primary_category: x.category,
        date: x.date,
        latest_date: x.date,
        uk_relevance: x.uk,
        uk_score: x.uk_score
      };
      return passesCommon(item, fakeKind);
    });

    filtered.sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
    return filtered.slice(0, 30);
  }, [sections, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore]);

  // Harm buckets
  const harmCategories = useMemo(() => {
    const cats = new Set((sections.harms || []).map((h) => h.category).filter(Boolean));
    const arr = Array.from(cats);
    arr.sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
    return arr;
  }, [sections.harms]);

  function toggleBucket(cat) {
    setOpenBuckets((s) => ({ ...s, [cat]: !s[cat] }));
  }

  const theme = viewTheme(view);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-5 py-5 animate-fadeUp">
        {/* Header */}
        <div className="card p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--a1)" }} />
                <h1 className="text-lg font-semibold">AI Harms Horizon Scan</h1>
                {payload?.last_updated ? (
                  <span className="text-sm text-[var(--muted)] font-mono">
                    updated {payload.last_updated.slice(0, 19)}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-sm text-[var(--muted)] max-w-3xl leading-relaxed">
                {payload?.disclaimer || "Proof-of-concept dashboard for harms-focused horizon scanning."}
              </div>

              {/* Removed: top summary boxes to keep header uncluttered */}

              {errors && Object.keys(errors).length ? (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Some sources returned errors (see meta.errors in news_data.json): {Object.keys(errors).join(", ")}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="pill px-4 py-2 text-sm hover:bg-white transition inline-flex items-center gap-2"
                title="Refresh"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>

              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className="pill px-4 py-2 text-sm hover:bg-white transition inline-flex items-center gap-2"
                title="Filters"
              >
                <SlidersHorizontal size={16} />
                Filters
              </button>
            </div>
          </div>

          {/* Filters drawer */}
          {filtersOpen ? (
            <div className="mt-4 card p-4 bg-white/70">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4">
                  <label className="text-xs text-[var(--muted)]">Search</label>
                  <div className="relative mt-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="titles, sources, tags, summaries…"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Time window</label>
                  <select
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                    disabled={!!(dateFrom || dateTo)}
                    title={dateFrom || dateTo ? "Disabled when Date From/To is set" : ""}
                  >
                    <option value="24h">Last 24h</option>
                    <option value="7d">Last 7d</option>
                    <option value="30d">Last 30d</option>
                    <option value="All">Any time</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Date from</label>
                  <input
                    type="date"
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Date to</label>
                  <input
                    type="date"
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Show</label>
                  <select
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={showN}
                    onChange={(e) => setShowN(parseInt(e.target.value, 10))}
                  >
                    {[24, 36, 48, 72, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs text-[var(--muted)]">Category</label>
                  <select
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs text-[var(--muted)]">Source type</label>
                  <select
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="News">News</option>
                    <option value="Forum">Forum</option>
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs text-[var(--muted)]">Sort</label>
                  <select
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="relevance">Relevance (default)</option>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="uk">UK score first</option>
                    <option value="confidence">Confidence first (Signals)</option>
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs text-[var(--muted)]">Min UK score: {minUkScore}</label>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={minUkScore}
                    onChange={(e) => setMinUkScore(parseInt(e.target.value, 10))}
                    className="mt-2 w-full"
                  />
                </div>

                <div className="lg:col-span-12 flex flex-wrap gap-3 items-center mt-1">
                  <label className="inline-flex items-center gap-2 text-sm pill px-3 py-2 bg-white">
                    <input type="checkbox" checked={ukOnly} onChange={(e) => setUkOnly(e.target.checked)} />
                    UK only (strict)
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm pill px-3 py-2 bg-white">
                    <input type="checkbox" checked={showAiSummaries} onChange={(e) => setShowAiSummaries(e.target.checked)} />
                    Show AI summaries
                  </label>

                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="pill px-3 py-2 text-sm hover:bg-white transition bg-white"
                    title="Clear date range"
                  >
                    Clear dates
                  </button>

                  <div className="text-xs text-[var(--muted)] font-mono">
                    TIME_WINDOW={limits.TIME_WINDOW || "—"} · RELEASE_TIME_WINDOW={limits.RELEASE_TIME_WINDOW || "—"} · dedupe={meta.dedupe_mode || "—"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Navigation */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-4">
          <aside className="card p-4">
            <NavItem icon={<LayoutDashboard size={16} />} label="Overview (latest feed)" active={view === "overview"} onClick={() => setView("overview")} count={null} />
            <NavItem icon={<Shield size={16} />} label="Harms (articles)" active={view === "harms"} onClick={() => setView("harms")} count={counts.harms} />
            <NavItem icon={<TrendingUp size={16} />} label="Signals (clusters)" active={view === "signals"} onClick={() => setView("signals")} count={counts.signals} />
            <NavItem icon={<Cpu size={16} />} label="Model releases" active={view === "releases"} onClick={() => setView("releases")} count={counts.dev_releases} />
            <NavItem icon={<MessageSquare size={16} />} label="Forums (posts)" active={view === "forums"} onClick={() => setView("forums")} count={counts.forums} />
          </aside>

          <main className="space-y-4">
            {loading && !payload ? <SkeletonDashboard /> : null}

            {!loading && payload && view === "overview" ? (
              <OverviewFeed whatsNew={whatsNew} />
            ) : null}

            {!loading && payload && view === "harms" ? (
              <HarmsView
                categories={harmCategories}
                harms={harms}
                coverage={coverage}
                summaries={summaries}
                openBuckets={openBuckets}
                toggleBucket={toggleBucket}
                showN={showN}
                showAiSummaries={showAiSummaries}
              />
            ) : null}

            {!loading && payload && view === "signals" ? (
              <SignalsView items={signals.slice(0, showN)} showAiSummaries={showAiSummaries} />
            ) : null}

            {!loading && payload && view === "releases" ? (
              <ReleasesView items={releases.slice(0, showN)} />
            ) : null}

            {!loading && payload && view === "forums" ? (
              <ForumsView items={forums.slice(0, showN)} />
            ) : null}

            {!loading && !payload ? (
              <div className="card p-4 text-sm">
                Failed to load <span className="font-mono">news_data.json</span>.
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl mb-1 transition flex items-center justify-between ${
        active ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50"
      }`}
    >
      <span className="inline-flex items-center gap-2 text-sm">
        <span className="text-slate-500">{icon}</span>
        <span className="font-medium">{label}</span>
      </span>
      {count !== null && count !== undefined ? (
        <span className="text-xs font-mono text-slate-500">{count}</span>
      ) : null}
    </button>
  );
}

function ViewHeader({ view, title, subtitle, right }) {
  const t = viewTheme(view);
  return (
    <div className={`card p-4 bg-gradient-to-b ${t.band} border ${t.border} ring-1 ${t.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-semibold ${t.accent}`}>{title}</div>
          <div className="text-sm text-[var(--muted)] mt-1">{subtitle}</div>
        </div>
        {right ? <div>{right}</div> : null}
      </div>
    </div>
  );
}

function OverviewFeed({ whatsNew }) {
  return (
    <div className="space-y-4">
      <ViewHeader
        view="overview"
        title="Latest feed"
        subtitle="A simple, cross-system list of the most recent items (no dashboards / no confusing number tiles)."
        right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600">{whatsNew.length} shown</span>}
      />

      <div className="card p-4">
        {!whatsNew.length ? (
          <div className="text-sm text-[var(--muted)]">No items match your current filters.</div>
        ) : (
          <div className="space-y-2">
            {whatsNew.map((x, i) => (
              <a
                key={i}
                href={x.link}
                target="_blank"
                rel="noreferrer"
                className="block card-hover border border-slate-100 rounded-xl px-3 py-2 bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">{x.kind}</span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${catChip(x.category)}`}>{x.category}</span>
                    {x.uk ? (
                      <span className="text-xs px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800">
                        UK‑relevant
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">{fmtDateShort(x.date)}</div>
                </div>
                <div className="mt-1 text-sm font-medium">{x.title}</div>
                {x.source ? <div className="mt-1 text-xs text-slate-500">{x.source}</div> : null}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HarmsView({ categories, harms, coverage, summaries, openBuckets, toggleBucket, showN, showAiSummaries }) {
  const byCat = useMemo(() => {
    const m = new Map();
    for (const h of harms) {
      const c = h.category || "Other";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(h);
    }
    return m;
  }, [harms]);

  return (
    <div className="space-y-4">
      <ViewHeader
        view="harms"
        title="Harms (articles)"
        subtitle="Individual stories and incidents, bucketed by harm category. Use filters for date range, UK relevance, source type, etc."
        right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600">{harms.length} matches</span>}
      />

      <div className="card p-4">
        <div className="space-y-3">
          {categories.map((cat) => {
            const items = (byCat.get(cat) || []).slice(0, showN);
            const cov = coverage?.by_harm?.[cat] || {};
            const isOpen = openBuckets[cat] ?? true;

            return (
              <div key={cat} className="border border-slate-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleBucket(cat)}
                  className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                    <span className={`text-xs px-2 py-1 rounded-full border ${catChip(cat)}`}>{cat}</span>
                    <span className="text-xs font-mono text-slate-600">
                      shown {items.length}{typeof cov.uk_count === "number" ? ` · UK ${cov.uk_count}` : ""}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{showAiSummaries && summaries?.harms_by_category?.[cat] ? "summary" : ""}</span>
                </button>

                {isOpen ? (
                  <div className="p-4 bg-white">
                    {showAiSummaries && summaries?.harms_by_category?.[cat] ? (
                      <div className="pill px-3 py-2 mb-3">
                        <div className="text-xs text-[var(--muted)] flex items-center gap-2">
                          <Sparkles size={14} /> Category summary
                        </div>
                        <div className="mt-1 text-sm">{summaries.harms_by_category[cat]}</div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {items.map((h, i) => (
                        <article key={`${h.link}-${i}`} className="card-hover border border-slate-100 rounded-2xl p-4 bg-white">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase tracking-wide font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-2 py-1">
                                Harm
                              </span>
                              <span className="text-xs text-slate-500 font-mono">{fmtDateShort(h.date)}</span>
                            </div>
                            {h.uk_relevance ? (
                              <span className="text-xs px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800">
                                UK‑relevant
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                                Global
                              </span>
                            )}
                          </div>

                          <a href={h.link} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold hover:underline">
                            {h.title}
                          </a>

                          <div className="mt-2 text-xs text-slate-500">
                            {h.source}
                            <span className="ml-2 font-mono">uk_score {h.uk_score ?? 0}</span>
                          </div>
                        </article>
                      ))}
                    </div>

                    {!items.length ? (
                      <div className="text-sm text-[var(--muted)]">No items in this bucket with current filters.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SignalsView({ items, showAiSummaries }) {
  return (
    <div className="space-y-4">
      <ViewHeader
        view="signals"
        title="Signals (clusters)"
        subtitle="Clusters of similar headlines within a category. This is not single articles: it’s a grouped ‘theme’ with sources underneath."
        right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600">{items.length} shown</span>}
      />

      <div className="card p-4">
        {!items.length ? (
          <div className="text-sm text-[var(--muted)]">No signals match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((s) => (
              <article key={s.signal_id} className="card-hover border border-slate-100 rounded-2xl p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-sky-700 bg-sky-50 border border-sky-100 rounded-full px-2 py-1">
                      Signal cluster
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${catChip(s.primary_category)}`}>
                      {s.primary_category || "Signal"}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${confidenceChip(s.confidence_label)}`}>
                    {s.confidence_label || "Low"}
                  </span>
                </div>

                <div className="mt-2 text-sm font-semibold leading-snug">{s.title}</div>

                {showAiSummaries && s.ai_summary ? (
                  <div className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                    {s.ai_summary}
                  </div>
                ) : null}

                <div className="mt-2 text-xs text-slate-500 font-mono">
                  latest {fmtDateShort(s.latest_date)} · {s.source_count ?? 0} sources · {s.cluster_size ?? 0} items
                </div>

                <div className="mt-3 space-y-1">
                  {(s.links || []).slice(0, 5).map((l, i) => {
                    const st = (l.source_type || "news").toLowerCase();
                    const badge = st === "forum"
                      ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900"
                      : "border-slate-200 bg-slate-50 text-slate-700";
                    return (
                      <a key={i} href={l.link} target="_blank" rel="noreferrer" className="block text-sm text-blue-700 hover:underline">
                        <span className={`mr-2 inline-flex text-[10px] px-2 py-1 rounded-full border ${badge}`}>
                          {st.toUpperCase()}
                        </span>
                        {l.source}: {l.title}
                      </a>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReleasesView({ items }) {
  return (
    <div className="space-y-4">
      <ViewHeader
        view="releases"
        title="Model releases"
        subtitle="Only items that look like new model releases / model cards / system cards are included."
        right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600">{items.length} shown</span>}
      />

      <div className="card p-4">
        {!items.length ? (
          <div className="text-sm text-[var(--muted)]">
            No model releases match your filters (try widening RELEASE_TIME_WINDOW or removing category filter).
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((r, i) => (
              <a
                key={`${r.link}-${i}`}
                href={r.link}
                target="_blank"
                rel="noreferrer"
                className="block card-hover border border-slate-100 rounded-2xl p-4 bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-1">
                      Release
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${catChip("Model Releases")}`}>Model release</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{fmtDateShort(r.date)}</span>
                </div>
                <div className="mt-2 text-sm font-semibold">{r.title}</div>
                <div className="mt-1 text-xs text-slate-500">{r.source}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ForumsView({ items }) {
  return (
    <div className="space-y-4">
      <ViewHeader
        view="forums"
        title="Forums (posts)"
        subtitle="These are forum posts (not news). Included only if tagged to a harm category (via your harm_queries keywords)."
        right={<span className="pill px-3 py-1 text-xs font-mono text-slate-600">{items.length} shown</span>}
      />

      <div className="card p-4">
        {!items.length ? (
          <div className="text-sm text-[var(--muted)]">No forum items match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((f, i) => (
              <article key={`${f.link}-${i}`} className="card-hover border border-slate-100 rounded-2xl p-4 bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-100 rounded-full px-2 py-1">
                      Forum post
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${catChip(f.category)}`}>{f.category}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{fmtDateShort(f.date)}</span>
                </div>

                <a href={f.link} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold hover:underline">
                  {f.title}
                </a>

                <div className="mt-2 text-xs text-slate-500">
                  {f.source}
                  {f.uk_relevance ? <span className="ml-2 text-indigo-700">UK‑relevant</span> : null}
                </div>

                {f.tags?.length ? (
                  <div className="mt-2 text-xs text-slate-500">{f.tags.join(" · ")}</div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[120px]" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="skeleton h-[280px]" />
        <div className="skeleton h-[280px]" />
      </div>
    </div>
  );
}
