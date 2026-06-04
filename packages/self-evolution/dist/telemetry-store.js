"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class TelemetryStore {
    constructor(dataDir, fileName = 'experiences.jsonl') {
        const dir = dataDir ?? path_1.default.resolve(process.cwd(), 'data/telemetry');
        fs_1.default.mkdirSync(dir, { recursive: true });
        this.filePath = path_1.default.join(dir, fileName);
    }
    append(record) {
        const full = {
            ...record,
            id: `tel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
        };
        fs_1.default.appendFileSync(this.filePath, `${JSON.stringify(full)}\n`, 'utf8');
        return full;
    }
    loadRecent(limit = 500) {
        if (!fs_1.default.existsSync(this.filePath))
            return [];
        const lines = fs_1.default.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean);
        return lines
            .slice(-limit)
            .map((line) => JSON.parse(line))
            .reverse();
    }
    count() {
        if (!fs_1.default.existsSync(this.filePath))
            return 0;
        return fs_1.default.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean).length;
    }
    getPath() {
        return this.filePath;
    }
}
exports.TelemetryStore = TelemetryStore;
//# sourceMappingURL=telemetry-store.js.map