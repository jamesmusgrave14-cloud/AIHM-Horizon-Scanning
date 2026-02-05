import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
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
 * AIHM Intelligence Monitor — stable build + interactive UI
 * - Fixes empty sections by building /api/gnews params with URLSearchParams (no &amp; bugs)
 * - White background, cleaner visual hierarchy
 * - Sidebar toggles, per-section refresh, pin/hide, export, density switch
 * - AIID removed as a dependency (optional toggle kept but OFF by default)
 */

// ----------------------------- Sections -----------------------------
const SECTIONS = [
  {
    key: "capability_milestones",
    title: "Horizon: Capability Milestones & Releases",
    subtitle: "Model/system cards, weights, agent tooling, eval/red teaming signals.",
    tone: "blue",
    query:
      '"model card" OR "system card" OR "open weights" OR "weights release" OR "frontier model" OR agentic OR "tool use" OR "autonomous agent" OR "model evaluation" OR "red teaming" OR jailbreak OR "prompt injection" OR GPT OR Claude OR Gemini OR Llama OR Grok',
  },
  {
    key: "safety_eval_mitigations",
    title: "Safety, Evaluation & Mitigations",
    subtitle: "Detection/provenance, watermarking, content credentials, safeguards, testing.",
    tone: "blue",
    query:
      '"deepfake detection" OR "synthetic media detection" OR provenance OR watermarking OR C2PA OR "content credentials" OR "forensic detection" OR "liveness detection" OR "age verification" OR "safety evaluation" OR "risk assessment" OR "content moderation"',
  },
  {
    key: "uk_policy_enforcement",
    title: "UK Policy, Regulation & Enforcement",
    subtitle: "Online Safety Act/Ofcom, enforcement actions, UK legal/policy developments.",
    tone: "maroon",
    query:
      '"Online Safety Act" OR Ofcom OR "codes of practice" OR "risk assessment" OR "illegal content" OR "safety duties" OR "platform accountability" OR "UK AI regulation" OR "synthetic media" OR deepfake UK',
  },
  {
    key: "csea_ibsa",
    title: "CSEA & Image‑Based Sexual Abuse (IBSA)",
    subtitle: "CSAM/CSEA, nudification, sextortion, grooming, NCII/IBSA signals.",
    tone: "red",
    query:
      'CSAM OR CSEA OR "child sexual abuse" OR "synthetic CSAM" OR nudify OR nudification OR sextortion OR grooming OR "image-based abuse" OR "non-consensual intimate" OR "deepfake pornography"',
  },
  {
    key: "fraud_identity",
    title: "Fraud, Impersonation & Identity Integrity",
    subtitle: "Voice cloning, scams, synthetic identity, KYC/AML pressure, ATO and payments.",
    tone: "red",
    query:
      '"voice cloning" OR "deepfake fraud" OR impersonation OR "CEO fraud" OR "business email compromise" OR BEC OR "account takeover" OR "synthetic identity" OR "identity verification" OR KYC OR AML OR "payment fraud" OR "authorized push payment" OR vishing OR "romance scam"',
  },
  {
    key: "cyber_illicit_enablement",
    title: "Cybercrime & Illicit Enablement",
    subtitle: "Phishing automation, malware/ransomware enablement, illicit tooling and markets.",
    tone: "red",
    query:
      '"AI phishing" OR "LLM phishing" OR phishing OR "automated phishing" OR malware OR ransomware OR "malware-as-a-service" OR "initial access broker" OR "credential stuffing" OR "prompt injection" OR jailbreak',
  },
  {
    key: "ns_extremism",
    title: "National Security: Terrorism & Extremism Misuse",
    subtitle: "Extremism misuse, incitement, propaganda/recruitment signals (open reporting).",
    tone: "red",
    query:
      'terror* OR extrem* OR "violent extremist" OR radicalis* OR incitement OR propaganda AND (AI OR deepfake OR "synthetic media" OR chatbot OR LLM)',
  },
  {
    key: "border_docs_biometrics",
    title: "Border / Document & Biometric Integrity",
    subtitle: "Document fraud, biometric spoofing, face morphing, liveness bypass and proofing.",
    tone: "red",
    query:
      '"document fraud" OR "forged passport" OR "counterfeit documents" OR "visa fraud" OR "identity proofing" OR "biometric spoofing" OR "face morphing" OR "liveness bypass" AND (AI OR deepfake OR synthetic)',
  },
  {
    key: "watchdogs_research_gov",
    title: "Watchdogs, Research & Govt Signals",
    subtitle: "AISI/CETaS/Ada/Oxford/IWF/GO‑Science/NSSIF etc; UK-weighted when enabled.",
    tone: "maroon",
    query:
      'AISI OR "AI Safety Institute" OR CETaS OR "Ada Lovelace Institute" OR IWF OR "Internet Watch Foundation" OR "Oxford Internet Institute" OR "Oxford Institute for Ethics in AI" OR "GO-Science" OR "Government Office for Science" OR NSSIF OR "NSSIF Insights" OR NCA OR RICU OR UCL OR "future crime"',
  },
];

