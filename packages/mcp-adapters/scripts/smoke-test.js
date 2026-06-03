const { MCPRegistry } = require('../dist/mcp-registry');

async function main() {
  const registry = new MCPRegistry();
  const health = await registry.healthCheckAll();

  console.log('\n=== MCP Adapter Health ===');
  for (const adapter of health) {
    console.log(`${adapter.name}: ${adapter.status} (${adapter.tools.length} tools)`);
  }

  const result = await registry.executeToolCall('vibe_create_project', {
    name: 'test-project',
    template: 'nextjs',
  });

  console.log('\n=== Tool Call Test ===');
  console.log(`${result.toolName}: ${result.success ? 'OK' : 'FAILED'}`);
  console.log(JSON.stringify(result.result, null, 2));

  if (!result.success) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
