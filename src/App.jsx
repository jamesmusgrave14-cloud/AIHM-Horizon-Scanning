import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Shield,
  TrendingUp,
  MessageSquare,
  Cpu,
  Database,
  RefreshCw,
  Search,
  Filter,
  Info,
} from "lucide-react";

function fmtDateShort(d) {
  if (!d) return "";
  // Works with RSS strings and ISO-ish strings; fall back to raw
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return String(d).slice(0, 16);
  const dt = new Date(t);
  return dt.toISOString().slice(0, 10);
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

function badgeTone(level) {
  if (level === "High") return "bg-green-100 text-green-800 border-green-200";
  if (level === "Medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function catTone(cat) {
  const key = (cat || "").toLowerCase();
  if (key.includes("fraud")) return "border-amber-500 text-amber-700";
  if (key.includes("cyber")) return "border-sky-500 text-sky-700";
  if (key.includes("terror")) return "border-rose-500 text-rose-700";
  if (key.includes("vawg")) return "border-fuchsia-500 text-fuchsia-700";
  if (key.includes("csam") || key.includes("child")) return "border-violet-500 text-violet-700";
  if (key.includes("model")) return "border-slate-500 text-slate-700";
  return "border-slate-400 text-slate-700";
}

export default function App() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("signals");
  const [searchTerm, setSearchTerm] = useState("");

  const [timeFilter, setTimeFilter] = useState("7d");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All"); // All | News | Forum
  const [hideLowRel, setHideLowRel] = useState(true);

  const [showN, setShowN] = useState({
    signals: 24,
    harms: 48,
    forums: 36,
    dev_releases: 24,
    aiid: 36,
  });

  async function load() {
    setLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.BASE_URL}news_data.json?ts=${Date.now()}`
      );
      setPayload(res.data);
    } catch (err) {
      console.error("Failed to load news_data.json", err);
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
    return (
      title.includes(q) ||
      source.includes(q) ||
      tags.includes(q) ||
      cat.includes(q)
    );
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
      // Signals don't have source_type; we infer from their links
      if (!st && item?.links?.length) {
        const anyForum = item.links.some((l) => (l?.source_type || "").toLowerCase() === "forum");
        const anyNews = item.links.some((l) => (l?.source_type || "").toLowerCase() === "news");
        if (sourceFilter === "Forum" && !anyForum) return false;
        if (sourceFilter === "News" && !anyNews) return false;
      }
    }

    if (hideLowRel && item?.relevance_score !== undefined) {
      // Only applies to harms (and signal links); conservative default
      if (Number(item.relevance_score) === 0) return false;
    }

    if (!matchesSearch(item)) return false;
    return true;
  }

  const tabs = [
    { id: "signals", label: "Signals", icon: TrendingUp },
    { id: "harms", label: "Harms", icon: Shield },
    { id: "forums", label: "Forums", icon: MessageSquare },
    { id: "dev_releases", label: "Model Releases", icon: Cpu },
    { id: "aiid", label: "Incident DB", icon: Database },
  ];

  const counts = {
    signals: (sections?.signals || []).length,
    harms: (sections?.harms || []).length,
    forums: (sections?.forums || []).length,
    dev_releases: (sections?.dev_releases || []).length,
    aiid: (sections?.aiid || []).length,
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* HEADER */}
      <header className="border-b border-slate-200 px-6 md:px-8 py-6 sticky top-0 bg-white/90 backdrop-blur z-40">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield size={18} />
              <div className="flex flex-col">
                <h1 className="font-bold text-sm uppercase tracking-tight">
                  AI Harms Horizon Scan
                </h1>
                <div className="text-[11px] text-slate-500">
                  {payload?.last_updated ? (
                    <span className="font-mono">updated {payload.last_updated.slice(0, 19)}</span>
                  ) : (
                    <span className="text-slate-400">no timestamp</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-full hover:bg-slate-100"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span className="text-[11px] font-semibold">Refresh</span>
            </button>
          </div>

          {payload?.disclaimer && (
            <div className="text-[12px] text-slate-600 max-w-4xl">
              {payload.disclaimer}
            </div>
          )}

          {/* SEARCH + FILTERS */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search titles, sources, tags…"
                className="w-full bg-slate-50 border border-slate-200 rounded-full py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Filter size={14} />
                Filters
              </div>

              <select
                className="text-xs border border-slate-200 rounded-full px-3 py-2 bg-white"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                title="Recency filter"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
                <option value="All">Any time</option>
              </select>

              <select
                className="text-xs border border-slate-200 rounded-full px-3 py-2 bg-white"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                title="Category filter"
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                className="text-xs border border-slate-200 rounded-full px-3 py-2 bg-white"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                title="Source type"
              >
                <option value="All">All sources</option>
                <option value="News">News only</option>
                <option value="Forum">Forums only</option>
              </select>

              <label className="inline-flex items-center gap-2 text-xs text-slate-600 px-3 py-2 border border-slate-200 rounded-full bg-white">
                <input
                  type="checkbox"
                  checked={hideLowRel}
                  onChange={(e) => setHideLowRel(e.target.checked)}
                />
                Hide low relevance
              </label>
            </div>
          </div>

          {/* META */}
          {limits && (
            <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-mono">TIME_WINDOW={String(limits.TIME_WINDOW || "")}</span>
              <span className="font-mono">MAX_PER_HARM={String(limits.MAX_PER_HARM || "")}</span>
              <span className="font-mono">MAX_RELEASES={String(limits.MAX_RELEASES || "")}</span>
              <span className="font-mono">MAX_AI_ID={String(limits.MAX_AI_ID || "")}</span>
              <span className="font-mono">MAX_FORUM_ITEMS={String(limits.MAX_FORUM_ITEMS || "")}</span>
            </div>
          )}
        </div>
      </header>

      {/* TABS */}
      <nav className="flex px-6 md:px-8 border-b border-slate-100 bg-white gap-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`py-4 text-[10px] font-bold uppercase tracking-widest border-b-2 whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <t.icon size={13} />
            {t.label}
            <span className="ml-1 text-[10px] text-slate-400 font-mono">
              {counts[t.id] ?? 0}
            </span>
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <main className="p-6 md:p-8 max-w-7xl mx-auto">
        {!payload && !loading && (
          <div className="border border-red-200 bg-red-50 text-red-700 p-4 rounded-lg">
            Failed to load <span className="font-mono">news_data.json</span>.
          </div>
        )}

        {activeTab === "signals" && (
          <SignalsView
            items={(sections?.signals || []).filter(matchesCommon)}
            showN={showN.signals}
            setShowN={(n) => setShowN((s) => ({ ...s, signals: n }))}
          />
        )}

        {activeTab === "harms" && (
          <HarmsView
            items={(sections?.harms || []).filter(matchesCommon)}
            showN={showN.harms}
            setShowN={(n) => setShowN((s) => ({ ...s, harms: n }))}
          />
        )}

        {activeTab === "forums" && (
          <ListView
            title="Forums"
            items={(sections?.forums || []).filter(matchesCommon)}
            showN={showN.forums}
            setShowN={(n) => setShowN((s) => ({ ...s, forums: n }))}
            emptyHint={errors?.forums ? `Backend error: ${errors.forums}` : "No forum items returned."}
            itemMeta={(it) => (it?.tags?.length ? it.tags.join(" · ") : "")}
          />
        )}

        {activeTab === "dev_releases" && (
          <ListView
            title="Model Releases"
            items={(sections?.dev_releases || []).filter(matchesCommon)}
            showN={showN.dev_releases}
            setShowN={(n) => setShowN((s) => ({ ...s, dev_releases: n }))}
            emptyHint={errors?.dev_releases ? `Backend error: ${errors.dev_releases}` : "No model releases returned (try widening TIME_WINDOW or MAX_RELEASES)."}
          />
        )}

        {activeTab === "aiid" && (
          <AIIDView
            items={(sections?.aiid || []).filter(matchesCommon)}
            showN={showN.aiid}
            setShowN={(n) => setShowN((s) => ({ ...s, aiid: n }))}
            emptyHint={errors?.aiid ? `Backend error: ${errors.aiid}` : "No AIID incidents returned (Google RSS may be sparse)."}
          />
        )}
      </main>
    </div>
  );
}

