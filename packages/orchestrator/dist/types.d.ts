export type AgentState = 'planner' | 'executor' | 'critic' | 'user_approval' | 'skill_refinement' | 'self_corrector' | 'knowledge_updater' | 'completed' | 'failed';
export interface CodeChange {
    filePath: string;
    diff: string;
}
export type EngineMode = 'auto' | 'local' | 'cloud';
export interface AgentTeamMember {
    role: string;
    model: string;
    provider?: string;
}
export interface KnowledgeGraphUpdate {
    type: string;
    content: string;
    source?: string;
    timestamp?: string;
}
export interface MCPToolResultSummary {
    toolName: string;
    adapterId: string;
    success: boolean;
    result: unknown;
}
export interface WorkflowStepEvent {
    agent: AgentState;
    status: 'started' | 'completed';
    output?: string;
    timestamp: string;
}
export interface SubTaskSummary {
    id: string;
    description: string;
    priority: number;
    assignedTools: string[];
    status?: 'pending' | 'running' | 'completed' | 'failed';
    result?: string;
    assignedEngine?: string;
}
export interface ConsensusSummary {
    verdict: string;
    confidence: number;
    summary: string;
    reviewers?: Array<{
        provider: string;
        modelId: string;
        verdict: string;
    }>;
}
export interface AgentWorkflowState {
    currentAgent: AgentState;
    taskInput: string;
    plan: string | null;
    executionResult: string | null;
    review: string | null;
    lastOutput: string | null;
    availableSkills: string[];
    knowledgeGraphUpdates: KnowledgeGraphUpdate[];
    codeChangesProposed: CodeChange[] | null;
    userApprovalRequired: boolean;
    planApproved: boolean;
    compensationActions: string[];
    agentTeam: AgentTeamMember[];
    projectContext: Record<string, unknown>;
    workflowIteration: number;
    subTasks: SubTaskSummary[];
    mcpToolResults: MCPToolResultSummary[];
    consensusResult: ConsensusSummary | null;
    engineMode: EngineMode;
    parallelExecution: boolean;
}
export declare function createInitialWorkflowState(taskInput: string, overrides?: Partial<AgentWorkflowState>): AgentWorkflowState;
//# sourceMappingURL=types.d.ts.map