// ----------------------------- Filters -----------------------------
const DATE_WINDOWS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
];

const FOCUS_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Capability milestone", value: "capability" },
  { label: "Enforcement / action", value: "enforcement" },
  { label: "Platform / ecosystem", value: "platform" },
  { label: "Research / watchdog", value: "research" },
  { label: "Incident", value: "incident" },
];

const HIGH_TERMS = [
  "csam",
  "csea",
  "child sexual",
  "synthetic csam",
  "nudify",
  "nudification",
  "sextortion",
  "grooming",
  "non-consensual intimate",
  "ransomware",
  "malware-as-a-service",
  "initial access broker",
  "account takeover",
  "business email compromise",
  "bec",
  "authorized push payment",
  "violent extremist",
  "attack planning",
  "document fraud",
  "biometric spoof",
  "liveness bypass",
  "face morph",
  "ofcom investigation",
  "prosecution",
  "charged",
  "arrested",
  "sentenced",
];

const MED_TERMS = [
  "deepfake",
  "synthetic media",
  "voice cloning",
  "impersonation",
  "phishing",
  "malware",
  "identity verification",
  "kyc",
  "aml",
  "biometric",
  "facial recognition",
  "doxx",
  "data leak",
  "breach",
  "bias",
  "discriminat",
  "automated decision",
  "agentic",
  "tool use",
  "model card",
  "system card",
  "weights release",
  "open weights",
  "red team",
  "evaluation",
  "jailbreak",
  "prompt injection",
  "watermark",
  "provenance",
  "c2pa",
  "content credentials",
  "deepfake detection",
  "liveness detection",
  "age verification",
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
  const isCapability =
    t.includes("model card") ||
    t.includes("system card") ||
    t.includes("weights release") ||
    t.includes("open weights") ||
    t.includes("agentic") ||
    t.includes("tool use") ||
    t.includes("autonomous agent") ||
    t.includes("frontier model");
  const isEnforcement =
    t.includes("ofcom") ||
    t.includes("investigation") ||
    t.includes("fine") ||
    t.includes("fined") ||
    t.includes("charged") ||
    t.includes("arrested") ||
    t.includes("sentenced") ||
    t.includes("prosecution") ||
    t.includes("ban") ||
    t.includes("shutdown");
  const isResearch =
    t.includes("ai safety institute") ||
    t.includes("a i s i") ||
    t.includes("cetas") ||
    t.includes("ada lovelace") ||
    t.includes("oxford internet institute") ||
    t.includes("internet watch foundation") ||
    t.includes("paper") ||
    t.includes("preprint") ||
    t.includes("study") ||
    t.includes("report");
  if (isCapability) tags.push({ label: "Capability", key: "capability" });
  if (isEnforcement) tags.push({ label: "Enforcement", key: "enforcement" });
  if (isResearch) tags.push({ label: "Research", key: "research" });
  return tags;
}

