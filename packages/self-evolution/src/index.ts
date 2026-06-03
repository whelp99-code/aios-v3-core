export { ExperienceReplayBuffer, type ExperienceEntry } from './experience-buffer';
export { CodeSynthesisEngine, type CodePatch, type SynthesisResult } from './code-synthesis';
export { SandboxExecutor, type SandboxResult } from './sandbox';
export {
  HotPatchManager,
  UpdateProposalGenerator,
  type UpdateProposal,
  type PatchStatus,
} from './hot-patch';

import { ExperienceReplayBuffer } from './experience-buffer';
import { HotPatchManager, UpdateProposalGenerator } from './hot-patch';

export class EvolutionKernel {
  experience: ExperienceReplayBuffer;
  hotPatch: HotPatchManager;
  proposals: UpdateProposalGenerator;

  constructor() {
    this.experience = new ExperienceReplayBuffer();
    this.hotPatch = new HotPatchManager();
    this.proposals = new UpdateProposalGenerator(this.hotPatch);
  }
}
