import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';
export interface GoogleProviderConfig {
    apiKey?: string;
    /** Gemini OpenAI-compatible endpoint */
    baseURL?: string;
    timeout?: number;
}
/**
 * Google Gemini via OpenAI-compatible chat/completions.
 * @see https://ai.google.dev/gemini-api/docs/openai
 */
export declare class GoogleProvider implements ILLMProvider {
    readonly provider: "google";
    private client;
    private apiKey;
    constructor(config?: GoogleProviderConfig);
    isConfigured(): boolean;
    healthCheck(): Promise<ProviderHealth>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    listModels(): Promise<{
        id: string;
    }[]>;
}
//# sourceMappingURL=google-provider.d.ts.map