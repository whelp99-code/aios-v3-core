# @aios/hyperagents

> **PR-09** · Meta-cognitive system for reflective, self-improving agents.

## Concept

A **Task Agent** does the work.
A **Meta Agent** reflects on *how* that work was done, diagnoses failures,
and modifies the program itself to improve future outcomes.

```
┌──────────────────────────────────────────────────┐
│                 RecursiveImprover                │
│  ┌─────────────────────────────────────────────┐ │
│  │           MetaCognitiveAgent                │ │
│  │                                             │ │
│  │  reflect(ctx) → Reflection                  │ │
│  │       ↕                                     │ │
│  │  selfModify(reflection, code) → newCode     │ │
│  └──────────────────┬──────────────────────────┘ │
│                     ▼                            │
│               SafetyGuard                        │
│         (max iterations / cooldown)              │
└──────────────────────────────────────────────────┘
```

## Installation

```bash
npm install @aios/hyperagents
```

## Quick Start

```ts
import { RecursiveImprover } from "@aios/hyperagents";
import type { MetaContext } from "@aios/hyperagents";

const context: MetaContext = {
  taskInput: "Parse CSV files efficiently",
  executionResult: "Timeout on 50 MB file",
  successRate: 0.4,
  recentFailures: ["OOM on large input", "Timeout on 50 MB file"],
  currentCode: `function parse(csv) { return csv.split("\\n"); }`,
};

const improver = new RecursiveImprover({
  maxIterations: 5,
  cooldownPeriod: 0,
});

const result = await improver.improve(context, (code) => {
  // Apply the patched code (write to disk, reload module, etc.)
  console.log("Applying patch:\n", code);
  return code;
});

console.log(`Completed ${result.totalIterations} improvement(s)`);
console.log("Final code:\n", result.finalCode);
```

## API

### `MetaCognitiveAgent`

| Method | Description |
|--------|-------------|
| `reflect(context: MetaContext): Reflection` | Analyses execution context and produces a structured `Reflection` |
| `selfModify(reflection, currentCode): string` | Validates confidence and applies the reflection's code patch |
| `recursiveImprove(context, apply, shouldContinue?)` | Runs iterative improvement up to `maxRecursiveDepth` |

### `SafetyGuard`

| Method | Description |
|--------|-------------|
| `canProceed(): boolean` | Checks iteration count and cooldown |
| `recordIteration(): void` | Bumps counter and records timestamp |
| `reset(): void` | Clears all state for a new run |
| `getStatus(): SafetyGuardStatus` | Returns a snapshot of the current guard state |

### `RecursiveImprover`

| Method | Description |
|--------|-------------|
| `improve(context, apply): Promise<ImprovementResult>` | Orchestrates the full reflect → patch → apply loop |
| `getSafetyStatus()` | Exposes the safety guard status |
| `reset()` | Resets the improver for a new run |

## Types

```ts
interface Reflection {
  analysis: string;
  rootCause: string;
  improvementProposal: string;
  codePatch: string;
  confidenceScore: number;
}

interface MetaContext {
  taskInput: string;
  executionResult: string;
  successRate: number;
  recentFailures: string[];
  currentCode: string;
}

interface SafetyConfig {
  maxIterations: number;
  cooldownPeriod: number;
}
```

## Safety

The `SafetyGuard` enforces hard limits on recursive self-modification:

- **maxIterations** — stops the loop after N iterations regardless of confidence.
- **cooldownPeriod** — enforces a minimum delay between iterations to prevent
  runaway CPU usage.

If the safety guard intervenes, `ImprovementResult.safetyIntervened` is `true`.

## License

MIT
