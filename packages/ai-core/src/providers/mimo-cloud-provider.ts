import axios, { AxiosInstance } from 'axios';
import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';

export interface MimoCloudProviderConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  provider?: 'together' | 'fireworks' | 'replicate' | 'custom';
}

export class MimoCloudProvider implements ILLMProvider {
  readonly provider = 'mimo' as const;
  private client: AxiosInstance | null = null;
  private apiKey: string;
  private providerName: string;

  constructor(config: MimoCloudProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.MIMO_API_KEY ?? process.env.TOGETHER_API_KEY ?? process.env.FIREWORKS_API_KEY ?? '';
    this.providerName = config.provider ?? 'custom';

    const defaultBaseURL: Record<string, string> = {
      together: 'https://api.together.xyz/v1',
      fireworks: 'https://api.fireworks.ai/inference/v1',
      replicate: 'https://api.replicate.com/v1',
      custom: 'https://api.together.xyz/v1',
    };

    const baseURL = config.baseURL ?? defaultBaseURL[this.providerName] ?? defaultBaseURL.custom;

    if (this.apiKey) {
      this.client = axios.create({
        baseURL,
        timeout: config.timeout ?? 120000, // Mimo can be slower
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
      return { provider: 'mimo', healthy: false, error: 'MIMO_API_KEY / TOGETHER_API_KEY / FIREWORKS_API_KEY not configured' };
    }
    const start = Date.now();
    try {
      await this.client!.get('/models');
      return { provider: 'mimo', healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        provider: 'mimo',
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Mimo Cloud unreachable',
      };
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) throw new Error('Mimo Cloud provider not configured');
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

  getProviderName(): string {
    return this.providerName;
  }
}