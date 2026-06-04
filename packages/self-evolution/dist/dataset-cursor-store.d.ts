export interface DatasetCursor {
    offset: number;
    lastRowIdx?: number;
    updatedAt: string;
}
export declare class DatasetCursorStore {
    private filePath;
    private cursors;
    constructor(dataDir?: string, fileName?: string);
    private key;
    getOffset(datasetId: string, config?: string, split?: string): number;
    advance(datasetId: string, batchSize: number, config?: string, split?: string): number;
    reset(datasetId?: string): void;
    getAll(): Record<string, DatasetCursor>;
    private load;
    private save;
}
