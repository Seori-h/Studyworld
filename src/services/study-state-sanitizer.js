import { personaById, PERSONA_IDS } from './ai-personas.js';
import { redactSensitiveText } from './ai-context-service.js';

const ACTIVITIES = new Set(['coding', 'recall', 'brainstorm', 'reading', 'conversation']);
const ENGINES = new Set(['code_workbench', 'recall_deck', 'idea_canvas', 'focus_reader', 'dialogue_stage']);
const COMPONENTS = new Set(['code_editor', 'static_terminal', 'mission_board', 'recall_card', 'recall_draft', 'memory_map', 'idea_nodes', 'reader_document', 'field_notes', 'dialogue_choices']);
const INTERACTIONS = new Set(['hint', 'quiz', 'reply']);
const TIMER_TYPES = new Set(['pomodoro', 'feynman_pomodoro']);
const BGM_TYPES = new Set(['quiet_focus', 'lofi_cyber']);
const PERSONA_SET = new Set(PERSONA_IDS);
const ENGINE_COMPONENTS = Object.freeze({
  code_workbench: Object.freeze(['code_editor', 'static_terminal', 'mission_board']),
  recall_deck: Object.freeze(['recall_card', 'recall_draft', 'memory_map']),
  idea_canvas: Object.freeze(['idea_nodes']),
  focus_reader: Object.freeze(['reader_document', 'field_notes']),
  dialogue_stage: Object.freeze(['dialogue_choices']),
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

function manifestPreset(activity) {
  const presets = {
    coding: { engine: 'code_workbench', environment: 'code_lab', persona: 'code_coach', components: ENGINE_COMPONENTS.code_workbench, interactions: ['hint', 'quiz'], capabilities: { code_editor: true, terminal: true, timer_type: null, bgm_recommendation: 'lofi_cyber' } },
    recall: { engine: 'recall_deck', environment: 'memory_chamber', persona: 'recall_coach', components: ENGINE_COMPONENTS.recall_deck, interactions: ['hint', 'quiz'], capabilities: { code_editor: false, terminal: false, timer_type: 'feynman_pomodoro', bgm_recommendation: null } },
    brainstorm: { engine: 'idea_canvas', environment: 'idea_field', persona: 'brainstorm_partner', components: ENGINE_COMPONENTS.idea_canvas, interactions: ['hint', 'quiz'], capabilities: { code_editor: false, terminal: false, timer_type: null, bgm_recommendation: 'quiet_focus' } },
    reading: { engine: 'focus_reader', environment: 'quiet_archive', persona: 'reading_guide', components: ENGINE_COMPONENTS.focus_reader, interactions: ['hint', 'quiz'], capabilities: { code_editor: false, terminal: false, timer_type: null, bgm_recommendation: null } },
    conversation: { engine: 'dialogue_stage', environment: 'roleplay_zone', persona: 'conversation_coach', components: ENGINE_COMPONENTS.dialogue_stage, interactions: ['hint', 'quiz', 'reply'], capabilities: { code_editor: false, terminal: false, timer_type: null, bgm_recommendation: null } },
  };
  const selected = presets[activity] || presets.brainstorm;
  const persona = personaById(selected.persona);
  return {
    manifest_version: '2.0',
    activity: ACTIVITIES.has(activity) ? activity : 'brainstorm',
    scene: { id: 'primary', engine_id: selected.engine, environment: selected.environment, components: [...selected.components] },
    interactions: [...selected.interactions],
    capabilities: { ...selected.capabilities },
    persona: { id: persona.id, role: persona.role, system_prompt: persona.systemPrompt },
  };
}

function legacyToManifest(raw = {}) {
  const activity = ACTIVITIES.has(raw.study_type) ? raw.study_type : 'brainstorm';
  const base = manifestPreset(activity);
  const tools = raw?.active_tools && typeof raw.active_tools === 'object' ? raw.active_tools : {};
  const requestedPersona = raw?.ai_persona?.id;
  const persona = personaById(PERSONA_SET.has(requestedPersona) ? requestedPersona : base.persona.id);
  return {
    ...base,
    capabilities: {
      ...base.capabilities,
      code_editor: cleanBool(tools.code_editor) || base.capabilities.code_editor,
      terminal: cleanBool(tools.terminal) || base.capabilities.terminal,
      timer_type: TIMER_TYPES.has(tools.timer_type) ? tools.timer_type : base.capabilities.timer_type,
      bgm_recommendation: BGM_TYPES.has(tools.bgm_recommendation) ? tools.bgm_recommendation : base.capabilities.bgm_recommendation,
    },
    persona: { id: persona.id, role: persona.role, system_prompt: persona.systemPrompt },
  };
}

function sanitizeManifest(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  if (!raw.scene && raw.study_type) raw = legacyToManifest(raw);
  const activity = ACTIVITIES.has(raw.activity) ? raw.activity : 'brainstorm';
  const fallback = manifestPreset(activity);
  const engineId = ENGINES.has(raw.scene?.engine_id) ? raw.scene.engine_id : fallback.scene.engine_id;
  const supported = new Set(ENGINE_COMPONENTS[engineId] || []);
  const requestedComponents = Array.isArray(raw.scene?.components) ? raw.scene.components : [];
  const components = [...new Set(requestedComponents.filter((item) => COMPONENTS.has(item) && supported.has(item)))].slice(0, 10);
  const requestedInteractions = Array.isArray(raw.interactions) ? raw.interactions : [];
  const interactions = [...new Set(requestedInteractions.filter((item) => INTERACTIONS.has(item)))].slice(0, 3);
  const capabilities = raw.capabilities && typeof raw.capabilities === 'object' ? raw.capabilities : {};
  const requestedPersona = raw.persona?.id;
  const persona = personaById(PERSONA_SET.has(requestedPersona) ? requestedPersona : fallback.persona.id);
  return {
    manifest_version: '2.0',
    activity,
    scene: {
      id: cleanText(raw.scene?.id || 'primary', 80) || 'primary',
      engine_id: engineId,
      environment: cleanText(raw.scene?.environment || fallback.scene.environment, 80) || fallback.scene.environment,
      components: components.length ? components : [...ENGINE_COMPONENTS[engineId]],
    },
    interactions: interactions.length ? interactions : [...fallback.interactions],
    capabilities: {
      code_editor: cleanBool(capabilities.code_editor),
      terminal: cleanBool(capabilities.terminal),
      timer_type: TIMER_TYPES.has(capabilities.timer_type) ? capabilities.timer_type : null,
      bgm_recommendation: BGM_TYPES.has(capabilities.bgm_recommendation) ? capabilities.bgm_recommendation : null,
    },
    persona: { id: persona.id, role: persona.role, system_prompt: persona.systemPrompt },
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

function sanitizeLocalQuiz(value) {
  if (!value || typeof value !== 'object') return null;
  const options = cleanStringArray(value.options, { maxItems: 6, maxChars: 240 });
  const selectedRaw = value.selected;
  const selected = selectedRaw === null || selectedRaw === undefined ? null : cleanInt(selectedRaw, 0, Math.max(0, options.length - 1), 0);
  return {
    question: cleanText(value.question, 400),
    options,
    answer: cleanInt(value.answer, 0, Math.max(0, options.length - 1), 0),
    explanation: cleanText(value.explanation, 600),
    selected,
  };
}

function sanitizeConversationHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-40).map((item) => ({
    role: ['user', 'assistant', 'npc'].includes(item?.role) ? item.role : 'npc',
    text: cleanText(item?.text || item?.content, 1200),
  })).filter((item) => item.text);
}

function sanitizeWorkspace(raw = {}, { ephemeralSource = false } = {}) {
  const cursorRaw = raw?.localActionCursor && typeof raw.localActionCursor === 'object' ? raw.localActionCursor : {};
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
    conversationHistory: sanitizeConversationHistory(raw?.conversationHistory),
    conversationFeedback: cleanOptionalText(raw?.conversationFeedback, 1200),
    diegeticMessage: cleanText(raw?.diegeticMessage, 1200),
    localActionCursor: {
      hint: cleanInt(cursorRaw.hint, 0, 10000, 0),
      quiz: cleanInt(cursorRaw.quiz, 0, 10000, 0),
    },
    localQuiz: sanitizeLocalQuiz(raw?.localQuiz),
    localConversationStep: cleanInt(raw?.localConversationStep, 0, 10000, 0),
  };
  if (!ephemeralSource) workspace.code = cleanText(raw?.code, 50000);
  return workspace;
}

export function sanitizePersistentStudyState(payload = {}) {
  const rawContext = payload?.context && typeof payload.context === 'object' ? payload.context : {};
  const ephemeralSource = rawContext.ephemeral === true || rawContext.source === 'upload';
  return {
    // `schema` remains the storage/API envelope for compatibility; its content is now a v2 Scene Manifest.
    schema: sanitizeManifest(payload?.schema && typeof payload.schema === 'object' ? payload.schema : {}),
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
