"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HFDatasetLoader = void 0;
exports.toHFDatasetConfig = toHFDatasetConfig;
exports.resolveDatasetList = resolveDatasetList;
function toHFDatasetConfig(entry) {
    if (typeof entry === 'string') {
        return { dataset: entry, config: 'default', split: 'train' };
    }
    return {
        dataset: entry.id,
        config: entry.config ?? 'default',
        split: entry.split ?? 'train',
        domain: entry.domain,
    };
}
function resolveDatasetList(datasets, fallback) {
    if (datasets?.length) {
        return datasets.map((d) => (typeof d === 'string' ? { id: d } : d));
    }
    return [{ id: fallback ?? 'databricks/databricks-dolly-15k' }];
}
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
        // HF Datasets Server rate-limits large row requests on heavy datasets
        const cappedLength = Math.min(length, 20);
        const params = new URLSearchParams({
            dataset: cfg.dataset,
            config: cfg.config ?? 'default',
            split: cfg.split ?? 'train',
            offset: String(offset),
            length: String(cappedLength),
        });
        const headers = { Accept: 'application/json' };
        if (this.token)
            headers.Authorization = `Bearer ${this.token}`;
        const response = await this.fetchWithRetry(`${this.baseUrl}/rows?${params}`, { headers });
        if (!response.ok) {
            throw new Error(`HF dataset fetch failed (${response.status}): ${cfg.dataset}`);
        }
        const data = (await response.json());
        const rows = (data.rows ?? [])
            .map((r) => this.normalizeRow(r.row, r.row_idx))
            .filter((row) => row.instruction.length >= 5 && row.response.length >= 3);
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
            return { configs: ['default'], splits: ['train'], splitSizes: {} };
        }
        const data = (await response.json());
        const configs = Object.keys(data.dataset_info ?? {});
        let splits = ['train'];
        let splitSizes = {};
        if (configs.length > 0) {
            const splitData = data.dataset_info[configs[0]].splits;
            if (Array.isArray(splitData)) {
                splits = splitData.map((s) => s.name);
            }
            else if (splitData && typeof splitData === 'object') {
                splits = Object.keys(splitData);
                for (const [name, meta] of Object.entries(splitData)) {
                    if (meta?.num_examples)
                        splitSizes[name] = meta.num_examples;
                }
            }
        }
        return { configs: configs.length ? configs : ['default'], splits, splitSizes };
    }
    async fetchWithRetry(url, init, maxAttempts = 5) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const response = await fetch(url, init);
            if (response.ok || (response.status !== 429 && response.status < 500)) {
                return response;
            }
            const waitMs = Math.min(30000, 2000 * Math.pow(2, attempt - 1));
            console.warn(`[HFDatasetLoader] ${response.status} rate limit, retry ${attempt}/${maxAttempts} in ${waitMs}ms`);
            await new Promise((r) => setTimeout(r, waitMs));
            lastError = new Error(`HTTP ${response.status}`);
        }
        throw lastError ?? new Error('Fetch failed after retries');
    }
    normalizeRow(row, rowIdx) {
        let instruction = '';
        let context = '';
        let response = '';
        if (Array.isArray(row.messages)) {
            const msgs = row.messages;
            const userMsgs = msgs.filter((m) => m.role === 'user').map((m) => m.content ?? '');
            const asstMsgs = msgs.filter((m) => m.role === 'assistant').map((m) => m.content ?? '');
            instruction = userMsgs.join('\n');
            response = asstMsgs.join('\n');
        }
        else if (Array.isArray(row.conversations)) {
            const conv = row.conversations;
            instruction = conv.filter((c) => c.from === 'human').map((c) => c.value ?? '').join('\n');
            response = conv.filter((c) => c.from === 'gpt' || c.from === 'assistant').map((c) => c.value ?? '').join('\n');
        }
        else if (row.story && row.question) {
            instruction = `${String(row.question)}${row.answers ? `\nAnswers: ${JSON.stringify(row.answers).slice(0, 300)}` : ''}`;
            context = String(row.story).slice(0, 2000);
            const ans = row.answer ?? (Array.isArray(row.answers) ? row.answers[0] : row.answers);
            response = String(ans ?? '');
        }
        else if (row.context && row.question && !row.instruction) {
            instruction = String(row.question);
            context = String(row.context).slice(0, 2000);
            response = String(row.answers ?? row.answer ?? row.response ?? '');
            if (Array.isArray(row.answers)) {
                response = String(row.answers[0] ?? '');
            }
        }
        else if (row.generated_solution || row.expected_answer) {
            instruction = String(row.question ?? row.problem ?? row.prompt ?? '');
            response = String(row.generated_solution ?? row.expected_answer ?? row.predicted_answer ?? '');
        }
        else if (row.correct_answer && row.question) {
            instruction = String(row.question);
            context = String(row.support ?? row.distractor1 ?? '').slice(0, 2000);
            response = String(row.correct_answer);
        }
        else if (row.passage && row.question !== undefined) {
            instruction = `${String(row.question)}\nPassage: ${String(row.passage).slice(0, 1500)}`;
            response =
                typeof row.answer === 'boolean'
                    ? row.answer
                        ? 'Yes, the answer is true.'
                        : 'No, the answer is false.'
                    : String(row.answer ?? '');
        }
        else if (row.text && row.role) {
            const t = String(row.text);
            if (row.role === 'assistant') {
                instruction = 'OpenAssistant dialogue response';
                response = t;
            }
            else {
                instruction = t;
                response = t.length >= 20 ? t : `${t} (continued in thread)`;
            }
        }
        else if (row.message && typeof row.message === 'object') {
            const msg = row.message;
            instruction = String(row.prompt ?? row.topic ?? 'Message');
            response = String(msg.content ?? '');
        }
        else {
            instruction = String(row.instruction ?? row.prompt ?? row.question ?? row.query ?? row.text ?? row.input ?? '');
            context = String(row.context ?? row.passage ?? row.document ?? '');
            if (!context && row.input && row.instruction) {
                context = String(row.input);
            }
            const chosen = row.chosen;
            const rejected = row.rejected;
            if (chosen && !row.response && !row.output) {
                instruction = String(row.prompt ?? row.question ?? 'Compare responses');
                response = typeof chosen === 'string' ? chosen : JSON.stringify(chosen);
                if (rejected)
                    context = `Rejected: ${String(rejected).slice(0, 500)}`;
            }
            else {
                response = String(row.response ??
                    row.output ??
                    row.answer ??
                    row.completion ??
                    (typeof chosen === 'string' ? chosen : '') ??
                    row.label ??
                    '');
            }
        }
        const category = row.category
            ? String(row.category)
            : row.source
                ? String(row.source)
                : undefined;
        return { rowIdx, instruction, context, response, category, raw: row };
    }
}
exports.HFDatasetLoader = HFDatasetLoader;
//# sourceMappingURL=hf-dataset-loader.js.map