import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelProvider,
  ProviderHealth,
} from '../types';

export interface ILLMProvider {
  readonly provider: ModelProvider;
  isConfigured(): boolean;
  healthCheck(): Promise<ProviderHealth>;
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  listModels(): Promise<{ id: string }[]>;
  /** Optional token streaming. Providers without it fall back to chatCompletion. */
  chatCompletionStream?(request: ChatCompletionRequest): AsyncIterable<string>;
}
