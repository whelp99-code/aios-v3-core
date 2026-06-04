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
export declare class HFDatasetLoader {
    private baseUrl;
    private token;
    constructor(token?: string);
    fetchRows(cfg: HFDatasetConfig, offset?: number, length?: number): Promise<FetchRowsResult>;
    getDatasetInfo(dataset: string): Promise<{
        configs: string[];
        splits: string[];
        splitSizes: Record<string, number>;
    }>;
    private fetchWithRetry;
    private normalizeRow;
}
