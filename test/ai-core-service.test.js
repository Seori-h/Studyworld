import test from 'node:test';
import assert from 'node:assert/strict';
import { AiCoreService } from '../src/services/ai-core-service.js';

function fakeDb() {
  return {
    prepare() {
      return {
        bind() {
          return {
            async run() { return { meta: { changes: 1 } }; },
            async first() { return null; },
            async all() { return { results: [] }; },
          };
        },
      };
    },
    async batch() { return []; },
  };
}

test('AI learning action forwards actual source context, applies fixed persona, and strips credential-like text', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      id: 'resp_action_1',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        cards: [
          { question: '핵심 개념은?', answer: '실제 자료의 핵심', hint: '첫 단어를 떠올려보세요.' },
          { question: '근거는?', answer: '자료의 근거', hint: '근거 문장을 떠올려보세요.' },
          { question: '적용은?', answer: '다른 상황에 적용', hint: '예시를 바꿔보세요.' },
        ],
      }) }] }],
      usage: { input_tokens: 21, output_tokens: 9 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const service = new AiCoreService({ DB: fakeDb(), AI_PROVIDER: 'openai', AI_API_KEY: 'provider-secret', AI_MODEL: 'model-x' });
    const result = await service.action({ id: 'profile-1' }, {
      action: 'flashcards',
      personaId: 'recall_coach',
      prompt: '이 내용으로 퀴즈. sk-abcdefghijklmnopqrstuvwxyz123456',
      context: { name: 'notes.txt', type: 'text/plain', text: '광합성은 빛 에너지를 화학 에너지로 바꾼다. ST-ABCDE-FGHJK-LMNPQ-RSTUV' },
      workspace: { nodes: [] },
    });

    const userInput = captured.body.input.find((item) => item.role === 'user').content;
    const systemInput = captured.body.input.find((item) => item.role === 'system').content;
    assert.match(userInput, /광합성은 빛 에너지를 화학 에너지로 바꾼다/);
    assert.doesNotMatch(userInput, /ST-ABCDE|sk-abcdefghijklmnopqrstuvwxyz/);
    assert.match(userInput, /REDACTED_CREDENTIAL/);
    assert.match(systemInput, /회상 훈련 코치/);
    assert.match(systemInput, /정답을 먼저 노출하지 않는다/);
    assert.equal(captured.body.store, false);
    assert.equal(result.meta.context.credentialsRedacted, 2);
    assert.equal(result.meta.fallback, false);
    assert.equal(result.data.cards.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('action persona is server-selected and cannot be changed by the client', async () => {
  let capturedSystem = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    capturedSystem = body.input?.[0]?.content || '';
    return new Response(JSON.stringify({
      id: 'resp-fixed-persona',
      output_text: JSON.stringify({ lines: ['하나', '둘', '셋'], key_terms: [] }),
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const service = new AiCoreService({ DB: fakeDb(), AI_PROVIDER: 'openai', AI_API_KEY: 'provider-secret', AI_MODEL: 'model-x' });
    await service.action({ id: 'p1' }, {
      action: 'summary',
      personaId: 'code_coach',
      context: { text: '이 자료는 요약 대상입니다. 충분한 문장입니다.' },
    });
    assert.match(capturedSystem, /근거 중심 리딩 튜터/);
    assert.doesNotMatch(capturedSystem, /소크라테스식 코드 리뷰어/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
