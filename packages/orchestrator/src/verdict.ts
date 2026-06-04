export interface CriticVerdict {
  needsCorrection: boolean;
  needsApproval: boolean;
}

/**
 * Parse a critic agent's review text into routing flags.
 * Recognizes "VERDICT: NEEDS_CORRECTION" / "NEEDS CORRECTION" and the approval variants.
 */
export function parseCriticVerdict(review: string): CriticVerdict {
  const upper = (review ?? '').toUpperCase();
  return {
    needsCorrection:
      upper.includes('VERDICT: NEEDS_CORRECTION') || upper.includes('NEEDS CORRECTION'),
    needsApproval:
      upper.includes('VERDICT: NEEDS_APPROVAL') || upper.includes('NEEDS APPROVAL'),
  };
}
