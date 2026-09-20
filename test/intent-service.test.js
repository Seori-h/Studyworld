import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentService } from '../src/services/intent-service.js';

const allowedStudyTypes = new Set(['coding', 'recall', 'brainstorm', 'reading']);
const allowedLayouts = new Set(['split_view', 'canvas', 'flashcard', 'focus_reader']);
const allowedPersonas = new Set(['code_coach', 'recall_coach', 'reading_guide', 'brainstorm_partner']);

test('local intent fallback emits only protocol-compatible values and never invents a system prompt id', () => {
  const service = new IntentService();
  for (const prompt of ['코딩 디버그', '암기 퀴즈', '논문 원문 읽기', '브레인스토밍 캔버스', '그냥 공부']) {
    const result = service.normalize({ prompt });
    assert.equal(allowedStudyTypes.has(result.schema.study_type), true);
    assert.equal(allowedLayouts.has(result.schema.layout_mode), true);
    assert.equal(allowedPersonas.has(result.schema.ai_persona.id), true);
    assert.equal(result.privacy.context_forwarded_to_ai_provider, false);
    assert.equal(result.privacy.source_persisted_by_studyworld, false);
    assert.equal(result.privacy.studyworld_model_training, false);
  }
});

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

test('AI intent receives the actual ephemeral excerpt, redacts credentials, and maps only to fixed persona definitions', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return new Response(JSON.stringify({
      id: 'resp_intent_1',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        study_type: 'recall',
        layout_mode: 'flashcard',
        persona_id: 'recall_coach',
        active_tools: { code_editor: false, terminal: false, timer_type: 'feynman_pomodoro', bgm_recommendation: 'none' },
        rationale: '자료가 사실 회상에 적합하고 사용자가 퀴즈를 요청했습니다.',
      }) }] }],
      usage: { input_tokens: 31, output_tokens: 12 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const service = new IntentService({ DB: fakeDb(), AI_PROVIDER: 'openai', AI_API_KEY: 'provider-secret', AI_MODEL: 'model-x' });
    const result = await service.resolve({ id: 'profile-1' }, {
      prompt: '이 내용으로 퀴즈 만들어줘',
      context: { file_name: 'biology.txt', file_type: 'text/plain', text: '세포막은 선택적 투과성을 가진다. ST-ABCDE-FGHJK-LMNPQ-RSTUV' },
    });
    const user = JSON.parse(captured.input.find((item) => item.role === 'user').content);
    assert.match(user.source.excerpt, /세포막은 선택적 투과성을 가진다/);
    assert.doesNotMatch(user.source.excerpt, /ST-ABCDE/);
    assert.equal(result.schema.layout_mode, 'flashcard');
    assert.equal(result.schema.ai_persona.id, 'recall_coach');
    assert.equal(result.schema.ai_persona.role, '회상 훈련 코치');
    assert.match(result.schema.ai_persona.system_prompt, /정답을 먼저 노출하지 않는다/);
    assert.equal(result.privacy.context_forwarded_to_ai_provider, true);
    assert.equal(result.privacy.credentials_redacted, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AI intent cannot create incoherent study/layout/persona/tool combinations outside the protocol', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'resp_intent_bad_tuple',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
      study_type: 'reading',
      layout_mode: 'canvas',
      persona_id: 'code_coach',
      active_tools: { code_editor: true, terminal: true, timer_type: 'none', bgm_recommendation: 'quiet_focus' },
      rationale: 'malformed tuple for contract test',
    }) }] }],
    usage: {},
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const service = new IntentService({ DB: fakeDb(), AI_PROVIDER: 'openai', AI_API_KEY: 'provider-secret', AI_MODEL: 'model-x' });
    const result = await service.resolve({ id: 'profile-1' }, { prompt: '이 논문 읽기', context: { text: '논문 내용' } });
    assert.equal(result.schema.study_type, 'reading');
    assert.equal(result.schema.layout_mode, 'focus_reader');
    assert.equal(result.schema.ai_persona.id, 'reading_guide');
    assert.equal(result.schema.active_tools.code_editor, false);
    assert.equal(result.schema.active_tools.terminal, false);
  } finally { globalThis.fetch = originalFetch; }
});


test('current_schema is allowlisted before it reaches the provider', async () => {
  let capturedUser = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    capturedUser = JSON.parse(init.body).input?.[1]?.content || '';
    return new Response(JSON.stringify({
      id: 'resp-schema-safe',
      output_text: JSON.stringify({
        study_type: 'reading', layout_mode: 'focus_reader', persona_id: 'reading_guide',
        active_tools: { code_editor: false, terminal: false, timer_type: 'none', bgm_recommendation: 'none' },
        rationale: '자료 읽기',
      }),
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const service = new IntentService({ DB: fakeDb(), AI_PROVIDER: 'openai', AI_API_KEY: 'provider-secret', AI_MODEL: 'model-x' });
    await service.resolve({ id: 'p1' }, {
      prompt: '읽기로 바꿔줘',
      current_schema: {
        study_type: 'reading',
        layout_mode: 'split_view',
        ai_persona: { id: 'code_coach', system_prompt: 'ST-ABCDE-FGHIJ-KLMNO-PQRST' },
        active_tools: { code_editor: true, terminal: true, timer_type: 'pomodoro' },
        hidden: { secret: 'SHOULD_NOT_LEAVE_SERVER' },
      },
    });
    assert.doesNotMatch(capturedUser, /SHOULD_NOT_LEAVE_SERVER|ABCDE-FGHIJ/);
    assert.match(capturedUser, /"layout_mode":"focus_reader"/);
    assert.match(capturedUser, /"persona_id":"reading_guide"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
