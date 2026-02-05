import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldAlert, Search, LayoutDashboard, Ghost, 
  Fingerprint, Zap, Scale, FileWarning, Menu, X, ExternalLink 
} from 'lucide-react';

const CATEGORY_QUERIES = {
  'All': 'ai crime OR "deepfake fraud" OR "algorithmic bias" OR "ai extortion"',
  'Deepfakes': '"deepfake fraud" OR "voice cloning crime" OR "synthetic media scam"',
  'Cybercrime': '"ai cyberattack" OR "automated phishing" OR "llm malware"',
  'Identity Theft': '"ai identity theft" OR "biometric fraud" OR "synthetic identity"',
  'Algorithmic Bias': '"algorithmic discrimination" OR "ai bias lawsuit" OR "automated redlining"',
  'Extortion': '"ai extortion" OR "automated blackmail" OR "deepfake revenge porn"',
  'Safety Reports': '"ai safety failure" OR "llm jailbreak incident" OR "ai model leak"',
};

export default function App() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchLiveReports = async () => {
      setLoading(true);
      const query = searchTerm || CATEGORY_QUERIES[selectedCategory];
      const url = `/api/news?query=${encodeURIComponent(query)}`;

      try {
        const response = await axios.get(url);
        const formattedData = response.data.articles.map((art, index) => ({
          id: index,
          category: selectedCategory,
          title: art.title,
          status: art.description?.includes('fraud') ? 'High' : 'Medium',
          date: art.publishedAt.split('T')[0],
          description: art.description,
          source: art.source.name,
          url: art.url,
          image: art.image
        }));
        setIncidents(formattedData);
      } catch (error) {
        console.error("API Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveReports();
  }, [selectedCategory, searchTerm]);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col`}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg"><ShieldAlert size={24} /></div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight uppercase">AI Harms Monitoring</span>}
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {Object.keys(CATEGORY_QUERIES).map((catName) => (
            <button
              key={catName}
              onClick={() => setSelectedCategory(catName)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                selectedCategory === catName ? 'bg-red-600 text-white shadow-lg' : 'hover:bg-gray-700 text-gray-400'
              }`}
            >
              {catName === 'All' ? <LayoutDashboard size={20}/> : <Ghost size={20}/>}
              {isSidebarOpen && <span className="font-medium">{catName}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-8">
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-700 rounded-lg">
              {isSidebarOpen ? <X size={20}/> : <Menu size={20}/>}
            </button>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Search AI crime keywords (e.g., 'scam', 'malware')..."
                className="w-full bg-gray-900 border border-gray-700 rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-red-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        <section className="p-8 overflow-y-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold">{selectedCategory} Monitoring</h1>
              <p className="text-gray-400 mt-1">Live data feed for AI-related criminal forensics.</p>
            </div>
            {loading && <div className="animate-pulse text-red-500 font-mono">SCANNING LIVE FEED...</div>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incidents.map(incident => (
              <div key={incident.id} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden hover:border-red-500 transition-all flex flex-col">
                {incident.image && <img src={incident.image} className="h-40 w-full object-cover opacity-60" alt="News" />}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-red-500/20 text-red-500 uppercase tracking-tighter">
                      {incident.status} Threat
                    </span>
                    <span className="text-xs text-gray-500">{incident.date}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2 leading-tight">{incident.title}</h3>
                  <p className="text-gray-400 text-sm line-clamp-3 mb-4">{incident.description}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-gray-700 pt-4">
                    <span className="text-xs font-mono text-gray-500 uppercase">{incident.source}</span>
                    <a href={incident.url} target="_blank" rel="noreferrer" className="text-red-400 hover:text-red-300 flex items-center gap-1 text-sm">
                      Full Evidence <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
