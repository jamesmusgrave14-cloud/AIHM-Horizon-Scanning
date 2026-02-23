import React, { useState, useMemo } from 'react';
import { Search, ShieldAlert, AlertTriangle, Activity, Users, Database, Filter, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// --- MOCK DATA (Matches your Criminal Harms focus) ---
const DATA = [
  { id: 1, date: '2024-05-22', title: 'AI-Enhanced Phishing Campaign', category: 'Fraud', threat: 4, description: 'LLMs used to craft personalized spear-phishing emails bypassing standard filters.' },
  { id: 2, date: '2024-05-20', title: 'Deepfake Audio CEO Scam', category: 'Fraud', threat: 5, description: 'Cloned voice used to authorize £250,000 wire transfer.' },
  { id: 3, date: '2024-05-18', title: 'Mass Disinformation Botnet', category: 'Disinfo', threat: 3, description: '5,000 AI-managed accounts spreading conflicting public safety advice.' },
  { id: 4, date: '2024-05-15', title: 'Polymorphic Malware Generation', category: 'Cyber', threat: 5, description: 'AI agent actively rewriting malware code to evade signature detection.' },
  { id: 5, date: '2024-05-12', title: 'Synthetic Identity Creation', category: 'Fraud', threat: 3, description: 'AI-generated faces and documents used to open fraudulent bank accounts.' },
];

export default function App() {
  // State for Navigation and Filters
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [minThreat, setMinThreat] = useState(1);
  const [limit, setLimit] = useState(50);

  // Filter Logic
  const filteredData = useMemo(() => {
    return DATA.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'Overview' || item.category === activeTab;
      const matchesThreat = item.threat >= minThreat;
      return matchesSearch && matchesTab && matchesThreat;
    }).slice(0, limit);
  }, [searchTerm, activeTab, minThreat, limit]);

  // Chart Data Logic for Overview
  const chartData = useMemo(() => {
    const counts = { Fraud: 0, Disinfo: 0, Cyber: 0 };
    DATA.forEach(item => { if (counts[item.category] !== undefined) counts[item.category]++; });
    return Object.keys(counts).map(key => ({ name: key, incidents: counts[key] }));
  }, []);

  // Reusable Stat Card Component (Now Clickable!)
  const StatCard = ({ title, count, icon: Icon, targetTab, color }) => (
    <button 
      onClick={() => setActiveTab(targetTab)}
      className={`flex-1 p-6 rounded-xl border text-left transition-all hover:shadow-md ${activeTab === targetTab ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'bg-white hover:border-indigo-300'}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase">{title}</p>
          <h3 className="text-3xl font-bold mt-2" style={{ color }}>{count}</h3>
        </div>
        <div className={`p-3 rounded-lg bg-opacity-20`} style={{ backgroundColor: `${color}20`, color }}>
          <Icon size={24} />
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 p-6 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3 text-indigo-700">
          <ShieldAlert size={32} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">AI Misuse Horizon Scanner</h1>
            <p className="text-xs text-gray-500 font-medium">Tracking Criminal Applications of AI</p>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* TABS & FILTERS BAR */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Tabs */}
          <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
            {['Overview', 'Fraud', 'Disinfo', 'Cyber'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                  activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" placeholder="Search threats..." 
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Min Threat:</span>
              <input 
                type="range" min="1" max="5" value={minThreat} 
                className="w-24 accent-indigo-600"
                onChange={(e) => setMinThreat(Number(e.target.value))}
              />
              <span className="text-sm font-bold w-4">{minThreat}</span>
            </div>
          </div>
        </div>

        {/* CONDITIONAL RENDER: OVERVIEW TAB */}
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            {/* Clickable Stat Cards */}
            <div className="flex flex-col md:flex-row gap-4">
              <StatCard title="Total Threats" count={DATA.length} icon={Activity} targetTab="Overview" color="#4f46e5" />
              <StatCard title="Fraud & Scams" count={DATA.filter(d => d.category === 'Fraud').length} icon={Users} targetTab="Fraud" color="#eab308" />
              <StatCard title="Disinformation" count={DATA.filter(d => d.category === 'Disinfo').length} icon={Database} targetTab="Disinfo" color="#3b82f6" />
              <StatCard title="Cyber Attacks" count={DATA.filter(d => d.category === 'Cyber').length} icon={AlertTriangle} targetTab="Cyber" color="#ef4444" />
            </div>

            {/* Chart Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold mb-6 text-gray-800">Incident Distribution by Category</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="incidents" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* THE FEED (Shows on all tabs, filtered accordingly) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">
              {activeTab === 'Overview' ? 'Recent Intelligence Feed' : `${activeTab} Intelligence`}
            </h3>
            <span className="text-xs text-gray-500 font-medium bg-gray-200 px-2 py-1 rounded-full">{filteredData.length} Results</span>
          </div>
          
          <div className="divide-y divide-gray-100">
            {filteredData.length > 0 ? filteredData.map(item => (
              <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      item.threat >= 4 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      Level {item.threat}
                    </span>
                    <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2 rounded">
                      {item.category}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400 font-medium">{item.date}</span>
                </div>
                
                <h4 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{item.title}</h4>
                <p className="text-gray-600 text-sm leading-relaxed max-w-4xl">{item.description}</p>
                
                <button className="mt-4 text-sm font-semibold text-indigo-500 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  View Full Analysis <ChevronRight size={16} />
                </button>
              </div>
            )) : (
              <div className="p-12 text-center">
                <Filter size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">No results match your current filters in this tab.</p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
