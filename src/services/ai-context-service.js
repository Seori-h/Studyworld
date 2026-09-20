import { HttpError } from '../lib/http.js';

const PLANET_KEY_PATTERN = /\bST-[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}\b/gi;
const SESSION_COOKIE_PATTERN = /\b__Host-sw_session\s*=\s*[^\s;]+/gi;
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{16,}\b/g;
const GOOGLE_API_KEY_PATTERN = /\bAIza[0-9A-Za-z_-]{25,}\b/g;
const GITHUB_TOKEN_PATTERN = /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g;
const AWS_ACCESS_KEY_PATTERN = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]{24,}={0,2}\b/gi;

const SECRET_PATTERNS = Object.freeze([
  PLANET_KEY_PATTERN,
  SESSION_COOKIE_PATTERN,
  OPENAI_KEY_PATTERN,
  GOOGLE_API_KEY_PATTERN,
  GITHUB_TOKEN_PATTERN,
  AWS_ACCESS_KEY_PATTERN,
  BEARER_PATTERN,
]);

function normalizePlainText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function redactSensitiveText(value = '') {
  let text = normalizePlainText(value);
  let redactionCount = 0;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, () => {
      redactionCount += 1;
      return '[REDACTED_CREDENTIAL]';
    });
  }
  return { text, redactionCount };
}

export function prepareAiText(value, limit, { required = false, field = 'context' } = {}) {
  const normalized = normalizePlainText(value);
  if (required && !normalized) throw new HttpError(400, 'AI_CONTEXT_REQUIRED', `${field}에 사용할 학습 내용이 필요합니다.`);
  const redacted = redactSensitiveText(normalized);
  const text = redacted.text.slice(0, limit);
  return {
    text,
    originalChars: normalized.length,
    forwardedChars: text.length,
    truncated: redacted.text.length > limit,
    redactionCount: redacted.redactionCount,
  };
}

export function prepareAiNodes(nodes, { maxNodes = 30, maxCharsPerNode = 300 } = {}) {
  if (!Array.isArray(nodes)) return { nodes: [], redactionCount: 0 };
  let redactionCount = 0;
  const safe = nodes.slice(0, maxNodes).map((node) => {
    const result = prepareAiText(node?.text, maxCharsPerNode);
    redactionCount += result.redactionCount;
    return result.text;
  }).filter(Boolean);
  return { nodes: safe, redactionCount };
}

export function assertAiActionHasMaterial(action, { contextText = '', selectedText = '', code = '', nodes = [] } = {}) {
  const sourceText = String(contextText || '').trim();
  const selection = String(selectedText || '').trim();
  const sourceCode = String(code || '').trim();
  if (['flashcards', 'summary'].includes(action) && !sourceText && !selection) {
    throw new HttpError(400, 'AI_CONTEXT_REQUIRED', '이 기능에는 먼저 학습 자료가 필요합니다.');
  }
  if (action === 'paragraph_explain' && !selection && !sourceText) {
    throw new HttpError(400, 'AI_CONTEXT_REQUIRED', '설명할 문단을 먼저 선택해 주세요.');
  }
  if (action === 'code_review' && !sourceCode) {
    throw new HttpError(400, 'AI_CODE_REQUIRED', '리뷰할 코드를 먼저 입력해 주세요.');
  }
  if (action === 'node_suggestion' && !sourceText && !nodes.length) {
    throw new HttpError(400, 'AI_CONTEXT_REQUIRED', '추천에 사용할 자료나 캔버스 노드가 필요합니다.');
  }
}

export const AI_SECRET_PATTERNS = Object.freeze({
  planetKey: PLANET_KEY_PATTERN.source,
  sessionCookie: SESSION_COOKIE_PATTERN.source,
});
