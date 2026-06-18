# @aios/karpathy-loop

Karpathy-style automatic learning loop for iterative code improvement.

## Overview

This package implements Andrej Karpathy's approach to automated code improvement through iterative feedback loops. The system continuously analyzes code, proposes improvements, generates patches, tests them, and commits successful changes.

## The Learning Loop

```
Analyze Code → Propose Improvement → Generate Patch → Test → Commit/Rollback → Repeat
```

### Loop Pattern

1. **Analyze Code**: Read the current state of the codebase
2. **Propose Improvement**: Use an LLM to generate a specific improvement proposal
3. **Generate Patch**: Create the actual code changes based on the proposal
4. **Test**: Run the modified code in a sandbox to verify it works
5. **Evaluate**: Score the improvement (positive = better)
6. **Commit or Rollback**: Keep improvements that pass tests and show gains; revert others
7. **Record**: Log successful patterns for future reference
8. **Repeat**: Continue until max iterations reached or convergence

## Installation

```bash
npm install @aios/karpathy-loop
```

## Usage

### Basic Usage

```typescript
import { KarpathyLoop } from '@aios/karpathy-loop';

const loop = new KarpathyLoop({
  codebasePath: './src/main.ts',
  maxIterations: 20,
  improvementThreshold: 0.1,
});

const report = await loop.run();
console.log(`Committed ${report.committedCount} improvements`);
console.log(`Total improvement: ${report.totalImprovement.toFixed(3)}`);
```

### With Callbacks

```typescript
const loop = new KarpathyLoop({
  codebasePath: './src/main.ts',
  maxIterations: 10,
  onIteration: (iteration) => {
    console.log(`Iteration ${iteration.iteration}: ${iteration.committed ? '✓' : '✗'}`);
  },
});
```

### Overnight Scheduling

```typescript
import { KarpathyLoop, OvernightScheduler } from '@aios/karpathy-loop';

const scheduler = new OvernightScheduler({
  enabled: true,
  startTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours from now
  maxIterations: 20,
  cooldownMinutes: 5,
});

await scheduler.start(async () => {
  const loop = new KarpathyLoop({
    codebasePath: './src/main.ts',
    maxIterations: 5,
  });
  await loop.run();
});

// To stop early
// scheduler.stop();
```

### Code Patching

```typescript
import { CodePatcher } from '@aios/karpathy-loop';

const patcher = new CodePatcher();

// Apply a patch
const previous = await patcher.applyPatch({
  filePath: './src/main.ts',
  content: 'new code here',
  description: 'Improved function',
});

// Rollback if needed
await patcher.rollback('./src/main.ts');
```

## Configuration

### LoopOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `codebasePath` | `string` | required | Path to the file to improve |
| `maxIterations` | `number` | `20` | Maximum loop iterations |
| `improvementThreshold` | `number` | `0.1` | Minimum improvement to commit |
| `model` | `string` | `'default'` | LLM model to use |
| `onIteration` | `function` | - | Callback for iteration progress |

### ScheduleConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Whether scheduling is active |
| `startTime` | `string` | required | ISO string for when to start |
| `maxIterations` | `number` | `20` | Max iterations per scheduled run |
| `cooldownMinutes` | `number` | `5` | Minutes between iterations |

## API

### KarpathyLoop

Main class implementing the learning loop.

- `run(): Promise<LoopReport>` - Execute the full learning loop
- `getIterationCount(): number` - Get current iteration count
- `getIterations(): LoopIteration[]` - Get all iterations

### OvernightScheduler

Schedules execution at specific times.

- `start(fn: () => Promise<void>): Promise<boolean>` - Start the scheduler
- `stop(): void` - Cancel scheduled execution
- `runNow(): Promise<void>` - Execute immediately
- `isRunning(): boolean` - Check if scheduler is active

### CodePatcher

Handles code modifications with backup/rollback.

- `applyPatch(patch: CodePatch): Promise<string>` - Apply a patch
- `rollback(filePath: string): Promise<boolean>` - Revert changes
- `clearBackups(): void` - Clear all backups

### TestRunner

Executes tests on modified code.

- `runTest(filePath: string, testCode?: string): Promise<TestResult>` - Run tests
- `validateSyntax(code: string): Promise<TestResult>` - Check syntax

## Types

### LoopIteration

```typescript
interface LoopIteration {
  iteration: number;
  proposal: string;
  patch: string;
  testResult: TestResult;
  committed: boolean;
  improvement: number;
}
```

### LoopReport

```typescript
interface LoopReport {
  totalIterations: number;
  committedCount: number;
  rolledBackCount: number;
  totalImprovement: number;
  iterations: LoopIteration[];
}
```

## License

MIT
