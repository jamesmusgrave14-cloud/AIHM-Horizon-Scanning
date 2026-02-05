import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

/**
 * AIHM Intelligence Monitor — v3 (Plan-aligned)
 * - Categories/headings aligned to your AIHM horizon scanning plan sources list:
 *   Developers/model cards; Watchdogs; Govt signals; Harms; Academic research; Media.
 *   (See AIHM Horizon Scanning plan) [1](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
 * - Broader capture-first approach, then triage (per plan’s “weak signals” framing). [1](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
 * - Better UI: grouped navigation, reset filters, per-section diagnostics, per-section refresh, pin/hide, export.
 * - GNews only (AIID removed).
 */

/* ----------------------------- Sections (Plan-aligned) ----------------------------- */

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
  // 1) Developer releases & model cards [1](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
  {
    key: "dev_releases",
    group: "dev",
    title: "Developer Releases & Model Cards",
    subtitle: "Frontier model announcements, model/system cards, open-weights releases.",
    tone: "blue",
    query:
      '"model card" OR "system card" OR "open weights" OR "weights release" OR "frontier model" OR OpenAI OR Anthropic OR Google DeepMind OR Meta Llama OR xAI Grok',
  },
  {
    key: "dev_eval",
    group: "dev",
    title: "Evaluation, Red Teaming & Safety Testing",
    subtitle: "Red teaming, eval releases, jailbreak/prompt injection coverage in public reporting.",
    tone: "blue",
    query:
      '"model evaluation" OR "safety evaluation" OR "red teaming" OR jailbreak OR "prompt injection" OR "safety testing" OR "risk assessment" AND (OpenAI OR Anthropic OR DeepMind OR Meta OR xAI)',
  },

  // 2) Watchdogs & monitors (AISI, CETaS, Ada, Oxford, IWF) [1](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
  {
    key: "watchdogs_core",
    group: "watchdogs",
    title: "Watchdogs & Safety Monitors",
    subtitle: "AISI, CETaS, Ada Lovelace, Oxford institutes, IWF—new reports/briefs and findings.",
    tone: "maroon",
    query:
      'AISI OR "AI Safety Institute" OR CETaS OR "Ada Lovelace Institute" OR "Oxford Internet Institute" OR "Oxford Institute for Ethics in AI" OR IWF OR "Internet Watch Foundation"',
  },

  // 3) Government / HMG signals (emerging-tech sources, NSSIF, GO‑Science, ETSSU) [1](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
  {
    key: "gov_signals",
    group: "gov",
    title: "Government & HMG Signals",
    subtitle: "GO‑Science, NSSIF Insights, NCA, ETSSU-type emerging tech monitoring (open reporting).",
    tone: "maroon",
    query:
      '"Government Office for Science" OR "GO-Science" OR NSSIF OR "NSSIF Insights" OR NCA OR "threat assessment" OR ETSSU OR "emerging technology" AND AI',
  },

  // 4) Operational harms / misuse (your harm buckets)
  {
    key: "harms_csea",
    group: "harms",
    title: "CSEA / IBSA Signals",
    subtitle: "CSAM/CSEA, nudification, sextortion, NCII and safeguarding-related signals.",
    tone: "red",
    query:
      'CSAM OR CSEA OR "child sexual abuse" OR nudification OR nudify OR sextortion OR grooming OR "non-consensual intimate" OR "deepfake pornography"',
  },
  {
    key: "harms_fraud",
    group: "harms",
    title: "Fraud, Impersonation & Identity Integrity",
    subtitle: "Voice cloning, scams, synthetic identity, KYC/AML, account takeover and payments fraud.",
    tone: "red",
    query:
      '"voice cloning" OR "deepfake fraud" OR impersonation OR "CEO fraud" OR "business email compromise" OR BEC OR "account takeover" OR "synthetic identity" OR KYC OR AML',
  },
  {
    key: "harms_cyber",
    group: "harms",
    title: "Cybercrime & Illicit Enablement",
    subtitle: "Phishing automation, malware/ransomware enablement, illicit tooling and markets.",
    tone: "red",
    query:
      'phishing OR malware OR ransomware OR "malware-as-a-service" OR "initial access broker" OR "prompt injection" OR jailbreak AND AI',
  },
  {
    key: "harms_extremism",
    group: "harms",
    title: "National Security: Extremism Misuse",
    subtitle: "Propaganda, recruitment, and misuse signals in open reporting.",
    tone: "red",
    query:
      'terror* OR extrem* OR propaganda OR radicalis* AND (AI OR deepfake OR "synthetic media" OR chatbot OR LLM)',
  },
  {
    key: "harms_border",
    group: "harms",
    title: "Border / Document & Biometric Integrity",
    subtitle: "Document fraud, biometric spoofing, face morphing, liveness bypass and proofing.",
    tone: "red",
    query:
      '"document fraud" OR "forged passport" OR "counterfeit documents" OR "biometric spoofing" OR "face morphing" OR "liveness bypass" AND (AI OR deepfake OR synthetic)',
  },

  // 5) Academic research & futures (UCL Future Crime + “future capabilities”) [1](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
  {
    key: "research_futures",
    group: "research",
    title: "Academic & Futures Signals",
    subtitle: "Research on future capabilities/limitations and emerging harms (UCL Future Crime etc.).",
    tone: "blue",
    query:
      '"future crime" OR "AI trajectories" OR "frontier AI" OR "capability milestones" OR "agentic AI" OR "AI limitations" OR UCL AND AI',
  },

  // 6) Media coverage & broad capture (weak signals) [1](https://ukhomeoffice.sharepoint.com/sites/CTCOLLAB5541/_layouts/15/Doc.aspx?sourcedoc=%7B3C1D5F74-DB3E-41BD-8623-73865DF69FF0%7D&file=AIHM%20Horizon%20Scanning%20plan.docx&action=default&mobileredirect=true)
  {
    key: "media_broad",
    group: "media",
    title: "Broad Media Capture (Weak Signals)",
    subtitle: "Broad catch-all for unexpected developments; triage with filters/tags.",
    tone: "blue",
    query:
      '"artificial intelligence" AND (deepfake OR "voice cloning" OR scam OR nudify OR ransomware OR "prompt injection" OR "model card" OR Ofcom)',
  },
];

