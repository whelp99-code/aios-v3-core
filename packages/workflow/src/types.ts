/**
 * Mastra 기반 워크플로우 타입
 */

export interface WorkflowStep {
  id: string;
  name: string;
  execute: (input: any) => Promise<any>;
}

export interface WorkflowResult {
  success: boolean;
  output: any;
  steps: string[];
  duration: number;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

export interface WorkflowConfig {
  name: string;
  steps?: WorkflowStep[];
  maxRetries?: number;
  timeout?: number;
  model?: string;
}

/**
 * LLM 관련 타입
 */
export interface LLMConfig {
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}
