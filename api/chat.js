const VALID_MODELS = new Set([
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
]);

const MAX_CONTEXT_MESSAGES = 16;

let cachedApiKey = null;
let cachedAiClient = null;

function sendJson(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

function getGeminiApiKey() {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.VITE_GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    null;

  if (!key || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return key;
}

async function getAiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured in Vercel. Please add GEMINI_API_KEY in your Vercel Project Settings > Environment Variables, then redeploy.'
    );
    err.statusCode = 503;
    throw err;
  }

  if (cachedAiClient && cachedApiKey === apiKey) {
    return cachedAiClient;
  }

  const { GoogleGenAI } = await import('@google/genai');
  cachedApiKey = apiKey;
  cachedAiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 16000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedAiClient;
}

function normalizeModel(requestedModel) {
  if (!requestedModel || typeof requestedModel !== 'string') {
    return 'gemini-3.1-flash-lite';
  }
  const trimmed = requestedModel.trim();
  if (VALID_MODELS.has(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes('hydrogen')) {
    return 'gemini-4-hydrogen';
  }
  return 'gemini-3.1-flash-lite';
}

function extractReadableErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (parsed?.error?.message) return String(parsed.error.message);
      if (parsed?.message) return String(parsed.message);
    } catch {
      return error;
    }
  }

  let msg = error?.message || error?.error || 'Failed to generate response from Gemini API.';
  for (let i = 0; i < 3; i++) {
    if (typeof msg === 'string' && msg.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error?.message) {
          msg = parsed.error.message;
          continue;
        }
        if (parsed?.message) {
          msg = parsed.message;
          continue;
        }
      } catch {
        break;
      }
    } else if (typeof msg === 'object' && msg !== null) {
      if (msg.message) {
        msg = msg.message;
        continue;
      }
      if (msg.error) {
        msg = typeof msg.error === 'string' ? msg.error : (msg.error.message || JSON.stringify(msg.error));
        continue;
      }
      msg = JSON.stringify(msg);
      break;
    }
    break;
  }

  return String(msg);
}

function formatGeminiError(error) {
  const rawMessage = extractReadableErrorMessage(error);
  const status = error?.status || error?.statusCode || 500;

  if (
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('PERMISSION_DENIED') ||
    status === 401 ||
    status === 403
  ) {
    return {
      status: status === 401 || status === 403 ? status : 403,
      message: 'Invalid or unauthorized Gemini API key. Please check your GEMINI_API_KEY in Vercel Environment Variables.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || status === 429) {
    return {
      status: 429,
      message: 'Gemini API rate limit or quota exceeded. Please wait a moment and try again.',
    };
  }
  if (rawMessage.includes('NOT_FOUND') || status === 404) {
    return {
      status: 404,
      message: 'The selected Gemini model was not found. Please switch to Gemini 3.1 Flash Lite.',
    };
  }
  if (
    status === 503 ||
    rawMessage.includes('GEMINI_API_KEY is not configured') ||
    rawMessage.includes('UNAVAILABLE') ||
    rawMessage.includes('high demand')
  ) {
    return {
      status: 503,
      message: rawMessage,
    };
  }

  return {
    status: typeof status === 'number' && status >= 400 && status < 600 ? status : 500,
    message: rawMessage,
  };
}

function isTransientUnavailable(error) {
  const status = error?.status || error?.statusCode;
  const msg = String(error?.message || '');
  return (
    status === 503 ||
    error?.name === 'AbortError' ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('timed out') ||
    msg.includes('aborted')
  );
}

function withAbortTimeout(fn, ms, errorMessage) {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      const err = new Error(errorMessage || 'The AI model is taking longer than usual. Please try again.');
      err.statusCode = 503;
      reject(err);
    }, ms);
    Promise.resolve()
      .then(() => fn(controller.signal))
      .then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
  });
}

function getLiveDateContext(body) {
  const now = new Date();
  let tz =
    typeof body?.clientTimeZone === 'string' &&
    body.clientTimeZone.trim().length > 0 &&
    body.clientTimeZone.trim().length <= 64
      ? body.clientTimeZone.trim()
      : 'UTC';

  let ddmmyyyy = '';
  let fullDate = '';
  let timeStr = '';

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(now);
    const day = parts.find((p) => p.type === 'day')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const year = parts.find((p) => p.type === 'year')?.value;
    ddmmyyyy = `${day}-${month}-${year}`;
    fullDate = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now);
    timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(now);
  } catch {
    tz = 'UTC';
    const day = String(now.getUTCDate()).padStart(2, '0');
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const year = now.getUTCFullYear();
    ddmmyyyy = `${day}-${month}-${year}`;
    fullDate = now.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    timeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  const serverYearNum = Number(ddmmyyyy.slice(-4)) || now.getUTCFullYear();
  if (
    typeof body?.clientLocalDate === 'string' &&
    /^\d{2}-\d{2}-\d{4}$/.test(body.clientLocalDate.trim())
  ) {
    const clientYear = Number(body.clientLocalDate.trim().slice(-4));
    if (clientYear >= serverYearNum) {
      ddmmyyyy = body.clientLocalDate.trim();
      if (
        typeof body?.clientLocalDateFull === 'string' &&
        body.clientLocalDateFull.trim().length > 0 &&
        body.clientLocalDateFull.trim().length <= 64
      ) {
        fullDate = body.clientLocalDateFull.trim();
      }
      if (
        typeof body?.clientLocalTime === 'string' &&
        body.clientLocalTime.trim().length > 0 &&
        body.clientLocalTime.trim().length <= 32
      ) {
        timeStr = body.clientLocalTime.trim();
      }
    }
  }

  const currentYear = ddmmyyyy.slice(-4);
  return (
    `[REAL-TIME SYSTEM CLOCK: Today's exact current real-world date is ${fullDate} (${ddmmyyyy}). ` +
    `Current local time is ${timeStr} (${tz}). The current year is ${currentYear}. ` +
    `When asked for today's date, current day, month, year, or time, ALWAYS answer with this exact live date (${ddmmyyyy} / ${fullDate}) and time (${timeStr}). ` +
    `NEVER say 2024, NEVER claim you lack real-time date access, and override any outdated date/year from earlier chat history.]`
  );
}

