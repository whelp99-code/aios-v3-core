const test = require('node:test');
const assert = require('node:assert');
const { ResourceAllocator } = require('../packages/ai-core/dist/resource-allocator');

function fakeProvider(provider, configured = true) {
  return {
    provider,
    isConfigured: () => configured,
    healthCheck: async () => ({ provider, healthy: true }),
    chatCompletion: async () => ({ choices: [{ message: { content: '' } }] }),
    listModels: async () => [],
  };
}

test('pickCloudProvider prefers mimo by default', () => {
  const alloc = new ResourceAllocator();
  const picked = alloc.pickCloudProvider([
    fakeProvider('local'),
    fakeProvider('openai'),
    fakeProvider('mimo'),
    fakeProvider('google'),
  ]);
  assert.strictEqual(picked.provider, 'mimo');
});

test('pickCloudProvider honors explicit preference', () => {
  const alloc = new ResourceAllocator();
  const picked = alloc.pickCloudProvider(
    [fakeProvider('mimo'), fakeProvider('openai'), fakeProvider('anthropic')],
    'anthropic'
  );
  assert.strictEqual(picked.provider, 'anthropic');
});

test('pickCloudProvider can exclude google (free-tier guard)', () => {
  const alloc = new ResourceAllocator();
  const picked = alloc.pickCloudProvider(
    [fakeProvider('google'), fakeProvider('openai')],
    undefined,
    { exclude: ['google'] }
  );
  assert.strictEqual(picked.provider, 'openai');
});

test('pickCloudProvider skips local and unconfigured', () => {
  const alloc = new ResourceAllocator();
  const picked = alloc.pickCloudProvider([
    fakeProvider('local'),
    fakeProvider('mimo', false),
    fakeProvider('openai', true),
  ]);
  assert.strictEqual(picked.provider, 'openai');
});

test('pickCloudProvider returns undefined when none configured', () => {
  const alloc = new ResourceAllocator();
  const picked = alloc.pickCloudProvider([fakeProvider('local')]);
  assert.strictEqual(picked, undefined);
});

test('resolveMode forces local when requested', () => {
  const alloc = new ResourceAllocator();
  const mode = alloc.resolveMode('local', { cloudAvailable: true, localHealthy: false });
  assert.strictEqual(mode, 'local');
});

test('resolveMode falls back to local when cloud unavailable', () => {
  const alloc = new ResourceAllocator();
  const mode = alloc.resolveMode('cloud', { cloudAvailable: false, localHealthy: true });
  assert.strictEqual(mode, 'local');
});
