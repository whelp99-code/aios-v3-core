"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearnedPolicyStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_POLICY = {
    version: 0,
    iteration: 0,
    successRate: 0,
    avgReward: 0,
    qualityThreshold: 0.55,
    batchSize: 15,
    synthesisKeywords: ['missing', 'incomplete', 'error', 'bug'],
    routingBias: { preferredProvider: 'huggingface' },
    categoryScores: {},
    appliedImprovements: [],
    updatedAt: new Date().toISOString(),
};
class LearnedPolicyStore {
    constructor(dataDir, policyFile = 'policy.json') {
        const dir = dataDir ?? path_1.default.resolve(process.cwd(), 'data/learned');
        fs_1.default.mkdirSync(dir, { recursive: true });
        this.filePath = path_1.default.join(dir, policyFile);
        this.policy = this.load();
    }
    get() {
        return { ...this.policy };
    }
    update(partial) {
        this.policy = {
            ...this.policy,
            ...partial,
            version: this.policy.version + 1,
            updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.get();
    }
    reset() {
        this.policy = { ...DEFAULT_POLICY, updatedAt: new Date().toISOString() };
        this.save();
        return this.get();
    }
    load() {
        try {
            if (fs_1.default.existsSync(this.filePath)) {
                return { ...DEFAULT_POLICY, ...JSON.parse(fs_1.default.readFileSync(this.filePath, 'utf-8')) };
            }
        }
        catch {
            /* use default */
        }
        return { ...DEFAULT_POLICY };
    }
    save() {
        fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.policy, null, 2));
    }
}
exports.LearnedPolicyStore = LearnedPolicyStore;
//# sourceMappingURL=learned-policy-store.js.map