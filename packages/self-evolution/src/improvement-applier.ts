import { LearnedPolicy, LearnedPolicyStore } from './learned-policy-store';
import { Improvement } from './improvement-analyzer';
import { HotPatchManager } from './hot-patch';

export interface ApplyResult {
  applied: string[];
  policy: LearnedPolicy;
  proposalIds: string[];
}

export class ImprovementApplier {
  constructor(
    private policyStore: LearnedPolicyStore,
    private hotPatch?: HotPatchManager
  ) {}

  apply(improvements: Improvement[], iteration: number): ApplyResult {
    const current = this.policyStore.get();
    const applied: string[] = [];
    const proposalIds: string[] = [];

    let policyUpdate: Partial<LearnedPolicy> = {
      iteration,
      appliedImprovements: [...current.appliedImprovements],
    };

    for (const imp of improvements) {
      switch (imp.type) {
        case 'quality':
          if (imp.action.qualityThreshold !== undefined) {
            policyUpdate.qualityThreshold = imp.action.qualityThreshold as number;
            applied.push(imp.description);
          }
          break;

        case 'batch':
          if (imp.action.batchSize !== undefined) {
            policyUpdate.batchSize = imp.action.batchSize as number;
            applied.push(imp.description);
          }
          break;

        case 'synthesis': {
          const add = imp.action.addSynthesisKeywords as string[] | undefined;
          if (add?.length) {
            const merged = [...new Set([...current.synthesisKeywords, ...add])];
            policyUpdate.synthesisKeywords = merged;
            applied.push(imp.description);

            if (this.hotPatch) {
              const proposal = this.hotPatch.createDirectProposal(imp.description, [
                {
                  filePath: 'packages/self-evolution/src/code-synthesis.ts',
                  diff: `+ // Learned keywords: ${add.join(', ')}`,
                  description: imp.description,
                },
              ]);
              proposalIds.push(proposal.id);
              this.hotPatch.approve(proposal.id);
              this.hotPatch.apply(proposal.id);
            }
          }
          break;
        }

        case 'routing':
          if (imp.action.routingBias) {
            policyUpdate.routingBias = {
              ...current.routingBias,
              ...(imp.action.routingBias as LearnedPolicy['routingBias']),
            };
            applied.push(imp.description);
          }
          break;

        case 'category':
          applied.push(imp.description);
          break;
      }

      policyUpdate.appliedImprovements = [
        ...(policyUpdate.appliedImprovements ?? current.appliedImprovements),
        `[iter-${iteration}] ${imp.description}`,
      ];
    }

    const policy = this.policyStore.update({
      ...policyUpdate,
      iteration,
    });

    return { applied, policy, proposalIds };
  }
}