function ShowCount({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500">Show</span>
      <select
        className="text-xs border border-slate-200 rounded-full px-3 py-2 bg-white"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      >
        {[12, 24, 36, 48, 72, 100].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}

function SignalsView({ items, showN, setShowN }) {
  const sliced = items.slice(0, showN);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Info size={16} />
          <div className="text-[12px] text-slate-600 max-w-3xl">
            <span className="font-semibold">Signals</span> group similar headlines within the same primary category,
            across news + forums + model releases. They are a prioritisation aid, not verification.
          </div>
        </div>
        <ShowCount value={showN} onChange={setShowN} />
      </div>

      {!sliced.length ? (
        <EmptyState text="No signals match your filters." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sliced.map((s) => {
            const tone = catTone(s.primary_category);
            return (
              <article
                key={s.signal_id}
                className="border border-slate-200 rounded-lg p-5 bg-white hover:border-slate-300 transition"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className={`text-[10px] uppercase tracking-widest border-l-2 pl-3 ${tone}`}>
                    {s.primary_category || "Signal"}
                    <span className="ml-2 text-slate-400 font-mono">
                      {s.source_count ?? 0}s / {s.cluster_size ?? 0}i
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full border ${badgeTone(s.confidence_label)}`}>
                    {s.confidence_label || "Low"}
                  </span>
                </div>

                <div className="text-sm font-bold leading-snug mb-2">{s.title}</div>

                {s.ai_summary && (
                  <div className="text-[12px] text-slate-600 mb-3">{s.ai_summary}</div>
                )}

                {s.why_this_is_a_signal && (
                  <div className="text-[11px] text-slate-500 mb-3">{s.why_this_is_a_signal}</div>
                )}

                <div className="text-[11px] text-slate-400 font-mono mb-2">
                  latest {fmtDateShort(s.latest_date)}
                </div>

                <div className="space-y-1">
                  {(s.links || []).slice(0, 6).map((l, i) => (
                    <a
                      key={i}
                      href={l.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[11px] text-blue-700 hover:underline"
                    >
                      {(l.source_type || "news").toUpperCase()} · {l.source}: {l.title}
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HarmsView({ items, showN, setShowN }) {
  const sliced = items.slice(0, showN);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-slate-600">
          Raw query hits bucketed by category (use “Hide low relevance” to reduce noise).
        </div>
        <ShowCount value={showN} onChange={setShowN} />
      </div>

      {!sliced.length ? (
        <EmptyState text="No harms items match your filters." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sliced.map((h, i) => {
            const tone = catTone(h.category);
            return (
              <article
                key={`${h.link || ""}-${i}`}
                className="border border-slate-200 rounded-lg p-5 bg-slate-50/30 hover:border-slate-300 transition"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className={`text-[10px] uppercase tracking-widest border-l-2 pl-3 ${tone}`}>
                    {h.category || "Other"}
                  </div>
                  {h.relevance_score !== undefined && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      rel {h.relevance_score}
                    </span>
                  )}
                </div>

                <a
                  href={h.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-bold hover:underline block"
                >
                  {h.title}
                </a>

                <div className="mt-2 text-[11px] text-slate-500">
                  {h.source}
                  <span className="ml-2 text-slate-400 font-mono">
                    {fmtDateShort(h.date)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListView({ title, items, showN, setShowN, emptyHint, itemMeta }) {
  const sliced = items.slice(0, showN);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-slate-600">{title}</div>
        <ShowCount value={showN} onChange={setShowN} />
      </div>

      {!sliced.length ? (
        <EmptyState text={emptyHint || "No items returned."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sliced.map((it, i) => (
            <article key={`${it.link || ""}-${i}`} className="border border-slate-200 rounded-lg p-5 bg-white hover:border-slate-300 transition">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                {it.source || title}
                <span className="ml-2 text-slate-400 font-mono">{fmtDateShort(it.date)}</span>
              </div>

              <a href={it.link} target="_blank" rel="noreferrer" className="text-sm font-bold hover:underline">
                {it.title}
              </a>

              {itemMeta && itemMeta(it) ? (
                <div className="mt-2 text-[11px] text-slate-500">{itemMeta(it)}</div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AIIDView({ items, showN, setShowN, emptyHint }) {
  const sliced = items.slice(0, showN);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-slate-600">AI Incident Database (AIID)</div>
        <ShowCount value={showN} onChange={setShowN} />
      </div>

      {!sliced.length ? (
        <EmptyState text={emptyHint || "No incidents returned."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sliced.map((it, i) => (
            <article key={`${it.link || ""}-${i}`} className="border border-slate-200 rounded-lg p-5 bg-white hover:border-slate-300 transition">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                AIID
                {it.incident_no !== undefined ? (
                  <span className="ml-2 text-slate-400 font-mono">Incident {it.incident_no}</span>
                ) : null}
              </div>

              <a href={it.link} target="_blank" rel="noreferrer" className="text-sm font-bold hover:underline">
                {it.title}
              </a>

              <div className="mt-2 text-[11px] text-slate-500 font-mono">
                {fmtDateShort(it.date)}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="border border-slate-200 bg-slate-50 text-slate-600 p-4 rounded-lg text-sm">
      {text}
    </div>
  );
}
