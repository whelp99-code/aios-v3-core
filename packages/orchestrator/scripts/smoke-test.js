const { LMStudioClient } = require('../../ai-core/dist/rapid-mlx-client');
const { ModelRouter } = require('../../ai-core/dist/model-router');
const { Orchestrator } = require('../dist/orchestrator');
const { SkillParser } = require('../dist/skill-parser');
const { createInitialWorkflowState } = require('../dist/types');

async function main() {
  const client = new LMStudioClient();
  const router = new ModelRouter(client);
  const parser = new SkillParser();

  const orchestrator = new Orchestrator(client, router, parser, { maxIterations: 5 });

  const initialState = createInitialWorkflowState('Implement a hello world API endpoint', {
    projectContext: { environment: 'test', priority: 'high' },
  });

  const result = await orchestrator.run(initialState, {
    userApprovalHandler: async () => true,
  });

  console.log('\n=== Workflow Result ===');
  console.log('Final Agent:', result.currentAgent);
  console.log('Plan preview:', result.plan?.slice(0, 80));
  console.log('Knowledge Updates:', result.knowledgeGraphUpdates.length);
  console.log('Agent Team:', result.agentTeam.map((a) => `${a.role}:${a.model}`).join(', '));

  if (result.currentAgent !== 'completed') {
    throw new Error(`Expected completed, got ${result.currentAgent}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
