/**
 * @aios/lightrag
 *
 * LightRAG integration for AIOS - Graph-based Retrieval Augmented Generation
 * with LM Studio embedding support.
 *
 * This package provides:
 * - A TypeScript client (`LightRAGClient`) for communicating with the Python FastAPI server
 * - A Python FastAPI server that handles graph construction, embedding, and retrieval
 * - LM Studio integration for local embedding generation
 *
 * @example
 * ```typescript
 * import { LightRAGClient } from '@aios/lightrag';
 *
 * const client = new LightRAGClient({ serverUrl: 'http://localhost:8000' });
 *
 * // Check server health
 * const health = await client.health();
 * console.log('Server status:', health.status);
 *
 * // Index documents
 * await client.indexDocument({
 *   id: 'doc-1',
 *   content: 'Your document content here...',
 *   metadata: { source: 'manual' }
 * });
 *
 * // Query the knowledge graph
 * const results = await client.query({
 *   query: 'What are the main topics?',
 *   max_results: 5
 * });
 * ```
 */

export { LightRAGClient } from './python-client';
export type {
  LightRAGClientConfig,
  IndexDocument,
  IndexResponse,
  QueryRequest,
  QueryResponse,
  QueryResultItem,
  HealthResponse,
} from './python-client';
