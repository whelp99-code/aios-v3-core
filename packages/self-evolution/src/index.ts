export { ContinuousLearningKernel, type ContinuousLearningReport, type TrainingIterationResult } from './continuous-learning-kernel';
export { HFDatasetLoader, type HFDatasetRow, type HFDatasetConfig } from './hf-dataset-loader';
export { LearnedPolicyStore, type LearnedPolicy } from './learned-policy-store';
export { ImprovementAnalyzer, type Improvement } from './improvement-analyzer';
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
import { ContinuousLearningKernel } from './continuous-learning-kernel';
import { LearnedPolicyStore } from './learned-policy-store';

export class EvolutionKernel {
  experience: ExperienceReplayBuffer;
  hotPatch: HotPatchManager;
  proposals: UpdateProposalGenerator;
  policyStore: LearnedPolicyStore;
  training: ContinuousLearningKernel;

  constructor(dataDir?: string, policyFile = 'policy.json') {
    this.experience = new ExperienceReplayBuffer();
    this.hotPatch = new HotPatchManager();
    this.proposals = new UpdateProposalGenerator(this.hotPatch);
    this.policyStore = new LearnedPolicyStore(dataDir, policyFile);
    this.training = new ContinuousLearningKernel(this.hotPatch, this.experience, dataDir, policyFile);
  }
}
