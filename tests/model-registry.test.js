const test = require('node:test');
const assert = require('node:assert');
const { ModelRegistry } = require('../packages/ai-core/dist/model-registry');

test('registry includes mimo and google models', () => {
  const registry = new ModelRegistry();
  const providers = new Set(registry.getAll().map((m) => m.provider));
  assert.ok(providers.has('mimo'), 'expected mimo models');
  assert.ok(providers.has('google'), 'expected google models');
  assert.ok(providers.has('local'), 'expected local models');
});

test('getForRole returns a model per role', () => {
  const registry = new ModelRegistry();
  for (const role of ['planner', 'executor', 'critic', 'knowledge_updater', 'self_corrector']) {
    const model = registry.getForRole(role);
    assert.ok(model, `expected a model for role ${role}`);
  }
});

test('getForRole prefers cheapest then fastest within a provider', () => {
  const registry = new ModelRegistry();
  const googleModels = registry.getByProvider('google');
  const cheapest = [...googleModels].sort(
    (a, b) => a.costPerToken - b.costPerToken || a.latencyMs - b.latencyMs
  )[0];
  const picked = registry.getForRole('critic', 'google');
  assert.strictEqual(picked.modelId, cheapest.modelId);
});

test('gemini models expose large context window', () => {
  const registry = new ModelRegistry();
  const gemini = registry.get('gemini-2.5-flash', 'google');
  assert.ok(gemini);
  assert.ok(gemini.contextWindow >= 1000000);
});
