import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const VALID_MODELS = new Set([
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
]);

export function getGeminiApiKey(): string | null {
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

export function getAiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured in Vercel. Please add GEMINI_API_KEY in your Vercel Project Settings > Environment Variables, then redeploy.'
    );
    (err as any).statusCode = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function normalizeModel(requestedModel?: string): string {
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

export function extractReadableErrorMessage(error: any): string {
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

export function formatGeminiError(error: any): { status: number; message: string } {
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
      message: 'The selected Gemini model was not found. Please choose Gemini 3.1 Flash Lite or Gemini 4 Hydrogen in Settings.',
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

export function isTransientUnavailable(error: any): boolean {
  const status = error?.status || error?.statusCode;
  const msg = String(error?.message || '');
  return status === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('timed out');
}

export function buildRequestParams(body: any) {
  const { messages, systemInstruction, model } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    const err = new Error('Messages array is required and cannot be empty.');
    (err as any).statusCode = 400;
    throw err;
  }

  const normalizedModel = normalizeModel(model);
  const formattedContents = messages
    .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0)
    .map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  if (formattedContents.length === 0) {
    const err = new Error('At least one non-empty message is required.');
    (err as any).statusCode = 400;
    throw err;
  }

  const config: Record<string, any> = {};
  if (typeof systemInstruction === 'string' && systemInstruction.trim().length > 0) {
    config.systemInstruction = systemInstruction.trim();
  }
  if (normalizedModel === 'gemini-4-hydrogen') {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  return {
    model: normalizedModel,
    contents: formattedContents,
    config,
  };
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error('Model response timed out, switching to fast model.');
      (err as any).statusCode = 503;
      reject(err);
    }, ms);
    promise.then(
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

export async function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  // Handle incoming stream body if not pre-parsed
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: any) => {
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

// Handler for /api/chat
export async function handleChatRequest(req: any, res: any) {
  try {
    const body = await parseRequestBody(req);

    // Support streaming requested via query param or Accept header
    const wantsStream =
      req.query?.stream === 'true' ||
      req.headers?.['accept']?.includes('text/event-stream');

    if (wantsStream) {
      return handleStreamRequest(req, res);
    }

    const ai = getAiClient();
    const { model, contents, config } = buildRequestParams(body);

    let activeModel = model;
    let response;
    try {
      const call = ai.models.generateContent({
        model: activeModel,
        contents,
        config,
      });
      response = activeModel !== 'gemini-3.1-flash-lite' ? await withTimeout(call, 3500) : await call;
    } catch (err: any) {
      if ((isTransientUnavailable(err) || err?.statusCode === 503) && activeModel !== 'gemini-3.1-flash-lite') {
        activeModel = 'gemini-3.1-flash-lite';
        const fallbackConfig = { ...config };
        delete fallbackConfig.thinkingConfig;
        response = await ai.models.generateContent({
          model: activeModel,
          contents,
          config: fallbackConfig,
        });
      } else {
        throw err;
      }
    }

    const aiResponseText = response.text || 'I apologize, I could not generate a response.';
    return res.status(200).json({ success: true, text: aiResponseText, model: activeModel });
  } catch (error: any) {
    console.error('Gemini API Error (/api/chat):', error);
    const { status, message } = formatGeminiError(error);
    return res.status(status).json({
      success: false,
      error: message,
    });
  }
}

// Handler for /api/chat/stream
export async function handleStreamRequest(req: any, res: any) {
  let headersSent = false;
  try {
    const body = await parseRequestBody(req);
    const ai = getAiClient();
    const { model, contents, config } = buildRequestParams(body);

    let activeModel = model;
    let stream;
    try {
      const call = ai.models.generateContentStream({
        model: activeModel,
        contents,
        config,
      });
      stream = activeModel !== 'gemini-3.1-flash-lite' ? await withTimeout(call, 3500) : await call;
    } catch (err: any) {
      if ((isTransientUnavailable(err) || err?.statusCode === 503) && activeModel !== 'gemini-3.1-flash-lite') {
        activeModel = 'gemini-3.1-flash-lite';
        const fallbackConfig = { ...config };
        delete fallbackConfig.thinkingConfig;
        stream = await ai.models.generateContentStream({
          model: activeModel,
          contents,
          config: fallbackConfig,
        });
      } else {
        throw err;
      }
    }

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
    res.end();
  } catch (error: any) {
    console.error('Gemini API Error (/api/chat/stream):', error);
    const { status, message } = formatGeminiError(error);
    if (!headersSent) {
      return res.status(status).json({
        success: false,
        error: message,
      });
    }
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
}
