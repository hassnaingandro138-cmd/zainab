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

    const now = new Date();
    const day = String(now.getUTCDate()).padStart(2, '0');
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const year = now.getUTCFullYear();

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return sendJson(res, 200, {
      status: 'ok',
      hasApiKey,
      defaultModel: 'gemini-3.1-flash-lite',
      platform: 'vercel-serverless',
      serverDate: `${day}-${month}-${year}`,
      year,
    });
  } catch (err) {
    return sendJson(res, 500, {
      status: 'error',
      error: err?.message || 'Health check failed.',
    });
  }
}
