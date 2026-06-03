import axios, { AxiosInstance } from 'axios';
import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';

export interface HuggingFaceProviderConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
}

/**
 * Hugging Face Inference Providers — OpenAI-compatible router.
 * @see https://huggingface.co/docs/inference-providers/index
 */
export class HuggingFaceProvider implements ILLMProvider {
  readonly provider = 'huggingface' as const;
  private client: AxiosInstance | null = null;
  private apiKey: string;

  constructor(config: HuggingFaceProviderConfig = {}) {
    this.apiKey =
      config.apiKey ??
      process.env.HF_TOKEN ??
      process.env.HUGGINGFACE_API_KEY ??
      process.env.HUGGINGFACE_HUB_TOKEN ??
      '';

    if (this.apiKey) {
      this.client = axios.create({
        baseURL: config.baseURL ?? 'https://router.huggingface.co/v1',
        timeout: config.timeout ?? 90000,
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
      return {
        provider: 'huggingface',
        healthy: false,
        error: 'HF_TOKEN / HUGGINGFACE_API_KEY not configured',
      };
    }
    const start = Date.now();
    try {
      await this.client!.get('/models');
      return { provider: 'huggingface', healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        provider: 'huggingface',
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Hugging Face router unreachable',
      };
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) throw new Error('Hugging Face provider not configured');

    const model = request.model.includes(':')
      ? request.model
      : `${request.model}:fastest`;

    const response = await this.client.post<ChatCompletionResponse>('/chat/completions', {
      ...request,
      model,
      stream: false,
    });
    return response.data;
  }

  async listModels(): Promise<{ id: string }[]> {
    if (!this.client) return [];
    try {
      const response = await this.client.get<{ data: { id: string }[] }>('/models');
      return response.data.data ?? [];
    } catch {
      return [
        { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct' },
        { id: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
        { id: 'deepseek-ai/DeepSeek-V3-0324' },
      ];
    }
  }
}
