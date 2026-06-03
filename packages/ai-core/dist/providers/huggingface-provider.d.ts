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
export declare class HuggingFaceProvider implements ILLMProvider {
    readonly provider: "huggingface";
    private client;
    private apiKey;
    constructor(config?: HuggingFaceProviderConfig);
    isConfigured(): boolean;
    healthCheck(): Promise<ProviderHealth>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    listModels(): Promise<{
        id: string;
    }[]>;
}
//# sourceMappingURL=huggingface-provider.d.ts.map