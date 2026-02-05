import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ExternalLink, RefreshCw, Search, Filter } from "lucide-react";

/**
 * AIHM Intelligence Monitor — aligned to AIHM Horizon Scanning plan
 * - Focus: emerging risks + weak signals + capability milestones + mitigations + incidents
 * - Non-technical friendly: clear sections, simple filters, transparent rules-based triage
 *
 * ASSUMPTIONS
 * - /api/gnews  (server-side proxy to news API)
 * - /api/aiid   (AIID titles+dates+links proxy)
 */

// ---------- Sections + queries (aligned to HS plan intent) ----------
const SECTIONS = [
  {
    key: "capability_milestones",
    title: "Horizon: Capability Milestones & Releases",
    subtitle:
      "Model/system cards, weight releases, agent tooling, ‘milestone’ capability signals.",
    tone: "blue",
    type: "gnews",
    query:
      '"model card" OR "system card" OR "weights release" OR "open weights" OR "frontier model" OR "agentic" OR "tool use" OR "autonomous agent" OR "model evaluation" OR "red teaming" OR "jailbreak" OR "prompt injection" OR GPT OR Claude OR Gemini OR Llama OR Grok',
  },
  {
    key: "safety_eval_mitigations",
    title: "Safety, Evaluation & Mitigations",
    subtitle:
      "Detection/provenance, watermarking, content credentials, safeguards, evaluation movement.",
    tone: "blue",
    type: "gnews",
    query:
      '"deepfake detection" OR "synthetic media detection" OR provenance OR watermarking OR C2PA OR "content credentials" OR "forensic detection" OR "liveness detection" OR "age verification" OR "safety evaluation" OR "model evaluation" OR "red team" OR "risk assessment" OR "content moderation"',
  },
  {
    key: "uk_policy_enforcement",
    title: "UK Policy, Regulation & Enforcement",
    subtitle:
      "Online Safety Act/Ofcom, enforcement actions, UK legal/policy developments and accountability.",
    tone: "maroon",
    type: "gnews",
    query:
      '"Online Safety Act" OR Ofcom OR "codes of practice" OR "risk assessment" OR "illegal content" OR "safety duties" OR "platform accountability" OR "UK AI regulation" OR "deepfake" OR "synthetic media" UK',
  },
  {
    key: "csea_ibsa",
    title: "CSEA & Image‑Based Sexual Abuse (IBSA)",
    subtitle:
      "CSAM/CSEA, nudification, sextortion, grooming, non-consensual intimate imagery, safeguarding signals.",
    tone: "red",
    type: "gnews",
    query:
      'CSAM OR CSEA OR "child sexual abuse" OR "synthetic CSAM" OR "AI-generated abuse" OR nudify OR nudification OR sextortion OR grooming OR "image-based abuse" OR "non-consensual intimate" OR "deepfake pornography"',
  },
  {
    key: "fraud_identity",
    title: "Fraud, Impersonation & Identity Integrity",
    subtitle:
      "Voice cloning, scams, synthetic identity, KYC/AML pressure, account takeover and payments fraud.",
    tone: "red",
    type: "gnews",
    query:
      '"voice cloning" OR "deepfake fraud" OR impersonation OR "CEO fraud" OR "business email compromise" OR BEC OR "account takeover" OR "synthetic identity" OR "identity verification" OR KYC OR AML OR "payment fraud" OR "authorized push payment" OR vishing OR "romance scam"',
  },
  {
    key: "cyber_illicit_enablement",
    title: "Cybercrime & Illicit Enablement",
    subtitle:
      "Phishing automation, malware/ransomware enablement, intrusion patterns, illicit tooling and markets.",
    tone: "red",
    type: "gnews",
    query:
      '"AI phishing" OR "LLM phishing" OR phishing OR "automated phishing" OR malware OR ransomware OR "malware-as-a-service" OR "initial access broker" OR "credential stuffing" OR "prompt injection" OR "jailbreak marketplace"',
  },
  {
    key: "ns_extremism",
    title: "National Security: Terrorism & Extremism Misuse",
    subtitle:
      "Violent extremism misuse, incitement, operational guidance risks, propaganda and recruitment signals.",
    tone: "red",
    type: "gnews",
    query:
      'terror* OR extrem* OR "violent extremist" OR radicalis* OR "attack planning" OR incitement OR propaganda AND (AI OR deepfake OR "synthetic media" OR chatbot OR LLM)',
  },
  {
    key: "border_docs_biometrics",
    title: "Border / Document & Biometric Integrity",
    subtitle:
      "Document fraud, biometric spoofing, face morphing, liveness bypass, identity proofing pressures.",
    tone: "red",
    type: "gnews",
    query:
      '"document fraud" OR "forged passport" OR "counterfeit documents" OR "visa fraud" OR "identity proofing" OR "biometric spoofing" OR "face morphing" OR "liveness detection" OR "liveness bypass" AND (AI OR deepfake OR synthetic)',
  },
  {
    key: "watchdogs_research_gov",
    title: "Watchdogs, Research & Govt Signals",
    subtitle:
      "AI safety monitors, academic and think‑tank outputs, and emerging tech/government signal sources.",
    tone: "maroon",
    type: "gnews",
    query:
      'AISI OR "AI Safety Institute" OR CETaS OR "Ada Lovelace Institute" OR IWF OR "Internet Watch Foundation" OR "Oxford Internet Institute" OR "Oxford Institute for Ethics in AI" OR "GO-Science" OR "Government Office for Science" OR NSSIF OR "NSSIF Insights" OR NCA OR RICU OR "future crime" OR UCL',
  },
];