// ----------------------------- UI Helpers -----------------------------
function toneStyles(tone) {
  if (tone === "maroon") return { bar: "bg-[#7a1f3d]", ring: "ring-[#7a1f3d]/10" };
  if (tone === "blue") return { bar: "bg-blue-700", ring: "ring-blue-700/10" };
  return { bar: "bg-red-700", ring: "ring-red-700/10" };
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
        <div className="flex gap-2">
          <div className="h-5 bg-slate-100 rounded-full w-24" />
          <div className="h-5 bg-slate-100 rounded-full w-28" />
          <div className="h-5 bg-slate-100 rounded-full w-20" />
        </div>
      </div>
    </li>
  );
}

// ----------------------------- Main -----------------------------
export default function App() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [windowOpt, setWindowOpt] = useState(DATE_WINDOWS[1]);
  const [maxPerSection, setMaxPerSection] = useState(6);
  const [focus, setFocus] = useState("All");

  const [ukOnly, setUkOnly] = useState(true);
  const [fallbackBroad, setFallbackBroad] = useState(true);
  const [viewMode, setViewMode] = useState("comfortable"); // comfortable | compact

  const [enabled, setEnabled] = useState(() => {
    const obj = {};
    for (const s of SECTIONS) obj[s.key] = true;
    return obj;
  });
  const [collapsed, setCollapsed] = useState(() => {
    const obj = {};
    for (const s of SECTIONS) obj[s.key] = false;
    return obj;
  });

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState({});
  const [errors, setErrors] = useState({});
  const [note, setNote] = useState("");
  const [lastScan, setLastScan] = useState(null);

  const [pinned, setPinned] = useState(() => new Set());
  const [hidden, setHidden] = useState(() => new Set());

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const listClass = viewMode === "compact" ? "py-2" : "py-3";

  const applyFilters = useCallback(
    (items) => {
      let out = [...(items || [])];

      out = out
        .map((it) => {
          const source = it.source?.name || it.source || it.sourceName || "Unknown";
          const publishedAt = it.publishedAt || it.date || null;
          const priorityVal = it.priority || computePriority(it.title, it.description, source);
          const tags = it.tags || computeTags(it.title, it.description, source);
          return { ...it, source, publishedAt, priority: priorityVal, tags };
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

      out.sort((a, b) => {
        const da = toDate(a.publishedAt)?.getTime() || 0;
        const db = toDate(b.publishedAt)?.getTime() || 0;
        return db - da;
      });

      const seen = new Set();
      out = out.filter((it) => {
        const u = it.url || "";
        if (!u) return true;
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      });

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
      if (!filtered.length) return "No items matched current filters.";
      const counts = filtered.reduce(
        (acc, it) => {
          acc[it.priority] = (acc[it.priority] || 0) + 1;
          return acc;
        },
        { High: 0, Medium: 0, Low: 0 }
      );
      return `Showing ${filtered.length}. High: ${counts.High}, Medium: ${counts.Medium}, Low: ${counts.Low}.`;
    };
    const out = {};
    for (const s of SECTIONS) out[s.key] = make(data[s.key] || []);
    return out;
  }, [applyFilters, data]);

  const view = useMemo(() => {
    const out = {};
    for (const s of SECTIONS) out[s.key] = applyFilters(data[s.key] || []);
    return out;
  }, [applyFilters, data]);

  const fetchGnewsSection = useCallback(
    async (sec) => {
      setLoadingSections((m) => ({ ...m, [sec.key]: true }));
      setErrors((m) => ({ ...m, [sec.key]: "" }));

      const params = new URLSearchParams();
      params.set("q", sec.query);
      params.set("lang", "en");
      params.set("max", String(Math.max(12, maxPerSection * 2)));
      if (ukOnly) params.set("country", "gb");

      try {
        const r = await axios.get(`/api/gnews?${params.toString()}`);
        const articles = Array.isArray(r?.data?.articles) ? r.data.articles : [];

        let finalArticles = articles;
        if (fallbackBroad && finalArticles.length === 0) {
          const broad = new URLSearchParams(params);
          broad.set("q", `${sec.query} OR AI OR "artificial intelligence"`);
          const r2 = await axios.get(`/api/gnews?${broad.toString()}`);
          finalArticles = Array.isArray(r2?.data?.articles) ? r2.data.articles : [];
        }

        const mapped = finalArticles.map((a) => ({
          title: a.title ?? "",
          description: a.description ?? "",
          url: a.url ?? "#",
          image: a.image ?? "",
          publishedAt: a.publishedAt ?? "",
          source: a?.source?.name || a?.source || "Unknown",
        }));

        setData((prev) => ({ ...prev, [sec.key]: mapped }));
      } catch {
        setErrors((m) => ({ ...m, [sec.key]: "Section fetch failed (API missing / rate limit / network)." }));
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
      const enabledSections = SECTIONS.filter((s) => enabled[s.key]);
      await Promise.all(enabledSections.map((sec) => fetchGnewsSection(sec)));

      setLastScan(started.toISOString());
      setNote(`Scan complete. Sections scanned: ${enabledSections.length}.`);
    } catch {
      setNote("Scan failed (network/rate limit).");
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchGnewsSection]);

  useEffect(() => {
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sectionRefs = useRef({});
  const scrollToSection = (key) => {
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const togglePin = (id) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleHide = (id) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const rows = [];
    for (const s of SECTIONS) {
      if (!enabled[s.key]) continue;
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
                <div className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
                  AIHM Intelligence Monitor
                </div>
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
                    placeholder='e.g., "nudify", "Ofcom", "liveness bypass"'
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]/15"
                  />
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Time window</label>
                <select
                  value={windowOpt.label}
                  onChange={(e) => {
                    const sel = DATE_WINDOWS.find((d) => d.label === e.target.value) || DATE_WINDOWS[1];
                    setWindowOpt(sel);
                  }}
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

              <div className="lg:col-span-1">
                <label className="text-xs font-semibold text-slate-600">Items</label>
                <select
                  value={maxPerSection}
                  onChange={(e) => setMaxPerSection(parseInt(e.target.value, 10))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]/15"
                >
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-1 flex gap-2 justify-end">
                <button
                  onClick={() => setViewMode((m) => (m === "compact" ? "comfortable" : "compact"))}
                  className="mt-6 inline-flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm"
                  title="Toggle density"
                >
                  {viewMode === "compact" ? <LayoutList size={16} /> : <List size={16} />}
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 items-center">
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
                Fallback broaden
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

        {/* Sidebar + content */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3">
            <div className="sticky top-6 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">Sections</div>
                  <Pill>{SECTIONS.length}</Pill>
                </div>
                <div className="mt-3 space-y-2">
                  {SECTIONS.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => scrollToSection(s.key)}
                        className="text-left text-sm text-slate-700 hover:text-slate-900 hover:underline underline-offset-4 truncate"
                        title={s.title}
                      >
                        {s.title}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEnabled((m) => ({ ...m, [s.key]: !m[s.key] }))}
                          className={`text-[11px] px-2 py-1 rounded border ${
                            enabled[s.key]
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          {enabled[s.key] ? "On" : "Off"}
                        </button>

                        <button
                          onClick={() => setCollapsed((m) => ({ ...m, [s.key]: !m[s.key] }))}
                          className="p-1 rounded hover:bg-slate-50 border border-slate-200"
                        >
                          {collapsed[s.key] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-xs text-slate-500">
                  Tip: if you still see empty sections, set Time window to “All time” and click Scan.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="text-sm font-semibold text-slate-800">Personal tools</div>
                <div className="mt-2 text-xs text-slate-600">Pin items to top; hide items to declutter.</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill>Pinned: {pinned.size}</Pill>
                  <Pill>Hidden: {hidden.size}</Pill>
                  {hidden.size > 0 ? (
                    <button
                      onClick={() => setHidden(new Set())}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      Clear hidden
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          <main className="lg:col-span-9 space-y-6">
            {SECTIONS.map((s) => {
              const styles = toneStyles(s.tone || "maroon");
              const items = view[s.key] || [];
              const isLoading = !!loadingSections[s.key];
              const err = errors[s.key];

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
                          {!enabled[s.key] ? <Pill>Disabled</Pill> : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{s.subtitle}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fetchGnewsSection(s)}
