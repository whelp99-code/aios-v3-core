const { OpenKB } = require('../dist/index');

async function main() {
  const kb = new OpenKB('/tmp/aios-test-knowledge');

  await kb.ingestion.ingest({
    type: 'skill',
    data: { name: 'test-skill', description: 'A test skill for validation' },
  });

  await kb.ingestion.ingest({
    type: 'workflow',
    data: { taskInput: 'Build API', plan: '1. Design\n2. Implement', executionResult: 'Done' },
  });

  const query = kb.rag.query('API');
  const issues = kb.validator.validate();

  console.log('Nodes:', kb.store.getStats().nodeCount);
  console.log('Query confidence:', query.confidence);
  console.log('Validation issues:', issues.length);
  console.log('Projects:', kb.memory.getAllProjects().length);

  if (kb.store.getStats().nodeCount < 2) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
