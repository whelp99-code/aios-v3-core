import axios, { AxiosInstance } from 'axios';

export interface LMStudioConfig {
  baseURL: string;
  timeout: number;
}

/** @deprecated Use LMStudioConfig. */
export type RapidMLXConfig = LMStudioConfig;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: unknown[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LMStudioClient {
  private client: AxiosInstance;
  private config: LMStudioConfig;

  constructor(config: LMStudioConfig = { baseURL: 'http://localhost:1234/v1', timeout: 60000 }) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const response = await this.client.post<ChatCompletionResponse>('/chat/completions', {
        ...request,
        stream: request.stream ?? false,
      });
      return response.data;
    } catch (error) {
      console.error('LM Studio chat completion error:', error);
      throw error;
    }
  }

  async listModels(): Promise<Array<{ id: string }>> {
    try {
      const response = await this.client.get<{ data?: Array<{ id: string }> }>('/models');
      return response.data.data || [];
    } catch (error) {
      console.error('LM Studio list models error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      return response.status === 200;
    } catch (error) {
      console.error('LM Studio health check failed:', error);
      return false;
    }
  }

  // LM Studio의 도구 호출 복구 로직 (시뮬레이션/래퍼)
  async chatWithToolRecovery(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    // LM Studio 엔진 자체에 파서가 내장되어 있으므로 기본 호출을 사용하되,
    // 필요 시 추가적인 정규화 로직을 여기에 배치할 수 있습니다.
    return this.chatCompletion(request);
  }
}

/** @deprecated Use LMStudioClient. */
export { LMStudioClient as RapidMLXClient };
export default LMStudioClient;
