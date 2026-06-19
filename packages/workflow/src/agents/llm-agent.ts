/**
 * LLM Agent
 * LM Studio를 사용하는 실제 LLM 에이전트
 */

import {
  LLMClient,
  ChatMessage,
  ChatCompletionResponse,
  LLMClientConfig,
} from '../lm-studio-client.js';

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  llmConfig?: LLMClientConfig;
}

export interface AgentResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export class LLMAgent {
  private client: LLMClient;
  private config: AgentConfig;
  private conversationHistory: ChatMessage[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new LLMClient(config.llmConfig);
  }

  /**
   * 에이전트 ID 반환
   */
  get id(): string {
    return this.config.id;
  }

  /**
   * 에이전트 이름 반환
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * 대화 기록 초기화
   */
  resetHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * 대화 기록 가져오기
   */
  getHistory(): readonly ChatMessage[] {
    return this.conversationHistory;
  }

  /**
   * 시스템 프롬프트 업데이트
   */
  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
  }

  /**
   * 단일 메시지 실행 (대화 기록 없이)
   */
  async execute(
    input: string,
    options: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<AgentResponse> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: options.systemPrompt ?? this.config.systemPrompt,
      },
      { role: 'user', content: input },
    ];

    const response = await this.client.chatCompletion({
      model: this.config.model,
      messages,
      temperature: options.temperature ?? this.config.temperature,
      max_tokens: options.maxTokens ?? this.config.maxTokens,
    });

    return this.parseResponse(response);
  }

  /**
   * 대화형 실행 (기록 유지)
   */
  async chat(message: string): Promise<AgentResponse> {
    // 시스템 프롬프트가 없으면 추가
    if (
      this.conversationHistory.length === 0 ||
      this.conversationHistory[0].role !== 'system'
    ) {
      this.conversationHistory.unshift({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    // 사용자 메시지 추가
    this.conversationHistory.push({ role: 'user', content: message });

    const response = await this.client.chatCompletion({
      model: this.config.model,
      messages: [...this.conversationHistory],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    // 응답을 기록에 추가
    const assistantMessage = response.choices[0]?.message;
    if (assistantMessage) {
      this.conversationHistory.push(assistantMessage);
    }

    return this.parseResponse(response);
  }

  /**
   * 스트리밍 실행
   */
  async *executeStream(
    input: string,
    options: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): AsyncGenerator<string, void, unknown> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: options.systemPrompt ?? this.config.systemPrompt,
      },
      { role: 'user', content: input },
    ];

    yield* this.client.chatCompletionStream({
      model: this.config.model,
      messages,
      temperature: options.temperature ?? this.config.temperature,
      max_tokens: options.maxTokens ?? this.config.maxTokens,
    });
  }

  /**
   * 멀티턴 대화형 스트리밍
   */
  async *chatStream(
    message: string
  ): AsyncGenerator<string, void, unknown> {
    if (
      this.conversationHistory.length === 0 ||
      this.conversationHistory[0].role !== 'system'
    ) {
      this.conversationHistory.unshift({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    this.conversationHistory.push({ role: 'user', content: message });

    let fullContent = '';
    const stream = this.client.chatCompletionStream({
      model: this.config.model,
      messages: [...this.conversationHistory],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    for await (const chunk of stream) {
      fullContent += chunk;
      yield chunk;
    }

    // 전체 응답을 기록에 추가
    this.conversationHistory.push({
      role: 'assistant',
      content: fullContent,
    });
  }

  /**
   * 응답 파싱
   */
  private parseResponse(response: ChatCompletionResponse): AgentResponse {
    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice?.finish_reason ?? 'unknown',
    };
  }
}

/**
 * LLM Agent 생성 헬퍼
 */
export function createLLMAgent(config: AgentConfig): LLMAgent {
  return new LLMAgent(config);
}

/**
 * 프리셋 에이전트들
 */
export const AgentPresets = {
  /**
   * 플래너 에이전트
   */
  planner: (model?: string): AgentConfig => ({
    id: 'planner',
    name: 'Planner Agent',
    systemPrompt: `You are a planning agent. Your job is to analyze tasks and create detailed execution plans.
Break down complex tasks into clear, actionable steps.
Always provide structured output with priorities and dependencies.`,
    model,
    temperature: 0.7,
  }),

  /**
   * 실행자 에이전트
   */
  executor: (model?: string): AgentConfig => ({
    id: 'executor',
    name: 'Executor Agent',
    systemPrompt: `You are an execution agent. Your job is to carry out tasks precisely and efficiently.
Follow the provided plan step by step.
Report progress and any issues encountered.`,
    model,
    temperature: 0.3,
  }),

  /**
   * 비평가 에이전트
   */
  critic: (model?: string): AgentConfig => ({
    id: 'critic',
    name: 'Critic Agent',
    systemPrompt: `You are a critic agent. Your job is to evaluate work quality and provide constructive feedback.
Be thorough but fair in your assessments.
Provide specific, actionable suggestions for improvement.`,
    model,
    temperature: 0.5,
  }),

  /**
   * 코더 에이전트
   */
  coder: (model?: string): AgentConfig => ({
    id: 'coder',
    name: 'Coder Agent',
    systemPrompt: `You are a coding agent. Your job is to write clean, efficient, and well-documented code.
Follow best practices and language conventions.
Include error handling and edge case management.`,
    model,
    temperature: 0.2,
  }),

  /**
   * 분석 에이전트
   */
  analyst: (model?: string): AgentConfig => ({
    id: 'analyst',
    name: 'Analyst Agent',
    systemPrompt: `You are an analysis agent. Your job is to analyze data and provide insights.
Be precise and data-driven in your analysis.
Provide clear conclusions backed by evidence.`,
    model,
    temperature: 0.4,
  }),
};
