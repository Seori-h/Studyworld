import { personaById, PERSONA_IDS } from './ai-personas.js';
import { redactSensitiveText } from './ai-context-service.js';

const STUDY_TYPES = new Set(['coding', 'recall', 'brainstorm', 'reading']);
const TIMER_TYPES = new Set(['pomodoro', 'feynman_pomodoro']);
const BGM_TYPES = new Set(['quiet_focus', 'lofi_cyber']);
const PERSONA_SET = new Set(PERSONA_IDS);
const MODE_PROTOCOL = Object.freeze({
  coding: Object.freeze({ layout: 'split_view', persona: 'code_coach' }),
  recall: Object.freeze({ layout: 'flashcard', persona: 'recall_coach' }),
  brainstorm: Object.freeze({ layout: 'canvas', persona: 'brainstorm_partner' }),
  reading: Object.freeze({ layout: 'focus_reader', persona: 'reading_guide' }),
});

function cleanText(value, max = 4000) {
  if (value === null || value === undefined) return '';
  const normalized = String(value).split('\0').join('').trim().slice(0, max);
  return redactSensitiveText(normalized).text;
}

function cleanOptionalText(value, max = 4000) {
  if (value === null || value === undefined || value === '') return null;
  return cleanText(value, max) || null;
}

function cleanBool(value) { return value === true; }
function cleanInt(value, min, max, fallback = 0) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function cleanNumber(value, min, max, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function cleanStringArray(value, { maxItems = 20, maxChars = 500 } = {}) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => cleanText(item, maxChars)).filter(Boolean);
}

function sanitizeSchema(raw = {}) {
  const study = STUDY_TYPES.has(raw?.study_type) ? raw.study_type : 'brainstorm';
  const protocol = MODE_PROTOCOL[study];
  const tools = raw?.active_tools && typeof raw.active_tools === 'object' ? raw.active_tools : {};
  const requestedPersona = raw?.ai_persona?.id;
  const personaId = PERSONA_SET.has(requestedPersona) && requestedPersona === protocol.persona ? requestedPersona : protocol.persona;
  const persona = personaById(personaId);
  const timer = TIMER_TYPES.has(tools.timer_type) ? tools.timer_type : null;
  const bgm = BGM_TYPES.has(tools.bgm_recommendation) ? tools.bgm_recommendation : null;
  return {
    study_type: study,
    layout_mode: protocol.layout,
    active_tools: {
      code_editor: study === 'coding' && cleanBool(tools.code_editor),
      terminal: study === 'coding' && cleanBool(tools.terminal),
      timer_type: timer,
      bgm_recommendation: bgm,
    },
    ai_persona: {
      id: persona.id,
      role: persona.role,
      system_prompt: persona.systemPrompt,
    },
  };
}

function sanitizeContext(raw = {}) {
  return {
    name: cleanText(raw?.name, 180),
    type: cleanText(raw?.type, 100),
    source: cleanText(raw?.source, 40),
    ephemeral: raw?.ephemeral === true,
    updatedAt: cleanText(raw?.updatedAt, 60),
  };
}

function sanitizeFlashcards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.slice(0, 8).map((card) => ({
    question: cleanText(card?.question, 320),
    answer: cleanText(card?.answer, 480),
    hint: cleanText(card?.hint, 260),
  })).filter((card) => card.question || card.answer);
}

function sanitizeCanvasNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.slice(0, 60).map((node, index) => ({
    id: cleanText(node?.id || `node-${index + 1}`, 80),
    x: cleanNumber(node?.x, -5000, 15000, 100),
    y: cleanNumber(node?.y, -5000, 15000, 100),
    text: cleanText(node?.text, 1000),
  })).filter((node) => node.text);
}

function sanitizeAiNodeSuggestion(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    title: cleanText(value.title, 120),
    text: cleanText(value.text, 500),
    rationale: cleanText(value.rationale, 500),
  };
}

function sanitizeAiSummary(value) {
  if (!value || typeof value !== 'object') return null;
  const lines = cleanStringArray(value.lines, { maxItems: 3, maxChars: 300 });
  if (!lines.length) return null;
  return { lines, key_terms: cleanStringArray(value.key_terms, { maxItems: 6, maxChars: 80 }) };
}

function sanitizeParagraphExplain(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    explanation: cleanText(value.explanation, 700),
    evidence: cleanText(value.evidence, 500),
    check_question: cleanText(value.check_question, 320),
  };
}

function sanitizeCodeReview(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    headline: cleanText(value.headline, 240),
    complexity: cleanText(value.complexity, 320),
    questions: cleanStringArray(value.questions, { maxItems: 4, maxChars: 320 }),
    hints: cleanStringArray(value.hints, { maxItems: 4, maxChars: 320 }),
    risks: cleanStringArray(value.risks, { maxItems: 4, maxChars: 320 }),
  };
}

function sanitizeWorkspace(raw = {}, { ephemeralSource = false } = {}) {
  const workspace = {
    reviewRequest: cleanText(raw?.reviewRequest, 4000),
    terminal: cleanStringArray(raw?.terminal, { maxItems: 20, maxChars: 500 }),
    flashIndex: cleanInt(raw?.flashIndex, 0, 1000, 0),
    flashRevealed: cleanBool(raw?.flashRevealed),
    flashHintVisible: cleanBool(raw?.flashHintVisible),
    recallDraft: cleanText(raw?.recallDraft, 5000),
    aiFlashcards: sanitizeFlashcards(raw?.aiFlashcards),
    canvasNodes: sanitizeCanvasNodes(raw?.canvasNodes),
    aiNodeSuggestion: sanitizeAiNodeSuggestion(raw?.aiNodeSuggestion),
    readerNotes: cleanText(raw?.readerNotes, 20000),
    focusParagraph: cleanInt(raw?.focusParagraph, 0, 2000, 0),
    aiSummary: sanitizeAiSummary(raw?.aiSummary),
    aiParagraphExplain: sanitizeParagraphExplain(raw?.aiParagraphExplain),
    aiCodeReview: sanitizeCodeReview(raw?.aiCodeReview),
  };
  if (!ephemeralSource) workspace.code = cleanText(raw?.code, 50000);
  return workspace;
}

export function sanitizePersistentStudyState(payload = {}) {
  const rawContext = payload?.context && typeof payload.context === 'object' ? payload.context : {};
  const ephemeralSource = rawContext.ephemeral === true || rawContext.source === 'upload';
  return {
    schema: sanitizeSchema(payload?.schema && typeof payload.schema === 'object' ? payload.schema : {}),
    context: sanitizeContext(rawContext),
    workspace: sanitizeWorkspace(payload?.workspace && typeof payload.workspace === 'object' ? payload.workspace : {}, { ephemeralSource }),
  };
}

export function sanitizeStudyDraftPayload(body = {}) {
  const categoryModes = new Set(['purpose', 'subject']);
  return {
    version: Math.max(1, Math.min(10, Number(body.version || 1))),
    prompt: cleanText(body.prompt, 4000),
    categoryMode: categoryModes.has(body.categoryMode) ? body.categoryMode : 'purpose',
    tagLabel: cleanOptionalText(body.tagLabel, 80),
    tagPrompt: cleanOptionalText(body.tagPrompt, 500),
    source: cleanText(body.source, 40) || 'studyworld',
    createdAt: cleanOptionalText(body.createdAt, 60),
  };
}
