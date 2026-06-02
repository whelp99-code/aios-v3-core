import axios from 'axios';
export class OllamaClient {
    constructor(config = { baseURL: 'http://localhost:11434', timeout: 30000 }) {
        this.config = config;
        this.client = axios.create({
            baseURL: config.baseURL,
            timeout: config.timeout,
        });
    }
    async generate(request) {
        try {
            const response = await this.client.post('/api/generate', request);
            return response.data;
        }
        catch (error) {
            console.error('Ollama generation error:', error);
            throw error;
        }
    }
    async chat(model, messages) {
        try {
            const response = await this.client.post('/api/chat', {
                model,
                messages,
                stream: false,
            });
            return response.data.message.content;
        }
        catch (error) {
            console.error('Ollama chat error:', error);
            throw error;
        }
    }
    async listModels() {
        try {
            const response = await this.client.get('/api/tags');
            return response.data.models || [];
        }
        catch (error) {
            console.error('Ollama list models error:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const response = await this.client.get('/api/tags');
            return response.status === 200;
        }
        catch (error) {
            console.error('Ollama health check failed:', error);
            return false;
        }
    }
}
export default OllamaClient;
//# sourceMappingURL=ollama-client.js.map