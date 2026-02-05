// src/App.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ExternalLink, RefreshCw, ShieldAlert, Cpu } from 'lucide-react';

/**
 * Category -> Query config.
 * These are only used IF you later add /api/gnews (a Vercel serverless function).
 */
const HARM_CATEGORIES = {
  'Fraud & Scams': '"deepfake scam" OR "AI voice cloning fraud" OR "AI phishing"',
  'Cybercrime': '"ai cyberattack" OR "automated phishing" OR "llm malware"',
  'Identity Theft': '"ai identity theft" OR "synthetic identity" OR "biometric fraud"',
  'Bias & Rights': '"AI bias" OR "algorithmic discrimination" OR "facial recognition bias"',
};

const TECH_CATEGORIES = {
  'Model Releases': '"LLM release" OR "GPT-5" OR "Claude 4" OR "Gemini AI"',
  'Policy & Law': '"AI regulation" OR "AI Act" OR "government AI policy"',
  'Innovation': '"AI breakthrough" OR "robotics update" OR "multimodal model"',
  'Agentic AI': '"AI agents" OR "autonomous AI" OR "agentic workflows"',
};

/**
 * Dummy items so the demo always shows content (even with no backend).
 */
const DUMMY_ITEMS = [
  {
    title: 'Synthetic audio used in executive impersonation case',
    description: 'Investigators reported voice simulation used to authorise a transfer.',
    url: '#',
    image: '',
    publishedAt: '2026-02-03T09:00:00Z',
    source: { name: 'Demo Source' },
    category: 'Fraud & Scams',
    type: 'harm',
  },
  {
    title: 'Adaptive malware variants spotted using automated tooling',
    description: 'Rapid iteration patterns consistent with automation observed in the wild.',
    url: '#',
    image: '',
    publishedAt: '2026-02-02T12:00:00Z',
    source: { name: 'Demo Source' },
    category: 'Cybercrime',
    type: 'harm',
  },
  {
    title: 'New agent tooling announced by a major lab',
    description: 'Release focuses on safe orchestration and evaluation hooks.',
    url: '#',
    image: '',
    publishedAt: '2026-02-01T17:30:00Z',
    source: { name: 'Demo Source' },
    category: 'Agentic AI',
    type: 'tech',
  },
  {
    title: 'Regulator signals upcoming guidance on frontier model evaluations',
    description: 'Consultation aims to align capability trials with risk management.',
    url: '#',
    image: '',
    publishedAt: '2026-02-03T14:00:00Z',
    source: { name: 'Demo Source' },
    category: 'Policy & Law',
    type: 'tech',
  },
];

/**
 * Small presentational card for an article.
 */
function NewsCard({ article }) {
  const when = article.publishedAt ? new Date(article.publishedAt) : null;
  const whenText = when ? when.toLocaleDateString() : '—';
  const tone =
    article.type === 'harm'
      ? { badge: 'bg-red-500/20 text-red-400', border: 'border-red-900/50 hover:border-red-500' }
      : { badge: 'bg-blue-500/20 text-blue-400', border: 'border-blue-900/50 hover:border-blue-500' };

  return (
    <div className={`p-4 rounded-lg border bg-slate-900 transition-all hover:scale-[1.01] ${tone.border}`}>
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${tone.badge}`}>
          {article.category}
        </span>
        <span className="text-slate-500 text-[10px]">{whenText}</span>
      </div>
      <h3 className="font-bold text-slate-100 text-sm leading-tight mb-2 line-clamp-2">
        {article.title}
      </h3>
      <p className="text-slate-400 text-xs line-clamp-2 mb-3">
        {article.description}
      </p>
      <a
        href={article.url || '#'}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white"
      >
        READ SOURCE <ExternalLink size={12} />
      </a>
    </div>
  );
}

/**
 * Main App.
 */
export default function App() {
  const [harmNews, setHarmNews] = useState([]);
  const [techNews, setTechNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Normalize upstream response shape to our card needs.
  const normalize = (arr, type) =>
    (Array.isArray(arr) ? arr : []).map((a) => ({
      title: a.title ?? '',
      description: a.description ?? '',
      url: a.url ?? '#',
      image: a.image ?? '',
      publishedAt: a.publishedAt ?? '',
      source: { name: a?.source?.name ?? 'Unknown' },
      category: a.category ?? '',
      type,
    }));

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError('');

    // Build parallel requests to a serverless endpoint (safe). If /api/gnews isn't present,
    // these will error and we fall back to dummy data below.
    const harmPromises = Object.entries(HARM_CATEGORIES).map(async ([label, query]) => {
      try {
        const r = await axios.get(`/api/gnews?q=${encodeURIComponent(query)}&lang=en&max=3`);
        const items = (r?.data?.articles || []).map((a) => ({ ...a, category: label, type: 'harm' }));
        return items;
      } catch {
        return [];
      }
    });

    const techPromises = Object.entries(TECH_CATEGORIES).map(async ([label, query]) => {
      try {
        const r = await axios.get(`/api/gnews?q=${encodeURIComponent(query)}&lang=en&max=3`);
        const items = (r?.data?.articles || []).map((a) => ({ ...a, category: label, type: 'tech' }));
        return items;
      } catch {
        return [];
      }
    });

    try {
      const allHarms = (await Promise.all(harmPromises)).flat();
      const allTech = (await Promise.all(techPromises)).flat();

      // Fallback to local dummy items if upstream is empty (rate limit, no function, etc.)
      const harms = allHarms.length ? normalize(allHarms, 'harm') : DUMMY_ITEMS.filter((i) => i.type === 'harm');
      const tech = allTech.length ? normalize(allTech, 'tech') : DUMMY_ITEMS.filter((i) => i.type === 'tech');

      harms.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      tech.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

      setHarmNews(harms);
      setTechNews(tech);
    } catch (e) {
      setError('Feed temporarily unavailable — showing placeholders.');
      setHarmNews(DUMMY_ITEMS.filter((i) => i.type === 'harm'));
      setTechNews(DUMMY_ITEMS.filter((i) => i.type === 'tech'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    <div className="min-h-screen bg-black text-slate-200 p-6 font-sans">
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white">
            AIHM‑HS <span className="text-red-600">01</span>
          </h1>
          <p className="text-slate-500 text-xs uppercase tracking-widest">
            AI Harm Monitoring & Horizon Scanning
          </p>
        </div>
        <button
          onClick={fetchNews}
          className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Error banner (non-blocking) */}
      {error && (
        <div className="mb-6 text-xs px-3 py-2 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-700/40">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-slate-500 font-bold uppercase tracking-widest text-sm">
            Initializing Scan...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* COLUMN 1: HARMS */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-l-4 border-red-600 pl-4 py-1">
              <ShieldAlert className="text-red-500" />
              <h2 className="text-xl font-bold">Harms & Incidents</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {harmNews.length === 0 ? (
                <p className="text-slate-500 text-sm">No items yet.</p>
              ) : (
                harmNews.map((article, i) => <NewsCard key={article.url || i} article={article} />)
              )}
            </div>
          </div>

          {/* COLUMN 2: CAPABILITIES / TECH */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-4 py-1">
              <Cpu className="text-blue-500" />
              <h2 className="text-xl font-bold">Capabilities & Releases</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {techNews.length === 0 ? (
                <p className="text-slate-500 text-sm">No items yet.</p>
              ) : (
                techNews.map((article, i) => <NewsCard key={article.url || i} article={article} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
