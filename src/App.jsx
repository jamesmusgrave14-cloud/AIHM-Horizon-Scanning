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
  SlidersHorizontal,
  Globe,
  LayoutList,
  List,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";

/**
 * AIHM Intelligence Monitor — v4 (stable + RSS)
 * Requires:
 *  - /api/gnews supports q/lang/max and should pass through sortby/from/to (GNews supports these) [1](https://ukhomeoffice-my.sharepoint.com/personal/james_musgrave_homeoffice_gov_uk/_layouts/15/Doc.aspx?sourcedoc=%7B09A3D9B3-9B03-400E-BA1A-AFC42745D415%7D&file=AIHMT_Induction_Pack_Summary%20%281%29.pptx&action=edit&mobileredirect=true&DefaultItemOpen=1)
 *  - /api/rss exists (rss-parser)
 */

const STORAGE_KEY = "aihm_monitor_state_v4";

const DEFAULT_RSS_FEEDS = [
  // GO‑Science Futures/Foresight/Horizon Scanning blog (you’re subscribed by email)
  "https://foresightprojects.blog.gov.uk/feed/",
];

// Plan-aligned groups
const GROUPS = [
  { key: "all", label: "All" },
  { key: "dev", label: "Developer releases" },
  { key: "watchdogs", label: "Watchdogs & monitors" },
  { key: "gov", label: "Gov / HMG signals" },
  { key: "harms", label: "Operational harms" },
  { key: "research", label: "Academic & futures" },
  { key: "media", label: "Media & broad" },
  { key: "rss", label: "RSS feeds" },
];

// GNews sections (keep queries under 200 chars if possible; we also split just in case) [1](https://ukhomeoffice-my.sharepoint.com/personal/james_musgrave_homeoffice_gov_uk/_layouts/15/Doc.aspx?sourcedoc=%7B09A3D9B3-9B03-400E-BA1A-AFC42745D415%7D&file=AIHMT_Induction_Pack_Summary%20%281%29.pptx&action=edit&mobileredirect=true&DefaultItemOpen=1)
const SECTIONS = [
  {
    key: "dev_releases",
    group: "dev",
    title: "Developer releases & model cards",
    subtitle: "Model/system cards, open-weights, major release announcements.",
    tone: "blue",
    query:
      '"model card" OR "system card" OR "open weights" OR OpenAI OR Anthropic OR DeepMind OR Llama OR Grok',
  },
  {
    key: "watchdogs",
    group: "watchdogs",
    title: "Watchdogs & safety monitors",
    subtitle: "AISI/CETaS/Ada/Oxford/IWF style outputs and commentary.",
    tone: "maroon",
    query:
      'AISI OR "AI Security Institute" OR "AI Safety Institute" OR CETaS OR "Ada Lovelace Institute" OR IWF',
  },
  {
    key: "gov_signals",
    group: "gov",
    title: "Government / HMG signals",
    subtitle: "GO-Science, NSSIF and open reporting on emerging tech/threats.",
    tone: "maroon",
    query:
      '"Government Office for Science" OR "GO-Science" OR NSSIF OR "NSSIF Insights" OR "threat assessment" AND AI',
  },
  {
    key: "harms_csea",
    group: "harms",
    title: "CSEA / IBSA signals",
    subtitle: "Nudification, sextortion, grooming, NCII / IBSA indicators.",
    tone: "red",
    query:
      'CSEA OR CSAM OR nudification OR nudify OR sextortion OR grooming OR "deepfake pornography"',
  },
  {
    key: "harms_fraud",
    group: "harms",
    title: "Fraud & impersonation",
    subtitle: "Voice cloning, BEC, scams, synthetic identity, account takeover.",
    tone: "red",
    query:
      '"voice cloning" OR "deepfake fraud" OR impersonation OR "CEO fraud" OR BEC OR "account takeover"',
  },
  {
    key: "harms_cyber",
    group: "harms",
    title: "Cybercrime enablement",
    subtitle: "Phishing, malware, ransomware, prompt injection/jailbreak commoditisation.",
    tone: "red",
    query:
      'phishing OR malware OR ransomware OR "prompt injection" OR jailbreak AND AI',
  },
  {
    key: "research_futures",
    group: "research",
    title: "Academic & futures signals",
    subtitle: "Future capabilities/limitations; emerging harms research.",
    tone: "blue",
    query:
      '"future crime" OR "AI trajectories" OR "frontier AI" OR "agentic AI" OR "capability milestones"',
  },
  {
    key: "media_broad",
    group: "media",
    title: "Broad media capture (weak signals)",
    subtitle: "Catch unexpected developments; triage with filters/tags.",
    tone: "blue",
    query:
      '"artificial intelligence" AND (deepfake OR scam OR ransomware OR "model card" OR Ofcom OR nudify)',
  },
];

