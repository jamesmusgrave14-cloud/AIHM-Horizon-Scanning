import React, { useState, useMemo } from 'react';
import { Search, ShieldAlert, Calendar, ChevronRight, AlertCircle, Filter } from 'lucide-react';

// --- DATA SOURCE ---
// In a real setup, this would load from your data.json file.
const DATA = [
  { id: 1, date: '2024-05-22', title: 'AI-Enhanced Phishing Campaign Targets Healthcare Executives', category: 'Fraud', threat: 4, description: 'New reports show LLMs being used to craft highly personalized spear-phishing emails that bypass traditional spam filters by mimicking internal corporate tone.' },
  { id: 2, date: '2024-05-20', title: 'Deepfake Audio Used in CEO Impersonation Scam', category: 'Fraud', threat: 5, description: 'Criminals successfully cloned a senior directors voice to authorize an emergency wire transfer of £250,000.' },
  { id: 3, date: '2024-05-18', title: 'Mass Automation of Disinformation Bots on X', category: 'Disinfo', threat: 3, description: 'A network of 5,000 AI-managed accounts was discovered spreading conflicting health advice to sow public distrust.' }
];

export default function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");
  const [minThreat, setMinThreat] = useState(1);
  const [limit, setLimit] = useState(10);

  // This logic does the "Filtering" automatically as you type
  const filteredData = useMemo(() => {
    return DATA.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = category === "All" || item.category === category;
      const matchesThreat = item.threat >= minThreat;
      return matchesSearch && matchesCat && matchesThreat;
    }).slice(0, limit);
  }, [searchTerm, category, minThreat, limit]);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR - All your controls in one clean place */}
      <aside style={{ width: '320px', backgroundColor: 'white', borderRight: '1px solid #e5e7eb', padding: '24px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={24} /> AIHM Scanner
          </h1>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Horizon Scanning: Criminal Misuse</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Search Intelligence</label>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} size={18} />
              <input 
                type="text" placeholder="e.g. 'Fraud'..." 
                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Harm Category</label>
            <select 
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6' }}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="Fraud">Fraud & Scams</option>
              <option value="Disinfo">Disinformation</option>
              <option value="Cyber">Cyber Attacks</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Min Threat Level: {minThreat}</label>
            <input 
              type="range" min="1" max="5" value={minThreat} 
              style={{ width: '100%', accentColor: '#4f46e5' }}
              onChange={(e) => setMinThreat(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Number of Results</label>
            <input 
              type="number" value={limit} 
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
        </div>
      </aside>

      {/* MAIN FEED - Clear and simple list */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>Latest Intelligence</h2>
            <p style={{ color: '#6b7280' }}>Showing {filteredData.length} focused signals</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredData.length > 0 ? filteredData.map(item => (
              <div key={item.id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ 
                    fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase',
                    backgroundColor: item.threat >= 4 ? '#fee2e2' : '#e0e7ff',
                    color: item.threat >= 4 ? '#b91c1c' : '#4338ca'
                  }}>
                    Level {item.threat} • {item.category}
                  </span>
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> {item.date}
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6' }}>{item.description}</p>
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', fontSize: '14px', color: '#4f46e5', fontWeight: '600', cursor: 'pointer' }}>
                  Read Source Analysis <ChevronRight size={16} />
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '60px', border: '2px dashed #d1d5db', borderRadius: '12px' }}>
                <AlertCircle style={{ color: '#9ca3af', margin: '0 auto 12px' }} size={48} />
                <p style={{ color: '#6b7280' }}>No signals found for these filters.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
