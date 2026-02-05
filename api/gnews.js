export default async function handler(req, res) {
  try {
    const { q = '', lang = 'en', max = '3' } = req.query || {};
    const key = process.env.GNEWS_KEY;

    if (!key) {
      return res.status(500).json({ error: 'Missing GNEWS_KEY' });
    }

    if (!q.trim()) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const url = new URL('https://gnews.io/api/v4/search');
    url.searchParams.set('q', q);
    url.searchParams.set('lang', lang);
    url.searchParams.set('max', max);
    url.searchParams.set('apikey', key);

    const response = await fetch(url);
    const data = await response.json();

    return res.status(200).json({
      articles: Array.isArray(data.articles) ? data.articles : []
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
