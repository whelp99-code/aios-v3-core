export { ContinuousLearningKernel, type ContinuousLearningReport, type TrainingIterationResult } from './continuous-learning-kernel';
export { TelemetryStore, type TelemetryRecord } from './telemetry-store';
export {
  evaluateOperationalSuccess,
  operationalSuccessRate,
  type OperationalVerdict,
} from './operational-success';
export {
  PolicyRuntimeBridge,
  type PolicyBridgeResult,
  type PolicyBridgeEnginePrefs,
} from './policy-runtime-bridge';
export {
  OperationalLearningKernel,
  type OperationalLearningReport,
  GOLDEN_TASKS,
} from './operational-learning-kernel';
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

import path from 'path';
import { ExperienceReplayBuffer } from './experience-buffer';
import { HotPatchManager, UpdateProposalGenerator } from './hot-patch';
import { ContinuousLearningKernel } from './continuous-learning-kernel';
import { LearnedPolicyStore } from './learned-policy-store';
import { OperationalLearningKernel } from './operational-learning-kernel';
import { TelemetryStore } from './telemetry-store';
import { PolicyRuntimeBridge } from './policy-runtime-bridge';

export class EvolutionKernel {
  experience: ExperienceReplayBuffer;
  hotPatch: HotPatchManager;
  proposals: UpdateProposalGenerator;
  policyStore: LearnedPolicyStore;
  training: ContinuousLearningKernel;
  operational: OperationalLearningKernel;
  telemetry: TelemetryStore;
  policyBridge: PolicyRuntimeBridge;

  constructor(dataDir?: string, policyFile = 'policy.json') {
    this.experience = new ExperienceReplayBuffer();
    this.hotPatch = new HotPatchManager();
    this.proposals = new UpdateProposalGenerator(this.hotPatch);
    this.policyStore = new LearnedPolicyStore(dataDir, policyFile);
    this.training = new ContinuousLearningKernel(this.hotPatch, this.experience, dataDir, policyFile);
    this.operational = new OperationalLearningKernel(
      this.policyStore,
      this.experience,
      this.hotPatch,
      dataDir ? path.join(dataDir, '..', 'telemetry') : undefined
    );
    this.telemetry = new TelemetryStore(
      dataDir ? path.join(dataDir, '..', 'telemetry') : undefined
    );
    this.policyBridge = new PolicyRuntimeBridge();
  }
}
