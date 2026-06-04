"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionKernel = exports.UpdateProposalGenerator = exports.HotPatchManager = exports.SandboxExecutor = exports.CodeSynthesisEngine = exports.ExperienceReplayBuffer = exports.ImprovementAnalyzer = exports.LearnedPolicyStore = exports.HFDatasetLoader = exports.GOLDEN_TASKS = exports.OperationalLearningKernel = exports.PolicyRuntimeBridge = exports.operationalSuccessRate = exports.evaluateOperationalSuccess = exports.TelemetryStore = exports.ContinuousLearningKernel = void 0;
var continuous_learning_kernel_1 = require("./continuous-learning-kernel");
Object.defineProperty(exports, "ContinuousLearningKernel", { enumerable: true, get: function () { return continuous_learning_kernel_1.ContinuousLearningKernel; } });
var telemetry_store_1 = require("./telemetry-store");
Object.defineProperty(exports, "TelemetryStore", { enumerable: true, get: function () { return telemetry_store_1.TelemetryStore; } });
var operational_success_1 = require("./operational-success");
Object.defineProperty(exports, "evaluateOperationalSuccess", { enumerable: true, get: function () { return operational_success_1.evaluateOperationalSuccess; } });
Object.defineProperty(exports, "operationalSuccessRate", { enumerable: true, get: function () { return operational_success_1.operationalSuccessRate; } });
var policy_runtime_bridge_1 = require("./policy-runtime-bridge");
Object.defineProperty(exports, "PolicyRuntimeBridge", { enumerable: true, get: function () { return policy_runtime_bridge_1.PolicyRuntimeBridge; } });
var operational_learning_kernel_1 = require("./operational-learning-kernel");
Object.defineProperty(exports, "OperationalLearningKernel", { enumerable: true, get: function () { return operational_learning_kernel_1.OperationalLearningKernel; } });
Object.defineProperty(exports, "GOLDEN_TASKS", { enumerable: true, get: function () { return operational_learning_kernel_1.GOLDEN_TASKS; } });
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
const path_1 = __importDefault(require("path"));
const experience_buffer_2 = require("./experience-buffer");
const hot_patch_2 = require("./hot-patch");
const continuous_learning_kernel_2 = require("./continuous-learning-kernel");
const learned_policy_store_2 = require("./learned-policy-store");
const operational_learning_kernel_2 = require("./operational-learning-kernel");
const telemetry_store_2 = require("./telemetry-store");
const policy_runtime_bridge_2 = require("./policy-runtime-bridge");
class EvolutionKernel {
    constructor(dataDir, policyFile = 'policy.json') {
        this.experience = new experience_buffer_2.ExperienceReplayBuffer();
        this.hotPatch = new hot_patch_2.HotPatchManager();
        this.proposals = new hot_patch_2.UpdateProposalGenerator(this.hotPatch);
        this.policyStore = new learned_policy_store_2.LearnedPolicyStore(dataDir, policyFile);
        this.training = new continuous_learning_kernel_2.ContinuousLearningKernel(this.hotPatch, this.experience, dataDir, policyFile);
        this.operational = new operational_learning_kernel_2.OperationalLearningKernel(this.policyStore, this.experience, this.hotPatch, dataDir ? path_1.default.join(dataDir, '..', 'telemetry') : undefined);
        this.telemetry = new telemetry_store_2.TelemetryStore(dataDir ? path_1.default.join(dataDir, '..', 'telemetry') : undefined);
        this.policyBridge = new policy_runtime_bridge_2.PolicyRuntimeBridge();
    }
}
exports.EvolutionKernel = EvolutionKernel;
//# sourceMappingURL=index.js.map