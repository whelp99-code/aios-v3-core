# AIOS v3.0 코어 엔진 개발 지시서: Swarm-Native Orchestrator 구현

## 1. 개요

본 문서는 AIOS v3.0의 핵심인 **Swarm-Native Orchestrator** 구현을 위한 상세 개발 지시서입니다. 이 오케스트레이터는 LangGraph.js를 기반으로 다수의 에이전트(Planner, Executor, Critic 등)가 협력하여 복잡한 태스크를 수행하고, 자가 진화 및 지식 그래프 연동을 위한 기반을 마련합니다. 개발팀은 Cursor, VS Code, Antigravity 등 선호하는 IDE 툴을 활용하여 아래 지시사항에 따라 코드를 작성하고 구현합니다.

## 2. 목표

*   LangGraph.js를 활용하여 다중 에이전트(Planner, Executor, Critic) 워크플로우의 기본 구조를 구현합니다.
*   `AgentWorkflowState` 인터페이스를 정의하고, 각 에이전트 노드가 상태를 업데이트하도록 합니다.
*   `SkillParser`를 오케스트레이터에 통합하여 `SKILL.md`를 해석할 수 있는 기반을 마련합니다.
*   Rapid-MLX 클라이언트와 모델 라우터를 오케스트레이터에 연결합니다.

## 3. 개발 환경 설정 확인

개발을 시작하기 전에 다음 사항을 확인합니다.

*   Node.js (v20 이상) 및 pnpm 설치 완료
*   `/home/ubuntu/aios` 모노레포 구조 설정 완료
*   `packages/orchestrator` 및 `packages/ai-core` 디렉토리 생성 및 기본 `package.json`, `tsconfig.json` 설정 완료
*   `packages/ai-core`에 `rapid-mlx-client.ts` 및 `model-router.ts` 구현 완료
*   `packages/orchestrator`에 `types.ts` 및 `skill-parser.ts` 구현 완료

## 4. `packages/orchestrator` 구현 상세 지시

### 4.1. `packages/orchestrator/src/types.ts` 업데이트

`AgentWorkflowState` 인터페이스를 확장하여 Swarm Intelligence, Knowledge Graph, Self-Evolution을 위한 상태 변수들을 추가합니다. 이는 에이전트 간의 풍부한 정보 교환과 엔진의 자가 진화에 필수적입니다.

**파일**: `/home/ubuntu/aios/packages/orchestrator/src/types.ts`

**지시**: 기존 `AgentWorkflowState` 인터페이스에 다음 필드를 추가합니다.

```typescript
// /home/ubuntu/aios/packages/orchestrator/src/types.ts

export type AgentState = 'planner' | 'executor' | 'critic' | 'user_approval' | 'skill_refinement' | 'completed' | 'failed';

export interface AgentWorkflowState {
  currentAgent: AgentState;
  taskInput: string;
  plan: string | null;
  executionResult: string | null;
  review: string | null;
  lastOutput: string | null;
  
  // --- v3.0 Core Enhancements ---
  availableSkills: string[]; // 현재 로드된 스킬 목록 (SKILL.md 파일명 등)
  knowledgeGraphUpdates: any[]; // 지식 그래프에 반영될 업데이트 (노드, 엣지 정보)
  codeChangesProposed: { filePath: string; diff: string; }[] | null; // 자가 진화 에이전트가 제안한 코드 변경 사항
  userApprovalRequired: boolean; // 사용자 승인이 필요한지 여부 (3단계 승인 루프)
  compensationActions: string[]; // 실패 시 수행할 보상 작업 목록
  agentTeam: { role: string; model: string; }[]; // 현재 워크플로우에 참여하는 에이전트 팀 구성
  projectContext: any; // 현재 프로젝트의 전반적인 컨텍스트 (예: 목표, 제약사항)
}
```

### 4.2. `packages/orchestrator/src/orchestrator.ts` 구현

LangGraph.js를 사용하여 Swarm-Native Orchestrator의 핵심 로직을 구현합니다. 각 에이전트 노드는 `AgentWorkflowState`를 입력받아 처리하고, 다음 상태를 반환합니다.

**파일**: `/home/ubuntu/aios/packages/orchestrator/src/orchestrator.ts`

**지시**: 다음 코드 스니펫을 기반으로 `Orchestrator` 클래스를 구현합니다. 특히 `StateGraphArgs`의 `channels` 정의와 각 에이전트 노드의 로직을 상세화합니다.

