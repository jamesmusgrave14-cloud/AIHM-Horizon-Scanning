import React, { useEffect, useMemo, useState } from "react"; return "border-indigo-200 bg-indigo-50 text-indigo-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function subtypeChip(subtype) {
  const key = String(subtype || "").toLowerCase();
  if (key.includes("fraud") || key.includes("scam")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (key.includes("grooming") || key.includes("exploitation")) return "border-orange-200 bg-orange-50 text-orange-900";
  if (key.includes("synthetic-image")) return "border-pink-200 bg-pink-50 text-pink-900";
  if (key.includes("stalking") || key.includes("harassment")) return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
  if (key.includes("propaganda") || key.includes("radicalisation") || key.includes("recruitment")) {
    return "border-rose-200 bg-rose-50 text-rose-900";
  }
  if (key.includes("attack planning")) return "border-red-200 bg-red-50 text-red-900";
  if (key.includes("illegal items") || key.includes("drugs") || key.includes("firearms")) {
    return "border-violet-200 bg-violet-50 text-violet-900";
  }
  if (key.includes("cyber") || key.includes("ransomware") || key.includes("phishing")) {
    return "border-cyan-200 bg-cyan-50 text-cyan-900";
  }
  if (key.includes("evidence") || key.includes("identity")) return "border-indigo-200 bg-indigo-50 text-indigo-900";
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

/* ------------------------- small UI bits ------------------------- */

function NavItem({ icon, label, active, onClick, count }) {
  return (
    <button
      type="button"
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

function ViewHeader({ view, title, subtitle, right }) {
  const t = viewTheme(view);
  return (
    <div className={`card p-4 bg-gradient-to-b ${t.band} border ${t.border} ring-1 ${t.ring} bg-white/70 backdrop-blur`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-semibold ${t.accent}`}>{title}</div>
          <div className="text-sm text-[var(--muted)] mt-1">{subtitle}</div>
        </div>
        {right ? <div>{right}</div> : null}
      </div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[120px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="skeleton h-[280px]" />
        <div className="skeleton h-[280px]" />
      </div>
    </div>
  );
}

function ItemMetaBadges({ item }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {item?.category ? (
        <span className={`text-xs px-2 py-1 rounded-full border ${catChip(item.category)}`}>
          {item.category}
        </span>
      ) : null}
      {item?.mechanism ? (
        <span className={`text-xs px-2 py-1 rounded-full border ${mechanismChip(item.mechanism)}`}>
          {item.mechanism}
        </span>
      ) : null}
      {item?.harm_subtype ? (
        <span className={`text-xs px-2 py-1 rounded-full border ${subtypeChip(item.harm_subtype)}`}>
          {item.harm_subtype}
        </span>
      ) : null}
    </div>
  );
}

function ArticleCard({ item, label = "Harm" }) {
  return (
    <article className="card-hover border border-slate-100 rounded-2xl p-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-2 py-1">
            {label}
          </span>
          <span className="text-xs text-slate-500 font-mono">{fmtDateShort(item?.date)}</span>
        </div>

        {item?.uk_relevance ? (
          <span className="text-xs px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800">
            UK‑relevant
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
            Global
          </span>
        )}
      </div>

      <a
        href={item?.link || "#"}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block text-sm font-semibold hover:underline"
      >
        {item?.title || "Untitled"}
      </a>

      <ItemMetaBadges item={item} />

      <div className="mt-2 text-xs text-slate-500">
        {item?.source || "Unknown source"}
        {typeof item?.uk_score === "number" ? (
          <span className="ml-2 font-mono">uk_score {item.uk_score}</span>
        ) : null}
        {typeof item?.policy_score === "number" ? (
          <span className="ml-2 font-mono">policy {item.policy_score}</span>
        ) : null}
      </div>

      {item?.tags?.length ? (
        <div className="mt-2 text-xs text-slate-400">{item.tags.join(" · ")}</div>
      ) : null}
    </article>
  );
}

/* ------------------------- main views ------------------------- */

function HarmsView({
  categories,
  harms,
  coverage,
  summaries,
  openBuckets,
  toggleBucket,
  showN,
  showAiSummaries,
  harmsFocusCat,
  setHarmsFocusCat,
}) {
  const byCat = useMemo(() => {
    const m = new Map();
    for (const h of harms) {
      const c = h.category || "Other";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(h);
    }
    return m;
  }, [harms]);

  const catsToRender = harmsFocusCat === "All" ? categories : [harmsFocusCat];

  return (
    <div className="space-y-4">
      <ViewHeader
        view="harms"
        title="Harms (articles)"
        subtitle="Filtered towards policy, national security, and law-enforcement relevance."
        right={
          <span className="pill px-3 py-1 text-xs font-mono text-slate-600 bg-white/70">
            {harms.length} matches
          </span>
        }
      />

      <div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setHarmsFocusCat("All")}
            className={`text-sm px-3 py-1.5 rounded-full border transition ${
              harmsFocusCat === "All"
                ? "bg-rose-700 text-white border-rose-700"
                : "bg-white/70 hover:bg-white border-slate-200 text-slate-700"
            }`}
          >
            All categories
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setHarmsFocusCat(cat)}
              className={`text-sm px-3 py-1.5 rounded-full border ${catChip(cat)} ${
                harmsFocusCat === cat ? "ring-2 ring-rose-200" : ""
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="hr my-4" />

        <div className="space-y-3">
          {catsToRender.map((cat) => {
            const items = (byCat.get(cat) || []).slice(0, showN);
            const cov = coverage?.by_harm?.[cat] || {};
            const isOpen = openBuckets[cat] ?? true;

            return (
              <div key={cat} className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => toggleBucket(cat)}
                  className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {isOpen ? (
                      <ChevronDown size={16} className="text-slate-500" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-500" />
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full border ${catChip(cat)}`}>{cat}</span>
                    <span className="text-xs font-mono text-slate-600">
                      shown {items.length}
                      {typeof cov.uk_count === "number" ? ` · UK ${cov.uk_count}` : ""}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400">
                    {showAiSummaries && summaries?.harms_by_category?.[cat] ? "summary" : ""}
                  </span>
                </button>

                {isOpen ? (
                  <div className="p-4 bg-white">
                    {showAiSummaries && summaries?.harms_by_category?.[cat] ? (
                      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Sparkles size={14} />
                          AI summary
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          {summaries.harms_by_category[cat]}
                        </div>
                      </div>
                    ) : null}

                    {!items.length ? (
                      <div className="text-sm text-[var(--muted)]">
                        No items in this bucket with current filters.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {items.map((item, idx) => (
                          <ArticleCard key={`${item.link}-${idx}`} item={item} label="Harm" />
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SignalsView({ items, showAiSummaries, summaries }) {
  return (
    <div className="space-y-4">
      <ViewHeader
        view="signals"
        title="Signals (clusters)"
        subtitle="Grouped themes with multiple sources."
        right={
          <span className="pill px-3 py-1 text-xs font-mono text-slate-600 bg-white/70">
            {items.length} shown
          </span>
        }
      />

      {showAiSummaries && summaries?.signals_top ? (
        <div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles size={14} />
            AI summary
          </div>
          <div className="mt-1 text-sm text-slate-700">{summaries.signals_top}</div>
        </div>
      ) : null}

      <div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">
        {!items.length ? (
          <div className="text-sm text-[var(--muted)]">No signals match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((s) => (
              <article
                key={s.signal_id || `${s.title}-${s.latest_date}`}
                className="card-hover border border-slate-100 rounded-2xl p-4 bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-sky-700 bg-sky-50 border border-sky-100 rounded-full px-2 py-1">
                      Signal cluster
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${catChip(s.primary_category)}`}>
                      {s.primary_category || "Signal"}
                    </span>
                    {s.mechanism ? (
                      <span className={`text-xs px-2 py-1 rounded-full border ${mechanismChip(s.mechanism)}`}>
                        {s.mechanism}
                      </span>
                    ) : null}
                  </div>

                  <span className={`text-xs px-2 py-1 rounded-full border ${confidenceChip(s.confidence_label)}`}>
                    {s.confidence_label || "Low"}
                  </span>
                </div>

                <div className="mt-2 text-sm font-semibold leading-snug">{s.title}</div>

                {s.harm_subtype ? (
                  <div className="mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${subtypeChip(s.harm_subtype)}`}>
                      {s.harm_subtype}
                    </span>
                  </div>
                ) : null}

                {showAiSummaries && s.ai_summary ? (
                  <div className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{s.ai_summary}</div>
                ) : null}

                <div className="mt-2 text-xs text-slate-500 font-mono">
                  latest {fmtDateShort(s.latest_date)} · {s.source_count ?? 0} sources · {s.cluster_size ?? 0} items
                </div>

                <div className="mt-3 space-y-1">
                  {(s.links || []).slice(0, 5).map((l, i) => {
                    const st = String(l?.source_type || "news").toLowerCase();
                    const badge =
                      st === "forum"
                        ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900"
                        : "border-slate-200 bg-slate-50 text-slate-700";

                    return (
                      <a
                        key={`${l.link}-${i}`}
                        href={l.link || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-blue-700 hover:underline"
                      >
                        <span className={`mr-2 inline-flex text-[10px] px-2 py-1 rounded-full border ${badge}`}>
                          {st.toUpperCase()}
                        </span>
                        {l.source}: {l.title}
                      </a>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ForumsView({ items }) {
  return (
    <div className="space-y-4">
      <ViewHeader
        view="forums"
        title="Forums (posts)"
        subtitle="Forum posts tagged to a harm category."
        right={
          <span className="pill px-3 py-1 text-xs font-mono text-slate-600 bg-white/70">
            {items.length} shown
          </span>
        }
      />

      <div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">
        {!items.length ? (
          <div className="text-sm text-[var(--muted)]">No forum items match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((item, idx) => (
              <ArticleCard key={`${item.link}-${idx}`} item={item} label="Forum post" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReleasesView({ items, showAiSummaries, summaries }) {
  return (
    <div className="space-y-4">
      <ViewHeader
        view="releases"
        title="Model releases"
        subtitle="Model releases / model cards / system cards."
        right={
          <span className="pill px-3 py-1 text-xs font-mono text-slate-600 bg-white/70">
            {items.length} shown
          </span>
        }
      />

      {showAiSummaries && summaries?.releases_top ? (
        <div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles size={14} />
            AI summary
          </div>
          <div className="mt-1 text-sm text-slate-700">{summaries.releases_top}</div>
        </div>
      ) : null}

      <div className="card p-4 bg-white/80 backdrop-blur border border-slate-200">
        {!items.length ? (
          <div className="text-sm text-[var(--muted)]">
            No model releases match your filters (try widening RELEASE_TIME_WINDOW or removing category filter).
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((r, i) => (
              <a
                key={`${r.link}-${i}`}
                href={r.link || "#"}
                target="_blank"
                rel="noreferrer"
                className="block card-hover border border-slate-100 rounded-2xl p-4 bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-1">
                      Release
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-900">
                      Model release
                    </span>
                  </div>

                  <span className="text-xs text-slate-500 font-mono">{fmtDateShort(r.date)}</span>
                </div>

                <div className="mt-2 text-sm font-semibold">{r.title}</div>
                <div className="mt-1 text-xs text-slate-500">{r.source}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- main app ---------------------------- */

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
      const raw = localStorage.getItem("aihm_ui_prefs_v9");
      if (!raw) return;
      const p = JSON.parse(raw);
      const allowed = new Set(["harms", "signals",
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
  Sparkles,
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

function confidenceChip(level) {
  if (level === "High") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (level === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function catChip(cat) {
  const key = String(cat || "").toLowerCase();
  if (key.includes("fraud")) return "border-amber-200 bg-amber-50 text-amber-800";
  if (key.includes("cyber")) return "border-cyan-200 bg-cyan-50 text-cyan-900";
  if (key.includes("terror")) return "border-rose-200 bg-rose-50 text-rose-900";
  if (key.includes("vawg")) return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
  if (key.includes("csam") || key.includes("child")) return "border-violet-200 bg-violet-50 text-violet-900";
  if (key.includes("model")) return "border-indigo-200 bg-indigo-50 text-indigo-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function mechanismChip(mechanism) {
  const key = String(mechanism || "").toLowerCase();
  if (key.includes("synthetic")) return "border-pink-200 bg-pink-50 text-pink-900";
  if (key.includes("offender")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (key.includes("automation") || key.includes("scale")) return "border-violet-200 bg-violet-50 text-violet-900";
  if (key.includes("targeting")) return "border-cyan-200 bg-cyan-50 text-cyan-900";
