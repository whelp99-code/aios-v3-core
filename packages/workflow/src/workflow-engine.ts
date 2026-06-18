/**
 * WorkflowEngine
 * Mastra 기반 워크플로우 실행 엔진
 */

import { WorkflowConfig, WorkflowResult } from './types.js';

export class WorkflowEngine {
  private config: WorkflowConfig;
  private steps: Array<{ name: string; execute: (input: any) => Promise<any> }> = [];

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  /**
   * 스텝 추가
   */
  addStep(name: string, execute: (input: any) => Promise<any>): void {
    this.steps.push({ name, execute });
  }

  /**
   * 워크플로우 실행
   */
  async execute(input: any): Promise<WorkflowResult> {
    const startTime = Date.now();
    const executedSteps: string[] = [];
    let currentInput = input;

    try {
      for (const step of this.steps) {
        currentInput = await step.execute(currentInput);
        executedSteps.push(step.name);
      }

      return {
        success: true,
        output: currentInput,
        steps: executedSteps,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        steps: executedSteps,
        duration: Date.now() - startTime,
      };
    }
  }
}
