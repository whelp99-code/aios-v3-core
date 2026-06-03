import { OpenKB } from '@aios/knowledge-graph';
import { MCPRegistry } from '@aios/mcp-adapters';
import { Orchestrator, type AgentWorkflowState, type WorkflowStepEvent } from '@aios/orchestrator';
import { EvolutionKernel } from '@aios/self-evolution';
import { PluginManager } from './plugin-manager';
import { WebhookPublisher } from './webhook-publisher';
import { CommunityRegistry } from './community-registry';
export interface AIOSConfig {
    rapidMLXBaseURL?: string;
    dataDir?: string;
    skillsDirectory?: string;
    mcp?: {
        vibeCodingOSUrl?: string;
        automationPortalUrl?: string;
        revenueOpsUrl?: string;
    };
    maxIterations?: number;
}
export interface AIOSRunResult {
    state: AgentWorkflowState;
    steps: WorkflowStepEvent[];
    knowledgeNodes: number;
    evolutionProposalId?: string;
}
export declare class AIOS {
    readonly knowledge: OpenKB;
    readonly evolution: EvolutionKernel;
    readonly plugins: PluginManager;
    readonly webhooks: WebhookPublisher;
    readonly mcp: MCPRegistry;
    readonly community: CommunityRegistry;
    private orchestrator;
    private config;
    constructor(config?: AIOSConfig);
    getOrchestrator(): Orchestrator;
    run(taskInput: string, options?: {
        autoApprove?: boolean;
        onStep?: (step: WorkflowStepEvent) => void;
        userApprovalHandler?: (state: AgentWorkflowState) => Promise<boolean>;
    }): Promise<AIOSRunResult>;
    queryKnowledge(question: string): import("@aios/knowledge-graph").KnowledgeQueryResult;
    validateKnowledge(): import("@aios/knowledge-graph").ValidationIssue[];
    getStats(): {
        knowledge: {
            nodeCount: number;
            edgeCount: number;
            byType: Record<string, number>;
        };
        evolution: {
            experienceSize: number;
            successRate: number;
            pendingProposals: number;
            appliedPatches: number;
        };
        plugins: number;
        webhooks: number;
        community: number;
        mcp: number;
    };
}
export { PluginManager, type AIOSPlugin } from './plugin-manager';
export { WebhookPublisher, type WebhookEvent, type WebhookSubscription } from './webhook-publisher';
export { CommunityRegistry, type CommunityContribution } from './community-registry';
