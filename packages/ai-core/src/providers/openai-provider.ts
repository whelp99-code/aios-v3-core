import axios, { AxiosInstance } from 'axios';
import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';

export interface OpenAIProviderConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
}

export class OpenAIProvider implements ILLMProvider {
  readonly provider = 'openai' as const;
  private client: AxiosInstance | null = null;
  private apiKey: string;

  constructor(config: OpenAIProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    if (this.apiKey) {
      this.client = axios.create({
        baseURL: config.baseURL ?? 'https://api.openai.com/v1',
        timeout: config.timeout ?? 60000,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.client);
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.isConfigured()) {
      return { provider: 'openai', healthy: false, error: 'OPENAI_API_KEY not configured' };
    }
    const start = Date.now();
    try {
      await this.client!.get('/models');
      return { provider: 'openai', healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        provider: 'openai',
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'OpenAI unreachable',
      };
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) throw new Error('OpenAI provider not configured');
    const response = await this.client.post<ChatCompletionResponse>('/chat/completions', {
      ...request,
      stream: false,
    });
    return response.data;
  }

  async listModels(): Promise<{ id: string }[]> {
    if (!this.client) return [];
    const response = await this.client.get<{ data: { id: string }[] }>('/models');
    return response.data.data ?? [];
  }
}
