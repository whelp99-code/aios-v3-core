export type DatasetTier = 'A' | 'B' | 'C';
export type DatasetDomain = 'instruct' | 'reasoning' | 'math' | 'preference' | 'dialogue' | 'qa' | 'code';
export type RateLimitRisk = 'low' | 'medium' | 'high';
export interface DatasetRegistryEntry {
    id: string;
    tier: DatasetTier;
    config: string;
    split: string;
    domain: DatasetDomain;
    compatible: boolean;
    totalRows: number | null;
    rateLimitRisk: RateLimitRisk;
    category?: string;
}
/** Known training tiers from multi-dataset plan */
export declare const TIER_A_DATASETS: DatasetRegistryEntry[];
export declare const TIER_B_DATASETS: DatasetRegistryEntry[];
export declare const TIER_C_DATASETS: DatasetRegistryEntry[];
export declare const ROTATION_DATASETS: DatasetRegistryEntry[];
export declare function inferTier(totalRows: number | null): DatasetTier;
export declare function inferDomain(category: string): DatasetDomain;
export declare function inferRateLimitRisk(totalRows: number | null): RateLimitRisk;
export declare function probeResultToRegistryEntry(r: {
    id: string;
    category: string;
    totalRows: number | null;
    compatible: boolean;
    status: string;
    configs?: string[];
    splits?: string[];
}, candidate?: {
    config?: string;
    split?: string;
    tier?: DatasetTier;
}): DatasetRegistryEntry;
