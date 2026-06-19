/**
 * F-aios-v3 API Contract Test
 *
 * Phase 0: Verifies that F server responses match Zod schemas.
 * Run: npx vitest run src/schemas/__tests__/api-contract.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  HealthResponseSchema,
  WorkflowSchema,
  WorkflowExecuteResponseSchema,
  OrchestratorStatusSchema,
  OrchestratorRunResponseSchema,
  KnowledgeDocumentSchema,
  LightRAGStatusSchema,
  LightRAGSearchResponseSchema,
  LightRAGIngestResponseSchema,
  MonitoringResponseSchema,
  MonitoringServiceDetailSchema,
  ExecutionStatusSchema,
  ExecutionModeSchema,
  F_API_ENDPOINT_COUNT,
} from '../api-contract.js';

describe('F API Contract Schemas', () => {
  describe('ExecutionStatusSchema', () => {
    it('accepts all valid statuses', () => {
      const statuses = ['queued', 'pending_approval', 'running', 'completed', 'failed', 'cancelled', 'degraded'];
      for (const status of statuses) {
        expect(ExecutionStatusSchema.parse(status)).toBe(status);
      }
    });

    it('rejects invalid status', () => {
      expect(() => ExecutionStatusSchema.parse('unknown')).toThrow();
    });
  });

  describe('ExecutionModeSchema', () => {
    it('accepts all valid modes', () => {
      for (const mode of ['live', 'simulated', 'degraded']) {
        expect(ExecutionModeSchema.parse(mode)).toBe(mode);
      }
    });
  });

  describe('HealthResponseSchema', () => {
    it('validates health response', () => {
      const data = {
        status: 'ok' as const,
        service: 'aios-workflow-server',
        timestamp: new Date().toISOString(),
        uptime: 123.45,
      };
      expect(HealthResponseSchema.parse(data)).toEqual(data);
    });

    it('rejects missing fields', () => {
      expect(() => HealthResponseSchema.parse({ status: 'ok' })).toThrow();
    });
  });

  describe('WorkflowSchema', () => {
    it('validates workflow object', () => {
      const data = {
        id: 'wf-001',
        name: 'Test Workflow',
        description: 'A test workflow',
        category: 'test',
        favorite: false,
        steps: [{ name: 'step1', code: 'return input' }],
        lastRun: null,
        runCount: 0,
      };
      expect(WorkflowSchema.parse(data)).toEqual(data);
    });

    it('accepts empty steps (schema allows, server validates)', () => {
      const data = {
        id: 'wf-001',
        name: 'Test',
        description: '',
        category: 'test',
        favorite: false,
        steps: [],
        lastRun: null,
        runCount: 0,
      };
      expect(WorkflowSchema.parse(data)).toEqual(data);
    });
  });

  describe('WorkflowExecuteResponseSchema', () => {
    it('validates execution response with all fields', () => {
      const data = {
        executionId: 'exec-123',
        status: 'completed' as const,
        mode: 'live' as const,
        createdAt: new Date().toISOString(),
        workflowId: 'wf-001',
        workflow: 'Test Workflow',
        result: { output: 'done' },
      };
      expect(WorkflowExecuteResponseSchema.parse(data)).toEqual(data);
    });

    it('validates minimal execution response', () => {
      const data = {
        executionId: 'exec-123',
        status: 'queued' as const,
        mode: 'live' as const,
        createdAt: new Date().toISOString(),
        workflowId: 'wf-001',
        workflow: 'Test',
      };
      expect(WorkflowExecuteResponseSchema.parse(data)).toEqual(data);
    });
  });

  describe('OrchestratorStatusSchema', () => {
    it('validates orchestrator status', () => {
      const data = {
        status: 'ok' as const,
        engineMode: 'local',
        activeRuns: 0,
        lastRun: null,
      };
      expect(OrchestratorStatusSchema.parse(data)).toEqual(data);
    });
  });

  describe('OrchestratorRunResponseSchema', () => {
    it('validates run response', () => {
      const data = {
        executionId: 'exec-456',
        status: 'queued' as const,
        mode: 'live' as const,
        task: 'test task',
        engineMode: 'local' as const,
        createdAt: new Date().toISOString(),
      };
      expect(OrchestratorRunResponseSchema.parse(data)).toEqual(data);
    });
  });

  describe('KnowledgeDocumentSchema', () => {
    it('validates knowledge document', () => {
      const data = {
        id: 'kb-001',
        title: 'Test Doc',
        content: 'Some content',
        category: 'general',
        createdAt: new Date().toISOString(),
      };
      expect(KnowledgeDocumentSchema.parse(data)).toEqual(data);
    });
  });

  describe('LightRAGStatusSchema', () => {
    it('validates ok status', () => {
      const data = {
        status: 'ok' as const,
        service: 'lightrag' as const,
        upstream: { status: 'healthy' },
      };
      expect(LightRAGStatusSchema.parse(data)).toEqual(data);
    });

    it('validates degraded status', () => {
      const data = {
        status: 'degraded' as const,
        service: 'lightrag' as const,
        upstream: null,
        mode: 'simulated' as const,
        error: 'Server unreachable',
      };
      expect(LightRAGStatusSchema.parse(data)).toEqual(data);
    });
  });

  describe('LightRAGSearchResponseSchema', () => {
    it('validates search response', () => {
      const data = {
        status: 'ok' as const,
        mode: 'live' as const,
        results: [{ id: 'r1', text: 'result' }],
      };
      expect(LightRAGSearchResponseSchema.parse(data)).toEqual(data);
    });

    it('validates simulated response', () => {
      const data = {
        status: 'degraded' as const,
        mode: 'simulated' as const,
        results: [],
        message: 'LightRAG server not available',
      };
      expect(LightRAGSearchResponseSchema.parse(data)).toEqual(data);
    });
  });

  describe('LightRAGIngestResponseSchema', () => {
    it('validates ingest response', () => {
      const data = {
        status: 'ok' as const,
        mode: 'live' as const,
        documentId: 'doc-123',
        result: { indexed: true },
      };
      expect(LightRAGIngestResponseSchema.parse(data)).toEqual(data);
    });
  });

  describe('MonitoringResponseSchema', () => {
    it('validates monitoring response', () => {
      const data = {
        status: 'ok' as const,
        services: {
          'aios-server': { status: 'healthy', uptime: 100 },
          lightrag: { status: 'degraded', mode: 'simulated' as const },
        },
        metrics: {
          totalWorkflows: 4,
          totalExecutions: 10,
          activeRuns: 0,
          failedRuns: 1,
        },
        timestamp: new Date().toISOString(),
      };
      expect(MonitoringResponseSchema.parse(data)).toEqual(data);
    });
  });

  describe('MonitoringServiceDetailSchema', () => {
    it('validates service detail', () => {
      const data = {
        name: 'F-aios-v3 Server',
        status: 'healthy',
        port: 3201,
        uptime: 100,
      };
      expect(MonitoringServiceDetailSchema.parse(data)).toEqual(data);
    });
  });

  describe('F_API_ENDPOINT_COUNT', () => {
    it('matches expected endpoint count', () => {
      // health(1) + workflows(6) + orchestrator(2) + knowledge(3) + lightrag(3) + monitoring(2) = 17
      expect(F_API_ENDPOINT_COUNT).toBe(17);
    });
  });
});
