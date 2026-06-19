import axios, { AxiosInstance } from 'axios';

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

export class OllamaClient {
  private client: AxiosInstance;
  private config: OllamaConfig;

  constructor(config: OllamaConfig = { baseURL: 'http://localhost:11434', timeout: 30000 }) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
    });
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const response = await this.client.post<GenerateResponse>('/api/generate', request);
      return response.data;
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw error;
    }
  }

  async chat(model: string, messages: Array<{role: string; content: string}>): Promise<string> {
    try {
      const response = await this.client.post('/api/chat', {
        model,
        messages,
        stream: false,
      });
      return response.data.message.content;
    } catch (error) {
      console.error('Ollama chat error:', error);
      throw error;
    }
  }

  async listModels(): Promise<Array<{name: string}>> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models || [];
    } catch (error) {
      console.error('Ollama list models error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      return response.status === 200;
    } catch (error) {
      console.error('Ollama health check failed:', error);
      return false;
    }
  }
}

export default OllamaClient;
