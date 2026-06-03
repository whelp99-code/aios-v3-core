"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExperienceReplayBuffer = void 0;
class ExperienceReplayBuffer {
    constructor(maxSize = 1000) {
        this.buffer = [];
        this.maxSize = maxSize;
    }
    add(entry) {
        const full = {
            ...entry,
            id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
        };
        this.buffer.unshift(full);
        if (this.buffer.length > this.maxSize) {
            this.buffer = this.buffer.slice(0, this.maxSize);
        }
        return full;
    }
    sample(count) {
        const shuffled = [...this.buffer].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }
    getRecent(count) {
        return this.buffer.slice(0, count);
    }
    getSuccessRate() {
        if (this.buffer.length === 0)
            return 0;
        return this.buffer.filter((e) => e.success).length / this.buffer.length;
    }
    size() {
        return this.buffer.length;
    }
}
exports.ExperienceReplayBuffer = ExperienceReplayBuffer;
//# sourceMappingURL=experience-buffer.js.map