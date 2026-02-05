export default async function handler(req, res) {
  const { query = 'ai crime' } = req.query;

  if (!process.env.GNEWS_API_KEY) {
    return res.status(500).json({ error: 'GNews API key not configured' });
  }

  try {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&token=${process.env.GNEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'GNews API error');
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('API Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
}
