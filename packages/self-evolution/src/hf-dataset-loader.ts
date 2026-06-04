export interface HFDatasetRow {
  rowIdx: number;
  instruction: string;
  context: string;
  response: string;
  category?: string;
  raw: Record<string, unknown>;
}

export interface HFDatasetConfig {
  dataset: string;
  config?: string;
  split?: string;
  token?: string;
}

export interface FetchRowsResult {
  rows: HFDatasetRow[];
  total?: number;
  dataset: string;
  offset: number;
}

/**
 * Hugging Face Datasets Server — no heavy datasets library required.
 * @see https://huggingface.co/docs/dataset-viewer
 */
export class HFDatasetLoader {
  private baseUrl = 'https://datasets-server.huggingface.co';
  private token: string;

  constructor(token?: string) {
    this.token = token ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY ?? '';
  }

  async fetchRows(
    cfg: HFDatasetConfig,
    offset = 0,
    length = 20
  ): Promise<FetchRowsResult> {
    // HF Datasets Server rate-limits large row requests on heavy datasets
    const cappedLength = Math.min(length, 20);
    const params = new URLSearchParams({
      dataset: cfg.dataset,
      config: cfg.config ?? 'default',
      split: cfg.split ?? 'train',
      offset: String(offset),
      length: String(cappedLength),
    });

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await this.fetchWithRetry(`${this.baseUrl}/rows?${params}`, { headers });
    if (!response.ok) {
      throw new Error(`HF dataset fetch failed (${response.status}): ${cfg.dataset}`);
    }

    const data = (await response.json()) as {
      rows?: Array<{ row: Record<string, unknown>; row_idx: number }>;
      num_rows_total?: number;
    };

    const rows = (data.rows ?? []).map((r) => this.normalizeRow(r.row, r.row_idx));

    return {
      rows,
      total: data.num_rows_total,
      dataset: cfg.dataset,
      offset,
    };
  }

  async getDatasetInfo(dataset: string): Promise<{
    configs: string[];
    splits: string[];
    splitSizes: Record<string, number>;
  }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseUrl}/info?dataset=${encodeURIComponent(dataset)}`, {
      headers,
    });
    if (!response.ok) {
      return { configs: ['default'], splits: ['train'], splitSizes: {} };
    }

    const data = (await response.json()) as {
      dataset_info?: Record<
        string,
        {
          splits?: Record<string, { name?: string; num_examples?: number }> | Array<{ name: string }>;
        }
      >;
    };

    const configs = Object.keys(data.dataset_info ?? {});
    let splits = ['train'];
    let splitSizes: Record<string, number> = {};

    if (configs.length > 0) {
      const splitData = data.dataset_info![configs[0]].splits;
      if (Array.isArray(splitData)) {
        splits = splitData.map((s) => s.name);
      } else if (splitData && typeof splitData === 'object') {
        splits = Object.keys(splitData);
        for (const [name, meta] of Object.entries(splitData)) {
          if (meta?.num_examples) splitSizes[name] = meta.num_examples;
        }
      }
    }

    return { configs: configs.length ? configs : ['default'], splits, splitSizes };
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    maxAttempts = 5
  ): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(url, init);
      if (response.ok || (response.status !== 429 && response.status < 500)) {
        return response;
      }
      const waitMs = Math.min(30000, 2000 * Math.pow(2, attempt - 1));
      console.warn(
        `[HFDatasetLoader] ${response.status} rate limit, retry ${attempt}/${maxAttempts} in ${waitMs}ms`
      );
      await new Promise((r) => setTimeout(r, waitMs));
      lastError = new Error(`HTTP ${response.status}`);
    }
    throw lastError ?? new Error('Fetch failed after retries');
  }

  private normalizeRow(row: Record<string, unknown>, rowIdx: number): HFDatasetRow {
    let instruction = '';
    let context = '';
    let response = '';

    if (Array.isArray(row.messages)) {
      const msgs = row.messages as Array<{ role?: string; content?: string }>;
      const userMsgs = msgs.filter((m) => m.role === 'user').map((m) => m.content ?? '');
      const asstMsgs = msgs.filter((m) => m.role === 'assistant').map((m) => m.content ?? '');
      instruction = userMsgs.join('\n');
      response = asstMsgs.join('\n');
    } else if (Array.isArray(row.conversations)) {
      const conv = row.conversations as Array<{ from?: string; value?: string }>;
      instruction = conv.filter((c) => c.from === 'human').map((c) => c.value ?? '').join('\n');
      response = conv.filter((c) => c.from === 'gpt' || c.from === 'assistant').map((c) => c.value ?? '').join('\n');
    } else {
      instruction = String(
        row.instruction ?? row.prompt ?? row.question ?? row.query ?? row.text ?? row.input ?? ''
      );
      context = String(row.context ?? row.passage ?? row.document ?? '');
      if (!context && row.input && row.instruction) {
        context = String(row.input);
      }
      const chosen = row.chosen;
      const rejected = row.rejected;
      if (chosen && !row.response && !row.output) {
        instruction = String(row.prompt ?? row.question ?? 'Compare responses');
        response = typeof chosen === 'string' ? chosen : JSON.stringify(chosen);
        if (rejected) context = `Rejected: ${String(rejected).slice(0, 500)}`;
      } else {
        response = String(
          row.response ??
            row.output ??
            row.answer ??
            row.completion ??
            (typeof chosen === 'string' ? chosen : '') ??
            row.label ??
            ''
        );
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
