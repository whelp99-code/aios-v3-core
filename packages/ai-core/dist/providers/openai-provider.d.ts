import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';
export interface OpenAIProviderConfig {
    apiKey?: string;
    baseURL?: string;
    timeout?: number;
}
export declare class OpenAIProvider implements ILLMProvider {
    readonly provider: "openai";
    private client;
    private apiKey;
    constructor(config?: OpenAIProviderConfig);
    isConfigured(): boolean;
    healthCheck(): Promise<ProviderHealth>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    listModels(): Promise<{
        id: string;
    }[]>;
}
//# sourceMappingURL=openai-provider.d.ts.map