const RSS_SECTION = {
  key: "rss_updates",
  group: "rss",
  title: "RSS: Updates & briefs",
  subtitle: "Publisher updates (stable; not headline-search volatility).",
  tone: "maroon",
};

const DATE_WINDOWS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
];

const HIGH_TERMS = [
  "csam",
  "csea",
  "nudification",
  "sextortion",
  "ransomware",
  "account takeover",
  "bec",
  "liveness bypass",
];

const MED_TERMS = [
  "deepfake",
  "voice cloning",
  "phishing",
  "malware",
  "model card",
  "system card",
  "open weights",
  "watermark",
  "provenance",
  "c2pa",
];

function toDate(d) {
  const dt = d ? new Date(d) : null;
  return dt && !Number.isNaN(dt.getTime()) ? dt : null;
}
function fmtDate(iso) {
  const dt = toDate(iso);
  if (!dt) return "—";
  return dt.toISOString().slice(0, 10);
}
function withinWindow(iso, days) {
  if (!days) return true;
  const dt = toDate(iso);
  if (!dt) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return dt >= cutoff;
}
function computePriority(title, description, source) {
  const t = `${title || ""} ${description || ""} ${source || ""}`.toLowerCase();
  if (HIGH_TERMS.some((w) => t.includes(w))) return "High";
  if (MED_TERMS.some((w) => t.includes(w))) return "Medium";
  return "Low";
}
function computeTags(title, description, source) {
  const t = `${title || ""} ${description || ""} ${source || ""}`.toLowerCase();
  const tags = [];
  if (t.includes("model card") || t.includes("system card") || t.includes("open weights"))
    tags.push({ label: "Capability", key: "capability" });
  if (t.includes("ofcom") || t.includes("investigation") || t.includes("fined") || t.includes("charged"))
    tags.push({ label: "Enforcement", key: "enforcement" });
  if (
    t.includes("a i s i") ||
    t.includes("ai safety institute") ||
    t.includes("ai security institute") ||
    t.includes("cetas") ||
    t.includes("report") ||
    t.includes("study")
  )
    tags.push({ label: "Research", key: "research" });
  return tags;
}
function toneStyles(tone) {
  if (tone === "maroon") return { bar: "bg-[#7a1f3d]", ring: "ring-[#7a1f3d]/10" };
  if (tone === "blue") return { bar: "bg-[#1f4aa8]", ring: "ring-[#1f4aa8]/10" };
  return { bar: "bg-[#b42318]", ring: "ring-[#b42318]/10" };
}
function Pill({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] bg-white text-slate-700 border-slate-200">
      {children}
    </span>
  );
}
function PriorityPill({ value }) {
  const cls =
    value === "High"
      ? "bg-red-100 text-red-800 border-red-200"
      : value === "Medium"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : "bg-emerald-100 text-emerald-900 border-emerald-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${cls}`}>
      {value} priority
    </span>
  );
}
function SkeletonRow() {
  return (
    <li className="py-3 border-b border-slate-200 last:border-b-0">
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
      </div>
    </li>
  );
}

