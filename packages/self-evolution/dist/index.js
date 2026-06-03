"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionKernel = exports.UpdateProposalGenerator = exports.HotPatchManager = exports.SandboxExecutor = exports.CodeSynthesisEngine = exports.ExperienceReplayBuffer = exports.ImprovementAnalyzer = exports.LearnedPolicyStore = exports.HFDatasetLoader = exports.ContinuousLearningKernel = void 0;
var continuous_learning_kernel_1 = require("./continuous-learning-kernel");
Object.defineProperty(exports, "ContinuousLearningKernel", { enumerable: true, get: function () { return continuous_learning_kernel_1.ContinuousLearningKernel; } });
var hf_dataset_loader_1 = require("./hf-dataset-loader");
Object.defineProperty(exports, "HFDatasetLoader", { enumerable: true, get: function () { return hf_dataset_loader_1.HFDatasetLoader; } });
var learned_policy_store_1 = require("./learned-policy-store");
Object.defineProperty(exports, "LearnedPolicyStore", { enumerable: true, get: function () { return learned_policy_store_1.LearnedPolicyStore; } });
var improvement_analyzer_1 = require("./improvement-analyzer");
Object.defineProperty(exports, "ImprovementAnalyzer", { enumerable: true, get: function () { return improvement_analyzer_1.ImprovementAnalyzer; } });
var experience_buffer_1 = require("./experience-buffer");
Object.defineProperty(exports, "ExperienceReplayBuffer", { enumerable: true, get: function () { return experience_buffer_1.ExperienceReplayBuffer; } });
var code_synthesis_1 = require("./code-synthesis");
Object.defineProperty(exports, "CodeSynthesisEngine", { enumerable: true, get: function () { return code_synthesis_1.CodeSynthesisEngine; } });
var sandbox_1 = require("./sandbox");
Object.defineProperty(exports, "SandboxExecutor", { enumerable: true, get: function () { return sandbox_1.SandboxExecutor; } });
var hot_patch_1 = require("./hot-patch");
Object.defineProperty(exports, "HotPatchManager", { enumerable: true, get: function () { return hot_patch_1.HotPatchManager; } });
Object.defineProperty(exports, "UpdateProposalGenerator", { enumerable: true, get: function () { return hot_patch_1.UpdateProposalGenerator; } });
const experience_buffer_2 = require("./experience-buffer");
const hot_patch_2 = require("./hot-patch");
const continuous_learning_kernel_2 = require("./continuous-learning-kernel");
const learned_policy_store_2 = require("./learned-policy-store");
class EvolutionKernel {
    constructor(dataDir) {
        this.experience = new experience_buffer_2.ExperienceReplayBuffer();
        this.hotPatch = new hot_patch_2.HotPatchManager();
        this.proposals = new hot_patch_2.UpdateProposalGenerator(this.hotPatch);
        this.policyStore = new learned_policy_store_2.LearnedPolicyStore(dataDir);
        this.training = new continuous_learning_kernel_2.ContinuousLearningKernel(this.hotPatch, this.experience, dataDir);
    }
}
exports.EvolutionKernel = EvolutionKernel;
//# sourceMappingURL=index.js.map