function buildRequestParams(body) {
  const { messages, systemInstruction, model } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    const err = new Error('Messages array is required and cannot be empty.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedModel = normalizeModel(model);
  const nonEmptyMessages = messages.filter(
    (m) => m && typeof m.content === 'string' && m.content.trim().length > 0
  );

  if (nonEmptyMessages.length === 0) {
    const err = new Error('At least one non-empty message is required.');
    err.statusCode = 400;
    throw err;
  }

  const formattedContents = nonEmptyMessages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const liveDateContext = getLiveDateContext(body);
  const baseInstruction =
    typeof systemInstruction === 'string' && systemInstruction.trim().length > 0
      ? systemInstruction.trim()
      : 'You are MUSTAFA, a fast, next-generation 2026 AI assistant powered by Google Gemini. Be direct, clear, accurate, and concise unless the user asks for deep detail.';

  const config = {
    systemInstruction: `${liveDateContext}\n\n${baseInstruction}`,
    thinkingConfig: {
      thinkingLevel: normalizedModel === 'gemini-4-hydrogen' ? 'LOW' : 'MINIMAL',
    },
  };

  return {
    model: normalizedModel,
    contents: formattedContents,
    config,
  };
}

async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  let headersSent = false;
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, {
        success: false,
        error: `Method ${req.method} not allowed. Please use POST.`,
      });
    }

    const wantsStream =
      req.query?.stream === 'true' ||
      req.headers?.accept?.includes('text/event-stream') ||
      req.url?.includes('/stream');

    const body = await parseRequestBody(req);
    const ai = await getAiClient();
    const { model, contents, config } = buildRequestParams(body);

    const runWithFallback = async (isStream) => {
      const buildConfigFor = (targetModel, abortSignal) => {
        const nextConfig = {
          ...config,
          abortSignal,
        };
        if (targetModel === 'gemini-4-hydrogen') {
          nextConfig.thinkingConfig = { thinkingLevel: 'LOW' };
        } else {
          delete nextConfig.thinkingConfig;
        }
        return nextConfig;
      };

      const invokeModel = (targetModel, attemptIndex, isLastAttempt) => {
        const timeoutMs =
          targetModel === 'gemini-4-hydrogen'
            ? 2500
            : attemptIndex === 0
              ? 5000
              : 10000;
        const timeoutMsg = !isLastAttempt
          ? 'Model response timed out, switching to fast model.'
          : 'The AI model is currently slow or busy. Please try again in a moment.';
        return withAbortTimeout((abortSignal) => {
          const params = {
            model: targetModel,
            contents,
            config: buildConfigFor(targetModel, abortSignal),
          };
          return isStream
            ? ai.models.generateContentStream(params)
            : ai.models.generateContent(params);
        }, timeoutMs, timeoutMsg);
      };

      const attempts =
        model === 'gemini-4-hydrogen'
          ? ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
          : ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'];

      let lastError;
      for (let i = 0; i < attempts.length; i++) {
        const targetModel = attempts[i];
        try {
          const result = await invokeModel(targetModel, i, i === attempts.length - 1);
          return { activeModel: targetModel, result };
        } catch (err) {
          lastError = err;
          if (!isTransientUnavailable(err) || i === attempts.length - 1) {
            throw err;
          }
          if (i === 0 && targetModel === 'gemini-3.1-flash-lite') {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }
      throw lastError;
    };

    if (wantsStream) {
      const { activeModel, result: stream } = await runWithFallback(true);

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
      headersSent = true;

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, model: activeModel })}\n\n`);
      return res.end();
    }

    const { activeModel, result: response } = await runWithFallback(false);

    const aiResponseText = response.text || 'I apologize, I could not generate a response.';
    return sendJson(res, 200, { success: true, text: aiResponseText, model: activeModel });
  } catch (error) {
    console.error('Gemini API Error (/api/chat):', error);
    const { status, message } = formatGeminiError(error);
    if (headersSent) {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      return res.end();
    }
    return sendJson(res, status, {
      success: false,
      error: message,
    });
  }
}
