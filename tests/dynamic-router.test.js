const test = require('node:test');
const assert = require('node:assert');
const { DynamicRouter } = require('../packages/ai-core/dist/dynamic-router');

// Local Rapid-MLX is unreachable in CI, so routing falls through to cloud logic.
test('critic/chat routes to free-tier Gemini when google is configured', async () => {
  const router = new DynamicRouter({ googleApiKey: 'test-key' });
  router.setPreferences({ mode: 'auto', securityLevel: 'cloud_secure', preferredCloudProvider: 'mimo' });
  const decision = await router.route('critic', 'chat');
  assert.strictEqual(decision.provider, 'google');
  assert.match(decision.modelId, /^gemini/);
});

test('executor/code does NOT route to Gemini free tier', async () => {
  const router = new DynamicRouter({ googleApiKey: 'test-key' });
  router.setPreferences({ mode: 'cloud', securityLevel: 'cloud_secure', preferredCloudProvider: 'mimo' });
  const decision = await router.route('executor', 'code');
  assert.notStrictEqual(decision.provider, 'google');
});

test('AIOS_GOOGLE_SIMPLE_TASKS=0 disables Gemini free-tier routing', async () => {
  process.env.AIOS_GOOGLE_SIMPLE_TASKS = '0';
  const router = new DynamicRouter({ googleApiKey: 'test-key' });
  router.setPreferences({ mode: 'auto', securityLevel: 'cloud_secure', preferredCloudProvider: 'mimo' });
  const decision = await router.route('critic', 'chat');
  assert.notStrictEqual(decision.provider, 'google');
  delete process.env.AIOS_GOOGLE_SIMPLE_TASKS;
});
