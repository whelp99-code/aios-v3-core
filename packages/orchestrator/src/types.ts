export type AgentState = 'planner' | 'executor' | 'critic' | 'user_approval' | 'skill_refinement' | 'completed' | 'failed';

export interface AgentWorkflowState {
  currentAgent: AgentState;
  taskInput: string;
  plan: string | null;
  executionResult: string | null;
  review: string | null;
  lastOutput: string | null;
  // Add more state variables as needed for Swarm Intelligence, Knowledge Graph, Self-Evolution
  // For example:
  // availableSkills: string[];
  // knowledgeGraphUpdates: any[];
  // codeChangesProposed: string | null;
  // userApprovalRequired: boolean;
  // compensationActions: string[];
}
