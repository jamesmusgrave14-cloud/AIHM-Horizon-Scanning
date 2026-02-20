import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LayoutDashboard,
  Shield,
  TrendingUp,
  Cpu,
  Database,
  MessageSquare,
  Search,
  SlidersHorizontal,
  RefreshCw,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

/*
  Light, interactive dashboard UI.
  Works with your existing news_data.json shape + the backend updates below.

  Expected:
    payload.last_updated
    payload.disclaimer (optional)
    payload.meta.limits (optional)
    payload.meta.errors (optional)
    payload.sections.{harms,signals,forums,dev_releases,aiid}
    payload.coverage.by_harm (optional)
    payload.summaries (optional; added by backend below)
*/

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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function confidenceTone(level) {
  if (level === "High") return "border-[rgba(22,163,74,0.25)] bg-[rgba(22,163,74,0.08)] text-[rgba(20,83,45,0.95)]";
  if (level === "Medium") return "border-[rgba(217,119,6,0.25)] bg-[rgba(217,119,6,0.08)] text-[rgba(120,53,15,0.95)]";
  return "border-[rgba(15,23,42,0.12)] bg-[rgba(15,23,42,0.03)] text-[rgba(15,23,42,0.78)]";
}

function catTone(cat) {
  const k = (cat || "").toLowerCase();
  if (k.includes("fraud")) return "border-[rgba(217,119,6,0.25)] bg-[rgba(217,119,6,0.08)] text-[rgba(120,53,15,0.95)]";
  if (k.includes("cyber")) return "border-[rgba(0,163,196,0.25)] bg-[rgba(0,163,196,0.08)] text-[rgba(8,51,68,0.95)]";
  if (k.includes("terror")) return "border-[rgba(220,38,38,0.22)] bg-[rgba(220,38,38,0.06)] text-[rgba(127,29,29,0.95)]";
  if (k.includes("vawg")) return "border-[rgba(168,85,247,0.22)] bg-[rgba(168,85,247,0.06)] text-[rgba(88,28,135,0.95)]";
  if (k.includes("csam") || k.includes("child")) return "border-[rgba(79,70,229,0.22)] bg-[rgba(79,70,229,0.06)] text-[rgba(49,46,129,0.95)]";
  return "border-[rgba(15,23,42,0.12)] bg-[rgba(15,23,42,0.03)] text-[rgba(15,23,42,0.78)]";
}

