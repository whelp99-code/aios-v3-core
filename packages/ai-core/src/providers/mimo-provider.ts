import axios, { AxiosInstance } from 'axios';
import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';

export interface MimoProviderConfig {
  apiKey?: string;
  /** Pay-as-you-go: https://api.xiaomimimo.com/v1 — Token Plan uses cluster URL from console */
  baseURL?: string;
  timeout?: number;
}

/**
 * Xiaomi MiMo API — OpenAI-compatible chat/completions with `api-key` header.
 * @see https://platform.xiaomimimo.com/docs/en-US/quick-start/model
 */
export class MimoProvider implements ILLMProvider {
  readonly provider = 'mimo' as const;
  private client: AxiosInstance | null = null;
  private apiKey: string;

  constructor(config: MimoProviderConfig = {}) {
    this.apiKey =
      config.apiKey ?? process.env.MIMO_API_KEY ?? process.env.XIAOMI_MIMO_API_KEY ?? '';
    if (this.apiKey) {
      this.client = axios.create({
        baseURL: config.baseURL ?? process.env.MIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1',
        timeout: config.timeout ?? 120000,
        headers: {
          'api-key': this.apiKey,
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
      return { provider: 'mimo', healthy: false, error: 'MIMO_API_KEY not configured' };
    }
    if (process.env.MIMO_SKIP_HEALTH_PING === '1') {
      return { provider: 'mimo', healthy: true, latencyMs: 0 };
    }
    const start = Date.now();
    try {
      await this.client!.post('/chat/completions', {
        model: 'mimo-v2-flash',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 4,
      });
      return { provider: 'mimo', healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        provider: 'mimo',
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'MiMo unreachable',
      };
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) throw new Error('MiMo provider not configured');
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: false,
      temperature: request.temperature,
    };
    if (request.max_tokens !== undefined) {
      body.max_completion_tokens = request.max_tokens;
      body.max_tokens = request.max_tokens;
    }
    if (request.tools?.length) {
      body.tools = request.tools;
      body.tool_choice = request.tool_choice ?? 'auto';
    }
    const response = await this.client.post<ChatCompletionResponse>('/chat/completions', body);
    return response.data;
  }

  async listModels(): Promise<{ id: string }[]> {
    return [
      { id: 'mimo-v2.5-pro' },
      { id: 'mimo-v2.5' },
      { id: 'mimo-v2-flash' },
      { id: 'mimo-v2-pro' },
    ];
  }
}
