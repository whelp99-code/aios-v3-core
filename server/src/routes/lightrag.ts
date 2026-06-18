import { Router, type IRouter } from 'express';
import { LightRAGClient } from '@aios/lightrag';
import { z } from 'zod';
import { simulatedResult, validateBody, validateQuery } from '../middleware/security.js';
import { LightRAGIngestRequestSchema } from '../schemas/api-contract.js';

export const lightragRouter: IRouter = Router();

// LightRAG client (Lazy init)
let client: LightRAGClient | null = null;

function getClient(): LightRAGClient {
  if (!client) {
    const serverUrl = process.env.LIGHTRAG_SERVER_URL || 'http://localhost:3300';
    client = new LightRAGClient({ serverUrl });
  }
  return client;
}

// LightRAG status
lightragRouter.get('/api/lightrag', async (_req, res) => {
  try {
    const rag = getClient();
    const health = await rag.health();
    res.json({
      status: 'ok',
      service: 'lightrag',
      upstream: health,
    });
  } catch (error) {
    // Phase 1: Return degraded, not success
    res.json({
      status: 'degraded',
      service: 'lightrag',
      mode: 'simulated',
      upstream: null,
      error: error instanceof Error ? error.message : 'LightRAG server unreachable',
    });
  }
});

// LightRAG search
lightragRouter.get(
  '/api/lightrag/search',
  validateQuery(z.object({ q: z.string().min(1) })),
  async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: 'Required query parameter: q' });
      return;
    }

    const rag = getClient();
    const results = await rag.query({ query, max_results: 10 });
    res.json({
      status: 'ok',
      mode: 'live',
      results,
    });
  } catch (error) {
    // Phase 1: Return degraded with simulated mode, NOT success
    res.json(simulatedResult(
      { results: [] },
      'LightRAG server not available, returning empty results',
    ));
  }
  }
);

// LightRAG document ingest
lightragRouter.post(
  '/api/lightrag/ingest',
  validateBody(LightRAGIngestRequestSchema),
  async (req, res) => {
  try {
    const { content, metadata } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Required field: content' });
      return;
    }

    const rag = getClient();
    const docId = `doc-${Date.now()}`;
    const result = await rag.indexDocument({
      id: docId,
      content,
      metadata: metadata || {},
    });
    res.json({
      status: 'ok',
      mode: 'live',
      documentId: docId,
      result,
    });
  } catch (error) {
    // Phase 1: Return degraded, not success
    res.json(simulatedResult(
      { documentId: `doc-${Date.now()}` },
      'Document accepted but LightRAG server not available for indexing',
    ));
  }
  }
);
