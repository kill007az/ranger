const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:8081' }));
app.use(express.json());

app.all('/notion/{*path}', async (req, res) => {
  const notionPath = req.path.replace('/notion', '');
  const url = `https://api.notion.com/v1${notionPath}`;

  const headers = {
    'Authorization': req.headers['authorization'] ?? '',
    'Notion-Version': req.headers['notion-version'] ?? '2022-06-28',
    'Content-Type': 'application/json',
  };

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`[proxy] Notion proxy running on http://localhost:${PORT}`));
