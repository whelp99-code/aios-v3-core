/**
 * Estimate Domain
 * 견적서 관련 도메인 모델
 */

export interface EstimateLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  taxRate: number;
}

export interface Estimate {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string;
  items: EstimateLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  validUntil: Date;
  status: 'draft' | 'approved' | 'sent';
  createdAt: Date;
}

/** 견적 계산 규칙 */
export function calculateEstimate(items: EstimateLineItem[]): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice;
  }, 0);

  const tax = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unitPrice;
    return sum + itemTotal * (item.taxRate / 100);
  }, 0);

  return {
    subtotal: Math.round(subtotal),
    tax: Math.round(tax),
    total: Math.round(subtotal + tax),
  };
}
