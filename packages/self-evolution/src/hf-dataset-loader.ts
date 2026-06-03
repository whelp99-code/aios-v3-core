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
    const params = new URLSearchParams({
      dataset: cfg.dataset,
      config: cfg.config ?? 'default',
      split: cfg.split ?? 'train',
      offset: String(offset),
      length: String(length),
    });

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseUrl}/rows?${params}`, { headers });
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

  async getDatasetInfo(dataset: string): Promise<{ configs: string[]; splits: string[] }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseUrl}/info?dataset=${encodeURIComponent(dataset)}`, {
      headers,
    });
    if (!response.ok) {
      return { configs: ['default'], splits: ['train'] };
    }

    const data = (await response.json()) as {
      dataset_info?: Record<string, { splits?: Array<{ name: string }> }>;
    };

    const configs = Object.keys(data.dataset_info ?? {});
    const splits =
      configs.length > 0
        ? (data.dataset_info![configs[0]].splits ?? []).map((s) => s.name)
        : ['train'];

    return { configs: configs.length ? configs : ['default'], splits };
  }

  private normalizeRow(row: Record<string, unknown>, rowIdx: number): HFDatasetRow {
    const instruction = String(
      row.instruction ?? row.prompt ?? row.question ?? row.text ?? row.input ?? ''
    );
    const context = String(row.context ?? row.input ?? '');
    const response = String(
      row.response ?? row.output ?? row.answer ?? row.completion ?? row.chosen ?? ''
    );
    const category = row.category ? String(row.category) : undefined;

    return { rowIdx, instruction, context, response, category, raw: row };
  }
}
