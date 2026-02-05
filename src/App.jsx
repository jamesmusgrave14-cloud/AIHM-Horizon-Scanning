import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Zap, ExternalLink, RefreshCw, ShieldAlert, Cpu } from 'lucide-react';

const API_KEY = import.meta.env.VITE_GNEWS_KEY;

// --- DASHBOARD CONFIGURATION ---
const HARM_CATEGORIES = {
  'Physical & Safety': '"AI failure" OR "self-driving accident" OR "medical AI error"',
  'Fraud & Scams': '"deepfake scam" OR "AI voice cloning fraud" OR "AI phishing"',
  'Bias & Rights': '"AI bias" OR "facial recognition" OR "algorithmic discrimination"',
  'AI Incident DB': '"AI Incident Database" OR "AI incident report" OR "automated harm"'
};

const TECH_CATEGORIES = {
  'Model Releases': '"LLM release" OR "GPT-5" OR "Claude 4" OR "Gemini AI"',
  'Policy & Law': '"AI Act" OR "AI regulation" OR "government AI policy"',
  'Innovation': '"AI breakthrough" OR "robotics update" OR "quantum computing AI"',
  'Agentic AI': '"AI agents" OR "autonomous AI" OR "agentic workflows"'
};

function App() {
  const [harmNews, setHarmNews] = useState([]);
  const [techNews, setTechNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNews = async () => {
    setLoading(true);
    try {
      // Fetch Harms
      const harmPromises = Object.entries(HARM_CATEGORIES).map(([label, query]) => 
        axios.get(`https://gnews.io/api/v4/search?q=${query}&lang=en&max=3&apikey=${API_KEY}`)
          .then(res => res.data.articles.map(a => ({ ...a, category: label, type: 'harm' })))
      );

      // Fetch Tech
      const techPromises = Object.entries(TECH_CATEGORIES).map(([label, query]) => 
        axios.get(`https://gnews.io/api/v4/search?q=${query}&lang=en&max=3&apikey=${API_KEY}`)
          .then(res => res.data.articles.map(a => ({ ...a, category: label, type: 'tech' })))
      );

      const allHarms = (await Promise.all(harmPromises)).flat();
      const allTech = (await Promise.all(techPromises)).flat();

      setHarmNews(allHarms.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)));
      setTechNews(allTech.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)));
      setLoading(false);
    } catch (err) {
      setError("API limit reached or network error.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const NewsCard = ({ article }) => (
    <div className={`p-4 rounded-lg border bg-slate-900 transition-all hover:scale-[1.01] ${article.type === 'harm' ? 'border-red-900/50 hover:border-red-500' : 'border-blue-900/50 hover:border-blue-500'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${article.type === 'harm' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
          {article.category}
        </span>
        <span className="text-slate-500 text-[10px]">{new Date(article.publishedAt).toLocaleDateString()}</span>
      </div>
      <h3 className="font-bold text-slate-100 text-sm leading-tight mb-2 line-clamp-2">{article.title}</h3>
      <p className="text-slate-400 text-xs line-clamp-2 mb-3">{article.description}</p>
      <a href={article.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white">
        READ SOURCE <ExternalLink size={12} />
      </a>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-slate-200 p-6 font-sans">
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white">AIHM-HS <span className="text-red-600">01</span></h1>
          <p className="text-slate-500 text-xs uppercase tracking-widest">AI Harm Monitoring & Horizon Scanning</p>
        </div>
        <button onClick={fetchNews} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-slate-500 font-bold uppercase tracking-widest text-sm">Initializing Scan...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* COLUMN 1: HARMS */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-l-4 border-red-600 pl-4 py-1">
              <ShieldAlert className="text-red-500" />
              <h2 className="text-xl font