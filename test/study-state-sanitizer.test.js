import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePersistentStudyState, sanitizeStudyDraftPayload } from '../src/services/study-state-sanitizer.js';

test('server persistence sanitizer removes uploaded source text even when a client bypasses frontend stripping', () => {
  const malicious = sanitizePersistentStudyState({
    schema: {
      study_type: 'reading',
      layout_mode: 'split_view',
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
  assert.equal(malicious.schema.study_type, 'reading');
  assert.equal(malicious.schema.layout_mode, 'focus_reader');
  assert.equal(malicious.schema.ai_persona.id, 'reading_guide');
  assert.notEqual(malicious.schema.ai_persona.system_prompt, 'STEAL SECRET');
});

test('non-ephemeral workspace persists allowlisted code while redacting credential-shaped values', () => {
  const clean = sanitizePersistentStudyState({
    schema: { study_type: 'coding', active_tools: { code_editor: true, terminal: true } },
    context: { source: 'workspace', ephemeral: false },
    workspace: { code: 'const token = "sk-abcdefghijklmnopqrstuv";', arbitrary: 'DROP ME' },
  });
  assert.equal(clean.workspace.arbitrary, undefined);
  assert.match(clean.workspace.code, /\[REDACTED_CREDENTIAL\]/);
  assert.doesNotMatch(clean.workspace.code, /sk-abcdefghijklmnopqrstuv/);
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
