function sendJson(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

export default function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    const key =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.VITE_GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.GOOGLE_GENAI_API_KEY?.trim() ||
      null;

    const hasApiKey = Boolean(key && key !== 'MY_GEMINI_API_KEY');

    return sendJson(res, 200, {
      name: 'MUSTAFA AI Chatbot API (2026)',
      status: 'online',
      hasApiKey,
      endpoints: ['/api/chat', '/api/health'],
    });
  } catch (err) {
    return sendJson(res, 500, {
      status: 'error',
      error: err?.message || 'API root failed.',
    });
  }
}
