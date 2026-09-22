import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentService } from '../src/services/intent-service.js';

const allowedActivities = new Set(['coding', 'recall', 'brainstorm', 'reading', 'conversation']);
const allowedEngines = new Set(['code_workbench', 'recall_deck', 'idea_canvas', 'focus_reader', 'dialogue_stage']);
const allowedPersonas = new Set(['code_coach', 'recall_coach', 'reading_guide', 'brainstorm_partner', 'conversation_coach']);

test('local intent fallback emits a v2 scene manifest instead of a layout mode', () => {
  const service = new IntentService();
  for (const prompt of ['코딩 디버그', '암기 퀴즈', '논문 원문 읽기', '영어 회화 롤플레이', '브레인스토밍', '그냥 공부']) {
    const result = service.normalize({ prompt });
    assert.equal(result.protocol_version, '2.0');
    assert.equal(allowedActivities.has(result.manifest.activity), true);
    assert.equal(allowedEngines.has(result.manifest.scene.engine_id), true);
    assert.equal(allowedPersonas.has(result.manifest.persona.id), true);
    assert.equal(Array.isArray(result.manifest.scene.components), true);
    assert.equal(Object.hasOwn(result.manifest, 'layout_mode'), false);
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

test('AI Director receives ephemeral context, redacts credentials, and returns an allowlisted scene manifest', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return new Response(JSON.stringify({
      id: 'resp_intent_1',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        activity: 'recall',
        scene: { engine_id: 'recall_deck', environment: 'memory_chamber', components: ['recall_card', 'recall_draft', 'memory_map'] },
        interactions: ['hint', 'quiz'],
        persona_id: 'recall_coach',
        capabilities: { code_editor: false, terminal: false, timer_type: 'feynman_pomodoro', bgm_recommendation: 'none' },
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
    assert.deepEqual(user.engine_registry.recall_deck, ['recall_card', 'recall_draft', 'memory_map']);
    assert.equal(result.manifest.scene.engine_id, 'recall_deck');
    assert.equal(result.manifest.persona.id, 'recall_coach');
    assert.equal(result.manifest.persona.role, '회상 훈련 코치');
    assert.match(result.manifest.persona.system_prompt, /정답을 먼저 노출하지 않는다/);
    assert.equal(result.privacy.context_forwarded_to_ai_provider, true);
    assert.equal(result.privacy.credentials_redacted, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AI Director can combine activity and engine without a hard-coded activity-to-layout tuple', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'resp_intent_composed_scene',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
      activity: 'reading',
      scene: { engine_id: 'idea_canvas', environment: 'evidence_wall', components: ['idea_nodes', 'code_editor'] },
      interactions: ['hint', 'quiz', 'invalid_action'],
      persona_id: 'brainstorm_partner',
      capabilities: { code_editor: true, terminal: true, timer_type: 'none', bgm_recommendation: 'quiet_focus' },
      rationale: '읽은 근거를 공간 노드로 재배치합니다.',
    }) }] }],
    usage: {},
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const service = new IntentService({ DB: fakeDb(), AI_PROVIDER: 'openai', AI_API_KEY: 'provider-secret', AI_MODEL: 'model-x' });
    const result = await service.resolve({ id: 'profile-1' }, { prompt: '논문 근거를 캔버스에서 연결하며 읽고 싶어', context: { text: '논문 내용' } });
    assert.equal(result.manifest.activity, 'reading');
    assert.equal(result.manifest.scene.engine_id, 'idea_canvas');
    assert.deepEqual(result.manifest.scene.components, ['idea_nodes']);
    assert.deepEqual(result.manifest.interactions, ['hint', 'quiz']);
    assert.equal(result.manifest.persona.id, 'brainstorm_partner');
    assert.equal(Object.hasOwn(result.manifest, 'layout_mode'), false);
  } finally { globalThis.fetch = originalFetch; }
});


test('current_manifest is allowlisted before it reaches the provider and legacy schemas are upgraded', async () => {
  let capturedUser = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    capturedUser = JSON.parse(init.body).input?.[1]?.content || '';
    return new Response(JSON.stringify({
      id: 'resp-manifest-safe',
      output_text: JSON.stringify({
        activity: 'reading',
        scene: { engine_id: 'focus_reader', environment: 'quiet_archive', components: ['reader_document', 'field_notes'] },
        interactions: ['hint', 'quiz'], persona_id: 'reading_guide',
        capabilities: { code_editor: false, terminal: false, timer_type: 'none', bgm_recommendation: 'none' },
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
        ai_persona: { id: 'code_coach', system_prompt: 'ST-ABCDE-FGHIJ-KLMNO-PQRST' },
        active_tools: { code_editor: true, terminal: true, timer_type: 'pomodoro' },
        hidden: { secret: 'SHOULD_NOT_LEAVE_SERVER' },
      },
    });
    assert.doesNotMatch(capturedUser, /SHOULD_NOT_LEAVE_SERVER|ABCDE-FGHIJ/);
    assert.match(capturedUser, /"engine_id":"focus_reader"/);
    assert.match(capturedUser, /"components":\["reader_document","field_notes"\]/);
    assert.doesNotMatch(capturedUser, /layout_mode/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
