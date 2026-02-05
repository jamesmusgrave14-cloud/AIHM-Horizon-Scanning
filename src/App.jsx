// src/App.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ExternalLink, RefreshCw, ShieldAlert, Cpu } from 'lucide-react';

// ------------------------------
// Category → Query configuration
// (Used when you later enable /api/gnews; safe to keep in UI.)
// ------------------------------
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

// ------------------------------
// Dummy items (so the demo always shows content)
// ------------------------------
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

// ------------------------------
// Small card component
// ------------------------------
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
      <p className="text-slate-400 text-xs line-clamp-2 mb-3">{article.description}</p>
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

// ------------------------------
// Main App
// ------------------------------
export default function App() {
  const [harmNews, setHarmNews] = useState([]);
  const [techNews, setTechNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const normalize = (arr, type) =>
    (Array.isArray(arr) ? arr : []).map((a) => ({
      title: a.title ?? '',
      description: a.description ?? '',
      url: a.url ?? '#',
      image: a.image ?? '',
      publishedAt: a.publishedAt ?? '',
      source: { name: a?.source?.name ?? 'Unknown' },
      category: a.category ?? '',
