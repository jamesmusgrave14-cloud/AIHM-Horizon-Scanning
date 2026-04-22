import { useEffect, useMemo, useState } from "react";  MECHANISMS.OTHER,
];

const SUBTYPES = {
  FRAUD_SCAMS: "Fraud / scams / impersonation",
  GROOMING_EXPLOITATION: "Grooming / exploitation / coercion",
  SYNTHETIC_IMAGE_ABUSE: "Synthetic-image abuse",
  STALKING_HARASSMENT: "Stalking / harassment / coercion",
  TERRORIST_PROPAGANDA: "Propaganda / radicalisation / recruitment",
  ATTACK_PLANNING: "Attack planning / operational guidance",
  ILLICIT_ITEMS: "Illegal items / drugs / firearms",
  CYBER_CRIME_ENABLEMENT: "Cyber / phishing / ransomware enablement",
  EVIDENCE_IDENTITY: "False evidence / false documents / identity abuse",
  OTHER: "Other",
};

const SUBTYPE_ORDER = [
  SUBTYPES.FRAUD_SCAMS,
  SUBTYPES.GROOMING_EXPLOITATION,
  SUBTYPES.SYNTHETIC_IMAGE_ABUSE,
  SUBTYPES.STALKING_HARASSMENT,
  SUBTYPES.TERRORIST_PROPAGANDA,
  SUBTYPES.ATTACK_PLANNING,
  SUBTYPES.ILLICIT_ITEMS,
  SUBTYPES.CYBER_CRIME_ENABLEMENT,
  SUBTYPES.EVIDENCE_IDENTITY,
  SUBTYPES.OTHER,
];

/* ------------------------- chips / colours ------------------------- */

