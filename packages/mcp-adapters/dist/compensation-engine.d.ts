export interface CompensationAction {
    type: 'retry' | 'rollback' | 'fallback' | 'notify';
    target: string;
    description: string;
    maxRetries?: number;
}
export interface CompensationResult {
    action: CompensationAction;
    success: boolean;
    message: string;
}
export declare class CompensationEngine {
    private retryCounts;
    planCompensation(failedTool: string, error: string, existingActions?: string[]): CompensationAction[];
    execute(action: CompensationAction): Promise<CompensationResult>;
    resetRetries(toolName: string): void;
}
//# sourceMappingURL=compensation-engine.d.ts.map