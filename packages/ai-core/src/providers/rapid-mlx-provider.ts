import RapidMLXClient from '../rapid-mlx-client';
import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';

export class RapidMLXProvider implements ILLMProvider {
  readonly provider = 'local' as const;
  private client: RapidMLXClient;

  constructor(client: RapidMLXClient) {
    this.client = client;
  }

  isConfigured(): boolean {
    return true;
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const healthy = await this.client.healthCheck();
      return {
        provider: 'local',
        healthy,
        latencyMs: Date.now() - start,
        error: healthy ? undefined : 'Rapid-MLX not responding',
      };
    } catch (error) {
      return {
        provider: 'local',
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.client.chatCompletion(request);
  }

  async listModels(): Promise<{ id: string }[]> {
    const models = await this.client.listModels();
    return models.map((m: { id: string }) => ({ id: m.id }));
  }
}
