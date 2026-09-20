import test from 'node:test';
import assert from 'node:assert/strict';
import { AiGateway, aiConfigurationStatus } from '../src/services/ai-gateway.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
};

test('AI configuration requires provider key and model but never requires them in source code', () => {
  assert.equal(aiConfigurationStatus({}).configured, false);
  assert.deepEqual(aiConfigurationStatus({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'secret', OPENAI_MODEL: 'model-x' }), { configured: true, provider: 'openai', model: 'model-x' });
});

test('OpenAI adapter uses Responses structured output and returns usage metadata', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ id: 'resp_1', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }], usage: { input_tokens: 11, output_tokens: 3 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const gateway = new AiGateway({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'secret', OPENAI_MODEL: 'model-x' });
    const result = await gateway.structured({ system: 'system', user: 'user', schema, schemaName: 'test_schema' });
    assert.equal(captured.url, 'https://api.openai.com/v1/responses');
    assert.equal(captured.body.text.format.type, 'json_schema');
    assert.equal(captured.body.text.format.strict, true);
    assert.equal(captured.body.store, false);
    assert.deepEqual(result.data, { ok: true });
    assert.deepEqual(result.usage, { inputTokens: 11, outputTokens: 3 });
  } finally { globalThis.fetch = originalFetch; }
});

test('Gemini adapter uses JSON response schema', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ responseId: 'g1', candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const gateway = new AiGateway({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'secret', GEMINI_MODEL: 'gemini-test' });
    const result = await gateway.structured({ system: 'system', user: 'user', schema, schemaName: 'test_schema' });
    assert.match(captured.url, /generativelanguage\.googleapis\.com/);
    assert.equal(captured.body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(captured.body.generationConfig.responseSchema, schema);
    assert.deepEqual(result.data, { ok: true });
  } finally { globalThis.fetch = originalFetch; }
});

test('OpenAI PDF adapter sends the PDF directly with store=false and structured output', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      id: 'resp_pdf_1',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"title":"문서","sections":["첫 구간"]}' }] }],
      usage: { input_tokens: 17, output_tokens: 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const gateway = new AiGateway({ AI_PROVIDER: 'openai', AI_API_KEY: 'secret', AI_MODEL: 'model-x' });
    const pdfSchema = {
      type: 'object', additionalProperties: false,
      properties: { title: { type: 'string' }, sections: { type: 'array', items: { type: 'string' } } },
      required: ['title', 'sections'],
    };
    const buffer = new TextEncoder().encode('%PDF-1.7 test').buffer;
    const result = await gateway.pdfStructured({ system: 'system', prompt: 'extract', fileName: 'doc.pdf', buffer, schema: pdfSchema, schemaName: 'pdf_test' });
    assert.equal(captured.url, 'https://api.openai.com/v1/responses');
    assert.equal(captured.body.store, false);
    const user = captured.body.input.find((item) => item.role === 'user');
    const filePart = user.content.find((part) => part.type === 'input_file');
    assert.match(filePart.file_data, /^data:application\/pdf;base64,/);
    assert.equal(captured.body.text.format.type, 'json_schema');
    assert.deepEqual(result.data, { title: '문서', sections: ['첫 구간'] });
  } finally { globalThis.fetch = originalFetch; }
});
