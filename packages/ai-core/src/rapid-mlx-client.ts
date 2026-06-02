import axios, { AxiosInstance } from 'axios';

export interface RapidMLXConfig {
  baseURL: string;
  timeout: number;
}

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
  tools?: any[];
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
      tool_calls?: any[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class RapidMLXClient {
  private client: AxiosInstance;
  private config: RapidMLXConfig;

  constructor(config: RapidMLXConfig = { baseURL: 'http://localhost:8000/v1', timeout: 60000 }) {
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
      console.error('Rapid-MLX chat completion error:', error);
      throw error;
    }
  }

  async listModels(): Promise<any[]> {
    try {
      const response = await this.client.get('/models');
      return response.data.data || [];
    } catch (error) {
      console.error('Rapid-MLX list models error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      return response.status === 200;
    } catch (error) {
      console.error('Rapid-MLX health check failed:', error);
      return false;
    }
  }

  // Rapid-MLX의 강점인 도구 호출 복구 로직 (시뮬레이션/래퍼)
  async chatWithToolRecovery(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    // Rapid-MLX 엔진 자체에 파서가 내장되어 있으므로 기본 호출을 사용하되,
    // 필요 시 추가적인 정규화 로직을 여기에 배치할 수 있습니다.
    return this.chatCompletion(request);
  }
}

export default RapidMLXClient;