// Dedicated AIID section (separate, always visible)
const AIID_SECTION = {
  key: "aiid",
  title: "AI Incident Database — Latest Updates",
  subtitle:
    "Direct incident entries from AIID (useful if AIID site is blocked on your work network).",
};

// ---------- Filtering helpers ----------
const DATE_WINDOWS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: null },
];

// Optional “focus” filter: simple tags that help triage quickly
const FOCUS_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Capability milestone", value: "capability" },
  { label: "Enforcement / action", value: "enforcement" },
  { label: "Platform / ecosystem", value: "platform" },
  { label: "Research / watchdog", value: "research" },
  { label: "Incident", value: "incident" },
];

const HIGH_TERMS = [
  // CSEA / IBSA
  "csam",
  "csea",
  "child sexual",
  "synthetic csam",
  "nudify",
  "nudification",
  "sextortion",
  "grooming",
  "non-consensual intimate",
  // Cyber / fraud severity
  "ransomware",
  "malware-as-a-service",
  "initial access broker",
  "account takeover",
  "business email compromise",
  "bec",
  "authorized push payment",
  // NS
  "violent extremist",
  "attack planning",
  // Border / identity integrity
  "document fraud",
  "biometric spoof",
  "liveness bypass",
  "face morph",
  // “So what” enforcement/action signals
  "ofcom investigation",
  "fine",
  "fined",
  "prosecution",
  "charged",
  "arrested",
  "sentenced",
];

const MED_TERMS = [
  // Misuse techniques / emerging harms
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
  // Capability / safety movement
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
  // Mitigations
  "watermark",
  "provenance",
  "c2pa",
  "content credentials",
  "deepfake detection",
  "liveness detection",
  "age verification",
];

