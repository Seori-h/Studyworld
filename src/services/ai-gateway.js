import { HttpError } from '../lib/http.js';

const DEFAULT_TIMEOUT_MS = 18_000;
const PDF_TIMEOUT_MS = 35_000;
const MAX_ATTEMPTS = 3;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function providerConfig(env) {
  const explicit = String(env.AI_PROVIDER || '').trim().toLowerCase();
  const genericKey = String(env.AI_API_KEY || '').trim();
  const inferred = explicit || (env.OPENAI_API_KEY ? 'openai' : env.GEMINI_API_KEY ? 'gemini' : '');
  if (!['openai', 'gemini'].includes(inferred)) {
    throw new HttpError(503, 'AI_NOT_CONFIGURED', 'AI 제공자 설정이 필요합니다.');
  }
  if (inferred === 'openai') {
    const apiKey = genericKey || String(env.OPENAI_API_KEY || '').trim();
    const model = String(env.OPENAI_MODEL || env.AI_MODEL || '').trim();
    if (!apiKey || !model) throw new HttpError(503, 'AI_NOT_CONFIGURED', 'OpenAI API 키와 모델 설정이 필요합니다.');
    return { provider: 'openai', apiKey, model };
  }
  const apiKey = genericKey || String(env.GEMINI_API_KEY || '').trim();
  const model = String(env.GEMINI_MODEL || env.AI_MODEL || '').trim();
  if (!apiKey || !model) throw new HttpError(503, 'AI_NOT_CONFIGURED', 'Gemini API 키와 모델 설정이 필요합니다.');
  return { provider: 'gemini', apiKey, model };
}

function shouldRetry(status) { return status === 408 || status === 409 || status === 429 || status >= 500; }

async function fetchWithRetry(url, init, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) return response;
      const errorText = (await response.text()).slice(0, 1000);
      const error = new HttpError(response.status, 'AI_UPSTREAM_ERROR', `AI 제공자가 ${response.status} 오류를 반환했습니다.`);
      error.upstreamBody = errorText;
      if (!shouldRetry(response.status) || attempt === MAX_ATTEMPTS) throw error;
      lastError = error;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const retryable = error?.name === 'AbortError' || error?.code === 'AI_UPSTREAM_ERROR' || error instanceof TypeError;
      if (!retryable || attempt === MAX_ATTEMPTS) {
        if (error?.name === 'AbortError') throw new HttpError(504, 'AI_TIMEOUT', 'AI 응답 시간이 초과되었습니다.');
        throw error;
      }
    }
    await sleep(attempt === 1 ? 250 : 800);
  }
  throw lastError || new HttpError(502, 'AI_UPSTREAM_ERROR', 'AI 요청에 실패했습니다.');
}

function outputTextFromOpenAI(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (typeof part?.text === 'string' && part.text.trim()) return part.text.trim();
    }
  }
  return '';
}

function outputTextFromGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('').trim();
}

function parseJsonText(text) {
  try { return JSON.parse(text); } catch (_error) {
    throw new HttpError(502, 'AI_SCHEMA_INVALID', 'AI가 올바른 구조의 응답을 만들지 못했습니다.');
  }
}

function usageFromOpenAI(data) {
  return {
    inputTokens: Number(data?.usage?.input_tokens || 0),
    outputTokens: Number(data?.usage?.output_tokens || 0),
  };
}

function usageFromGemini(data) {
  return {
    inputTokens: Number(data?.usageMetadata?.promptTokenCount || 0),
    outputTokens: Number(data?.usageMetadata?.candidatesTokenCount || 0),
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

export class AiGateway {
  constructor(env) {
    this.env = env;
    this.config = providerConfig(env);
  }

  info() { return { provider: this.config.provider, model: this.config.model }; }

  async structured({ system, user, schema, schemaName, maxOutputTokens = 1800 }) {
    return this.config.provider === 'openai'
      ? this.#openAiStructured({ system, user, schema, schemaName, maxOutputTokens })
      : this.#geminiStructured({ system, user, schema, maxOutputTokens });
  }

  async pdfStructured({ system, prompt, fileName, buffer, schema, schemaName, maxOutputTokens = 4500 }) {
    return this.config.provider === 'openai'
      ? this.#openAiPdf({ system, prompt, fileName, buffer, schema, schemaName, maxOutputTokens })
      : this.#geminiPdf({ system, prompt, buffer, schema, maxOutputTokens });
  }

  async #openAiStructured({ system, user, schema, schemaName, maxOutputTokens }) {
    const body = {
      model: this.config.model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_output_tokens: maxOutputTokens,
      store: false,
      text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
    };
    const response = await fetchWithRetry('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const text = outputTextFromOpenAI(data);
    if (!text) throw new HttpError(502, 'AI_EMPTY_RESPONSE', 'AI가 빈 응답을 반환했습니다.');
    return { data: parseJsonText(text), usage: usageFromOpenAI(data), providerRequestId: data?.id || '' };
  }

  async #geminiStructured({ system, user, schema, maxOutputTokens }) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        maxOutputTokens,
      },
    };
    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.config.apiKey },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const text = outputTextFromGemini(data);
    if (!text) throw new HttpError(502, 'AI_EMPTY_RESPONSE', 'AI가 빈 응답을 반환했습니다.');
    return { data: parseJsonText(text), usage: usageFromGemini(data), providerRequestId: data?.responseId || '' };
  }

  async #openAiPdf({ system, prompt, fileName, buffer, schema, schemaName, maxOutputTokens }) {
    const fileData = `data:application/pdf;base64,${arrayBufferToBase64(buffer)}`;
    const body = {
      model: this.config.model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: [
          { type: 'input_file', filename: fileName, file_data: fileData },
          { type: 'input_text', text: prompt },
        ] },
      ],
      max_output_tokens: maxOutputTokens,
      store: false,
      text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
    };
    const response = await fetchWithRetry('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(body),
    }, PDF_TIMEOUT_MS);
    const data = await response.json();
    const text = outputTextFromOpenAI(data);
    if (!text) throw new HttpError(502, 'AI_EMPTY_RESPONSE', 'AI가 PDF에서 읽기용 텍스트를 추출하지 못했습니다.');
    return { data: parseJsonText(text), usage: usageFromOpenAI(data), providerRequestId: data?.id || '' };
  }

  async #geminiPdf({ system, prompt, buffer, schema, maxOutputTokens }) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: 'application/pdf', data: arrayBufferToBase64(buffer) } },
        { text: prompt },
      ] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        maxOutputTokens,
      },
    };
    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.config.apiKey },
      body: JSON.stringify(body),
    }, PDF_TIMEOUT_MS);
    const data = await response.json();
    const text = outputTextFromGemini(data);
    if (!text) throw new HttpError(502, 'AI_EMPTY_RESPONSE', 'AI가 PDF에서 읽기용 텍스트를 추출하지 못했습니다.');
    return { data: parseJsonText(text), usage: usageFromGemini(data), providerRequestId: data?.responseId || '' };
  }
}

export function aiConfigurationStatus(env) {
  try {
    const config = providerConfig(env);
    return { configured: true, provider: config.provider, model: config.model };
  } catch (_error) {
    return { configured: false, provider: null, model: null };
  }
}
