import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_KEY = import.meta.env.VITE_GNEWS_KEY;

function App() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await axios.get(`https://gnews.io/api/v4/search?q="AI harm" OR "AI incident" OR "AI breakthrough"&lang=en&max=10&apikey=${API_KEY}`);
        setNews(res.data.articles);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #334155', marginBottom: '20px', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>🛡️ AIHM-HS PROOF OF CONCEPT</h1>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>LIVE MONITORING ACTIVE</p>
      </header>

      {loading ? <p>Scanning Horizon...</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {news.map((article, i) => (
            <div key={i} style={{ border: '1px solid #1e293b', padding: '15px', borderRadius: '8px', backgroundColor: '#1e293b' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>{article.title}</h3>
              <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '15px' }}>{article.description}</p>
              <a href={article.url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}>READ ARTICLE →</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;