// Tags: simple, transparent
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

  const isPlatform =
    t.includes("platform") ||
    t.includes("telegram") ||
    t.includes("discord") ||
    t.includes("app store") ||
    t.includes("marketplace") ||
    t.includes("open-source") ||
    t.includes("model weights");

  const isResearch =
    t.includes("a i s i") ||
    t.includes("ai safety institute") ||
    t.includes("cetas") ||
    t.includes("ada lovelace") ||
    t.includes("oxford internet institute") ||
    t.includes("internet watch foundation") ||
    t.includes("paper") ||
    t.includes("preprint") ||
    t.includes("study") ||
    t.includes("report");

  const isIncident =
    t.includes("incident") ||
    t.includes("breach") ||
    t.includes("harm") ||
    t.includes("victim") ||
    t.includes("case") ||
    t.includes("lawsuit");

  if (isCapability) tags.push({ label: "Capability milestone", key: "capability" });
  if (isEnforcement) tags.push({ label: "Enforcement/action", key: "enforcement" });
  if (isPlatform) tags.push({ label: "Platform/ecosystem", key: "platform" });
  if (isResearch) tags.push({ label: "Research/watchdog", key: "research" });
  if (isIncident) tags.push({ label: "Incident", key: "incident" });

  return tags;
}

function computePriority(title, description, source) {
  const t = `${title || ""} ${description || ""} ${source || ""}`.toLowerCase();
  if (HIGH_TERMS.some((w) => t.includes(w))) return "High";
  if (MED_TERMS.some((w) => t.includes(w))) return "Medium";
  return "Low";
}

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

// ---------- Visual tone styles ----------
function toneStyles(tone) {
  if (tone === "maroon") {
    return {
      bar: "bg-[#7a1f3d]",
      pill: "bg-[#f6e7ee] text-[#7a1f3d] border-[#e7c6d3]",
      border: "border-[#e7c6d3]",
    };
  }
  if (tone === "blue") {
    return {
      bar: "bg-blue-700",
      pill: "bg-blue-50 text-blue-800 border-blue-200",
      border: "border-blue-200",
    };
  }
  return {
    bar: "bg-red-700",
    pill: "bg-red-50 text-red-800 border-red-200",
    border: "border-red-200",
  };
}

// ---------- Brief box ----------
function BriefBox({ tone = "maroon", text }) {
  const s = toneStyles(tone);
  return (
    <div className={`rounded-lg border ${s.border} bg-slate-50 p-4`}>
      <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
        Brief (rules-based)
      </div>
      <div className="mt-2 text-sm text-slate-700 leading-relaxed">{text}</div>
    </div>
  );
}

