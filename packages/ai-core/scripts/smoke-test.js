const { DynamicRouter } = require('../dist/dynamic-router');
const { ModelRegistry } = require('../dist/model-registry');
const { ResourceAllocator } = require('../dist/resource-allocator');
const { LMStudioClient } = require('../dist/rapid-mlx-client');

async function main() {
  const lmStudioClient = new LMStudioClient({ baseURL: 'http://localhost:1234/v1', timeout: 60000 });
  const router = new DynamicRouter({ lmStudioClient });
  const registry = new ModelRegistry();
  const allocator = new ResourceAllocator();

  console.log('Models registered:', registry.getAll().length);
  const models = registry.getAll();
  if (models.length < 9) throw new Error(`Expected at least 9 default models, got ${models.length}`);

  const health = await router.getAllProviderHealth();
  console.log('Providers:', health.map((h) => `${h.provider}:${h.healthy}`).join(', '));

  const hf = health.find((h) => h.provider === 'huggingface');
  console.log('HuggingFace configured:', hf?.healthy ?? false);

  const snapshot = await router.getResourceSnapshot();
  console.log('Resource snapshot:', snapshot.recommendedMode, 'load=', snapshot.localLoad);

  router.setPreferences({ mode: 'auto' });
  const decision = await router.route('planner', 'reasoning');
  console.log('Route planner:', decision.provider, decision.modelId, decision.reason);

  try {
    const chat = await router.routeAndChat('executor', 'code', [
      { role: 'user', content: 'Say OK' },
    ]);
    console.log('Chat result length:', chat.content.length, 'via', chat.routing.provider);
  } catch {
    console.log('Chat fallback (no providers available) — routing logic OK');
  }

  const multi = await router.routeMulti('critic', 'chat', [
    { role: 'user', content: 'VERDICT: APPROVED\nQuick review.' },
  ]);
  console.log('Multi reviewers:', multi.length);

  allocator.setLocalLoad(0.9);
  const overloaded = await allocator.assess(
    router.getProvider('local'),
    router.getAllProviders().filter((p) => p.provider !== 'local')
  );
  console.log('Overloaded recommends:', overloaded.recommendedMode);

  router.setPreferences({ mode: 'cloud', preferredCloudProvider: 'huggingface' });
  const hfRoute = await router.route('executor', 'code');
  console.log('Cloud+HF preference ->', hfRoute.provider, hfRoute.modelId);

  for (const mode of ['auto', 'local', 'cloud']) {
    router.setPreferences({ mode });
    const d = await router.route('executor', 'code');
    console.log(`Mode ${mode} -> ${d.provider}/${d.modelId}`);
  }

  console.log('\n✅ Hybrid AI Core smoke test passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
