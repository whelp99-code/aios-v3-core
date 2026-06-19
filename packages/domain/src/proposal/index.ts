/**
 * Proposal Domain
 * 제안서 관련 도메인 모델
 */

export interface ProposalSection {
  title: string;
  content: string;
}

export interface Proposal {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string;
  sections: ProposalSection[];
  status: 'draft' | 'approved' | 'sent';
  createdAt: Date;
}

export interface PocPlan {
  id: string;
  projectId: string;
  projectName: string;
  objectives: string[];
  scope: string;
  timeline: { phase: string; duration: string }[];
  successCriteria: string[];
  status: 'draft' | 'approved' | 'completed';
  createdAt: Date;
}