/* ----------------------------- Filters ----------------------------- */

const DATE_WINDOWS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
];

const HIGH_TERMS = ["csam", "csea", "nudification", "sextortion", "ransomware", "account takeover", "bec", "liveness bypass"];
const MED_TERMS = ["deepfake", "voice cloning", "phishing", "malware", "model card", "system card", "open weights", "watermark", "provenance", "c2pa"];

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
  if (t.includes("model card") || t.includes("system card") || t.includes("open weights")) tags.push({ label: "Capability", key: "capability" });
  if (t.includes("ofcom") || t.includes("investigation") || t.includes("fined") || t.includes("charged")) tags.push({ label: "Enforcement", key: "enforcement" });
  if (t.includes("a i s i") || t.includes("ai safety institute") || t.includes("cetas") || t.includes("report") || t.includes("study")) tags.push({ label: "Research", key: "research" });
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
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${cls}`}>{value} priority</span>;
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

/* ----------------------------- Main ----------------------------- */

export default function App() {
  // Filters
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [windowOpt, setWindowOpt] = useState(DATE_WINDOWS[2]); // default 90 days
  const [maxPerSection, setMaxPerSection] = useState(8);
  const [focus, setFocus] = useState("All");
  const [group, setGroup] = useState("all");

  // Source controls
  const [ukOnly, setUkOnly] = useState(false);
  const [fallbackBroad, setFallbackBroad] = useState(true);
  const [viewMode, setViewMode] = useState("comfortable"); // comfortable | compact

  // Section toggles / collapse
  const [enabled, setEnabled] = useState(() => Object.fromEntries(SECTIONS.map((s) => [s.key, true])));
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(SECTIONS.map((s) => [s.key, false])));

  // Data + state
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState({});
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState("");
  const [lastScan, setLastScan] = useState(null);

  // Personal
  const [pinned, setPinned] = useState(() => new Set());
  const [hidden, setHidden] = useState(() => new Set());

  // Diagnostics per section (raw count + URL called)
  const [diag, setDiag] = useState(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.key, { url: "", rawCount: 0, err: "" }]))
  );

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const listClass = viewMode === "compact" ? "py-2" : "py-3";

  const visibleSections = useMemo(() => {
    const base = SECTIONS.filter((s) => enabled[s.key]);
    return group === "all" ? base : base.filter((s) => s.group === group);
  }, [enabled, group]);

  const sectionRefs = useRef({});
  const scrollToSection = (key) => {
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const togglePin = (id) => {
    setPinned((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleHide = (id) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setSearch("");
    setPriority("All");
    setFocus("All");
    setWindowOpt(DATE_WINDOWS[2]); // 90 days
    setUkOnly(false);
    setFallbackBroad(true);
    setGroup("all");
  };

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

      return out.slice(0, maxPerSection);
    },
    [focus, hidden, maxPerSection, priority, search, windowOpt.days]
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
    return Object.fromEntries(SECTIONS.map((s) => [s.key, make(data[s.key] || [])]));
  }, [applyFilters, data]);

  const view = useMemo(
    () => Object.fromEntries(SECTIONS.map((s) => [s.key, applyFilters(data[s.key] || [])])),
    [applyFilters, data]
  );

  const fetchGnewsSection = useCallback(
    async (sec) => {
      setLoadingSections((m) => ({ ...m, [sec.key]: true }));
      setErrors((m) => ({ ...m, [sec.key]: "" }));

      const params = new URLSearchParams();
      params.set("q", sec.query);
      params.set("lang", "en");
      params.set("max", String(Math.max(16, maxPerSection * 3)));
      if (ukOnly) params.set("country", "gb");

      let url = `/api/gnews?${params.toString()}`;
      setDiag((d) => ({ ...d, [sec.key]: { ...d[sec.key], url, err: "" } }));

      try {
        const r = await axios.get(url);
        const articles = Array.isArray(r?.data?.articles) ? r.data.articles : [];
        let finalArticles = articles;

        if (fallbackBroad && finalArticles.length === 0) {
          const broad = new URLSearchParams(params);
          broad.set("q", `${sec.query} OR AI OR "artificial intelligence"`);
          url = `/api/gnews?${broad.toString()}`;
          const r2 = await axios.get(url);
          finalArticles = Array.isArray(r2?.data?.articles) ? r2.data.articles : [];
          setDiag((d) => ({ ...d, [sec.key]: { ...d[sec.key], url } }));
        }

        setDiag((d) => ({ ...d, [sec.key]: { ...d[sec.key], rawCount: finalArticles.length } }));

        const mapped = finalArticles.map((a) => ({
          title: a.title ?? "",
          description: a.description ?? "",
          url: a.url ?? "#",
          publishedAt: a.publishedAt ?? "",
          source: a?.source?.name || a?.source || "Unknown",
        }));

        setData((prev) => ({ ...prev, [sec.key]: mapped }));
      } catch {
        const msg = "Section fetch failed (API missing / rate limit / network).";
        setErrors((m) => ({ ...m, [sec.key]: msg }));
        setDiag((d) => ({ ...d, [sec.key]: { ...d[sec.key], err: msg, rawCount: 0 } }));
        setData((prev) => ({ ...prev, [sec.key]: [] }));
      } finally {
        setLoadingSections((m) => ({ ...m, [sec.key]: false }));
      }
    },
    [fallbackBroad, maxPerSection, ukOnly]
  );

  const runScan = useCallback(async () => {
    setLoading(true);
    setNote("");
    const started = new Date();

    try {
      await Promise.all(visibleSections.map((sec) => fetchGnewsSection(sec)));
      setLastScan(started.toISOString());
      const totalRaw = visibleSections.reduce((sum, s) => sum + (diag[s.key]?.rawCount || 0), 0);
      setNote(`Scan complete. Raw articles returned (before filters): ${totalRaw}.`);
    } catch {
      setNote("Scan failed (network/rate limit).");
    } finally {
      setLoading(false);
    }
  }, [fetchGnewsSection, visibleSections, diag]);

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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#7a1f3d] px-6 py-6 text-white">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">AIHM Intelligence Monitor</div>
                <div className="mt-1 text-sm opacity-90">Daily brief · {today}</div>
                <div className="mt-2 text-xs opacity-80">Last scan: {lastScan ? fmtDate(lastScan) : "—"}</div>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <button onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-sm">
                  <Download size={16} /> Export
                </button>
                <button onClick={runScan} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-[#7a1f3d] hover:bg-white/95 font-semibold text-sm">
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
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]/15"
                >
                  {DATE_WINDOWS.map((d) => (
                    <option key={d.label} value={d.label}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]/15"
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
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]/15"
                >
                  {FOCUS_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Category</label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]/15"
                >
                  {GROUPS.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
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
                title="Only enable if you really want UK-only sources"
              >
                <Globe size={14} />
                UK sources
              </button>

              <button
                onClick={() => setFallbackBroad((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                  fallbackBroad ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-700"
                }`}
                title="Broadens query once if the section returns zero results"
              >
                <SlidersHorizontal size={14} />
                Broaden if empty
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

        {/* Content */}
        <div className="mt-6 space-y-6">
          {visibleSections.map((s) => {
            const styles = toneStyles(s.tone);
            const items = view[s.key] || [];
            const isLoading = !!loadingSections[s.key];
            const err = errors[s.key];
            const raw = diag[s.key]?.rawCount ?? 0;

            return (
              <section
                key={s.key}
                ref={(el) => (sectionRefs.current[s.key] = el)}
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
                        onClick={() => fetchGnewsSection(s)}
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
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Brief (rules-based)</div>
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
                          No items after filtering. Click <span className="font-semibold">Reset filters</span> or set Time window to{" "}
                          <span className="font-semibold">All time</span>.
                        </li>
                      ) : (
                        items.map((it, idx) => {
                          const id = it.url || it.id || `${s.key}-${idx}`;
                          const pr = it.priority || computePriority(it.title, it.description, it.source);
                          const tags = it.tags || computeTags(it.title, it.description, it.source);

                          return (
                            <li key={id} className={listClass}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <a href={it.url || "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 hover:underline underline-offset-4">
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
                                  <button onClick={() => togglePin(id)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" title={pinned.has(id) ? "Unpin" : "Pin"}>
                                    {pinned.has(id) ? <PinOff size={16} /> : <Pin size={16} />}
                                  </button>
                                  <button onClick={() => toggleHide(id)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" title={hidden.has(id) ? "Unhide" : "Hide"}>
                                    {hidden.has(id) ? <Eye size={16} /> : <EyeOff size={16} />}
                                  </button>
                                  <a href={it.url || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
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
        </div>
      </div>
    </div>
  );
}
