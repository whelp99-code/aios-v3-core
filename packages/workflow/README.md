# @aios/workflow

Mastra-based orchestrator workflow package for the AIOS v3 core.

## Overview

This package implements a multi-agent workflow system using Mastra's Step and Workflow primitives. It provides a pipeline architecture where:

1. **Planner Agent** - Analyzes goals and creates execution plans
2. **Executor Agent** - Executes the plan step by step
3. **Critic Agent** - Reviews results and provides approval or correction feedback

## Architecture

```
Planner → Executor → Critic
                          ↓
                    (APPROVED → done)
                    (NEEDS_CORRECTION → loop back)
```

The `WorkflowEngine` chains these agents and supports iterative correction loops.

## Usage

### Quick Start

```typescript
import { WorkflowEngine, AgentFactory } from '@aios/workflow';

const engine = new WorkflowEngine({ maxIterations: 3 });

const result = await engine.run({
  goal: 'Build a REST API for user management',
  input: 'Create endpoints for CRUD operations',
});
```

### Single Agent Execution

```typescript
import { WorkflowEngine } from '@aios/workflow';

const engine = new WorkflowEngine();
const result = await engine.runSingleAgent('planner', {
  goal: 'Design a database schema',
  input: 'For an e-commerce application',
});
```

### Using Workflows Directly

```typescript
import { createMainWorkflow, runMainWorkflow } from './workflows/main-workflow';

const result = await runMainWorkflow({
  goal: 'Analyze data trends',
  input: 'Sales data from Q1 2024',
});
```

### Agent Factory

```typescript
import { AgentFactory } from '@aios/workflow';

const planner = AgentFactory.create('planner');
const allAgents = AgentFactory.createAll();
const types = AgentFactory.getAgentTypes();
```

## Configuration

### Environment Variables

- `LLM_API_URL` - LLM API endpoint (default: `http://localhost:11434`)
- `LLM_MODEL` - Model name (default: `llama3`)

### WorkflowEngine Options

```typescript
new WorkflowEngine({
  maxIterations: 3,  // Max correction loops before failure
});
```

## File Structure

```
src/
├── index.ts              # Package exports
├── types.ts              # Type definitions
├── workflow-engine.ts    # Core engine with run/runSingleAgent
└── agents/
    ├── planner-agent.ts   # Planning step
    ├── executor-agent.ts  # Execution step
    ├── critic-agent.ts    # Review step
    └── agent-factory.ts   # Factory pattern for agents

workflows/
├── main-workflow.ts      # Full pipeline: plan → execute → review
└── review-workflow.ts    # Review pipeline: execute → review
```

## PR-06: Mastra-based Orchestrator Redesign

This package is part of the Mastra-based orchestrator redesign for AIOS v3. It replaces the previous ad-hoc agent orchestration with Mastra's structured Step/Workflow primitives, providing:

- Type-safe agent interfaces
- Composable workflow steps
- Built-in iteration and correction loops
- Clean separation of concerns

## Development

```bash
npm install
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm run clean    # Remove dist/
```
