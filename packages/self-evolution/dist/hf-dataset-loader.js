"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HFDatasetLoader = void 0;
/**
 * Hugging Face Datasets Server — no heavy datasets library required.
 * @see https://huggingface.co/docs/dataset-viewer
 */
class HFDatasetLoader {
    constructor(token) {
        this.baseUrl = 'https://datasets-server.huggingface.co';
        this.token = token ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY ?? '';
    }
    async fetchRows(cfg, offset = 0, length = 20) {
        const params = new URLSearchParams({
            dataset: cfg.dataset,
            config: cfg.config ?? 'default',
            split: cfg.split ?? 'train',
            offset: String(offset),
            length: String(length),
        });
        const headers = { Accept: 'application/json' };
        if (this.token)
            headers.Authorization = `Bearer ${this.token}`;
        const response = await fetch(`${this.baseUrl}/rows?${params}`, { headers });
        if (!response.ok) {
            throw new Error(`HF dataset fetch failed (${response.status}): ${cfg.dataset}`);
        }
        const data = (await response.json());
        const rows = (data.rows ?? []).map((r) => this.normalizeRow(r.row, r.row_idx));
        return {
            rows,
            total: data.num_rows_total,
            dataset: cfg.dataset,
            offset,
        };
    }
    async getDatasetInfo(dataset) {
        const headers = { Accept: 'application/json' };
        if (this.token)
            headers.Authorization = `Bearer ${this.token}`;
        const response = await fetch(`${this.baseUrl}/info?dataset=${encodeURIComponent(dataset)}`, {
            headers,
        });
        if (!response.ok) {
            return { configs: ['default'], splits: ['train'] };
        }
        const data = (await response.json());
        const configs = Object.keys(data.dataset_info ?? {});
        const splits = configs.length > 0
            ? (data.dataset_info[configs[0]].splits ?? []).map((s) => s.name)
            : ['train'];
        return { configs: configs.length ? configs : ['default'], splits };
    }
    normalizeRow(row, rowIdx) {
        const instruction = String(row.instruction ?? row.prompt ?? row.question ?? row.text ?? row.input ?? '');
        const context = String(row.context ?? row.input ?? '');
        const response = String(row.response ?? row.output ?? row.answer ?? row.completion ?? row.chosen ?? '');
        const category = row.category ? String(row.category) : undefined;
        return { rowIdx, instruction, context, response, category, raw: row };
    }
}
exports.HFDatasetLoader = HFDatasetLoader;
//# sourceMappingURL=hf-dataset-loader.js.map