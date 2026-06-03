"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialWorkflowState = createInitialWorkflowState;
function createInitialWorkflowState(taskInput, overrides = {}) {
    return {
        currentAgent: 'planner',
        taskInput,
        plan: null,
        executionResult: null,
        review: null,
        lastOutput: null,
        availableSkills: [],
        knowledgeGraphUpdates: [],
        codeChangesProposed: null,
        userApprovalRequired: false,
        planApproved: false,
        compensationActions: [],
        agentTeam: [],
        projectContext: {},
        workflowIteration: 0,
        ...overrides,
    };
}
