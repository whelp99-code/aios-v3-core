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
}
