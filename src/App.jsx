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
  ExternalLink,
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

export default function App() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  // Views
  const [view, setView] = useState("overview"); // overview | harms | signals | releases | forums

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("7d");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All"); // All | News | Forum
  const [ukOnly, setUkOnly] = useState(false);
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
    return title.includes(q) || source.includes(q) || tags.includes(q) || cat.includes(q);
  }

  // View-aware filter application (fixes “filters not working”)
  function passesCommon(item, kind) {
    // time filter (if no timestamp, keep item)
    if (item?.timestamp && !withinWindow(item.timestamp, timeFilter)) return false;

    // UK-only toggle: uses backend uk_relevance where available
    if (ukOnly) {
      const uk = item?.uk_relevance || (item?.uk_score >= 2);
      if (!uk) return false;
    }

    // category filter:
    if (categoryFilter !== "All") {
      if (kind === "releases") {
        // releases are a single bucket; allow "Model Releases" to pass, else ignore
        if (categoryFilter !== "Model Releases") return false;
      } else if (kind === "signals") {
        const cat = item?.primary_category || "";
        const tags = item?.tags || [];
        if (cat !== categoryFilter && !tags.includes(categoryFilter)) return false;
      } else {
        // harms/forums
        if ((item?.category || "") !== categoryFilter) return false;
      }
    }

    // source filter:
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

  // Filtered lists per view
  const harms = (sections.harms || []).filter((x) => passesCommon(x, "harms"));
  const signals = (sections.signals || []).filter((x) => passesCommon(x, "signals"));
  const forums = (sections.forums || []).filter((x) => passesCommon(x, "forums"));
  const releases = (sections.dev_releases || []).filter((x) => passesCommon(x, "releases"));

  // Overview: “what’s new” feed (merge top items)
  const whatsNew = useMemo(() => {
    const pool = [];
    (sections.harms || []).slice(0, 30).forEach((h) => pool.push({ kind: "Harms", title: h.title, link: h.link, date: h.date, category: h.category }));
    (sections.dev_releases || []).slice(0, 20).forEach((r) => pool.push({ kind: "Release", title: r.title, link: r.link, date: r.date, category: "Model Releases" }));
    (sections.signals || []).slice(0, 15).forEach((s) => pool.push({ kind: "Signal", title: s.title, link: (s.links && s.links[0]?.link) || "", date: s.latest_date, category: s.primary_category }));
    pool.sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
    return pool.slice(0, 10);
  }, [sections]);

  // Harm buckets
  const harmCategories = useMemo(() => {
    const cats = new Set((sections.harms || []).map((h) => h.category).filter(Boolean));
    const arr = Array.from(cats);
    // Keep "Other" last if present
    arr.sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
    return arr;
  }, [sections.harms]);

  function toggleBucket(cat) {
    setOpenBuckets((s) => ({ ...s, [cat]: !s[cat] }));
  }

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

              {/* optional AI summary blocks */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="pill px-4 py-3">
                  <div className="text-xs text-[var(--muted)] flex items-center gap-2">
                    <Sparkles size={14} /> Top signals summary
                  </div>
                  <div className="mt-1 text-sm">{summaries?.signals_top || "—"}</div>
                </div>
                <div className="pill px-4 py-3">
                  <div className="text-xs text-[var(--muted)] flex items-center gap-2">
                    <Sparkles size={14} /> Model releases summary
                  </div>
                  <div className="mt-1 text-sm">{summaries?.releases_top || "—"}</div>
                </div>
              </div>

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
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
                <div className="lg:col-span-2">
                  <label className="text-xs text-[var(--muted)]">Search</label>
                  <div className="relative mt-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="titles, sources, tags…"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[var(--muted)]">Time</label>
                  <select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                    <option value="24h">Last 24h</option>
                    <option value="7d">Last 7d</option>
                    <option value="30d">Last 30d</option>
                    <option value="All">Any time</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--muted)]">Category</label>
                  <select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--muted)]">Source type</label>
                  <select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                    <option value="All">All</option>
                    <option value="News">News</option>
                    <option value="Forum">Forum</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--muted)]">Show</label>
                  <select className="mt-1 w-full pill px-3 py-2 text-sm bg-white" value={showN} onChange={(e) => setShowN(parseInt(e.target.value, 10))}>
                    {[24, 36, 48, 72, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div className="lg:col-span-6 flex flex-wrap gap-3 items-center mt-1">
                  <label className="inline-flex items-center gap-2 text-sm pill px-3 py-2 bg-white">
                    <input type="checkbox" checked={ukOnly} onChange={(e) => setUkOnly(e.target.checked)} />
                    UK only (heuristic)
                  </label>
                  <div className="text-xs text-[var(--muted)] font-mono">
                    TIME_WINDOW={limits.TIME_WINDOW || "—"} · RELEASE_TIME_WINDOW={limits.RELEASE_TIME_WINDOW || "—"} · dedupe={meta.dedupe_mode || "—"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Navigation */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-4">
          <aside className="card p-4">
            <NavItem icon={<LayoutDashboard size={16} />} label="Overview" active={view === "overview"} onClick={() => setView("overview")} count={null} />
            <NavItem icon={<Shield size={16} />} label="Harms" active={view === "harms"} onClick={() => setView("harms")} count={counts.harms} />
            <NavItem icon={<TrendingUp size={16} />} label="Signals" active={view === "signals"} onClick={() => setView("signals")} count={counts.signals} />
            <NavItem icon={<Cpu size={16} />} label="Model releases" active={view === "releases"} onClick={() => setView("releases")} count={counts.dev_releases} />
            <NavItem icon={<MessageSquare size={16} />} label="Forums" active={view === "forums"} onClick={() => setView("forums")} count={counts.forums} />
          </aside>

          <main className="space-y-4">
            {loading && !payload ? <SkeletonDashboard /> : null}

            {!loading && payload && view === "overview" ? (
              <OverviewView
                counts={counts}
                coverage={coverage}
                whatsNew={whatsNew}
                summaries={summaries}
              />
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
              />
            ) : null}

            {!loading && payload && view === "signals" ? (
              <SignalsView items={signals.slice(0, showN)} />
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

function OverviewView({ counts, coverage, whatsNew, summaries }) {
  const cov = coverage?.by_harm || {};
  const topCats = Object.entries(cov).sort((a, b) => (b[1]?.count || 0) - (a[1]?.count || 0)).slice(0, 6);
  const max = topCats.reduce((m, [, v]) => Math.max(m, v?.count || 0), 1);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric title="Harms" value={counts.harms} colour="var(--a3)" />
        <Metric title="Signals" value={counts.signals} colour="var(--a2)" />
        <Metric title="Model releases" value={counts.dev_releases} colour="var(--a1)" />
        <Metric title="Forums (harm-tagged)" value={counts.forums} colour="var(--a4)" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Top harm categories</div>
              <div className="text-sm text-[var(--muted)] mt-1">Quick distribution snapshot.</div>
            </div>
            <span className="pill px-3 py-1 text-xs font-mono text-slate-600">{counts.harms} total</span>
          </div>

          <div className="mt-3 space-y-3">
            {topCats.map(([cat, v]) => {
              const n = v?.count || 0;
              const uk = v?.uk_count || 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`inline-flex px-2 py-1 rounded-full border ${catChip(cat)} text-xs`}>
                      {cat}
                    </span>
                    <span className="text-xs font-mono text-slate-600">{n} (UK {uk})</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${clamp((n / max) * 100, 4, 100)}%`, background: "linear-gradient(90deg, var(--a1), var(--a2))" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold">What’s new</div>
          <div className="text-sm text-[var(--muted)] mt-1">Most recent items across the system.</div>

          <div className="mt-3 space-y-2">
            {whatsNew.map((x, i) => (
              <a
                key={i}
                href={x.link}
                target="_blank"
                rel="noreferrer"
                className="block card-hover border border-slate-100 rounded-xl px-3 py-2 bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 font-mono">{x.kind}</div>
                  <div className={`text-xs px-2 py-1 rounded-full border ${catChip(x.category)}`}>{x.category}</div>
                </div>
                <div className="mt-1 text-sm font-medium">{x.title}</div>
                <div className="mt-1 text-xs text-slate-500 font-mono">{fmtDateShort(x.date)}</div>
              </a>
            ))}
          </div>

          <div className="mt-3 pill px-3 py-2">
            <div className="text-xs text-[var(--muted)] flex items-center gap-2">
              <Sparkles size={14} /> System summary (signals)
            </div>
            <div className="mt-1 text-sm">{summaries?.signals_top || "—"}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ title, value, colour }) {
  return (
    <div className="card p-4 card-hover">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-[var(--muted)]">{title}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{value ?? 0}</div>
        </div>
        <div className="h-10 w-10 rounded-2xl" style={{ background: `linear-gradient(180deg, ${colour}, rgba(255,255,255,0.8))` }} />
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-2 rounded-full" style={{ width: `${clamp(((value || 0) / 200) * 100, 4, 100)}%`, background: `linear-gradient(90deg, ${colour}, var(--a2))` }} />
      </div>
    </div>
  );
}

function HarmsView({ categories, harms, coverage, summaries, openBuckets, toggleBucket, showN }) {
  const byCat = useMemo(() => {
    const m = new Map();
    for (const h of harms) {
      const c = h.category || "Other";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(h);
    }
    // Already sorted in backend by UK score + relevance + recency
    return m;
  }, [harms]);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Harms (bucketed)</div>
          <div className="text-sm text-[var(--muted)] mt-1">
            Buckets use your harm_queries categories. Items are sorted with UK relevance first.
          </div>
        </div>
        <span className="pill px-3 py-1 text-xs font-mono text-slate-600">{harms.length}</span>
      </div>

      <div className="hr my-4" />

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
                  <span className="text-xs font-mono text-slate-600">count {cov.count ?? items.length} · UK {cov.uk_count ?? 0}</span>
                </div>
                <span className="text-xs text-slate-500 font-mono">{summaries?.harms_by_category?.[cat] ? "summary" : ""}</span>
              </button>

              {isOpen ? (
                <div className="p-4 bg-white">
                  {summaries?.harms_by_category?.[cat] ? (
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
                          <div className="text-xs text-slate-500 font-mono">{fmtDateShort(h.date)}</div>
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
  );
}

function SignalsView({ items }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Signals (harms-focused)</div>
          <div className="text-sm text-[var(--muted)] mt-1">
            Clusters of similar headlines within a category. Built from harms + harms-tagged forums + model releases.
          </div>
        </div>
        <span className="pill px-3 py-1 text-xs font-mono text-slate-600">{items.length}</span>
      </div>

      <div className="hr my-4" />

      {!items.length ? (
        <div className="text-sm text-[var(--muted)]">No signals match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((s) => (
            <article key={s.signal_id} className="card-hover border border-slate-100 rounded-2xl p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <span className={`text-xs px-2 py-1 rounded-full border ${catChip(s.primary_category)}`}>
                  {s.primary_category || "Signal"}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full border ${confidenceChip(s.confidence_label)}`}>
                  {s.confidence_label || "Low"}
                </span>
              </div>

              <div className="mt-2 text-sm font-semibold leading-snug">{s.title}</div>

              {s.ai_summary ? (
                <div className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                  {s.ai_summary}
                </div>
              ) : null}

              <div className="mt-2 text-xs text-slate-500 font-mono">
                latest {fmtDateShort(s.latest_date)} · {s.source_count ?? 0} sources · {s.cluster_size ?? 0} items
              </div>

              <div className="mt-3 space-y-1">
                {(s.links || []).slice(0, 5).map((l, i) => (
                  <a key={i} href={l.link} target="_blank" rel="noreferrer" className="block text-sm text-blue-700 hover:underline">
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

function ReleasesView({ items }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Model releases</div>
          <div className="text-sm text-[var(--muted)] mt-1">
            Only items that look like new model releases / model cards / system cards are included.
          </div>
        </div>
        <span className="pill px-3 py-1 text-xs font-mono text-slate-600">{items.length}</span>
      </div>

      <div className="hr my-4" />

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
                <span className={`text-xs px-2 py-1 rounded-full border ${catChip("Model Releases")}`}>Model release</span>
                <span className="text-xs text-slate-500 font-mono">{fmtDateShort(r.date)}</span>
              </div>
              <div className="mt-2 text-sm font-semibold">{r.title}</div>
              <div className="mt-1 text-xs text-slate-500">{r.source}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ForumsView({ items }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Forums (harms-tagged)</div>
          <div className="text-sm text-[var(--muted)] mt-1">
            Forum items are only included if they match a harm category (based on your harm_queries keywords).
          </div>
        </div>
        <span className="pill px-3 py-1 text-xs font-mono text-slate-600">{items.length}</span>
      </div>

      <div className="hr my-4" />

      {!items.length ? (
        <div className="text-sm text-[var(--muted)]">No forum items match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((f, i) => (
            <article key={`${f.link}-${i}`} className="card-hover border border-slate-100 rounded-2xl p-4 bg-white">
              <div className="flex items-center justify-between gap-3">
                <span className={`text-xs px-2 py-1 rounded-full border ${catChip(f.category)}`}>{f.category}</span>
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
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => <div key={i} className="skeleton h-[120px]" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="skeleton h-[280px]" />
        <div className="skeleton h-[280px]" />
      </div>
    </div>
  );
}