function catChip(cat) {
  const key = String(cat || "").toLowerCase();

  if (key.includes("financial crime")) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (key.includes("sexual crime")) {
    return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
  }
  if (key.includes("terrorism")) {
    return "border-rose-200 bg-rose-50 text-rose-900";
  }
  if (key.includes("illegal item")) {
    return "border-violet-200 bg-violet-50 text-violet-900";
  }
  if (key.includes("model")) {
    return "border-indigo-200 bg-indigo-50 text-indigo-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function mechanismChip(mechanism) {
  const key = String(mechanism || "").toLowerCase();

  if (key.includes("synthetic media")) return "border-pink-200 bg-pink-50 text-pink-900";
  if (key.includes("offender capability")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (key.includes("automation")) return "border-violet-200 bg-violet-50 text-violet-900";
  if (key.includes("targeting")) return "border-cyan-200 bg-cyan-50 text-cyan-900";
  if (key.includes("model misuse")) return "border-indigo-200 bg-indigo-50 text-indigo-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function subtypeChip(subtype) {
  const key = String(subtype || "").toLowerCase();

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

/* ------------------------- inference ------------------------- */

function itemTextBlob(item) {
  const linkText = (item?.links || [])
    .map((l) => `${l?.title || ""} ${l?.source || ""}`)
    .join(" ");

  return [
    item?.title,
    item?.source,
    item?.ai_summary,
    item?.summary,
    item?.category,
    item?.primary_category,
    item?.tags?.join(" "),
    linkText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferMechanism(text) {
  if (
    includesAny(text, [
      "deepfake",
      "synthetic",
      "synthetic image",
      "fake image",
      "fake video",
      "fake audio",
      "voice clone",
      "voice cloning",
      "face swap",
      "image generator",
      "image generation",
      "realistic fake",
      "impersonation",
    ])
  ) {
    return MECHANISMS.SYNTHETIC_MEDIA;
  }

  if (
    includesAny(text, [
      "automation",
      "automated",
      "at scale",
      "scale",
      "scalable",
      "bot",
      "bots",
      "botnet",
      "mass",
      "bulk",
      "industrial scale",
      "high-volume",
    ])
  ) {
    return MECHANISMS.AUTOMATION_SCALE;
  }

  if (
    includesAny(text, [
      "targeting",
      "targeted",
      "micro-targeting",
      "personalised",
      "personalized",
      "hyper-targeting",
      "profiling",
      "susceptibilities",
      "recruitment",
    ])
  ) {
    return MECHANISMS.TARGETING;
  }

  if (
    includesAny(text, [
      "jailbreak",
      "guardrail",
      "bypass",
      "evade detection",
      "evasion",
      "wormgpt",
      "fraudgpt",
      "uncensored model",
      "model misuse",
    ])
  ) {
    return MECHANISMS.MODEL_EVASION;
  }

  if (
    includesAny(text, [
      "instructions",
      "guidance",
      "how to",
      "planning",
      "preparation",
      "groom",
      "harass",
      "coerce",
      "phishing",
      "ransomware",
      "attack",
      "terrorist training",
      "offender",
      "criminal",
      "crime",
    ])
  ) {
    return MECHANISMS.OFFENDER_UPLIFT;
  }

  return MECHANISMS.OTHER;
}

function inferSubtype(text) {
  if (
    includesAny(text, [
      "fraud",
      "scam",
      "scamming",
      "money laundering",
      "phishing",
      "impersonation",
      "synthetic identity",
      "ceo scam",
      "romance scam",
      "hi mum",
      "muling",
    ])
  ) {
    return SUBTYPES.FRAUD_SCAMS;
  }

  if (
    includesAny(text, [
      "grooming",
      "exploitation",
      "extortion",
      "sextortion",
      "coercion",
      "vulnerable individuals",
      "vulnerable people",
      "children",
      "child sexual exploitation",
    ])
  ) {
    return SUBTYPES.GROOMING_EXPLOITATION;
  }

  if (
    includesAny(text, [
      "ncii",
      "non-consensual intimate",
      "non consensual intimate",
      "synthetic image",
      "illicit synthetic images",
      "deepfake abuse",
      "image abuse",
    ])
  ) {
    return SUBTYPES.SYNTHETIC_IMAGE_ABUSE;
  }

  if (
    includesAny(text, [
      "stalking",
      "cyber stalk",
      "harassment",
      "harass",
      "coerce women",
      "coerce girls",
      "audio abuse",
    ])
  ) {
    return SUBTYPES.STALKING_HARASSMENT;
  }

  if (
    includesAny(text, [
      "propaganda",
      "radicalisation",
      "radicalization",
      "recruitment",
      "extremist content",
      "terrorist content",
      "dangerous narratives",
      "grievance narratives",
    ])
  ) {
    return SUBTYPES.TERRORIST_PROPAGANDA;
  }

  if (
    includesAny(text, [
      "attack planning",
      "attack preparation",
      "terrorist training",
      "instructions",
      "weaponry",
      "target selection",
      "explosives",
      "3d printing",
      "operational guidance",
    ])
  ) {
    return SUBTYPES.ATTACK_PLANNING;
  }

  if (
    includesAny(text, [
      "firearms",
      "drugs",
      "drug production",
      "drug smuggling",
      "illicit items",
      "illicit commodities",
      "counterfeit",
      "toxic chemicals",
      "dark web",
      "parcels",
    ])
  ) {
    return SUBTYPES.ILLICIT_ITEMS;
  }

  if (
    includesAny(text, [
      "ransomware",
      "phishing",
      "hack",
      "cyberattack",
      "crime scripts",
      "scam scripts",
      "wormgpt",
      "fraudgpt",
    ])
  ) {
    return SUBTYPES.CYBER_CRIME_ENABLEMENT;
  }

  if (
    includesAny(text, [
      "false evidence",
      "court case",
      "identity documents",
      "false supporting documents",
      "birth certificates",
      "bank statements",
      "educational qualifications",
      "false identity",
      "identity abuse",
      "evidence",
    ])
  ) {
    return SUBTYPES.EVIDENCE_IDENTITY;
  }

  return SUBTYPES.OTHER;
}

function inferRiskArea({ text, legacyCategory }) {
  const joined = `${text || ""} ${legacyCategory || ""}`.toLowerCase();

  // RA09
  if (
    includesAny(joined, [
      "fraud",
      "money laundering",
      "scam",
      "scamming",
      "blackmail",
      "extortion",
      "impersonation",
      "fraudgpt",
      "wormgpt",
      "phishing",
      "synthetic identity",
      "romance scam",
      "ceo scam",
      "hi mum scam",
      "muling",
      "financial crime",
    ])
  ) {
    return RISK_AREAS.FINANCIAL_CRIME;
  }

  // RA11
  if (
    includesAny(joined, [
      "sexual crime",
      "sexual abuse",
      "child sexual abuse",
      "child sexual exploitation",
      "csea",
      "csam",
      "sextortion",
      "ncii",
      "non-consensual intimate",
      "non consensual intimate",
      "synthetic image",
      "women and girls",
      "stalking",
      "harassment",
      "grooming",
      "coercion",
    ])
  ) {
    return RISK_AREAS.SEXUAL_CRIME_ABUSE;
  }

  // RA13
  if (
    includesAny(joined, [
      "terrorism",
      "terrorist",
      "extremist",
      "radicalisation",
      "radicalization",
      "recruitment",
      "propaganda",
      "attack planning",
      "attack preparation",
      "violent extremism",
      "grievance narratives",
    ])
  ) {
    return RISK_AREAS.TERRORISM;
  }

  // RA14
  if (
    includesAny(joined, [
      "illegal item",
      "firearms",
      "drugs",
      "drug smuggling",
      "drug production",
      "designer drugs",
      "illicit items",
      "illicit commodities",
      "counterfeit",
      "toxic chemicals",
      "dark web",
      "ransomware",
      "instructions for committing crimes",
    ])
  ) {
    return RISK_AREAS.ILLEGAL_ITEMS;
  }

  return RISK_AREAS.OTHER;
}

function normaliseItem(item, kind) {
  const text = itemTextBlob(item);
  const legacyCategory = kind === "signals" ? item?.primary_category || "" : item?.category || "";
  const mechanism = item?.mechanism || inferMechanism(text);
  const harm_subtype = item?.harm_subtype || inferSubtype(text);
  const primary_risk_area = item?.primary_risk_area || inferRiskArea({ text, legacyCategory });

  return {
    ...item,
    legacy_category: legacyCategory,
    primary_risk_area,
    mechanism,
    harm_subtype,
  };
}

/* ---------------------------- App ---------------------------- */

export default function App() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  // Landing page is Harms
  const [view, setView] = useState("harms"); // harms | signals | forums | releases

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("relevance"); // relevance | newest | oldest | uk | confidence
  const [minUkScore, setMinUkScore] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("All"); // risk area
  const [mechanismFilter, setMechanismFilter] = useState("All");
  const [subtypeFilter, setSubtypeFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All"); // All | News | Forum
  const [ukOnly, setUkOnly] = useState(false);
  const [showAiSummaries, setShowAiSummaries] = useState(false);
  const [showN, setShowN] = useState(36);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Harms view UI
  const [harmsFocusRiskArea, setHarmsFocusRiskArea] = useState("All");
  const [openBuckets, setOpenBuckets] = useState({});

  // Persist a few prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem("aihm_ui_prefs_v6");
      if (!raw) return;
      const p = JSON.parse(raw);
      const allowed = new Set(["harms", "signals", "forums", "releases"]);
      if (p?.view && allowed.has(p.view)) setView(p.view);
      if (typeof p?.showN === "number") setShowN(p.showN);
      if (typeof p?.showAiSummaries === "boolean") setShowAiSummaries(p.showAiSummaries);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "aihm_ui_prefs_v6",
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
  const meta = payload?.meta || {};
  const limits = meta?.limits || {};
  const errors = meta?.errors || {};

  const normalisedSections = useMemo(
    () => ({
      harms: (sections.harms || []).map((x) => normaliseItem(x, "harms")),
      signals: (sections.signals || []).map((x) => normaliseItem(x, "signals")),
      forums: (sections.forums || []).map((x) => normaliseItem(x, "forums")),
      dev_releases: sections.dev_releases || [],
    }),
    [sections]
  );

  const counts = useMemo(
    () => ({
      harms: normalisedSections.harms.length,
      signals: normalisedSections.signals.length,
      dev_releases: normalisedSections.dev_releases.length,
      forums: normalisedSections.forums.length,
    }),
    [normalisedSections]
  );

  const allRiskAreas = useMemo(() => {
    const vals = new Set();
    normalisedSections.harms.forEach((x) => x?.primary_risk_area && vals.add(x.primary_risk_area));
    normalisedSections.signals.forEach((x) => x?.primary_risk_area && vals.add(x.primary_risk_area));
    normalisedSections.forums.forEach((x) => x?.primary_risk_area && vals.add(x.primary_risk_area));
    normalisedSections.dev_releases.forEach(() => vals.add("Model Releases"));

    return ["All", ...sortByConfiguredOrder(Array.from(vals), [...RISK_AREA_ORDER, "Model Releases"])];
  }, [normalisedSections]);

  const harmRiskAreas = useMemo(() => {
    const vals = new Set(normalisedSections.harms.map((x) => x.primary_risk_area).filter(Boolean));
    return sortByConfiguredOrder(Array.from(vals), RISK_AREA_ORDER);
  }, [normalisedSections.harms]);

  const allMechanisms = useMemo(() => {
    const vals = new Set();
    normalisedSections.harms.forEach((x) => x?.mechanism && vals.add(x.mechanism));
    normalisedSections.signals.forEach((x) => x?.mechanism && vals.add(x.mechanism));
    normalisedSections.forums.forEach((x) => x?.mechanism && vals.add(x.mechanism));
    return ["All", ...sortByConfiguredOrder(Array.from(vals), MECHANISM_ORDER)];
  }, [normalisedSections]);

  const allSubtypes = useMemo(() => {
    const vals = new Set();
    normalisedSections.harms.forEach((x) => x?.harm_subtype && vals.add(x.harm_subtype));
    normalisedSections.signals.forEach((x) => x?.harm_subtype && vals.add(x.harm_subtype));
    normalisedSections.forums.forEach((x) => x?.harm_subtype && vals.add(x.harm_subtype));
    return ["All", ...sortByConfiguredOrder(Array.from(vals), SUBTYPE_ORDER)];
  }, [normalisedSections]);

  function matchesSearch(item) {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;

    const fields = [
      item?.title,
      item?.source,
      item?.ai_summary,
      item?.legacy_category,
      item?.primary_risk_area,
      item?.mechanism,
      item?.harm_subtype,
      ...(item?.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return fields.includes(q);
  }

  function passesDateRange(item, kind) {
    const d = getItemDateISO(item, kind);
    if (!d) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }

  function passesCommon(item, kind) {
    // Date range overrides time window
    if (dateFrom || dateTo) {
      if (!passesDateRange(item, kind)) return false;
    } else {
      const ts = item?.timestamp;
      if (ts && !withinWindow(ts, timeFilter)) return false;
    }

    // UK-only
    if (ukOnly) {
      const uk = item?.uk_relevance || (item?.uk_score >= 2);
      if (!uk) return false;
    }

    // Min UK score
    if (minUkScore > 0) {
      const score = item?.uk_score ?? (item?.uk_relevance ? 2 : 0);
      if (score < minUkScore) return false;
    }

    // Risk area
    if (categoryFilter !== "All") {
      if (kind === "releases") {
        if (categoryFilter !== "Model Releases") return false;
      } else {
        if ((item?.primary_risk_area || "") !== categoryFilter) return false;
      }
    }

    // Mechanism
    if (mechanismFilter !== "All") {
      if ((item?.mechanism || "") !== mechanismFilter) return false;
    }

    // Subtype
    if (subtypeFilter !== "All") {
      if ((item?.harm_subtype || "") !== subtypeFilter) return false;
    }

    // Source type
    if (sourceFilter !== "All") {
      if (kind === "signals") {
        const links = item?.links || [];
        const anyForum = links.some((l) => String(l?.source_type || "").toLowerCase() === "forum");
        const anyNews = links.some((l) => String(l?.source_type || "").toLowerCase() === "news");
        if (sourceFilter === "Forum" && !anyForum) return false;
        if (sourceFilter === "News" && !anyNews) return false;
      } else {
        const st = String(item?.source_type || "news").toLowerCase();
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
    const filtered = normalisedSections.harms.filter((x) => passesCommon(x, "harms"));
    return sortItems(filtered, "harms");
  }, [
    normalisedSections.harms,
    searchTerm,
    timeFilter,
    dateFrom,
    dateTo,
    categoryFilter,
    mechanismFilter,
    subtypeFilter,
    sourceFilter,
    ukOnly,
    minUkScore,
    sortBy,
  ]);

  const signals = useMemo(() => {
    const filtered = normalisedSections.signals.filter((x) => passesCommon(x, "signals"));
    return sortItems(filtered, "signals");
  }, [
    normalisedSections.signals,
    searchTerm,
    timeFilter,
    dateFrom,
    dateTo,
    categoryFilter,
    mechanismFilter,
    subtypeFilter,
    sourceFilter,
    ukOnly,
    minUkScore,
    sortBy,
  ]);

  const forums = useMemo(() => {
    const filtered = normalisedSections.forums.filter((x) => passesCommon(x, "forums"));
    return sortItems(filtered, "forums");
  }, [
    normalisedSections.forums,
    searchTerm,
    timeFilter,
    dateFrom,
    dateTo,
    categoryFilter,
    mechanismFilter,
    subtypeFilter,
    sourceFilter,
    ukOnly,
    minUkScore,
    sortBy,
  ]);

  const releases = useMemo(() => {
    const filtered = normalisedSections.dev_releases.filter((x) => passesCommon(x, "releases"));
    return sortItems(filtered, "releases");
  }, [
    normalisedSections.dev_releases,
    searchTerm,
    timeFilter,
    dateFrom,
    dateTo,
    categoryFilter,
    sourceFilter,
    ukOnly,
    minUkScore,
    sortBy,
  ]);

  function toggleBucket(cat) {
    setOpenBuckets((s) => ({ ...s, [cat]: !s[cat] }));
  }

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (searchTerm.trim()) chips.push({ k: "search", label: `Search: ${searchTerm.trim()}` });
    if (dateFrom) chips.push({ k: "dateFrom", label: `From: ${dateFrom}` });
    if (dateTo) chips.push({ k: "dateTo", label: `To: ${dateTo}` });
    if (!dateFrom && !dateTo && timeFilter !== "All") chips.push({ k: "time", label: `Time: ${timeFilter}` });
    if (categoryFilter !== "All") chips.push({ k: "cat", label: `Risk area: ${categoryFilter}` });
    if (mechanismFilter !== "All") chips.push({ k: "mech", label: `Mechanism: ${mechanismFilter}` });
    if (subtypeFilter !== "All") chips.push({ k: "subtype", label: `Subtype: ${subtypeFilter}` });
    if (sourceFilter !== "All") chips.push({ k: "src", label: `Source: ${sourceFilter}` });
    if (sortBy !== "relevance") chips.push({ k: "sort", label: `Sort: ${sortBy}` });
    if (minUkScore > 0) chips.push({ k: "minUk", label: `Min UK: ${minUkScore}` });
    if (ukOnly) chips.push({ k: "ukOnly", label: "UK only" });
    if (showAiSummaries) chips.push({ k: "aiSum", label: "AI summaries" });
    return chips;
  }, [
    searchTerm,
    dateFrom,
    dateTo,
    timeFilter,
    categoryFilter,
    mechanismFilter,
    subtypeFilter,
    sourceFilter,
    sortBy,
    minUkScore,
    ukOnly,
    showAiSummaries,
  ]);

  function clearChip(k) {
    if (k === "search") setSearchTerm("");
    if (k === "dateFrom") setDateFrom("");
    if (k === "dateTo") setDateTo("");
    if (k === "time") setTimeFilter("7d");
    if (k === "cat") setCategoryFilter("All");
    if (
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
  return true; // "All"
}

function confidenceChip(level) {
  if (level === "High") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (level === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function viewTheme(view) {
  if (view === "harms") {
    return {
      ring: "ring-rose-100",
      band: "from-rose-50 to-white",
      accent: "text-rose-700",
      border: "border-rose-100",
    };
  }
  if (view === "signals") {
    return {
      ring: "ring-sky-100",
      band: "from-sky-50 to-white",
      accent: "text-sky-700",
      border: "border-sky-100",
    };
  }
  if (view === "forums") {
    return {
      ring: "ring-fuchsia-100",
      band: "from-fuchsia-50 to-white",
      accent: "text-fuchsia-700",
      border: "border-fuchsia-100",
    };
  }
  if (view === "releases") {
    return {
      ring: "ring-indigo-100",
      band: "from-indigo-50 to-white",
      accent: "text-indigo-700",
      border: "border-indigo-100",
    };
  }
  return {
    ring: "ring-slate-100",
    band: "from-slate-50 to-white",
    accent: "text-slate-700",
    border: "border-slate-100",
  };
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
    (kind === "signals" ? item?.latest_date || item?.date : item?.date) ||
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

function includesAny(text, terms) {
  const hay = String(text || "").toLowerCase();
  return terms.some((t) => hay.includes(String(t).toLowerCase()));
}

function sortByConfiguredOrder(values, order) {
  return values.slice().sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    const safeIa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
    const safeIb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
    if (safeIa !== safeIb) return safeIa - safeIb;
    return String(a).localeCompare(String(b));
  });
}

/* ------------------------- taxonomy config ------------------------- */
/*
  Based on the HO-owned risk areas in:
  130226 - HO AI Risk Register - UK OFFICIAL-SENSITIVE INTERNAL ONLY.xlsx
*/

const RISK_AREAS = {
  FINANCIAL_CRIME: "AI use in financial crime, fraud and exploitation",
  SEXUAL_CRIME_ABUSE: "AI Use for Sexual Crime and Abuse",
  TERRORISM: "AI use in terrorism",
  ILLEGAL_ITEMS: "AI increases illegal item creation and acquisition",
  OTHER: "Other",
};

const RISK_AREA_ORDER = [
  RISK_AREAS.FINANCIAL_CRIME,
  RISK_AREAS.SEXUAL_CRIME_ABUSE,
  RISK_AREAS.TERRORISM,
  RISK_AREAS.ILLEGAL_ITEMS,
  RISK_AREAS.OTHER,
];

const MECHANISMS = {
  SYNTHETIC_MEDIA: "Synthetic media / realistic fake",
  OFFENDER_UPLIFT: "Offender capability uplift",
  AUTOMATION_SCALE: "Automation / scale",
  TARGETING: "Targeting / personalisation",
  MODEL_EVASION: "Model misuse / evasion",
  OTHER: "Other / mixed",
};

const MECHANISM_ORDER = [
  MECHANISMS.SYNTHETIC_MEDIA,
  MECHANISMS.OFFENDER_UPLIFT,
  MECHANISMS.AUTOMATION_SCALE,
  MECHANISMS.TARGETING,
  MECHANISMS.MODEL_EVASION,
