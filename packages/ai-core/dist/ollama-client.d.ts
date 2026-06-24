export interface OllamaConfig {
    baseURL: string;
    timeout: number;
}
export interface GenerateRequest {
    model: string;
    prompt: string;
    stream: boolean;
}
export interface GenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}
export declare class OllamaClient {
    private client;
    private config;
    constructor(config?: OllamaConfig);
    generate(request: GenerateRequest): Promise<GenerateResponse>;
    chat(model: string, messages: Array<{
        role: string;
        content: string;
    }>): Promise<string>;
    listModels(): Promise<Array<{
        name: string;
    }>>;
    healthCheck(): Promise<boolean>;
}
export default OllamaClient;
//# sourceMappingURL=ollama-client.d.ts.map