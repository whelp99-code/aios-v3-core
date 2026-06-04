"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetCursorStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DatasetCursorStore {
    constructor(dataDir, fileName = 'dataset-cursors.json') {
        const dir = dataDir ?? path_1.default.resolve(process.cwd(), 'data/learned');
        fs_1.default.mkdirSync(dir, { recursive: true });
        this.filePath = path_1.default.join(dir, fileName);
        this.cursors = this.load();
    }
    key(datasetId, config = 'default', split = 'train') {
        return `${datasetId}::${config}::${split}`;
    }
    getOffset(datasetId, config, split) {
        const k = this.key(datasetId, config, split);
        return this.cursors[k]?.offset ?? 0;
    }
    advance(datasetId, batchSize, config, split) {
        const k = this.key(datasetId, config, split);
        const current = this.cursors[k]?.offset ?? 0;
        const next = current + batchSize;
        this.cursors[k] = { offset: next, updatedAt: new Date().toISOString() };
        this.save();
        return current;
    }
    reset(datasetId) {
        if (datasetId) {
            for (const k of Object.keys(this.cursors)) {
                if (k.startsWith(`${datasetId}::`))
                    delete this.cursors[k];
            }
        }
        else {
            this.cursors = {};
        }
        this.save();
    }
    getAll() {
        return { ...this.cursors };
    }
    load() {
        try {
            if (fs_1.default.existsSync(this.filePath)) {
                return JSON.parse(fs_1.default.readFileSync(this.filePath, 'utf-8'));
            }
        }
        catch {
            /* empty */
        }
        return {};
    }
    save() {
        fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.cursors, null, 2));
    }
}
exports.DatasetCursorStore = DatasetCursorStore;
//# sourceMappingURL=dataset-cursor-store.js.map