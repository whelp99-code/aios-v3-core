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

export class CompensationEngine {
  private retryCounts = new Map<string, number>();

  planCompensation(
    failedTool: string,
    error: string,
    existingActions: string[] = []
  ): CompensationAction[] {
    const actions: CompensationAction[] = [];

    const retryCount = this.retryCounts.get(failedTool) ?? 0;
    if (retryCount < 3) {
      actions.push({
        type: 'retry',
        target: failedTool,
        description: `Retry ${failedTool} after failure: ${error}`,
        maxRetries: 3,
      });
    }

    actions.push({
      type: 'fallback',
      target: failedTool,
      description: `Use simulated response for ${failedTool}`,
    });

    if (!existingActions.includes('notify_admin')) {
      actions.push({
        type: 'notify',
        target: 'monitoring',
        description: `Tool ${failedTool} failed: ${error}`,
      });
    }

    return actions;
  }

  async execute(action: CompensationAction): Promise<CompensationResult> {
    switch (action.type) {
      case 'retry': {
        const count = (this.retryCounts.get(action.target) ?? 0) + 1;
        this.retryCounts.set(action.target, count);
        return {
          action,
          success: count <= (action.maxRetries ?? 3),
          message: `Retry attempt ${count} for ${action.target}`,
        };
      }
      case 'fallback':
        return {
          action,
          success: true,
          message: `Fallback activated for ${action.target}`,
        };
      case 'notify':
        console.warn(`[Compensation] ${action.description}`);
        return {
          action,
          success: true,
          message: action.description,
        };
      case 'rollback':
        return {
          action,
          success: true,
          message: `Rollback completed for ${action.target}`,
        };
      default:
        return {
          action,
          success: false,
          message: `Unknown compensation type`,
        };
    }
  }

  resetRetries(toolName: string): void {
    this.retryCounts.delete(toolName);
  }
}