```typescript
// /home/ubuntu/aios/packages/orchestrator/src/orchestrator.ts

import { StateGraph, StateGraphArgs, CompiledGraph } from '@langchain/langgraph';
import { AgentState, AgentWorkflowState } from './types';
import { RapidMLXClient } from '@aios/ai-core/rapid-mlx-client';
import { ModelRouter } from '@aios/ai-core/model-router';
import { SkillParser } from './skill-parser';

export class Orchestrator {
  private workflow: CompiledGraph<AgentWorkflowState>;
  private rapidMLXClient: RapidMLXClient;
  private modelRouter: ModelRouter;
  private skillParser: SkillParser;

  constructor(rapidMLXClient: RapidMLXClient, modelRouter: ModelRouter, skillParser: SkillParser) {
    this.rapidMLXClient = rapidMLXClient;
    this.modelRouter = modelRouter;
    this.skillParser = skillParser;

    // Define the state channels with reducers and default values
    const stateGraphArgs: StateGraphArgs<AgentWorkflowState> = {
      channels: {
        currentAgent: { reducer: (x: AgentState, y: AgentState) => y, default: () => 'planner' as AgentState },
        taskInput: { reducer: (x: string, y: string) => y, default: () => '' },
        plan: { reducer: (x: string | null, y: string | null) => y, default: () => null },
        executionResult: { reducer: (x: string | null, y: string | null) => y, default: () => null },
        review: { reducer: (x: string | null, y: string | null) => y, default: () => null },
        lastOutput: { reducer: (x: string | null, y: string | null) => y, default: () => null },
        availableSkills: { reducer: (x: string[], y: string[]) => y, default: () => [] },
        knowledgeGraphUpdates: { reducer: (x: any[], y: any[]) => x.concat(y), default: () => [] },
        codeChangesProposed: { reducer: (x: any[] | null, y: any[] | null) => y, default: () => null },
        userApprovalRequired: { reducer: (x: boolean, y: boolean) => y, default: () => false },
        compensationActions: { reducer: (x: string[], y: string[]) => y, default: () => [] },
        agentTeam: { reducer: (x: { role: string; model: string; }[], y: { role: string; model: string; }[]) => y, default: () => [] },
        projectContext: { reducer: (x: any, y: any) => y, default: () => ({}) },
      },
    };

    const graphBuilder = new StateGraph<AgentWorkflowState>(stateGraphArgs);

    // --- Agent Nodes (Swarm Intelligence) ---
    graphBuilder.addNode('planner', async (state: AgentWorkflowState) => {
      console.log('Planner: Analyzing task and creating initial plan...');
      // TODO: Use modelRouter to select appropriate LLM (e.g., DeepSeek-R1) for planning
      // TODO: Integrate skillParser to identify relevant skills from state.availableSkills
      // TODO: Generate a detailed plan, potentially breaking down into sub-tasks (TODO-based decomposition)
      const llm = this.modelRouter.getModelForRole('planner');
      const plan = `Plan for task: ${state.taskInput}\n1. Analyze requirements\n2. Identify necessary skills\n3. Outline execution steps`; // Placeholder
      return { ...state, currentAgent: 'planner', plan: plan, lastOutput: plan, userApprovalRequired: true }; // Initial plan often requires user approval
    });

    graphBuilder.addNode('executor', async (state: AgentWorkflowState) => {
      console.log('Executor: Executing plan step...');
      // TODO: Use modelRouter to select appropriate LLM (e.g., Qwen2.5-Coder) for execution
      // TODO: Execute the current step of the plan, using available tools/skills
      // TODO: Capture execution result, potential errors, and proposed code changes
      const llm = this.modelRouter.getModelForRole('executor');
      const executionResult = `Executed step based on plan: ${state.plan}`; // Placeholder
      const proposedChanges = [{ filePath: 'src/main.ts', diff: 'diff content' }]; // Placeholder for self-evolution
      return { ...state, currentAgent: 'executor', executionResult: executionResult, lastOutput: executionResult, codeChangesProposed: proposedChanges };
    });

    graphBuilder.addNode('critic', async (state: AgentWorkflowState) => {
      console.log('Critic: Reviewing execution result and proposed changes...');
      // TODO: Use modelRouter to select appropriate LLM (e.g., Llama3.2) for critical review
      // TODO: Evaluate executionResult and codeChangesProposed against the original plan and goals
      // TODO: Determine if self-correction is needed, or if user approval is required
      const llm = this.modelRouter.getModelForRole('critic');
      const review = `Review of execution: ${state.executionResult}. Changes proposed: ${state.codeChangesProposed ? 'Yes' : 'No'}`; // Placeholder
      const needsCorrection = Math.random() > 0.7; // Simulate need for correction
      return { ...state, currentAgent: 'critic', review: review, lastOutput: review, userApprovalRequired: needsCorrection };
    });

    graphBuilder.addNode('self_corrector', async (state: AgentWorkflowState) => {
      console.log('Self-Corrector: Applying feedback and refining plan/code...');
      // TODO: Based on critic's review, modify the plan or codeChangesProposed
      // TODO: This is where Hyper-Self-Evolution begins to manifest
      const refinedPlan = `Refined plan based on review: ${state.review}`; // Placeholder
      return { ...state, currentAgent: 'planner', plan: refinedPlan, lastOutput: refinedPlan, userApprovalRequired: false };
    });

    graphBuilder.addNode('knowledge_updater', async (state: AgentWorkflowState) => {
      console.log('Knowledge Updater: Integrating new insights into Knowledge Graph...');
      // TODO: Process executionResult, review, and codeChangesProposed to extract new knowledge
      // TODO: Use OpenKB/GraphRAG logic to update the Infinite Knowledge Graph
      const newKnowledge = { type: 'skill_update', content: 'Skill X improved' }; // Placeholder
      return { ...state, currentAgent: 'knowledge_updater', knowledgeGraphUpdates: [...state.knowledgeGraphUpdates, newKnowledge], lastOutput: 'Knowledge Graph updated' };
    });

    // --- Edges (Transitions) ---
    graphBuilder.addEdge('planner', 'executor');
    graphBuilder.addEdge('executor', 'critic');
    
    // Conditional edge from critic for self-correction or completion
    graphBuilder.addConditionalEdges(
      'critic',
      (state: AgentWorkflowState) => {
        if (state.userApprovalRequired) {
          return 'user_approval'; // If user approval is needed
        } else if (state.review && state.review.includes('needs correction')) {
          return 'self_corrector'; // If self-correction is needed
        } else {
          return 'knowledge_updater'; // If task is good, update knowledge
        }
      },
      { user_approval: 'user_approval', self_corrector: 'self_corrector', knowledge_updater: 'knowledge_updater' }
    );

    graphBuilder.addEdge('self_corrector', 'planner'); // After self-correction, re-plan
    graphBuilder.addEdge('knowledge_updater', 'completed'); // After knowledge update, task is completed

    // TODO: Add user_approval node and transition back to planner/executor or to completed
    graphBuilder.addNode('user_approval', async (state: AgentWorkflowState) => {
      console.log('User Approval: Waiting for user decision...');
      // This node would typically block and wait for external input
      // For now, we'll simulate approval and go back to planner or complete
      const userApproved = true; // Simulate user approval
      if (userApproved) {
        return { ...state, currentAgent: 'planner', userApprovalRequired: false, lastOutput: 'User approved, continuing with plan' };
      } else {
        return { ...state, currentAgent: 'planner', userApprovalRequired: false, lastOutput: 'User rejected, re-planning' };
      }
    });
    graphBuilder.addEdge('user_approval', 'planner'); // After user approval, go back to planner to continue or re-plan

    // Set the entry point and exit point
    graphBuilder.setEntryPoint('planner');
    graphBuilder.setExitPoint('completed');

    this.workflow = graphBuilder.compile();
  }

  async run(initialState: AgentWorkflowState): Promise<AgentWorkflowState> {
    console.log('Starting AIOS Orchestrator workflow...');
    const finalState = await this.workflow.invoke(initialState);
    console.log('AIOS Orchestrator workflow finished.');
    return finalState;
  }

  // TODO: Add methods for dynamic skill loading, agent management, etc.
}
```

