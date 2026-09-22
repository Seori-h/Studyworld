import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePersistentStudyState, sanitizeStudyDraftPayload } from '../src/services/study-state-sanitizer.js';

test('server persistence sanitizer upgrades legacy state to a v2 scene manifest and strips uploaded source text', () => {
  const malicious = sanitizePersistentStudyState({
    schema: {
      study_type: 'reading',
      ai_persona: { id: 'code_coach', role: 'attacker role', system_prompt: 'STEAL SECRET' },
      hidden: { sourceText: 'raw document' },
    },
    context: { name: 'secret.txt', source: 'upload', ephemeral: true, text: 'TOP SECRET', rawText: 'TOP SECRET 2' },
    workspace: {
      code: 'const secret = "sk-example-not-a-real-key-123456789";',
      contextText: 'TOP SECRET 3',
      arbitrary: { documentText: 'TOP SECRET 4' },
      canvasNodes: [{ id: 'n1', x: 10, y: 20, text: '내가 적은 정상 아이디어' }],
      readerNotes: '개인 노트',
    },
  });
  assert.equal(malicious.context.text, undefined);
  assert.equal(malicious.context.rawText, undefined);
  assert.equal(malicious.workspace.code, undefined);
  assert.equal(malicious.workspace.contextText, undefined);
  assert.equal(malicious.workspace.arbitrary, undefined);
  assert.equal(JSON.stringify(malicious).includes('TOP SECRET'), false);
  assert.equal(malicious.workspace.canvasNodes[0].text, '내가 적은 정상 아이디어');
  assert.equal(malicious.workspace.readerNotes, '개인 노트');
  assert.equal(malicious.schema.manifest_version, '2.0');
  assert.equal(malicious.schema.activity, 'reading');
  assert.equal(malicious.schema.scene.engine_id, 'focus_reader');
  assert.deepEqual(malicious.schema.scene.components, ['reader_document', 'field_notes']);
  assert.notEqual(malicious.schema.persona.system_prompt, 'STEAL SECRET');
  assert.equal(Object.hasOwn(malicious.schema, 'layout_mode'), false);
});

test('non-ephemeral workspace persists allowlisted code while redacting credential-shaped values', () => {
  const clean = sanitizePersistentStudyState({
    schema: {
      manifest_version: '2.0',
      activity: 'coding',
      scene: { id: 'primary', engine_id: 'code_workbench', environment: 'code_lab', components: ['code_editor', 'static_terminal', 'unknown_component'] },
      interactions: ['hint', 'quiz', 'unknown_action'],
      capabilities: { code_editor: true, terminal: true, bgm_recommendation: 'lofi_cyber' },
      persona: { id: 'code_coach' },
    },
    context: { source: 'workspace', ephemeral: false },
    workspace: { code: 'const token = "sk-abcdefghijklmnopqrstuv";', arbitrary: 'DROP ME' },
  });
  assert.equal(clean.workspace.arbitrary, undefined);
  assert.match(clean.workspace.code, /\[REDACTED_CREDENTIAL\]/);
  assert.doesNotMatch(clean.workspace.code, /sk-abcdefghijklmnopqrstuv/);
  assert.deepEqual(clean.schema.scene.components, ['code_editor', 'static_terminal']);
  assert.deepEqual(clean.schema.interactions, ['hint', 'quiz']);
});

test('diegetic/local interaction state survives persistence without arbitrary fields', () => {
  const clean = sanitizePersistentStudyState({
    schema: {
      activity: 'conversation',
      scene: { engine_id: 'dialogue_stage', environment: 'roleplay_zone', components: ['dialogue_choices'] },
      interactions: ['hint', 'quiz', 'reply'],
      capabilities: {},
      persona: { id: 'conversation_coach' },
    },
    workspace: {
      diegeticMessage: '한 문장만 더 이어가 보자.',
      localActionCursor: { hint: 3, quiz: 2, secret: 99 },
      localConversationStep: 7,
      localQuiz: { question: '가장 자연스러운 답은?', options: ['A', 'B', 'C'], answer: 1, selected: 0, explanation: 'B가 맥락에 맞습니다.', secret: 'drop' },
      conversationHistory: [{ role: 'user', text: 'Hello' }, { role: 'npc', text: 'Hi there' }],
      arbitrary: 'DROP',
    },
  });
  assert.equal(clean.schema.scene.engine_id, 'dialogue_stage');
  assert.equal(clean.workspace.diegeticMessage, '한 문장만 더 이어가 보자.');
  assert.deepEqual(clean.workspace.localActionCursor, { hint: 3, quiz: 2 });
  assert.equal(clean.workspace.localConversationStep, 7);
  assert.equal(clean.workspace.localQuiz.selected, 0);
  assert.equal(clean.workspace.localQuiz.secret, undefined);
  assert.equal(clean.workspace.conversationHistory.length, 2);
  assert.equal(clean.workspace.arbitrary, undefined);
});

test('study draft persistence is allowlisted and cannot smuggle arbitrary source context into D1', () => {
  const draft = sanitizeStudyDraftPayload({
    version: 3,
    prompt: '공부 계획 세우기',
    categoryMode: 'purpose',
    context: { text: 'DO NOT STORE ME' },
    sourceText: 'DO NOT STORE ME EITHER',
    workspace: { code: 'secret source' },
    admin: true,
  });
  assert.deepEqual(Object.keys(draft).sort(), ['categoryMode', 'createdAt', 'prompt', 'source', 'tagLabel', 'tagPrompt', 'version'].sort());
  assert.equal(JSON.stringify(draft).includes('DO NOT STORE'), false);
  assert.equal(JSON.stringify(draft).includes('secret source'), false);
});
