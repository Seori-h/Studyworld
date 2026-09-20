import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitiveText, prepareAiText, prepareAiNodes, assertAiActionHasMaterial } from '../src/services/ai-context-service.js';

const PLANET_KEY = 'ST-ABCDE-FGHJK-LMNPQ-RSTUV';
const OPENAI_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';

test('AI context redacts Planet Key, API key, session and bearer-like credentials before provider forwarding', () => {
  const source = `${PLANET_KEY}\n${OPENAI_KEY}\n__Host-sw_session=super-secret-cookie\nBearer abcdefghijklmnopqrstuvwxyz123456`;
  const result = redactSensitiveText(source);
  assert.equal(result.redactionCount, 4);
  assert.doesNotMatch(result.text, /ST-ABCDE|sk-abcdefghijklmnopqrstuvwxyz|super-secret-cookie|abcdefghijklmnopqrstuvwxyz123456/);
  assert.equal((result.text.match(/\[REDACTED_CREDENTIAL\]/g) || []).length, 4);
});

test('AI text preparation enforces truncation without persisting or returning the original secret', () => {
  const result = prepareAiText(`${PLANET_KEY} ${'A'.repeat(200)}`, 40);
  assert.equal(result.truncated, true);
  assert.equal(result.redactionCount, 1);
  assert.equal(result.forwardedChars <= 40, true);
  assert.doesNotMatch(result.text, /ABCDE/);
});

test('canvas node preparation is bounded and credential-redacted', () => {
  const nodes = prepareAiNodes([
    { text: `첫 노드 ${PLANET_KEY}` },
    { text: 'B'.repeat(500) },
  ], { maxNodes: 2, maxCharsPerNode: 40 });
  assert.equal(nodes.nodes.length, 2);
  assert.equal(nodes.redactionCount, 1);
  assert.equal(nodes.nodes[1].length, 40);
});

test('AI learning actions require the material they claim to analyze', () => {
  assert.throws(() => assertAiActionHasMaterial('flashcards', {}), (error) => error?.code === 'AI_CONTEXT_REQUIRED');
  assert.throws(() => assertAiActionHasMaterial('code_review', {}), (error) => error?.code === 'AI_CODE_REQUIRED');
  assert.doesNotThrow(() => assertAiActionHasMaterial('summary', { contextText: '실제 학습 자료' }));
  assert.doesNotThrow(() => assertAiActionHasMaterial('node_suggestion', { nodes: ['아이디어'] }));
});
