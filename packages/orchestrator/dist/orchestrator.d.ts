import { AgentWorkflowState, WorkflowStepEvent, createInitialWorkflowState } from './types';
import { RapidMLXClient } from '@aios/ai-core/rapid-mlx-client';
import { ModelRouter } from '@aios/ai-core/model-router';
import { MCPRegistry } from '@aios/mcp-adapters';
import type { OpenKB } from '@aios/knowledge-graph';
import type { EvolutionKernel } from '@aios/self-evolution';
import { ParsedSkill, SkillParser } from './skill-parser';
export interface OrchestratorOptions {
    maxIterations?: number;
    skillsDirectory?: string;
    mcpRegistry?: MCPRegistry;
    knowledgeGraph?: OpenKB;
    evolutionKernel?: EvolutionKernel;
}
export interface OrchestratorRunOptions {
    userApprovalHandler?: (state: AgentWorkflowState) => Promise<boolean>;
    maxIterations?: number;
    onStep?: (step: WorkflowStepEvent) => void;
}
export declare class Orchestrator {
    private workflow;
    private rapidMLXClient;
    private modelRouter;
    private skillParser;
    private loadedSkills;
    private maxIterations;
    private userApprovalHandler?;
    private onStep?;
    private mcpRegistry?;
    private knowledgeGraph?;
    private evolutionKernel?;
    private taskSplitter;
    private consensusEngine;
    constructor(rapidMLXClient: RapidMLXClient, modelRouter: ModelRouter, skillParser: SkillParser, options?: OrchestratorOptions);
    private buildWorkflow;
    run(initialState: AgentWorkflowState, options?: OrchestratorRunOptions): Promise<AgentWorkflowState>;
    loadSkill(name: string, skillMarkdown: string): ParsedSkill;
    loadSkillsFromDirectory(skillsDir: string): string[];
    getLoadedSkillNames(): string[];
    getLoadedSkill(name: string): ParsedSkill | undefined;
    getAllLoadedSkills(): ParsedSkill[];
    setAgentTeam(team: {
        role: string;
        model: string;
    }[]): void;
    identifyRelevantSkills(taskInput: string, skillNames?: string[]): string[];
    private emitStep;
    private executeWithMCP;
    private buildAgentTeam;
    private buildSkillsContext;
    private callLLM;
    private generateFallbackResponse;
    private parseCriticVerdict;
    private extractCodeChanges;
}
export { createInitialWorkflowState };
//# sourceMappingURL=orchestrator.d.ts.map