// ---------- Article row ----------
function ArticleRow({ item }) {
  const priority = item.priority || computePriority(item.title, item.description, item.source);
  const tags = item.tags || [];
  const priorityPill =
    priority === "High"
      ? "bg-red-100 text-red-800 border-red-200"
      : priority === "Medium"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : "bg-emerald-100 text-emerald-900 border-emerald-200";

  return (
    <li className="py-3 border-b border-slate-200 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a
            href={item.url || "#"}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-slate-900 hover:underline underline-offset-4"
          >
            {item.title || "Untitled"}
          </a>

          {item.description ? (
            <div className="mt-1 text-sm text-slate-600 line-clamp-2">{item.description}</div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${priorityPill}`}
              title="Rules-based priority (keyword heuristic)"
            >
              {priority} priority
            </span>

            {tags.slice(0, 3).map((t) => (
              <span
                key={t.key}
                className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] bg-white text-slate-700 border-slate-200"
                title="Rules-based signal tag"
              >
                {t.label}
              </span>
            ))}

            <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] bg-white text-slate-700 border-slate-200">
              Source: {item.source || item.sourceName || "Unknown"}
            </span>

            <span className="text-[11px] text-slate-500">Date: {fmtDate(item.publishedAt)}</span>
          </div>
        </div>

        <a
          href={item.url || "#"}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
        >
          Open <ExternalLink size={14} />
        </a>
      </div>
    </li>
  );
}

// ---------- Section block ----------
function SectionBlock({ title, subtitle, tone, brief, items, emptyText }) {
  const s = toneStyles(tone);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-3">
          <div className={`h-4 w-4 rounded-sm ${s.bar}`} />
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        </div>
        {subtitle ? <div className="text-sm text-slate-500">{subtitle}</div> : null}
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
          <BriefBox tone={tone} text={brief} />
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-lg border border-slate-200 bg-white">
            <ul className="px-4">
              {items.length === 0 ? (
                <li className="py-4 text-sm text-slate-500">{emptyText}</li>
              ) : (
                items.map((it, idx) => (
                  <ArticleRow key={`${it.url || it.id || "x"}-${idx}`} item={it} />
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================
   MAIN APP
   ========================= */

export default function App() {
  // Filters (simple for non-tech)
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All"); // All | High | Medium | Low
  const [windowOpt, setWindowOpt] = useState(DATE_WINDOWS[1]); // 30 days default
  const [maxPerSection, setMaxPerSection] = useState(6);
  const [focus, setFocus] = useState("All"); // optional signal focus

  // Data store
  const [data, setData] = useState({});
  const [aiid, setAiid] = useState([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const applyFilters = useCallback(
    (items) => {
      let out = [...(items || [])];

      // Normalize fields + compute priority + tags
      out = out.map((it) => {
        const source = it.source?.name || it.source || it.sourceName || "Unknown";
        const publishedAt = it.publishedAt || it.date || null;
        const priorityVal = it.priority || computePriority(it.title, it.description, source);
        const tags = it.tags || computeTags(it.title, it.description, source);

        return { ...it, source, publishedAt, priority: priorityVal, tags };
      });

      // Window
      out = out.filter((it) => withinWindow(it.publishedAt, windowOpt.days));

      // Priority
      if (priority !== "All") out = out.filter((it) => it.priority === priority);

      // Focus tag
      if (focus !== "All") {
        out = out.filter((it) => (it.tags || []).some((t) => t.key === focus));
      }

      // Search
      const q = search.trim().toLowerCase();
      if (q) {
        out = out.filter((it) => {
          const text = `${it.title || ""} ${it.description || ""} ${it.source || ""}`.toLowerCase();
          return text.includes(q);
        });
      }

      // Newest first
      out.sort((a, b) => {
        const da = toDate(a.publishedAt)?.getTime() || 0;
        const db = toDate(b.publishedAt)?.getTime() || 0;
        return db - da;
      });

      // Dedupe by URL (helps reduce repeats across sections)
      const seen = new Set();
      out = out.filter((it) => {
        const u = it.url || "";
        if (!u) return true;
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      });

      return out.slice(0, maxPerSection);
    },
    [focus, maxPerSection, priority, search, windowOpt.days]
  );

  const runScan = useCallback(async () => {
    setLoading(true);
    setNote("");

    try {
      const gnewsSections = SECTIONS.filter((s) => s.type === "gnews");

      const results = await Promise.all(
        gnewsSections.map(async (sec) => {
          const r = await axios.get(
            `/api/gnews?q=${encodeURIComponent(sec.query)}&lang=en&max=${Math.max(
              12,
              maxPerSection * 2
            )}`
          );

          const articles = Array.isArray(r?.data?.articles) ? r.data.articles : [];

          const mapped = articles.map((a) => ({
            title: a.title ?? "",
            description: a.description ?? "",
            url: a.url ?? "#",
            image: a.image ?? "",
            publishedAt: a.publishedAt ?? "",
            source: a?.source?.name || "Unknown",
          }));

          return [sec.key, mapped];
        })
      );

      const next = {};
      for (const [key, items] of results) next[key] = items;

      // AIID updates
      let aiidItems = [];
      try {
        const r = await axios.get(`/api/aiid?limit=${Math.max(12, maxPerSection * 2)}`);
        aiidItems = Array.isArray(r?.data?.articles) ? r.data.articles : [];
      } catch {
        aiidItems = [];
      }

      setData(next);
      setAiid(aiidItems);

      if (!aiidItems.length) {
        setNote("AIID feed returned no items (it may be temporarily unavailable or the endpoint isn't set up yet).");
      }
    } catch (e) {
      setNote("Live feed unavailable (rate limit, network, or missing API route).");
    } finally {
      setLoading(false);
    }
  }, [maxPerSection]);

  // initial scan
  useEffect(() => {
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brief strings
  const briefs = useMemo(() => {
    const make = (items) => {
      const filtered = applyFilters(items);
      if (!filtered.length)
        return "No items matched current filters. Try widening the time window, setting Focus to All, or clearing search.";

      const counts = filtered.reduce(
        (acc, it) => {
          acc[it.priority] = (acc[it.priority] || 0) + 1;
          return acc;
        },
        { High: 0, Medium: 0, Low: 0 }
      );

      const tagCounts = filtered.reduce((acc, it) => {
        (it.tags || []).forEach((t) => {
          acc[t.key] = (acc[t.key] || 0) + 1;
        });
        return acc;
      }, {});

      const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
      const topTagText = topTag ? ` Most common signal: ${topTag[0]} (${topTag[1]}).` : "";

      return `Showing ${filtered.length} items. High: ${counts.High}, Medium: ${counts.Medium}, Low: ${counts.Low}.${topTagText}`;
    };

    const out = {};
    for (const s of SECTIONS) out[s.key] = make(data[s.key] || []);
    out[AIID_SECTION.key] = make(aiid || []);
    return out;
  }, [aiid, applyFilters, data]);

  const view = useMemo(() => {
    const out = {};
    for (const s of SECTIONS) out[s.key] = applyFilters(data[s.key] || []);
    out[AIID_SECTION.key] = applyFilters(aiid || []);
    return out;
  }, [aiid, applyFilters, data]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <div className="bg-[#7a1f3d] px-6 py-6 text-white">
            <div className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              AIHM Intelligence Monitor
            </div>
            <div className="mt-1 text-sm opacity-90">Daily brief · {today}</div>
          </div>

          <div className="bg-white px-6 py-4 border-t border-slate-200">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              {/* Search */}
              <div className="lg:col-span-4">
                <label className="text-xs font-semibold text-slate-600">Search</label>
                <div className="mt-1 relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='e.g., "nudify", "model card", "Ofcom", "liveness bypass"'
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Time window */}
              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Time window</label>
                <select
                  value={windowOpt.label}
                  onChange={(e) => {
                    const sel =
                      DATE_WINDOWS.find((d) => d.label === e.target.value) || DATE_WINDOWS[1];
                    setWindowOpt(sel);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {DATE_WINDOWS.map((d) => (
                    <option key={d.label} value={d.label}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
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

              {/* Focus */}
              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Focus</label>
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {FOCUS_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div className="lg:col-span-1">
                <label className="text-xs font-semibold text-slate-600">Items</label>
                <select
                  value={maxPerSection}
                  onChange={(e) => setMaxPerSection(parseInt(e.target.value, 10))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Run scan */}
              <div className="lg:col-span-1 flex gap-2 justify-end">
                <button
                  onClick={runScan}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition w-full justify-center"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  {loading ? "Scanning…" : "Scan"}
                </button>
              </div>
            </div>

            {note ? (
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <Filter size={14} />
                {note}
              </div>
            ) : null}
          </div>
        </header>

        {/* Sections */}
        {SECTIONS.map((s) => (
          <SectionBlock
            key={s.key}
            title={s.title}
            subtitle={s.subtitle}
            tone={s.tone}
            brief={briefs[s.key]}
            items={view[s.key] || []}
            emptyText="No items loaded for this section (or none match filters)."
          />
        ))}

        {/* AIID dedicated section */}
        <SectionBlock
          title={AIID_SECTION.title}
          subtitle={AIID_SECTION.subtitle}
          tone="maroon"
          brief={briefs[AIID_SECTION.key]}
          items={view[AIID_SECTION.key] || []}
          emptyText="No AIID items loaded yet. If /api/aiid isn't set up, add it and redeploy."
        />

        <div className="mt-10 text-xs text-slate-500">
          Tip: This monitor uses transparent, rules-based triage: <span className="font-semibold">Priority</span>{" "}
          (High/Medium/Low) + <span className="font-semibold">Signal tags</span> (capability/enforcement/platform/research/incident).
          Adjust keywords in App.jsx to tune what your team considers “urgent”.
        </div>
      </div>
    </div>
  );
}
