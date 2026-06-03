const { AIOS } = require('../dist/index');

async function main() {
  const aios = new AIOS({ dataDir: '/tmp/aios-core-test' });

  const result = await aios.run('Create a revenue tracking dashboard', { autoApprove: true });

  console.log('Agent:', result.state.currentAgent);
  console.log('Steps:', result.steps.length);
  console.log('Knowledge nodes:', result.knowledgeNodes);
  console.log('Stats:', JSON.stringify(aios.getStats(), null, 2));

  if (result.state.currentAgent !== 'completed') process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
