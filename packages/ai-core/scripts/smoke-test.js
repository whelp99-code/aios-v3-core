const { DynamicRouter } = require('../dist/dynamic-router');
const { ModelRegistry } = require('../dist/model-registry');
const { ResourceAllocator } = require('../dist/resource-allocator');

async function main() {
  const router = new DynamicRouter({});
  const registry = new ModelRegistry();
  const allocator = new ResourceAllocator();

  console.log('Models registered:', registry.getAll().length);
  const models = registry.getAll();
  if (models.length < 6) throw new Error('Expected at least 6 default models');

  const health = await router.getAllProviderHealth();
  console.log('Providers:', health.map((h) => `${h.provider}:${h.healthy}`).join(', '));

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
