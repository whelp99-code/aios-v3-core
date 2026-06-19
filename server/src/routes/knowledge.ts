import { Router, type IRouter } from 'express';
import { randomUUID } from 'node:crypto';
import { validateBody } from '../middleware/security.js';
import {
  KnowledgeCreateRequestSchema,
  type KnowledgeDocument,
} from '../schemas/api-contract.js';

export const knowledgeRouter: IRouter = Router();

// 인메모리 지식 저장소 (Phase 2에서 PostgreSQL로 이전)
const knowledgeStore = new Map<string, KnowledgeDocument>();

// 기본 지식 항목 등록
const defaultDocs = [
  {
    id: 'kb-001',
    title: 'Sangfor 보안 정책',
    content: 'Sangfor 방화벽, IPS, VPN 보안 정책 관리 가이드',
    category: '보안',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'kb-002',
    title: '메일 분석 절차',
    content: '이메일 자동 분류, 요약, 우선순위 분석 절차',
    category: '분석',
    createdAt: new Date().toISOString(),
  },
];

defaultDocs.forEach(doc => knowledgeStore.set(doc.id, doc));

// 지식 목록 조회
knowledgeRouter.get('/api/knowledge', (_req, res) => {
  res.json(Array.from(knowledgeStore.values()));
});

// 지식 검색
knowledgeRouter.get('/api/knowledge/search', (req, res) => {
  const query = (req.query.q as string || '').toLowerCase();
  if (!query) {
    res.json(Array.from(knowledgeStore.values()));
    return;
  }

  const results = Array.from(knowledgeStore.values()).filter(doc =>
    doc.title.toLowerCase().includes(query) ||
    doc.content.toLowerCase().includes(query) ||
    doc.category.toLowerCase().includes(query)
  );

  res.json(results);
});

// 지식 생성
knowledgeRouter.post('/api/knowledge', validateBody(KnowledgeCreateRequestSchema), (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'Required fields: title, content' });
    return;
  }

  const doc = {
    id: `kb-${randomUUID()}`,
    title,
    content,
    category: category || 'general',
    createdAt: new Date().toISOString(),
  };

  knowledgeStore.set(doc.id, doc);
  res.json(doc);
});
