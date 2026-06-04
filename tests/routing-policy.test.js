const test = require('node:test');
const assert = require('node:assert');
const { isSimpleCloudTask } = require('../packages/ai-core/dist/routing-policy');

test('critic chat is a simple task (free-tier Gemini)', () => {
  assert.strictEqual(isSimpleCloudTask('critic', 'chat'), true);
});

test('knowledge_updater chat is simple', () => {
  assert.strictEqual(isSimpleCloudTask('knowledge_updater', 'chat'), true);
});

test('planner reasoning is NOT simple', () => {
  assert.strictEqual(isSimpleCloudTask('planner', 'reasoning'), false);
});

test('executor code is NOT simple', () => {
  assert.strictEqual(isSimpleCloudTask('executor', 'code'), false);
});

test('self_corrector is never simple even for chat', () => {
  assert.strictEqual(isSimpleCloudTask('self_corrector', 'chat'), false);
});

test('code/reasoning task types are never simple', () => {
  assert.strictEqual(isSimpleCloudTask('critic', 'code'), false);
  assert.strictEqual(isSimpleCloudTask('critic', 'reasoning'), false);
});