// GNews q max is 200 chars; split on " OR " to keep within limit [1](https://ukhomeoffice-my.sharepoint.com/personal/james_musgrave_homeoffice_gov_uk/_layouts/15/Doc.aspx?sourcedoc=%7B09A3D9B3-9B03-400E-BA1A-AFC42745D415%7D&file=AIHMT_Induction_Pack_Summary%20%281%29.pptx&action=edit&mobileredirect=true&DefaultItemOpen=1)
function splitQuery(q, maxLen = 200) {
  const s = (q || "").trim();
  if (s.length <= maxLen) return [s];
  const parts = s.split(/\s+OR\s+/i).map((x) => x.trim()).filter(Boolean);
  const out = [];
  let cur = "";
  for (const p of parts) {
    const candidate = cur ? `${cur} OR ${p}` : p;
    if (candidate.length <= maxLen) cur = candidate;
    else {
      if (cur) out.push(cur);
      cur = p.length <= maxLen ? p : p.slice(0, maxLen);
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [s.slice(0, maxLen)];
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export default function App() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [windowOpt, setWindowOpt] = useState(DATE_WINDOWS[2]);
  const [maxPerSection, setMaxPerSection] = useState(10);
  const [focus, setFocus] = useState("All");
  const [group, setGroup] = useState("all");

  const [ukOnly, setUkOnly] = useState(false);
  const [fallbackBroad, setFallbackBroad] = useState(true);
  const [viewMode, setViewMode] = useState("comfortable");

  const allSections = useMemo(() => [...SECTIONS, RSS_SECTION], []);
  const [enabled, setEnabled] = useState(() => Object.fromEntries(allSections.map((s) => [s.key, true])));
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(allSections.map((s) => [s.key, false])));

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState({});
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState("");
  const [lastScan, setLastScan] = useState(null);

  // Store by URL/id (not index) so it stays stable
  const [pinned, setPinned] = useState(() => new Set());
  const [hidden, setHidden] = useState(() => new Set());

  const [diag, setDiag] = useState(() =>
    Object.fromEntries(allSections.map((s) => [s.key, { url: "", rawCount: 0, err: "" }]))
  );

  const [rssFeeds, setRssFeeds] = useState(() => DEFAULT_RSS_FEEDS);
  const [rssInput, setRssInput] = useState("");

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const listClass = viewMode === "compact" ? "py-2" : "py-3";

  useEffect(() => {
    const st = loadState();
    if (!st) return;
    if (st.data) setData(st.data);
    if (st.lastScan) setLastScan(st.lastScan);
    if (Array.isArray(st.rssFeeds)) setRssFeeds(st.rssFeeds);
  }, []);

  useEffect(() => {
    saveState({ data, lastScan, rssFeeds });
  }, [data, lastScan, rssFeeds]);

  const visibleSections = useMemo(() => {
    const base = allSections.filter((s) => enabled[s.key]);
    return group === "all" ? base : base.filter((s) => s.group === group);
  }, [allSections, enabled, group]);

  const togglePinned = (key) => {
    setPinned((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleHidden = (key) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const resetFilters = () => {
    setSearch("");
    setPriority("All");
    setFocus("All");
    setWindowOpt(DATE_WINDOWS[2]);
    setUkOnly(false);
    setFallbackBroad(true);
    setGroup("all");
  };

  function mergeByUrl(existing = [], incoming = []) {
    const map = new Map();
    for (const it of existing) {
      const u = it.url || it.id || "";
      if (u) map.set(u, it);
    }
    for (const it of incoming) {
      const u = it.url || it.id || "";
      if (u && !map.has(u)) map.set(u, it);
    }
    const merged = [...map.values()];
    merged.sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
    return merged;
  }

  const applyFilters = useCallback(
    (items) => {
      let out = [...(items || [])];

      out = out
        .map((it) => {
          const source = it.source?.name || it.source || it.sourceName || "Unknown";
          const publishedAt = it.publishedAt || it.date || null;
          const p = it.priority || computePriority(it.title, it.description, source);
          const tags = it.tags || computeTags(it.title, it.description, source);
          return { ...it, source, publishedAt, priority: p, tags };
        })
        .filter((it) => withinWindow(it.publishedAt, windowOpt.days));

      if (priority !== "All") out = out.filter((it) => it.priority === priority);
      if (focus !== "All") out = out.filter((it) => (it.tags || []).some((t) => t.key === focus));

      const q = search.trim().toLowerCase();
      if (q) {
        out = out.filter((it) => {
          const text = `${it.title || ""} ${it.description || ""} ${it.source || ""}`.toLowerCase();
          return text.includes(q);
        });
      }

      out = out.filter((it) => !hidden.has(it.url || it.id || ""));

      out.sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));

      // pin to top (by URL/id)
      const pinnedItems = out.filter((it) => pinned.has(it.url || it.id || ""));
      const rest = out.filter((it) => !pinned.has(it.url || it.id || ""));
      out = [...pinnedItems, ...rest];

      return out.slice(0, maxPerSection);
    },
    [focus, hidden, maxPerSection, pinned, priority, search, windowOpt.days]
  );

  const briefs = useMemo(() => {
    const make = (items) => {
      const filtered = applyFilters(items);
      if (!filtered.length) return "No items matched current filters. Try Reset filters.";
      const counts = filtered.reduce(
        (acc, it) => {
          acc[it.priority] = (acc[it.priority] || 0) + 1;
          return acc;
        },
        { High: 0, Medium: 0, Low: 0 }
      );
      return `Showing ${filtered.length}. High: ${counts.High}, Medium: ${counts.Medium}, Low: ${counts.Low}.`;
    };
    return Object.fromEntries(allSections.map((s) => [s.key, make(data[s.key] || [])]));
  }, [allSections, applyFilters, data]);

  const view = useMemo(
    () => Object.fromEntries(allSections.map((s) => [s.key, applyFilters(data[s.key] || [])])),
    [allSections, applyFilters, data]
  );

  // RSS
  const fetchRss = useCallback(async () => {
    setLoadingSections((m) => ({ ...m, [RSS_SECTION.key]: true }));
    setErrors((m) => ({ ...m, [RSS_SECTION.key]: "" }));

    const params = new URLSearchParams();
    rssFeeds.forEach((u) => params.append("url", u));
    params.set("limit", "60");

    const url = `/api/rss?${params.toString()}`;
    setDiag((d) => ({ ...d, [RSS_SECTION.key]: { ...d[RSS_SECTION.key], url, err: "" } }));

    try {
      const r = await axios.get(url);
      const items = Array.isArray(r?.data?.articles) ? r.data.articles : [];
      setDiag((d) => ({ ...d, [RSS_SECTION.key]: { ...d[RSS_SECTION.key], rawCount: items.length } }));

      const mapped = items.map((a) => ({
        title: a.title ?? "",
        description: a.description ?? "",
        url: a.url ?? "#",
        publishedAt: a.publishedAt ?? "",
        source: a.source ?? "RSS",
      }));

      setData((prev) => ({ ...prev, [RSS_SECTION.key]: mergeByUrl(prev[RSS_SECTION.key] || [], mapped) }));
    } catch {
      const msg = "RSS fetch failed (missing /api/rss or invalid feed URL).";
      setErrors((m) => ({ ...m, [RSS_SECTION.key]: msg }));
      setDiag((d) => ({ ...d, [RSS_SECTION.key]: { ...d[RSS_SECTION.key], err: msg, rawCount: 0 } }));
    } finally {
      setLoadingSections((m) => ({ ...m, [RSS_SECTION.key]: false }));
    }
  }, [rssFeeds]);

  // GNews incremental scan (from/to + sortby publishedAt) [1](https://ukhomeoffice-my.sharepoint.com/personal/james_musgrave_homeoffice_gov_uk/_layouts/15/Doc.aspx?sourcedoc=%7B09A3D9B3-9B03-400E-BA1A-AFC42745D415%7D&file=AIHMT_Induction_Pack_Summary%20%281%29.pptx&action=edit&mobileredirect=true&DefaultItemOpen=1)
  const fetchGnewsSection = useCallback(
    async (sec) => {
      setLoadingSections((m) => ({ ...m, [sec.key]: true }));
      setErrors((m) => ({ ...m, [sec.key]: "" }));

      const now = new Date();
      const overlapMs = 12 * 60 * 60 * 1000;
      const fromDt = lastScan ? new Date(new Date(lastScan).getTime() - overlapMs) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromIso = fromDt.toISOString();
      const toIso = now.toISOString();

      const chunks = splitQuery(sec.query, 200);
      const all = [];
      let usedUrl = "";

      try {
        for (const q of chunks) {
          const params = new URLSearchParams();
          params.set("q", q);
          params.set("lang", "en");
          params.set("max", "50");
          params.set("sortby", "publishedAt");
          params.set("from", fromIso);
          params.set("to", toIso);
          if (ukOnly) params.set("country", "gb");

          const url = `/api/gnews?${params.toString()}`;
          usedUrl = url;
          const r = await axios.get(url);
          const articles = Array.isArray(r?.data?.articles) ? r.data.articles : [];
          all.push(...articles);
        }

        let finalArticles = all;
        if (fallbackBroad && finalArticles.length === 0) {
          const params = new URLSearchParams();
          params.set("q", String(sec.query).slice(0, 200));
          params.set("lang", "en");
          params.set("max", "50");
          params.set("sortby", "publishedAt");
          params.set("from", fromIso);
          params.set("to", toIso);
          if (ukOnly) params.set("country", "gb");

          const url = `/api/gnews?${params.toString()}`;
          usedUrl = url;
          const r2 = await axios.get(url);
          finalArticles = Array.isArray(r2?.data?.articles) ? r2.data.articles : [];
        }

        const seen = new Set();
        const mapped = [];
        for (const a of finalArticles) {
          const u = a?.url || "";
          if (!u || seen.has(u)) continue;
          seen.add(u);
          mapped.push({
            title: a.title ?? "",
            description: a.description ?? "",
            url: u,
            publishedAt: a.publishedAt ?? "",
            source: a?.source?.name || a?.source || "Unknown",
          });
        }

        setDiag((d) => ({ ...d, [sec.key]: { ...d[sec.key], url: usedUrl, rawCount: mapped.length, err: "" } }));
        setData((prev) => ({ ...prev, [sec.key]: mergeByUrl(prev[sec.key] || [], mapped) }));
      } catch {
        const msg = "Section fetch failed (API missing / rate limit / network).";
        setErrors((m) => ({ ...m, [sec.key]: msg }));
        setDiag((d) => ({ ...d, [sec.key]: { ...d[sec.key], err: msg, rawCount: 0, url: usedUrl } }));
      } finally {
        setLoadingSections((m) => ({ ...m, [sec.key]: false }));
      }
    },
    [fallbackBroad, lastScan, ukOnly]
  );

  const runScan = useCallback(async () => {
    setLoading(true);
    setNote("");
    const started = new Date();

    try {
      if (enabled[RSS_SECTION.key]) await fetchRss();

      const toScan = SECTIONS.filter((s) => enabled[s.key]).filter((s) => group === "all" || s.group === group);
      await Promise.all(toScan.map((sec) => fetchGnewsSection(sec)));

      setLastScan(started.toISOString());
      setNote("Scan complete (incremental). New items merged into existing lists.");
    } catch {
      setNote("Scan failed (network/rate limit).");
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchRss, fetchGnewsSection, group]);

  useEffect(() => {
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCSV = () => {
    const rows = [];
    for (const s of visibleSections) {
      for (const it of view[s.key] || []) {
        rows.push({
          section: s.title,
          title: it.title || "",
          source: it.source || "",
          date: it.publishedAt || "",
          url: it.url || "",
          priority: it.priority || "",
        });
      }
    }
    const header = ["section", "priority", "date", "source", "title", "url"];
    const csv = [
      header.join(","),
      ...rows.map((r) => header.map((k) => `"${String(r[k] ?? "").replaceAll('"', '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aihm-monitor-${today}.csv`;
    a.click();
  };

  const addFeed = () => {
    const u = rssInput.trim();
    if (!u) return;
    if (rssFeeds.includes(u)) return;
    setRssFeeds((prev) => [...prev, u]);
    setRssInput("");
  };
  const removeFeed = (u) => setRssFeeds((prev) => prev.filter((x) => x !== u));

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-teal-700 px-6 py-6 text-white">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">AIHM Horizon Scanning</div>
                <div className="mt-1 text-sm opacity-90">Daily brief · {today}</div>
                <div className="mt-2 text-xs opacity-80">Last scan: {lastScan ? fmtDate(lastScan) : "—"}</div>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-sm"
                >
                  <Download size={16} /> Export
                </button>
                <button
                  onClick={runScan}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-[#7a1f3d] hover:bg-white/95 font-semibold text-sm"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  {loading ? "Scanning…" : "Scan"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white px-6 py-4 border-t border-slate-200">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-4">
                <label className="text-xs font-semibold text-slate-600">Search</label>
                <div className="mt-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='e.g., "nudify", "model card", "AISI", "NSSIF"'
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]/15"
                  />
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Time window</label>
                <select
                  value={windowOpt.label}
                  onChange={(e) => setWindowOpt(DATE_WINDOWS.find((d) => d.label === e.target.value) || DATE_WINDOWS[2])}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {DATE_WINDOWS.map((d) => (
                    <option key={d.label} value={d.label}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Category</label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {GROUPS.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option>All</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Focus</label>
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="All">All</option>
                  <option value="capability">Capability</option>
                  <option value="enforcement">Enforcement</option>
                  <option value="research">Research</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs"
              >
                Reset filters
              </button>

              <button
                onClick={() => setUkOnly((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                  ukOnly ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <Globe size={14} />
                UK sources
              </button>

              <button
                onClick={() => setFallbackBroad((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                  fallbackBroad ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <SlidersHorizontal size={14} />
                Broaden if empty
              </button>

              <button
                onClick={() => setViewMode((m) => (m === "compact" ? "comfortable" : "compact"))}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs"
              >
                {viewMode === "compact" ? <LayoutList size={14} /> : <List size={14} />}
                Density
              </button>

              {note ? (
                <div className="ml-auto inline-flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} className="text-slate-500" />
                  {note}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* RSS manager */}
          <aside className="lg:col-span-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="text-sm font-semibold text-slate-800">RSS Sources</div>
              <div className="mt-1 text-xs text-slate-600">
                Paste a feed URL, click Add. Then hit “Refresh RSS” or “Scan”.
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={rssInput}
                  onChange={(e) => setRssInput(e.target.value)}
                  placeholder="https://example.com/feed/"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <button
                  onClick={addFeed}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-sm"
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {rssFeeds.map((u) => (
                  <div key={u} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
                    <div className="text-xs text-slate-700 truncate">{u}</div>
                    <button
                      onClick={() => removeFeed(u)}
                      className="p-2 rounded-lg hover:bg-slate-50 border border-slate-200"
                      title="Remove feed"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={fetchRss}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm"
                >
                  <RefreshCw size={16} className={loadingSections[RSS_SECTION.key] ? "animate-spin" : ""} />
                  Refresh RSS
                </button>
              </div>
            </div>
          </aside>

          {/* Sections */}
          <main className="lg:col-span-8 space-y-6">
            {visibleSections.map((s) => {
              const styles = toneStyles(s.tone);
              const items = view[s.key] || [];
              const isLoading = !!loadingSections[s.key];
              const err = errors[s.key];
              const raw = diag[s.key]?.rawCount ?? 0;

              return (
                <section
                  key={s.key}
                  className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ring-1 ${styles.ring}`}
                >
                  <div className="px-5 py-4 border-b border-slate-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className={`h-3.5 w-3.5 rounded ${styles.bar}`} />
                          <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">{s.title}</h2>
                          <Pill>raw: {raw}</Pill>
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{s.subtitle}</div>
                        <div className="mt-2 text-[11px] text-slate-400 truncate">{diag[s.key]?.url || ""}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => (s.key === RSS_SECTION.key ? fetchRss() : fetchGnewsSection(s))}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs"
                        >
                          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                          Refresh
                        </button>
                        <button
                          onClick={() => setCollapsed((m) => ({ ...m, [s.key]: !m[s.key] }))}
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                        >
                          {collapsed[s.key] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                        Brief (rules-based)
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{briefs[s.key]}</div>
                    </div>

                    {err ? (
                      <div className="mt-3 inline-flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                        <AlertCircle size={14} />
                        {err}
                      </div>
                    ) : null}
                  </div>

                  {collapsed[s.key] ? null : (
                    <div className="px-5 py-4">
                      <ul className="divide-y divide-slate-200">
                        {isLoading ? (
                          <>
                            <SkeletonRow />
                            <SkeletonRow />
                            <SkeletonRow />
                          </>
                        ) : items.length === 0 ? (
                          <li className="py-3 text-sm text-slate-500">
                            No items after filtering. Try Reset filters or widen Time window.
                          </li>
                        ) : (
                          items.map((it, idx) => {
                            const key = it.url || it.id || `${s.key}-${idx}`;
                            const pr = it.priority || computePriority(it.title, it.description, it.source);
                            const tags = it.tags || computeTags(it.title, it.description, it.source);
                            const pinnedNow = pinned.has(key);
                            const hiddenNow = hidden.has(key);

                            return (
                              <li key={key} className={listClass}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <a
                                      href={it.url || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sm font-semibold text-slate-900 hover:underline underline-offset-4"
                                    >
                                      {it.title || "Untitled"}
                                    </a>

                                    {viewMode === "compact" ? null : it.description ? (
                                      <div className="mt-1 text-sm text-slate-600">{it.description}</div>
                                    ) : null}

                                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                                      <PriorityPill value={pr} />
                                      {tags.slice(0, 3).map((t) => (
                                        <Pill key={t.key}>{t.label}</Pill>
                                      ))}
                                      <Pill>Source: {it.source || "Unknown"}</Pill>
                                      <span className="text-[11px] text-slate-500">Date: {fmtDate(it.publishedAt)}</span>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-2">
                                    <button
                                      onClick={() => togglePinned(key)}
                                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                                      title={pinnedNow ? "Unpin" : "Pin"}
                                    >
                                      {pinnedNow ? <PinOff size={16} /> : <Pin size={16} />}
                                    </button>

                                    <button
                                      onClick={() => toggleHidden(key)}
                                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                                      title={hiddenNow ? "Unhide" : "Hide"}
                                    >
                                      {hiddenNow ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>

                                    <a
                                      href={it.url || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                                    >
                                      Open <ExternalLink size={14} />
                                    </a>
                                  </div>
                                </div>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })}
          </main>
        </div>
      </div>
    </div>
  );
}