function dedupeUI(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = keyFn(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

export default function App() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  // Views
  const [view, setView] = useState("overview"); // overview | harms | signals | releases | incidents | forums

  // Filters (apply consistently)
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("7d");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All"); // All | News | Forum
  const [hideLowRel, setHideLowRel] = useState(true);
  const [showN, setShowN] = useState(36);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Harms bucket collapse state
  const [openCats, setOpenCats] = useState({});

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

  useEffect(() => {
    load();
  }, []);

  const sections = payload?.sections || {};
  const meta = payload?.meta || {};
  const limits = meta?.limits || {};
  const errors = meta?.errors || {};
  const summaries = payload?.summaries || {};

  const counts = useMemo(() => ({
    harms: (sections.harms || []).length,
    signals: (sections.signals || []).length,
    dev_releases: (sections.dev_releases || []).length,
    aiid: (sections.aiid || []).length,
    forums: (sections.forums || []).length,
  }), [sections]);

  const allCategories = useMemo(() => {
    const cats = new Set();
    (sections?.harms || []).forEach((h) => h?.category && cats.add(h.category));
    (sections?.signals || []).forEach((s) => {
      if (s?.primary_category) cats.add(s.primary_category);
      (s?.tags || []).forEach((t) => cats.add(t));
    });
    const arr = Array.from(cats).sort((a, b) => a.localeCompare(b));
    return ["All", ...arr];
  }, [sections?.harms, sections?.signals]);

  function matchesSearch(item) {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const title = (item?.title || "").toLowerCase();
    const source = (item?.source || "").toLowerCase();
    const tags = (item?.tags || []).join(" ").toLowerCase();
    const cat = (item?.category || item?.primary_category || "").toLowerCase();
    return title.includes(q) || source.includes(q) || tags.includes(q) || cat.includes(q);
  }

  function matchesCommon(item) {
    // Time filter: use timestamp if available; if not, allow through
    if (item?.timestamp && !withinWindow(item.timestamp, timeFilter)) return false;

    // Category filter: supports harms (category) and signals (primary_category/tags)
    if (categoryFilter !== "All") {
      const cat = item?.category || item?.primary_category;
      const tags = item?.tags || [];
      if (cat !== categoryFilter && !tags.includes(categoryFilter)) return false;
    }

    // Source filter:
    // - forums have source_type
    // - harms and releases are news
    // - signals infer from links
    if (sourceFilter !== "All") {
      const st = (item?.source_type || "").toLowerCase();
      if (st) {
        if (sourceFilter === "News" && st !== "news") return false;
        if (sourceFilter === "Forum" && st !== "forum") return false;
      } else if (item?.links?.length) {
        const anyForum = item.links.some((l) => (l?.source_type || "").toLowerCase() === "forum");
        const anyNews = item.links.some((l) => (l?.source_type || "").toLowerCase() === "news");
        if (sourceFilter === "Forum" && !anyForum) return false;
        if (sourceFilter === "News" && !anyNews) return false;
      } else {
        // No source_type and no links: treat as news-like by default
        if (sourceFilter === "Forum") return false;
      }
    }

    // Low relevance filter applies to harms rows (and any item that carries relevance_score)
    if (hideLowRel && item?.relevance_score !== undefined) {
      if (Number(item.relevance_score) === 0) return false;
    }

    if (!matchesSearch(item)) return false;
    return true;
  }

  // Dedupe + filter each section for display
  const harmsAll = useMemo(() => {
    const filtered = (sections.harms || []).filter(matchesCommon);
    // Strong UI-level dedupe by normalized title+category (last-mile)
    const d = dedupeUI(filtered, (h) => `${(h.category || "").toLowerCase()}|${(h.title || "").toLowerCase().replace(/\s+/g, " ").trim()}`);
    return d;
  }, [sections.harms, searchTerm, timeFilter, categoryFilter, sourceFilter, hideLowRel]);

  const harmsByCat = useMemo(() => {
    const map = new Map();
    harmsAll.forEach((h) => {
      const c = h.category || "Other";
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(h);
    });

    // Sort categories by count desc, then name
    const cats = Array.from(map.keys()).sort((a, b) => {
      const da = map.get(a).length;
      const db = map.get(b).length;
      if (db !== da) return db - da;
      return a.localeCompare(b);
    });

    return { map, cats };
  }, [harmsAll]);

  const signals = useMemo(() => {
    const filtered = (sections.signals || []).filter(matchesCommon);
    // Dedup by signal_id
    return dedupeUI(filtered, (s) => s.signal_id).slice(0, showN);
  }, [sections.signals, searchTerm, timeFilter, categoryFilter, sourceFilter, hideLowRel, showN]);

  const releases = useMemo(() => {
    const filtered = (sections.dev_releases || []).filter(matchesCommon);
    return dedupeUI(filtered, (r) => `${(r.title || "").toLowerCase()}|${(r.source || "").toLowerCase()}`).slice(0, showN);
  }, [sections.dev_releases, searchTerm, timeFilter, categoryFilter, sourceFilter, hideLowRel, showN]);

  const incidents = useMemo(() => {
    const filtered = (sections.aiid || []).filter(matchesCommon);
    return dedupeUI(filtered, (r) => `${r.incident_no || ""}|${(r.title || "").toLowerCase()}`).slice(0, showN);
  }, [sections.aiid, searchTerm, timeFilter, categoryFilter, sourceFilter, hideLowRel, showN]);

  const forums = useMemo(() => {
    const filtered = (sections.forums || []).filter(matchesCommon);
    return dedupeUI(filtered, (r) => `${(r.title || "").toLowerCase()}|${(r.source || "").toLowerCase()}`).slice(0, showN);
  }, [sections.forums, searchTerm, timeFilter, categoryFilter, sourceFilter, hideLowRel, showN]);

  const topCats = useMemo(() => {
    const arr = harmsByCat.cats.map((c) => [c, harmsByCat.map.get(c).length]);
    return arr.slice(0, 8);
  }, [harmsByCat]);

  const maxTop = useMemo(() => topCats.reduce((m, [, v]) => Math.max(m, v), 1), [topCats]);

  // Nav config
  const nav = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, count: null },
    { id: "harms", label: "Harms", icon: Shield, count: harmsAll.length },
    { id: "signals", label: "Signals", icon: TrendingUp, count: counts.signals },
    { id: "releases", label: "Model releases", icon: Cpu, count: counts.dev_releases },
    { id: "incidents", label: "Incidents", icon: Database, count: counts.aiid },
    { id: "forums", label: "Forums", icon: MessageSquare, count: counts.forums },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-5 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
          {/* Sidebar */}
          <aside className="glass rounded-2xl p-4 animate-fadeUp">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent)" }} />
                  <div className="text-sm font-semibold tracking-wide">
                    AI Harms Horizon Scan
                  </div>
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-1 font-mono">
                  {payload?.last_updated ? `updated ${payload.last_updated.slice(0, 19)}` : "loading…"}
                </div>
              </div>

              <button
                onClick={load}
                className="pill px-3 py-2 text-[12px] hover:bg-white transition"
                title="Refresh data"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Refresh
                </span>
              </button>
            </div>

            {payload?.disclaimer ? (
              <div className="mt-3 text-[12px] text-[var(--muted)] leading-relaxed">
                {payload.disclaimer}
              </div>
            ) : null}

            <div className="hr my-4" />

            <nav className="space-y-1">
              {nav.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition flex items-center justify-between ${
                    view === n.id
                      ? "bg-[rgba(59,91,219,0.10)] border border-[rgba(59,91,219,0.18)]"
                      : "hover:bg-white"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-sm">
                    <n.icon size={16} className="text-[var(--muted)]" />
                    <span>{n.label}</span>
                  </span>
                  {n.count !== null && n.count !== undefined ? (
                    <span className="text-[11px] font-mono text-[var(--muted)]">{n.count}</span>
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="hr my-4" />

            {/* backend warnings (subtle) */}
            {errors && Object.keys(errors).length ? (
              <div className="card p-3 bg-[rgba(217,119,6,0.06)] border-[rgba(217,119,6,0.20)]">
                <div className="text-[12px] font-semibold" style={{ color: "var(--warn)" }}>Warnings</div>
                <div className="text-[12px] text-[var(--muted)] mt-1">
                  Some sources failed or returned empty. See <span className="font-mono">meta.errors</span>.
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-[var(--faint)]">
                No backend warnings reported.
              </div>
            )}
          </aside>

          {/* Main */}
          <section className="animate-fadeUp">
            {/* Toolbar */}
            <div className="glass rounded-2xl p-4">
              <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search titles, sources, tags…"
                    className="w-full rounded-xl bg-white border border-[var(--border)] px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgba(59,91,219,0.25)]"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setFiltersOpen((v) => !v)}
                    className="pill px-3 py-2 text-sm hover:bg-white transition"
                  >
                    <span className="inline-flex items-center gap-2">
                      <SlidersHorizontal size={14} />
                      Filters
                    </span>
                  </button>

                  <select className="pill px-3 py-2 text-sm bg-transparent" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                    <option value="24h">Last 24h</option>
                    <option value="7d">Last 7d</option>
                    <option value="30d">Last 30d</option>
                    <option value="All">Any time</option>
                  </select>

                  <select className="pill px-3 py-2 text-sm bg-transparent" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <select className="pill px-3 py-2 text-sm bg-transparent" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                    <option value="All">All sources</option>
                    <option value="News">News only</option>
                    <option value="Forum">Forums only</option>
                  </select>

                  <select className="pill px-3 py-2 text-sm bg-transparent" value={showN} onChange={(e) => setShowN(parseInt(e.target.value, 10))}>
                    {[18, 24, 36, 48, 72, 100].map((n) => <option key={n} value={n}>Show {n}</option>)}
                  </select>

                  <label className="pill px-3 py-2 text-sm inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hideLowRel} onChange={(e) => setHideLowRel(e.target.checked)} />
                    Hide low relevance
                  </label>
                </div>
              </div>

              {filtersOpen ? (
                <div className="mt-3 text-[12px] text-[var(--muted)] flex flex-wrap gap-x-4 gap-y-1">
                  {limits.TIME_WINDOW ? <span className="font-mono">TIME_WINDOW={String(limits.TIME_WINDOW)}</span> : null}
                  {limits.RELEASE_TIME_WINDOW ? <span className="font-mono">RELEASE_TIME_WINDOW={String(limits.RELEASE_TIME_WINDOW)}</span> : null}
                  {limits.INCIDENT_TIME_WINDOW ? <span className="font-mono">INCIDENT_TIME_WINDOW={String(limits.INCIDENT_TIME_WINDOW)}</span> : null}
                  {limits.DEDUPE_MODE ? <span className="font-mono">DEDUPE={String(limits.DEDUPE_MODE)}</span> : null}
                </div>
              ) : null}
            </div>

            {/* Content */}
            <div className="mt-4">
              {loading && !payload ? <SkeletonDashboard /> : null}
              {!loading && !payload ? (
                <div className="card p-4 text-sm text-[var(--muted)]">
                  Failed to load <span className="font-mono">news_data.json</span>.
                </div>
              ) : null}

              {!loading && payload && view === "overview" ? (
                <Overview
                  counts={counts}
                  harmsCount={harmsAll.length}
                  topCats={topCats}
                  maxTop={maxTop}
                  summaries={summaries}
                />
              ) : null}

              {!loading && payload && view === "harms" ? (
                <HarmsBuckets
                  cats={harmsByCat.cats}
                  map={harmsByCat.map}
                  summaries={summaries}
                  openCats={openCats}
                  setOpenCats={setOpenCats}
                  showN={showN}
                />
              ) : null}

              {!loading && payload && view === "signals" ? (
                <SignalsGrid items={signals} />
              ) : null}

              {!loading && payload && view === "releases" ? (
                <TableView
                  title="Model releases"
                  subtitle="Only model releases (filtered). If empty, widen RELEASE_TIME_WINDOW."
                  rows={releases}
                  kind="releases"
                  emptyHint={errors?.dev_releases ? `Backend error: ${errors.dev_releases}` : "No model releases returned."}
                />
              ) : null}

              {!loading && payload && view === "incidents" ? (
                <TableView
                  title="Incidents"
                  subtitle="Incident entries."
                  rows={incidents}
                  kind="aiid"
                  emptyHint={errors?.aiid ? `Backend error: ${errors.aiid}` : "No incidents returned."}
                />
              ) : null}

              {!loading && payload && view === "forums" ? (
                <TableView
                  title="Forums"
                  subtitle="Noisy sources. We can tighten separately."
                  rows={forums}
                  kind="forums"
                  emptyHint={errors?.forums ? `Backend error: ${errors.forums}` : "No forum items returned."}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Overview({ counts, harmsCount, topCats, maxTop, summaries }) {
  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Harms" value={harmsCount ?? counts.harms} hint="Raw items (deduped view)" color="var(--accent)" />
        <MetricCard title="Signals" value={counts.signals} hint="Clusters" color="var(--accent-2)" />
        <MetricCard title="Model releases" value={counts.dev_releases} hint="Release-only feed" color="var(--accent)" />
        <MetricCard title="Incidents" value={counts.aiid} hint="Incident DB" color="var(--accent-2)" />
      </div>

      {/* Summary + Distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card card-hover p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Top harm categories</div>
              <div className="text-[12px] text-[var(--muted)] mt-1">
                Quick distribution view to scan changes.
              </div>
            </div>
            <span className="pill px-2 py-1 text-[11px] font-mono text-[var(--muted)]">
              {topCats.reduce((s, [, v]) => s + v, 0)} shown
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {topCats.map(([cat, n]) => (
              <div key={cat}>
                <div className="flex items-center justify-between text-[12px] text-[var(--muted)]">
                  <span className={`inline-flex px-2 py-1 rounded-full border text-[11px] ${catTone(cat)}`}>{cat}</span>
                  <span className="font-mono">{n}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[rgba(15,23,42,0.06)] overflow-hidden">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${clamp((n / maxTop) * 100, 4, 100)}%`,
                      background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-hover p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Today’s summary</div>
              <div className="text-[12px] text-[var(--muted)] mt-1">
                Deterministic summary by default; optional LLM summary if enabled in backend.
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <SummaryBlock title="Overall" text={summaries?.overall || "No summary available yet."} />
            <SummaryBlock title="Signals" text={summaries?.signals || "—"} />
            <SummaryBlock title="Model releases" text={summaries?.releases || "—"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({ title, text }) {
  return (
    <div className="p-3 rounded-xl border border-[var(--border)] bg-[rgba(15,23,42,0.02)]">
      <div className="text-[12px] font-semibold">{title}</div>
      <div className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">{text}</div>
    </div>
  );
}

function MetricCard({ title, value, hint, color }) {
  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] text-[var(--muted)]">{hint}</div>
          <div className="text-sm font-semibold mt-1">{title}</div>
        </div>
        <div className="h-8 w-8 rounded-xl" style={{ background: `linear-gradient(180deg, ${color}, rgba(255,255,255,0.1))` }} />
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value ?? 0}</div>
      <div className="mt-2 h-1.5 rounded-full bg-[rgba(15,23,42,0.06)] overflow-hidden">
        <div className="h-1.5 rounded-full" style={{ width: `${clamp(((value || 0) / 200) * 100, 4, 100)}%`, background: `linear-gradient(90deg, ${color}, rgba(15,23,42,0.10))` }} />
      </div>
    </div>
  );
}

function HarmsBuckets({ cats, map, summaries, openCats, setOpenCats, showN }) {
  if (!cats.length) {
    return <EmptyCard text="No harms match your filters." />;
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-sm font-semibold">Harms buckets</div>
        <div className="text-[12px] text-[var(--muted)] mt-1">
          Clear grouping by category. Each bucket includes a short summary and the most recent items.
        </div>
      </div>

      <div className="space-y-3">
        {cats.map((cat) => {
          const list = map.get(cat) || [];
          const open = openCats[cat] ?? true;
          const summary = summaries?.by_harm?.[cat] || "—";

          return (
            <div key={cat} className="card card-hover overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between"
                onClick={() => setOpenCats((s) => ({ ...s, [cat]: !open }))}
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex px-2 py-1 rounded-full border text-[11px] ${catTone(cat)}`}>{cat}</span>
                  <span className="text-[12px] text-[var(--muted)] font-mono">{list.length}</span>
                </div>
                <ChevronDown size={18} className={`text-[var(--muted)] transition ${open ? "rotate-180" : ""}`} />
              </button>

              <div className="px-4 pb-3">
                <div className="text-[12px] text-[var(--muted)] leading-relaxed">
                  {summary}
                </div>
              </div>

              {open ? (
                <div className="px-4 pb-4">
                  <div className="hr mb-3" />
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {list.slice(0, showN).map((h, i) => (
                      <a
                        key={`${h.link || ""}-${i}`}
                        href={h.link}
                        target="_blank"
                        rel="noreferrer"
                        className="card card-hover p-3 block"
                      >
                        <div className="text-[11px] text-[var(--muted)] flex items-center justify-between gap-2">
                          <span className="truncate">{h.source || "News"}</span>
                          <span className="font-mono">{fmtDateShort(h.date)}</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold leading-snug">
                          {h.title}
                        </div>
                        {h.relevance_score !== undefined ? (
                          <div className="mt-2 text-[11px] text-[var(--faint)] font-mono">
                            relevance {h.relevance_score}
                          </div>
                        ) : null}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SignalsGrid({ items }) {
  if (!items.length) return <EmptyCard text="No signals match your filters." />;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Signals</div>
          <div className="text-[12px] text-[var(--muted)] mt-1">
            Clusters of similar headlines within a primary category (prioritisation aid).
          </div>
        </div>
        <span className="pill px-2 py-1 text-[11px] text-[var(--muted)] font-mono">{items.length}</span>
      </div>

      <div className="hr my-4" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((s) => (
          <article key={s.signal_id} className="card card-hover p-4">
            <div className="flex items-start justify-between gap-3">
              <span className={`inline-flex px-2 py-1 text-[11px] rounded-full border ${catTone(s.primary_category)}`}>
                {s.primary_category || "Signal"}
              </span>
              <span className={`inline-flex px-2 py-1 text-[11px] rounded-full border ${confidenceTone(s.confidence_label)}`}>
                {s.confidence_label || "Low"}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold leading-snug">{s.title}</div>

            {s.ai_summary ? (
              <div className="mt-2 text-[12px] text-[var(--muted)] leading-relaxed">
                {s.ai_summary}
              </div>
            ) : null}

            <div className="mt-3 text-[11px] text-[var(--faint)] font-mono">
              latest {fmtDateShort(s.latest_date)} · {s.source_count ?? 0}s / {s.cluster_size ?? 0}i
            </div>

            <div className="mt-3 space-y-1">
              {(s.links || []).slice(0, 5).map((l, i) => (
                <a
                  key={i}
                  href={l.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[12px] text-[rgba(59,91,219,0.92)] hover:underline"
                >
                  {(l.source_type || "news").toUpperCase()} · {l.source}: {l.title}
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TableView({ title, subtitle, rows, kind, emptyHint }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[12px] text-[var(--muted)] mt-1">{subtitle}</div>
        </div>
        <span className="pill px-2 py-1 text-[11px] text-[var(--muted)] font-mono">{rows.length}</span>
      </div>

      <div className="hr my-4" />

      {!rows.length ? (
        <EmptyCard text={emptyHint} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-[11px] text-[var(--faint)]">
                <th className="py-2 pr-4 w-36">Category</th>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4 w-44">Source</th>
                <th className="py-2 pr-4 w-28">Date</th>
                {kind === "harms" ? <th className="py-2 pr-4 w-16">Rel</th> : null}
                {kind === "aiid" ? <th className="py-2 pr-4 w-20">ID</th> : null}
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map((r, idx) => {
                const category =
                  kind === "harms" ? r.category :
                  kind === "releases" ? "Releases" :
                  kind === "aiid" ? "AIID" :
                  (r.tags && r.tags[0]) || "Other";
                return (
                  <tr key={`${r.link || ""}-${idx}`} className="border-t border-[var(--border)]">
                    <td className="py-3 pr-4 align-top">
                      <span className={`inline-flex px-2 py-1 text-[11px] rounded-full border ${catTone(category)}`}>
                        {category}
                      </span>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <a href={r.link} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-2">
                        {r.title}
                        <ExternalLink size={14} className="text-[var(--faint)]" />
                      </a>
                    </td>
                    <td className="py-3 pr-4 align-top text-[var(--muted)]">
                      {r.source || ""}
                    </td>
                    <td className="py-3 pr-4 align-top text-[var(--muted)] font-mono">
                      {fmtDateShort(r.date)}
                    </td>
                    {kind === "harms" ? (
                      <td className="py-3 pr-4 align-top text-[var(--muted)] font-mono">
                        {r.relevance_score ?? ""}
                      </td>
                    ) : null}
                    {kind === "aiid" ? (
                      <td className="py-3 pr-4 align-top text-[var(--muted)] font-mono">
                        {r.incident_no ?? ""}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyCard({ text }) {
  return (
    <div className="card p-4 bg-[rgba(15,23,42,0.02)] text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card p-4 skeleton h-[120px]" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4 skeleton h-[260px]" />
        <div className="card p-4 skeleton h-[260px]" />
      </div>
    </div>
  );
}
