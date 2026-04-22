import { useEffect, useMemo, useState } from "react"; setShowN(p.showN);
      if (typeof p?.showAiSummaries === "boolean") setShowAiSummaries(p.showAiSummaries);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "aihm_ui_prefs_v7",
        JSON.stringify({ view, showN, showAiSummaries })
      );
    } catch {
      // ignore
    }
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

  useEffect(() => {
    load();
  }, []);

  const sections = payload?.sections || {};
  const coverage = payload?.coverage || {};
  const summaries = payload?.summaries || {};
  const meta = payload?.meta || {};
  const limits = meta?.limits || {};
  const errors = meta?.errors || {};

  const counts = useMemo(
    () => ({
      harms: (sections.harms || []).length,
      signals: (sections.signals || []).length,
      dev_releases: (sections.dev_releases || []).length,
      forums: (sections.forums || []).length,
    }),
    [sections]
  );

  const allCategories = useMemo(() => {
    const cats = new Set();
    (sections?.harms || []).forEach((h) => h?.category && cats.add(h.category));
    (sections?.signals || []).forEach((s) => s?.primary_category && cats.add(s.primary_category));
    (sections?.forums || []).forEach((f) => f?.category && cats.add(f.category));
    (sections?.dev_releases || []).forEach(() => cats.add("Model Releases"));
    return ["All", ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
  }, [sections]);

  const allMechanisms = useMemo(() => {
    const vals = new Set();
    (sections?.harms || []).forEach((x) => x?.mechanism && vals.add(x.mechanism));
    (sections?.signals || []).forEach((x) => x?.mechanism && vals.add(x.mechanism));
    (sections?.forums || []).forEach((x) => x?.mechanism && vals.add(x.mechanism));
    return ["All", ...Array.from(vals).sort((a, b) => a.localeCompare(b))];
  }, [sections]);

  const allSubtypes = useMemo(() => {
    const vals = new Set();
    (sections?.harms || []).forEach((x) => x?.harm_subtype && vals.add(x.harm_subtype));
    (sections?.signals || []).forEach((x) => x?.harm_subtype && vals.add(x.harm_subtype));
    (sections?.forums || []).forEach((x) => x?.harm_subtype && vals.add(x.harm_subtype));
    return ["All", ...Array.from(vals).sort((a, b) => a.localeCompare(b))];
  }, [sections]);

  const harmCategories = useMemo(() => {
    const cats = new Set((sections.harms || []).map((h) => h.category).filter(Boolean));
    const arr = Array.from(cats);
    arr.sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
    return arr;
  }, [sections.harms]);

  function matchesSearch(item) {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const title = (item?.title || "").toLowerCase();
    const source = (item?.source || "").toLowerCase();
    const tags = (item?.tags || []).join(" ").toLowerCase();
    const cat = (item?.category || item?.primary_category || "").toLowerCase();
    const mech = (item?.mechanism || "").toLowerCase();
    const subtype = (item?.harm_subtype || "").toLowerCase();
    const summary = (item?.ai_summary || "").toLowerCase();
    return (
      title.includes(q) ||
      source.includes(q) ||
      tags.includes(q) ||
      cat.includes(q) ||
      mech.includes(q) ||
      subtype.includes(q) ||
      summary.includes(q)
    );
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

    if (mechanismFilter !== "All") {
      if ((item?.mechanism || "") !== mechanismFilter) return false;
    }

    if (subtypeFilter !== "All") {
      if ((item?.harm_subtype || "") !== subtypeFilter) return false;
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

    return matchesSearch(item);
  }

  function sortItems(items, kind) {
    if (sortBy === "relevance") return items;
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
      copy.sort(
        (a, b) =>
          (b?.uk_score ?? (b?.uk_relevance ? 2 : 0)) -
          (a?.uk_score ?? (a?.uk_relevance ? 2 : 0))
      );
      return copy;
    }
    if (sortBy === "confidence" && kind === "signals") {
      copy.sort((a, b) => confidenceRank(b?.confidence_label) - confidenceRank(a?.confidence_label));
      return copy;
    }
    return copy;
  }

  const harms = useMemo(() => {
    const filtered = (sections.harms || []).filter((x) => passesCommon(x, "harms"));
    return sortItems(filtered, "harms");
  }, [sections.harms, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, mechanismFilter, subtypeFilter, sourceFilter, ukOnly, minUkScore, sortBy]);

  const signals = useMemo(() => {
    const filtered = (sections.signals || []).filter((x) => passesCommon(x, "signals"));
    return sortItems(filtered, "signals");
  }, [sections.signals, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, mechanismFilter, subtypeFilter, sourceFilter, ukOnly, minUkScore, sortBy]);

  const forums = useMemo(() => {
    const filtered = (sections.forums || []).filter((x) => passesCommon(x, "forums"));
    return sortItems(filtered, "forums");
  }, [sections.forums, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, mechanismFilter, subtypeFilter, sourceFilter, ukOnly, minUkScore, sortBy]);

  const releases = useMemo(() => {
    const filtered = (sections.dev_releases || []).filter((x) => passesCommon(x, "releases"));
    return sortItems(filtered, "releases");
  }, [sections.dev_releases, searchTerm, timeFilter, dateFrom, dateTo, categoryFilter, sourceFilter, ukOnly, minUkScore, sortBy]);

  function toggleBucket(cat) {
    setOpenBuckets((s) => ({ ...s, [cat]: !s[cat] }));
  }

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (searchTerm.trim()) chips.push({ k: "search", label: `Search: ${searchTerm.trim()}` });
    if (dateFrom) chips.push({ k: "dateFrom", label: `From: ${dateFrom}` });
    if (dateTo) chips.push({ k: "dateTo", label: `To: ${dateTo}` });
    if (!dateFrom && !dateTo && timeFilter !== "All") chips.push({ k: "time", label: `Time: ${timeFilter}` });
    if (categoryFilter !== "All") chips.push({ k: "cat", label: `Category: ${categoryFilter}` });
    if (mechanismFilter !== "All") chips.push({ k: "mech", label: `Mechanism: ${mechanismFilter}` });
    if (subtypeFilter !== "All") chips.push({ k: "subtype", label: `Subtype: ${subtypeFilter}` });
    if (sourceFilter !== "All") chips.push({ k: "src", label: `Source: ${sourceFilter}` });
    if (sortBy !== "relevance") chips.push({ k: "sort", label: `Sort: ${sortBy}` });
    if (minUkScore > 0) chips.push({ k: "minUk", label: `Min UK: ${minUkScore}` });
    if (ukOnly) chips.push({ k: "ukOnly", label: "UK only" });
    if (showAiSummaries) chips.push({ k: "aiSum", label: "AI summaries" });
    return chips;
  }, [searchTerm, dateFrom, dateTo, timeFilter, categoryFilter, mechanismFilter, subtypeFilter, sourceFilter, sortBy, minUkScore, ukOnly, showAiSummaries]);

  function clearChip(k) {
    if (k === "search") setSearchTerm("");
    if (k === "dateFrom") setDateFrom("");
    if (k === "dateTo") setDateTo("");
    if (k === "time") setTimeFilter("7d");
    if (k === "cat") setCategoryFilter("All");
    if (k === "mech") setMechanismFilter("All");
    if (k === "subtype") setSubtypeFilter("All");
    if (k === "src") setSourceFilter("All");
    if (k === "sort") setSortBy("relevance");
    if (k === "minUk") setMinUkScore(0);
    if (k === "ukOnly") setUkOnly(false);
    if (k === "aiSum") setShowAiSummaries(false);
  }

  function clearAllFilters() {
    setSearchTerm("");
    setTimeFilter("7d");
    setDateFrom("");
    setDateTo("");
    setSortBy("relevance");
    setMinUkScore(0);
    setCategoryFilter("All");
    setMechanismFilter("All");
    setSubtypeFilter("All");
    setSourceFilter("All");
    setUkOnly(false);
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
                {payload?.last_updated ? (
                  <span className="text-sm text-[var(--muted)] font-mono">
                    updated {String(payload.last_updated).slice(0, 19)}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-sm text-[var(--muted)] max-w-3xl leading-relaxed">
                {payload?.disclaimer || "Proof-of-concept dashboard for harms-focused horizon scanning."}
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
                className="pill px-4 py-2 text-sm hover:bg-white transition inline-flex items-center gap-2 bg-white/70"
                title="Refresh"
                type="button"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>

              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className="pill px-4 py-2 text-sm hover:bg-white transition inline-flex items-center gap-2 bg-white/70"
                title="Filters"
                type="button"
              >
                <SlidersHorizontal size={16} />
                Filters
              </button>
            </div>
          </div>

          {!filtersOpen && activeFilterChips.length ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-[var(--muted)] mr-1">Active filters:</div>
                {activeFilterChips.map((c) => (
                  <button
                    key={c.k}
                    onClick={() => clearChip(c.k)}
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white/70 hover:bg-white transition"
                    title="Click to remove"
                    type="button"
                  >
                    {c.label}
                    <X size={14} className="text-slate-400" />
                  </button>
                ))}
                <button
                  onClick={clearAllFilters}
                  className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition"
                  title="Clear all filters"
                  type="button"
                >
                  Clear all
                </button>
              </div>
            </div>
          ) : null}

          {filtersOpen ? (
            <div className="mt-4 card p-4 bg-white/70 border border-slate-200">
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
                    {[24, 36, 48, 72, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs text-[var(--muted)]">Category</label>
                  <select
                    className="mt-1 w-full pill px-3 py-2 text-sm bg-white"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs text-[var(--muted)]">Mechanism</label>
                  <select
                    className="mt-
import axios from "axios";
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
  if (key.includes("propaganda") || key.includes("radicalisation") || key.includes("recruitment")) return "border-rose-200 bg-rose-50 text-rose-900";
  if (key.includes("attack planning")) return "border-red-200 bg-red-50 text-red-900";
  if (key.includes("illegal items") || key.includes("drugs") || key.includes("firearms")) return "border-violet-200 bg-violet-50 text-violet-900";
  if (key.includes("cyber") || key.includes("ransomware") || key.includes("phishing")) return "border-cyan-200 bg-cyan-50 text-cyan-900";
  if (key.includes("evidence") || key.includes("identity")) return "border-indigo-200 bg-indigo-50 text-indigo-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function viewTheme(view) {
  if (view === "harms") {
    return { ring: "ring-rose-100", band: "from-rose-50 to-white", accent: "text-rose-700", border: "border-rose-100" };
  }
  if (view === "signals") {
    return { ring: "ring-sky-100", band: "from-sky-50 to-white", accent: "text-sky-700", border: "border-sky-100" };
  }
  if (view === "forums") {
    return { ring: "ring-fuchsia-100", band: "from-fuchsia-50 to-white", accent: "text-fuchsia-700", border: "border-fuchsia-100" };
  }
  if (view === "releases") {
    return { ring: "ring-indigo-100", band: "from-indigo-50 to-white", accent: "text-indigo-700", border: "border-indigo-100" };
  }
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
  const raw =
    (kind === "signals" ? (item?.latest_date || item?.date) : item?.date) ||
    (item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : "");
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

  const [harmsFocusCat, setHarmsFocusCat] = useState("All");
  const [openBuckets, setOpenBuckets] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("aihm_ui_prefs_v7");
      if (!raw) return;
      const p = JSON.parse(raw);
      const allowed = new Set(["harms", "signals", "forums", "releases"]);
      if (p?.view && allowed.has(p.view)) setView(p.view);
