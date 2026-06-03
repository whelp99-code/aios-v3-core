import { CodePatch, CodeSynthesisEngine } from './code-synthesis';
import { SandboxExecutor } from './sandbox';

export type PatchStatus = 'pending' | 'validated' | 'approved' | 'applied' | 'rejected';

export interface UpdateProposal {
  id: string;
  patches: CodePatch[];
  status: PatchStatus;
  sandboxResult?: { success: boolean; output: string };
  createdAt: string;
  appliedAt?: string;
  description: string;
}

export class HotPatchManager {
  private proposals = new Map<string, UpdateProposal>();
  private synthesisEngine = new CodeSynthesisEngine();
  private sandbox = new SandboxExecutor();
  private appliedPatches: CodePatch[] = [];

  async createProposal(
    review: string,
    executionResult: string | null,
    existingChanges: CodePatch[] = []
  ): Promise<UpdateProposal> {
    const synthesis = this.synthesisEngine.synthesize(review, executionResult, existingChanges);
    const id = `proposal-${Date.now()}`;

    const sandboxResults = [];
    for (const patch of synthesis.patches) {
      const result = await this.sandbox.executeCode(patch.diff);
      sandboxResults.push(result);
    }
    const testResult = await this.sandbox.runTests(synthesis.tests);

    const allPassed = sandboxResults.every((r) => r.success) && testResult.success;

    const proposal: UpdateProposal = {
      id,
      patches: synthesis.patches,
      status: allPassed ? 'validated' : 'pending',
      sandboxResult: {
        success: allPassed,
        output: sandboxResults.map((r) => r.output).join('\n') + '\n' + testResult.output,
      },
      createdAt: new Date().toISOString(),
      description: synthesis.reasoning,
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  approve(id: string): UpdateProposal | null {
    const proposal = this.proposals.get(id);
    if (!proposal || proposal.status === 'rejected') return null;
    proposal.status = 'approved';
    return proposal;
  }

  reject(id: string): UpdateProposal | null {
    const proposal = this.proposals.get(id);
    if (!proposal) return null;
    proposal.status = 'rejected';
    return proposal;
  }

  apply(id: string): UpdateProposal | null {
    const proposal = this.proposals.get(id);
    if (!proposal || proposal.status !== 'approved') return null;
    proposal.status = 'applied';
    proposal.appliedAt = new Date().toISOString();
    this.appliedPatches.push(...proposal.patches);
    return proposal;
  }

  getProposal(id: string): UpdateProposal | undefined {
    return this.proposals.get(id);
  }

  getAllProposals(): UpdateProposal[] {
    return Array.from(this.proposals.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getPendingProposals(): UpdateProposal[] {
    return this.getAllProposals().filter(
      (p) => p.status === 'pending' || p.status === 'validated'
    );
  }

  getAppliedPatches(): CodePatch[] {
    return [...this.appliedPatches];
  }
}

export class UpdateProposalGenerator {
  private hotPatchManager: HotPatchManager;

  constructor(hotPatchManager: HotPatchManager) {
    this.hotPatchManager = hotPatchManager;
  }

  async generate(
    review: string,
    executionResult: string | null,
    codeChanges: { filePath: string; diff: string }[] = []
  ): Promise<UpdateProposal> {
    const patches = codeChanges.map((c) => ({
      filePath: c.filePath,
      diff: c.diff,
      description: `Proposed change to ${c.filePath}`,
    }));
    return this.hotPatchManager.createProposal(review, executionResult, patches);
  }
}