### 4.3. `packages/orchestrator/src/skill-parser.ts` 통합

`SkillParser`는 `SKILL.md` 파일을 파싱하여 오케스트레이터가 사용할 수 있는 구조화된 스킬 정의를 제공합니다. 이 파서는 오케스트레이터의 `planner` 노드에서 사용될 예정입니다.

**파일**: `/home/ubuntu/aios/packages/orchestrator/src/skill-parser.ts`

**지시**: `SkillParser` 클래스를 구현합니다. 이 클래스는 `SKILL.md` 파일의 YAML 프런트매터와 본문을 파싱하여 스킬의 메타데이터와 실행 단계를 추출합니다.

```typescript
// /home/ubuntu/aios/packages/orchestrator/src/skill-parser.ts

import * as yaml from 'js-yaml';

export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  inputs: { [key: string]: string };
  outputs: { [key: string]: string };
  tools: string[];
}

export interface SkillDefinition {
  metadata: SkillMetadata;
  steps: string; // Markdown content of the skill steps
}

export class SkillParser {
  parse(skillMarkdown: string): SkillDefinition {
    const parts = skillMarkdown.split('---\n');
    if (parts.length < 3) {
      throw new Error('Invalid SKILL.md format: Missing YAML frontmatter or content separator.');
    }

    const metadataYaml = parts[1];
    const stepsMarkdown = parts.slice(2).join('---\n').trim();

    const metadata = yaml.load(metadataYaml) as SkillMetadata;

    // Basic validation
    if (!metadata.name || !metadata.description || !metadata.version) {
      throw new Error('Invalid SKILL.md metadata: Missing required fields (name, description, version).');
    }

    return {
      metadata,
      steps: stepsMarkdown,
    };
  }

  // TODO: Add methods to validate skill steps against available tools, etc.
}
```

### 4.4. `packages/orchestrator/package.json` 및 `tsconfig.json` 업데이트

새로운 의존성(`js-yaml`, `@types/js-yaml`)을 추가하고, TypeScript 컴파일 설정을 확인합니다.

**파일**: `/home/ubuntu/aios/packages/orchestrator/package.json`

**지시**: `dependencies`에 `js-yaml`과 `devDependencies`에 `@types/js-yaml`을 추가합니다.

```json
// /home/ubuntu/aios/packages/orchestrator/package.json
{
  
