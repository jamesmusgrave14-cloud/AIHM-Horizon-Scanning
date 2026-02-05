import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ExternalLink, RefreshCw, Search, Filter } from "lucide-react";

/**
 * DESIGN GOAL
 * - Professional briefing/dashboard (light background, clear sections)
 * - Non-technical friendly: simple lists + “Brief” boxes
 * - Source always shown
 * - Filters: search, priority, time window
 * - AI Incident Database in its own section (pulled via /api/aiid)
 *
 * ASSUMPTIONS
 * - You already have Vercel serverless endpoints:
 *    - /api/gnews  (safe server-side fetch to GNews with key stored in Vercel env)
 *    - /api/aiid   (AIID titles+dates+links endpoint we discussed)
 */

// ---------- Quick config: sections + queries ----------
const SECTIONS = [
  {
    key: "uk_regulation",
    title: "UK Regulation & Online Safety",
    subtitle: "UK policy, enforcement, regulator activity, and platform accountability.",
    tone: "maroon",
    type: "gnews",
    query:
      '"Online Safety Act" OR "Ofcom" OR "UK AI regulation" OR "deepfake" OR "nudify" OR "AI child safety" OR "synthetic media" UK',
  },
  {
    key: "child_safety",
    title: "Child Safety & Exploitation",
    subtitle: "CSAM risk, nudification, sextortion, grooming, safeguarding signals.",
    tone: "red",
    type: "gnews",
    query:
      '"nudify app" OR "AI-generated child abuse" OR "CSAM" OR "sextortion" OR "deepfake child" OR "AI grooming"',
  },
  {
    key: "fraud_impersonation",
    title: "Fraud, Scams & Impersonation",
    subtitle: "Voice cloning, CEO scams, synthetic identity, payment fraud patterns.",
    tone: "red",
    type: "gnews",
    query:
      '"voice cloning" OR "CEO scam" OR "deepfake fraud" OR "AI scam" OR "impersonation" OR "synthetic audio fraud"',
  },
  {
    key: "cybercrime",
    title: "Cybercrime & Security Misuse",
    subtitle: "Phishing automation, malware development, AI-enabled intrusion patterns.",
    tone: "red",
    type: "gnews",
    query:
      '"AI-enabled malware" OR "automated phishing" OR "LLM phishing" OR "AI cyberattack" OR "AI ransomware"',
  },
  {
    key: "bias_rights",
    title: "Bias, Discrimination & Rights Impacts",
    subtitle: "Algorithmic discrimination, biometric risk, public sector decision-making harms.",
    tone: "red",
    type: "gnews",
    query:
      '"algorithmic discrimination" OR "AI bias" OR "facial recognition bias" OR "automated decision unfair" OR "bias lawsuit"',
  },
  {
    key: "capabilities",
    title: "Horizon: Capability & Release Signals",
    subtitle: "Model releases, agent tooling, red teaming, evaluation and governance movement.",
    tone: "blue",
    type: "gnews",
    query:
      '"model release" OR "GPT" OR "Claude" OR "Gemini" OR "Llama" OR "agents" OR "agentic" OR "red teaming" OR "model evaluation"',
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

const HIGH_TERMS = [
  "csam",
  "child",
  "sextortion",
  "extortion",
  "blackmail",
  "ransomware",
  "fraud",
  "scam",
  "impersonat",
  "terror",
  "extrem",
  "weapon",
  "violent",
];

const MED_TERMS = [
  "deepfake",
  "phishing",
  "malware",
  "identity",
  "biometric",
  "doxx",
  "bias",
  "discriminat",
  "leak",
];

function computePriority(title, description) {
  const t = `${title || ""} ${description || ""}`.toLowerCase();
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
  // default “harms red”
  return {
    bar: "bg-red-700",
    pill: "bg-red-50 text-red-800 border-red-200",
    border: "border-red-200",
  };
}

// ---------- A simple “brief” box ----------
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

// ---------- Single list item row ----------
function ArticleRow({ item }) {
  const priority = item.priority || computePriority(item.title, item.description);
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

// ---------- A “section” styled like your briefing screenshot ----------
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
        {/* Left: brief */}
        <div className="lg:col-span-4">
          <BriefBox tone={tone} text={brief} />
        </div>

        {/* Right: list */}
        <div className="lg:col-span-8">
          <div className="rounded-lg border border-slate-200 bg-white">
            <ul className="px-4">
              {items.length === 0 ? (
                <li className="py-4 text-sm text-slate-500">{emptyText}</li>
              ) : (
                items.map((it, idx) => <ArticleRow key={`${it.url || it.id || "x"}-${idx}`} item={it} />)
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

  // Data store
  const [data, setData] = useState({}); // sectionKey -> items[]
  const [aiid, setAiid] = useState([]); // AIID updates
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Local filter pipeline applied to any list
  const applyFilters = useCallback(
    (items) => {
      let out = [...(items || [])];

      // Normalize fields
      out = out.map((it) => ({
        ...it,
        source: it.source?.name || it.source || it.sourceName || "Unknown",
        publishedAt: it.publishedAt || it.date || null,
        priority: it.priority || computePriority(it.title, it.description),
      }));

      // Window filter
      out = out.filter((it) => withinWindow(it.publishedAt, windowOpt.days));

      // Priority filter
      if (priority !== "All") out = out.filter((it) => it.priority === priority);

      // Search filter
      const q = search.trim().toLowerCase();
      if (q) {
        out = out.filter((it) => {
          const text = `${it.title || ""} ${it.description || ""} ${it.source || ""}`.toLowerCase();
          return text.includes(q);
        });
      }

      // Sort newest first
      out.sort((a, b) => {
        const da = toDate(a.publishedAt)?.getTime() || 0;
        const db = toDate(b.publishedAt)?.getTime() || 0;
        return db - da;
      });

      return out.slice(0, maxPerSection);
    },
    [maxPerSection, priority, search, windowOpt.days]
  );

  const runScan = useCallback(async () => {
    setLoading(true);
    setNote("");

    try {
      // Fetch all GNews sections in parallel (through your safe /api/gnews proxy)
      const gnewsSections = SECTIONS.filter((s) => s.type === "gnews");

      const results = await Promise.all(
        gnewsSections.map(async (sec) => {
          const r = await axios.get(
            `/api/gnews?q=${encodeURIComponent(sec.query)}&lang=en&max=${Math.max(10, maxPerSection)}`
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

      // Fetch AIID updates separately (dedicated section)
      // This relies on your /api/aiid returning { articles: [...] } with title/date/url.
      let aiidItems = [];
      try {
        const r = await axios.get(`/api/aiid?limit=${Math.max(10, maxPerSection)}`);
        aiidItems = Array.isArray(r?.data?.articles) ? r.data.articles : [];
      } catch {
        aiidItems = [];
      }

      setData(next);
      setAiid(aiidItems);

      // Friendly note if AIID empty
      if (!aiidItems.length) {
        setNote(
          "AIID feed returned no items (it may be temporarily unavailable or the endpoint isn't set up yet)."
        );
      }
    } catch (e) {
      setNote("Live feed unavailable (rate limit, network, or missing API route).");
    } finally {
      setLoading(false);
    }
  }, [maxPerSection]);

  // Initial scan once
  useEffect(() => {
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the “brief” strings per section (simple, honest, non-AI)
  const briefs = useMemo(() => {
    const make = (items) => {
      const filtered = applyFilters(items);
      if (!filtered.length) return "No items matched current filters. Try widening the time window or clearing search.";
      const counts = filtered.reduce(
        (acc, it) => {
          acc[it.priority] = (acc[it.priority] || 0) + 1;
          return acc;
        },
        { High: 0, Medium: 0, Low: 0 }
      );
      return `Showing ${filtered.length} items. High priority: ${counts.High}, Medium: ${counts.Medium}, Low: ${counts.Low}.`;
    };
    const out = {};
    for (const s of SECTIONS) out[s.key] = make(data[s.key] || []);
    out[AIID_SECTION.key] = make(aiid || []);
    return out;
  }, [aiid, applyFilters, data]);

  // Compute the filtered lists for rendering (per section)
  const view = useMemo(() => {
    const out = {};
    for (const s of SECTIONS) out[s.key] = applyFilters(data[s.key] || []);
    out[AIID_SECTION.key] = applyFilters(aiid || []);
    return out;
  }, [aiid, applyFilters, data]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* HEADER (briefing style) */}
        <header className="rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <div className="bg-[#7a1f3d] px-6 py-6 text-white">
            <div className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              AIHM Intelligence Monitor
            </div>
            <div className="mt-1 text-sm opacity-90">
              Daily brief · {today}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white px-6 py-4 border-t border-slate-200">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              {/* Search */}
              <div className="lg:col-span-5">
                <label className="text-xs font-semibold text-slate-600">Search</label>
                <div className="mt-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='e.g., "voice cloning", "CSAM", "fraud", "Ofcom"'
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
                    const sel = DATE_WINDOWS.find((d) => d.label === e.target.value) || DATE_WINDOWS[1];
                    setWindowOpt(sel);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {DATE_WINDOWS.map((d) => (
                    <option key={d.label} value={d.label}>{d.label}</option>
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

              {/* Max items */}
              <div className="lg:col-span-1">
                <label className="text-xs font-semibold text-slate-600">Items</label>
                <select
                  value={maxPerSection}
                  onChange={(e) => setMaxPerSection(parseInt(e.target.value, 10))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Run scan */}
              <div className="lg:col-span-2 flex gap-2 justify-end">
                <button
                  onClick={runScan}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition w-full justify-center"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  {loading ? "Scanning…" : "Run scan"}
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

        {/* SECTIONS (briefing style) */}
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

        {/* AIID DEDICATED SECTION */}
        <SectionBlock
          title={AIID_SECTION.title}
          subtitle={AIID_SECTION.subtitle}
          tone="maroon"
          brief={briefs[AIID_SECTION.key]}
          items={view[AIID_SECTION.key] || []}
          emptyText="No AIID items loaded yet. If /api/aiid isn't set up, add it and redeploy."
        />

        {/* FOOTER HELP TEXT */}
        <div className="mt-10 text-xs text-slate-500">
          Tip: This monitor applies <span className="font-semibold">simple keyword-based priority</span> (High/Medium/Low)
          to help triage quickly. Adjust terms in App.jsx if you want different prioritisation.
          Sources are shown on every item.
        </div>
      </div>
    </div>
  );
}
