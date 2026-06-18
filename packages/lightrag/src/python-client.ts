import axios, { AxiosInstance } from 'axios';

/**
 * Configuration for the LightRAG Python server connection
 */
export interface LightRAGClientConfig {
  /** Base URL of the LightRAG Python server (default: http://localhost:3300) */
  serverUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Document to be indexed into the LightRAG knowledge graph
 */
export interface IndexDocument {
  /** Unique identifier for the document */
  id: string;
  /** Document content/text to index */
  content: string;
  /** Optional metadata associated with the document */
  metadata?: Record<string, unknown>;
}

/**
 * Response from the /index endpoint
 */
export interface IndexResponse {
  success: boolean;
  message: string;
  nodes_created: number;
  edges_created: number;
}

/**
 * Query request for the LightRAG knowledge graph
 */
export interface QueryRequest {
  /** The query string */
  query: string;
  /** Maximum number of results to return (default: 10) */
  max_results?: number;
  /** Whether to include source documents in results (default: false) */
  include_sources?: boolean;
}

/**
 * A single result from a LightRAG query
 */
export interface QueryResultItem {
  /** Content of the matched node */
  content: string;
  /** Relevance score (0-1) */
  score: number;
  /** Node ID in the knowledge graph */
  node_id: string;
  /** Metadata associated with the node */
  metadata?: Record<string, unknown>;
}

/**
 * Response from the /query endpoint
 */
export interface QueryResponse {
  success: boolean;
  query: string;
  results: QueryResultItem[];
  total_results: number;
}

/**
 * Health check response from the server
 */
export interface HealthResponse {
  status: string;
  server: string;
  lm_studio_connected: boolean;
}

/**
 * Client for communicating with the LightRAG Python FastAPI server.
 *
 * The Python server handles graph construction, embeddings (via LM Studio),
 * and graph-based retrieval. This client provides a typed interface from
 * TypeScript/Node.js.
 *
 * @example
 * ```typescript
 * import { LightRAGClient } from '@aios/lightrag';
 *
 * const client = new LightRAGClient();
 *
 * // Index a document
 * await client.indexDocument({
 *   id: 'doc-1',
 *   content: 'LightRAG is a graph-based retrieval system...',
 *   metadata: { source: 'wiki' }
 * });
 *
 * // Query the knowledge graph
 * const results = await client.query({
 *   query: 'What is LightRAG?',
 *   max_results: 5
 * });
 * console.log(results);
 * ```
 */
export class LightRAGClient {
  private http: AxiosInstance;
  private serverUrl: string;

  constructor(config: LightRAGClientConfig = {}) {
    this.serverUrl = config.serverUrl || 'http://localhost:3300';
    this.http = axios.create({
      baseURL: this.serverUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check the health status of the LightRAG server and LM Studio connection.
   */
  async health(): Promise<HealthResponse> {
    const response = await this.http.get<HealthResponse>('/health');
    return response.data;
  }

  /**
   * Index a single document into the LightRAG knowledge graph.
   * The server will extract entities, build relationships, and generate
   * embeddings via LM Studio.
   */
  async indexDocument(doc: IndexDocument): Promise<IndexResponse> {
    const response = await this.http.post<IndexResponse>('/index', doc);
    return response.data;
  }

  /**
   * Index multiple documents in a single request (batch indexing).
   */
  async indexDocuments(docs: IndexDocument[]): Promise<IndexResponse> {
    const response = await this.http.post<IndexResponse>('/index', { documents: docs });
    return response.data;
  }

  /**
   * Query the LightRAG knowledge graph using natural language.
   * Performs graph-based retrieval augmented generation.
   */
  async query(request: QueryRequest): Promise<QueryResponse> {
    const response = await this.http.post<QueryResponse>('/query', request);
    return response.data;
  }

  /**
   * Get the base URL of the connected server.
   */
  getServerUrl(): string {
    return this.serverUrl;
  }
}
