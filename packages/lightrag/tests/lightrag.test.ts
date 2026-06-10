import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LightRAGClient } from '../src/python-client.js';

// Create mock functions at module level
const mockGet = vi.fn();
const mockPost = vi.fn();

// Mock axios module
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
    })),
  },
}));

describe('LightRAGClient', () => {
  let client: LightRAGClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new LightRAGClient({ serverUrl: 'http://localhost:8000' });
  });

  it('should create a LightRAGClient with default config', () => {
    const defaultClient = new LightRAGClient();
    expect(defaultClient).toBeDefined();
    expect(defaultClient.getServerUrl()).toBe('http://localhost:3300');
  });

  it('should create a LightRAGClient with custom config', () => {
    expect(client).toBeDefined();
    expect(client.getServerUrl()).toBe('http://localhost:8000');
  });

  it('should check health status', async () => {
    mockGet.mockResolvedValue({
      data: {
        status: 'ok',
        server: 'lightrag',
        lm_studio_connected: true,
      },
    });

    const health = await client.health();
    expect(health.status).toBe('ok');
    expect(health.lm_studio_connected).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('/health');
  });

  it('should index a document', async () => {
    mockPost.mockResolvedValue({
      data: {
        success: true,
        message: 'Document indexed',
        nodes_created: 5,
        edges_created: 3,
      },
    });

    const result = await client.indexDocument({
      id: 'doc-1',
      content: 'Test document content',
      metadata: { source: 'test' },
    });

    expect(result.success).toBe(true);
    expect(result.nodes_created).toBe(5);
    expect(result.edges_created).toBe(3);
    expect(mockPost).toHaveBeenCalledWith('/index', {
      id: 'doc-1',
      content: 'Test document content',
      metadata: { source: 'test' },
    });
  });

  it('should query the knowledge graph', async () => {
    mockPost.mockResolvedValue({
      data: {
        success: true,
        query: 'What is LightRAG?',
        results: [
          { content: 'LightRAG is a graph-based RAG system', score: 0.95, node_id: 'n1' },
        ],
        total_results: 1,
      },
    });

    const result = await client.query({
      query: 'What is LightRAG?',
      max_results: 5,
    });

    expect(result.success).toBe(true);
    expect(result.results.length).toBe(1);
    expect(result.results[0].content).toContain('LightRAG');
    expect(result.results[0].score).toBe(0.95);
  });

  it('should handle health check errors', async () => {
    mockGet.mockRejectedValue(new Error('Connection refused'));

    await expect(client.health()).rejects.toThrow('Connection refused');
  });
});
