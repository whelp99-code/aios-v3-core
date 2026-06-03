"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionKernel = exports.UpdateProposalGenerator = exports.HotPatchManager = exports.SandboxExecutor = exports.CodeSynthesisEngine = exports.ExperienceReplayBuffer = void 0;
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
class EvolutionKernel {
    constructor() {
        this.experience = new experience_buffer_2.ExperienceReplayBuffer();
        this.hotPatch = new hot_patch_2.HotPatchManager();
        this.proposals = new hot_patch_2.UpdateProposalGenerator(this.hotPatch);
    }
}
exports.EvolutionKernel = EvolutionKernel;
//# sourceMappingURL=index.js.map