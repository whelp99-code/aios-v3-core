/**
 * StepRunner
 * 워크플로우 스텝 실행기
 */

import { WorkflowStep, WorkflowConfig, WorkflowResult } from './types.js';

export class StepRunner {
  private steps: WorkflowStep[] = [];

  addStep(step: WorkflowStep): void {
    this.steps.push(step);
  }

  async execute(input: unknown): Promise<WorkflowResult> {
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
