# @aios/evolution

OpenSpace-based skill self-evolution engine for AIOS.

This package enables AI systems to automatically improve their skills through three evolution modes:

## Evolution Modes

### FIX
Auto-fix failed skills based on error feedback. When a skill fails during execution, the engine analyzes the error and generates an improved version.

### DERIVE
Create new specialized skills derived from existing high-performing ones. The engine uses an existing skill as a foundation and specializes it for a new purpose.

### CAPTURE
Extract reusable skills from successful execution records. The engine analyzes patterns across multiple successful runs and crystallizes them into reusable skills.

## Installation

```bash
npm install @aios/evolution
```

## Quick Start

```typescript
import { SkillStore, EvolutionEngine, SkillCapturer } from '@aios/evolution';

// Initialize the skill store (SQLite-backed)
const store = new SkillStore('./skills.db');

// Create a skill
const skill = store.save({
  name: 'code_formatter',
  content: 'Format code according to project conventions...',
});

// Initialize the evolution engine
const engine = new EvolutionEngine(store, {
  llmEndpoint: 'https://api.openai.com/v1',
  llmModel: 'gpt-4',
  llmApiKey: process.env.OPENAI_API_KEY,
});

// FIX a failed skill
const fixed = await engine.fixSkill(skill.id, 'Error: missing semicolons');

// DERIVE a new skill
const derived = await engine.deriveSkill(skill.id, 'Specialized for TypeScript');

// Record executions to update success rates
engine.recordExecution(skill.id, true);
engine.promoteSkill(skill.id, 0.8);

// Get stats
const stats = engine.getStats();
```

## API

### SkillStore

SQLite-backed persistent storage for skills.

- `save(skill)` - Save a new skill
- `findById(id)` - Find skill by ID
- `findByName(name)` - Find all versions of a skill by name
- `findTopSkills(limit)` - Get top skills by reward
- `findLatest(name)` - Get the latest version of a skill
- `incrementUsage(id)` - Increment usage counter
- `update(id, updates)` - Update skill properties
- `getLineage(id)` - Get the full parent chain of a skill

### EvolutionEngine

Core engine for skill evolution.

- `fixSkill(skillId, errorFeedback)` - FIX mode: auto-fix a failed skill
- `deriveSkill(parentSkillId, newPurpose)` - DERIVE mode: create new skill from existing
- `captureSkill(executions)` - CAPTURE mode: extract skills from execution records
- `autoEvolve(skillId?, executions?)` - Automatically choose the best strategy
- `promoteSkill(skillId, reward)` - Update skill reward
- `recordExecution(skillId, success)` - Record an execution result
- `getStats()` - Get evolution statistics

### SkillCapturer

Extracts reusable skills from successful executions.

- `capture(executions)` - Capture patterns from multiple executions
- `captureSingle(execution)` - Capture from a single execution
- `toSkill(pattern)` - Convert a captured pattern to a skill

## Database Schema

Skills are stored in SQLite with the following schema:

| Column       | Type    | Description                          |
|-------------|---------|--------------------------------------|
| id          | TEXT    | Unique identifier (UUID)             |
| name        | TEXT    | Skill name                           |
| content     | TEXT    | Skill content/instructions           |
| version     | INTEGER | Version number                       |
| parent_id   | TEXT    | ID of parent skill (if derived)      |
| reward      | REAL    | Reward score (0.0 - 1.0)            |
| usage_count | INTEGER | Number of times used                 |
| success_rate| REAL    | Success rate (0.0 - 1.0)            |
| metadata    | TEXT    | JSON metadata                        |
| created_at  | TEXT    | Creation timestamp                   |
| updated_at  | TEXT    | Last update timestamp                |

## License

MIT
