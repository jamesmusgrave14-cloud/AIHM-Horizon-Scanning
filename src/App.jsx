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
  Info,
  ExternalLink,
} from "lucide-react";

/*
  Dashboard-style UI inspired by "interactive explorer" sites
  while staying compatible with your existing news_data.json shape.

  Expects payload structure:
    payload.last_updated
    payload.disclaimer (optional)
    payload.meta.limits (optional)
    payload.meta.errors (optional)
    payload.sections.{harms,signals,forums,dev_releases,aiid}
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

function confidenceColor(level) {
  if (level === "High") return "border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.10)] text-[rgba(240,253,244,0.92)]";
  if (level === "Medium") return "border-[rgba(245,158,11,0.45)] bg-[rgba(245,158,11,0.10)] text-[rgba(255,251,235,0.92)]";
  return "border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.82)]";
}

function categoryBadge(cat) {
  const key = (cat || "").toLowerCase();
  if (key.includes("fraud")) return "border-[rgba(245,158,11,0.45)] bg-[rgba(245,158,11,0.10)] text-[rgba(255,251,235,0.92)]";
  if (key.includes("cyber")) return "border-[rgba(6,182,212,0.45)] bg-[rgba(6,182,212,0.10)] text-[rgba(236,254,255,0.92)]";
  if (key.includes("terror")) return "border-[rgba(244,63,94,0.45)] bg-[rgba(244,63,94,0.10)] text-[rgba(255,241,242,0.92)]";
  if (key.includes("vawg")) return "border-[rgba(217,70,239,0.45)] bg-[rgba(217,70,239,0.10)] text-[rgba(253,244,255,0.92)]";
  if (key.includes("csam") || key.includes("child")) return "border-[rgba(139,92,246,0.45)] bg-[rgba(139,92,246,0.10)] text-[rgba(245,243,255,0.92)]";
  return "border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.82)]";
}

export default function App() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  // Views (feels more like “dashboards”)
  const [view, setView] = useState("overview"); // overview | harms | signals | releases | incidents | forums

  // Controls
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("7d");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All"); // All | News | Forum
  const [hideLowRel, setHideLowRel] = useState(true);
  const [showN, setShowN] = useState(30);
  const [showFilters, setShowFilters] = useState(true);

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
    return ["All", ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
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
    if (!withinWindow(item?.timestamp, timeFilter)) return false;

    if (categoryFilter !== "All") {
      const cat = item?.category || item?.primary_category;
      const tags = item?.tags || [];
      if (cat !== categoryFilter && !tags.includes(categoryFilter)) return false;
    }

    if (sourceFilter !== "All") {
      const st = (item?.source_type || "").toLowerCase();
      if (st) {
        if (sourceFilter === "News" && st !== "news") return false;
        if (sourceFilter === "Forum" && st !== "forum") return false;
      }
      if (!st && item?.links?.length) {
        const anyForum = item.links.some((l) => (l?.source_type || "").toLowerCase() === "forum");
        const anyNews = item.links.some((l) => (l?.source_type || "").toLowerCase() === "news");
        if (sourceFilter === "Forum" && !anyForum) return false;
        if (sourceFilter === "News" && !anyNews) return false;
      }
    }

    if (hideLowRel && item?.relevance_score !== undefined) {
      if (Number(item.relevance_score) === 0) return false;
    }

    if (!matchesSearch(item)) return false;
    return true;
  }

  // Derived content per view
  const harms = (sections.harms || []).filter(matchesCommon).slice(0, showN);
  const signals = (sections.signals || []).filter(matchesCommon).slice(0, showN);
  const releases = (sections.dev_releases || []).filter(matchesCommon).slice(0, showN);
  const incidents = (sections.aiid || []).filter(matchesCommon).slice(0, showN);
  const forums = (sections.forums || []).filter(matchesCommon).slice(0, showN);

  // Overview metrics
  const topCats = useMemo(() => {
    const m = new Map();
    (sections.harms || []).forEach((h) => {
      const c = h.category || "Other";
      m.set(c, (m.get(c) || 0) + 1);
    });
    const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return arr.slice(0, 6);
  }, [sections.harms]);

  const maxTopCat = topCats.reduce((mx, [, v]) => Math.max(mx, v), 1);

  return (
    <div className="min-h-screen">
      {/* Shell */}
      <div className="max-w-7xl mx-auto px-5 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-4">
          {/* Sidebar */}
          <aside className="glass rounded-2xl p-4 animate-fadeUp">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
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
                className="pill px-3 py-2 text-[12px] hover:bg-[rgba(255,255,255,0.06)] transition"
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

            <NavItem icon={<LayoutDashboard size={16} />} label="Overview" active={view === "overview"} onClick={() => setView("overview")} count={null} />
            <NavItem icon={<Shield size={16} />} label="Harms" active={view === "harms"} onClick={() => setView("harms")} count={counts.harms} />
            <NavItem icon={<TrendingUp size={16} />} label="Signals" active={view === "signals"} onClick={() => setView("signals")} count={counts.signals} />
            <NavItem icon={<Cpu size={16} />} label="Model releases" active={view === "releases"} onClick={() => setView("releases")} count={counts.dev_releases} />
            <NavItem icon={<Database size={16} />} label="Incident DB" active={view === "incidents"} onClick={() => setView("incidents")} count={counts.aiid} />
            <NavItem icon={<MessageSquare size={16} />} label="Forums" active={view === "forums"} onClick={() => setView("forums")} count={counts.forums} />

            <div className="hr my-4" />

            {/* External reference link (your inspiration site) */}
            <a
              className="pill px-3 py-2 text-[12px] flex items-center justify-between hover:bg-[rgba(255,255,255,0.06)] transition"
              href="https://airisk.mit.edu/ai-incident-tracker"
              target="_blank"
              rel="noreferrer"
              title="Inspiration site"
            >
              <span className="inline-flex items-center gap-2">
                <ExternalLink size={14} />
                MIT tracker
              </span>
              <span className="text-[var(--faint)]">opens</span>
            </a>

            {/* Note: MIT tracker explicitly describes interactive dashboards and incident view. [1](https://pipedream.com/apps/rss/integrations/mistral-ai/upload-file-with-mistral-ai-api-on-new-item-in-feed-from-rss-api-int_Gjsy1rNA)[2](https://tracefeed.com/ai/anthropic/) */}
            <div className="mt-3 text-[11px] text-[var(--faint)] leading-relaxed">
              Inspired by multi-view interactive dashboards (risk classification / incident view / timelines). [1](https://pipedream.com/apps/rss/integrations/mistral-ai/upload-file-with-mistral-ai-api-on-new-item-in-feed-from-rss-api-int_Gjsy1rNA)[2](https://tracefeed.com/ai/anthropic/)
            </div>
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
                    className="w-full rounded-xl bg-[rgba(255,255,255,0.04)] border border-[var(--border)] px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgba(79,70,229,0.35)]"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className="pill px-3 py-2 text-sm hover:bg-[rgba(255,255,255,0.06)] transition"
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

                  <select className="pill px-3 py-2 text-sm bg-transparent" value={showN} onChange={(e) => setShowN(parseInt(e.target.value, 10))} title="How many items to show">
                    {[18, 24, 30, 48, 72, 100].map((n) => <option key={n} value={n}>Show {n}</option>)}
                  </select>

                  <label className="pill px-3 py-2 text-sm inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hideLowRel} onChange={(e) => setHideLowRel(e.target.checked)} />
                    Hide low relevance
                  </label>
                </div>
              </div>

              {showFilters ? (
                <div className="mt-3 text-[12px] text-[var(--muted)] flex flex-wrap gap-x-4 gap-y-1">
                  {limits.TIME_WINDOW ? <span className="font-mono">TIME_WINDOW={String(limits.TIME_WINDOW)}</span> : null}
                  {limits.RELEASE_TIME_WINDOW ? <span className="font-mono">RELEASE_TIME_WINDOW={String(limits.RELEASE_TIME_WINDOW)}</span> : null}
                  {limits.INCIDENT_TIME_WINDOW ? <span className="font-mono">INCIDENT_TIME_WINDOW={String(limits.INCIDENT_TIME_WINDOW)}</span> : null}
                  {errors && Object.keys(errors).length ? (
                    <span className="font-mono text-[rgba(245,158,11,0.9)]">warnings: {Object.keys(errors).length}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* View content */}
            <div className="mt-4">
              {loading && !payload ? <OverviewSkeleton /> : null}
              {!loading && !payload ? (
                <div className="card p-4 text-sm text-[rgba(255,255,255,0.85)]">
                  Failed to load <span className="font-mono">news_data.json</span>.
                </div>
              ) : null}

              {!loading && payload && view === "overview" ? (
                <Overview
                  counts={counts}
                  topCats={topCats}
                  maxTopCat={maxTopCat}
                  errors={errors}
                  limits={limits}
                />
              ) : null}

              {!loading && payload && view === "signals" ? (
                <SignalsView items={signals} emptyHint="No signals match your filters." />
              ) : null}

              {!loading && payload && view === "harms" ? (
                <TableView
                  title="Harms"
                  subtitle="Raw query hits bucketed by category."
                  rows={harms}
                  kind="harms"
                  emptyHint="No harms items match your filters."
                />
              ) : null}

              {!loading && payload && view === "releases" ? (
                <TableView
                  title="Model releases"
                  subtitle="Official posts + credible coverage of releases and model/system cards."
                  rows={releases}
                  kind="releases"
                  emptyHint={errors?.dev_releases ? `Backend error: ${errors.dev_releases}` : "No model releases returned."}
                />
              ) : null}

              {!loading && payload && view === "incidents" ? (
                <TableView
                  title="Incident DB"
                  subtitle="Incident entries (can be backed by MIT tracker or AIID)."
                  rows={incidents}
                  kind="aiid"
                  emptyHint={errors?.aiid ? `Backend error: ${errors.aiid}` : "No incidents returned."}
                />
              ) : null}

              {!loading && payload && view === "forums" ? (
                <TableView
                  title="Forums"
                  subtitle="High-noise sources; we can refine separately."
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

function NavItem({ icon, label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl mb-1 transition flex items-center justify-between ${
        active
          ? "bg-[rgba(79,70,229,0.18)] border border-[rgba(79,70,229,0.25)]"
          : "hover:bg-[rgba(255,255,255,0.05)]"
      }`}
    >
      <span className="inline-flex items-center gap-2 text-sm">
        <span className="text-[var(--muted)]">{icon}</span>
        <span className="text-[rgba(255,255,255,0.92)]">{label}</span>
      </span>
      {count !== null && count !== undefined ? (
        <span className="text-[11px] font-mono text-[var(--muted)]">{count}</span>
      ) : null}
    </button>
  );
}

function Overview({ counts, topCats, maxTopCat, errors, limits }) {
  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Harms" value={counts.harms} hint="Raw items" accent="var(--accent)" />
        <MetricCard title="Signals" value={counts.signals} hint="Clusters" accent="var(--accent-2)" />
        <MetricCard title="Model releases" value={counts.dev_releases} hint="Release feed" accent="var(--accent)" />
        <MetricCard title="Incidents" value={counts.aiid} hint="Incident DB" accent="var(--accent-2)" />
      </div>

      {/* Category distribution (simple bar chart) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card card-hover p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Top harm categories</div>
              <div className="text-[12px] text-[var(--muted)] mt-1">
                Quick distribution view (helps “scan” without reading everything).
              </div>
            </div>
            <div className="pill px-2 py-1 text-[11px] text-[var(--muted)] font-mono">
              {counts.harms} total
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {topCats.map(([cat, n]) => (
              <div key={cat}>
                <div className="flex items-center justify-between text-[12px] text-[var(--muted)]">
                  <span className={`inline-flex items-center gap-2`}>
                    <span className={`px-2 py-0.5 rounded-full border ${categoryBadge(cat)} text-[11px]`}>
                      {cat}
                    </span>
                  </span>
                  <span className="font-mono">{n}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${clamp((n / maxTopCat) * 100, 4, 100)}%`,
                      background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes + warnings */}
        <div className="card card-hover p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">About this dashboard</div>
              <div className="text-[12px] text-[var(--muted)] mt-1">
                The inspiration site emphasises interactive exploration (multiple dashboards and incident views). [1](https://pipedream.com/apps/rss/integrations/mistral-ai/upload-file-with-mistral-ai-api-on-new-item-in-feed-from-rss-api-int_Gjsy1rNA)[2](https://tracefeed.com/ai/anthropic/)
              </div>
            </div>
            <span className="pill px-2 py-1 text-[11px] text-[var(--muted)] font-mono">
              PoC
            </span>
          </div>

          <div className="mt-3 space-y-2 text-[12px] text-[var(--muted)] leading-relaxed">
            {limits?.TIME_WINDOW ? (
              <div><span className="font-mono">TIME_WINDOW</span> is <span className="font-mono">{String(limits.TIME_WINDOW)}</span> (harms).</div>
            ) : null}
            {limits?.RELEASE_TIME_WINDOW ? (
              <div><span className="font-mono">RELEASE_TIME_WINDOW</span> is <span className="font-mono">{String(limits.RELEASE_TIME_WINDOW)}</span> (releases).</div>
            ) : null}
            {limits?.INCIDENT_TIME_WINDOW ? (
              <div><span className="font-mono">INCIDENT_TIME_WINDOW</span> is <span className="font-mono">{String(limits.INCIDENT_TIME_WINDOW)}</span> (incidents).</div>
            ) : null}

            {errors && Object.keys(errors).length ? (
              <div className="mt-2 border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] rounded-xl p-3">
                <div className="text-[12px] font-semibold text-[rgba(255,251,235,0.92)]">Warnings</div>
                <div className="text-[12px] text-[rgba(255,251,235,0.85)] mt-1">
                  Some sources failed or returned empty. See <span className="font-mono">meta.errors</span> in <span className="font-mono">news_data.json</span>.
                </div>
              </div>
            ) : (
              <div className="mt-2 border border-[rgba(34,197,94,0.30)] bg-[rgba(34,197,94,0.06)] rounded-xl p-3">
                <div className="text-[12px] font-semibold text-[rgba(240,253,244,0.92)]">All sources healthy</div>
                <div className="text-[12px] text-[rgba(240,253,244,0.80)] mt-1">
                  No backend errors reported in <span className="font-mono">meta.errors</span>.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, hint, accent }) {
  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] text-[var(--muted)]">{hint}</div>
          <div className="text-sm font-semibold mt-1">{title}</div>
        </div>
        <div className="h-8 w-8 rounded-xl" style={{ background: `linear-gradient(180deg, ${accent}, rgba(255,255,255,0.06))`, opacity: 0.9 }} />
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value ?? 0}</div>
      <div className="mt-2 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div className="h-1.5 rounded-full" style={{ width: `${clamp((value || 0) / 200 * 100, 4, 100)}%`, background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.25))` }} />
      </div>
    </div>
  );
}

function SignalsView({ items, emptyHint }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Signals</div>
          <div className="text-[12px] text-[var(--muted)] mt-1">
            Clusters of similar headlines within a primary category (prioritisation aid, not verification).
          </div>
        </div>
        <span className="pill px-2 py-1 text-[11px] text-[var(--muted)] font-mono">{items.length}</span>
      </div>

      <div className="hr my-4" />

      {!items.length ? (
        <div className="text-sm text-[var(--muted)]">{emptyHint}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((s) => (
            <article key={s.signal_id} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-3">
                <span className={`inline-flex px-2 py-1 text-[11px] rounded-full border ${categoryBadge(s.primary_category)}`}>
                  {s.primary_category || "Signal"}
                </span>
                <span className={`inline-flex px-2 py-1 text-[11px] rounded-full border ${confidenceColor(s.confidence_label)}`}>
                  {s.confidence_label || "Low"}
                </span>
              </div>

              <div className="mt-2 text-sm font-semibold leading-snug">
                {s.title}
              </div>

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
                    className="block text-[12px] text-[rgba(147,197,253,0.95)] hover:underline"
                  >
                    {(l.source_type || "news").toUpperCase()} · {l.source}: {l.title}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
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
        <div className="text-sm text-[var(--muted)]">{emptyHint}</div>
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
                      <span className={`inline-flex px-2 py-1 text-[11px] rounded-full border ${categoryBadge(category)}`}>
                        {category}
                      </span>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <a href={r.link} target="_blank" rel="noreferrer" className="hover:underline">
                        {r.title}
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

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => <div key={i} className="card p-4 skeleton h-[120px]" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4 skeleton h-[260px]" />
        <div className="card p-4 skeleton h-[260px]" />
      </div>
    </div>
  );
}
