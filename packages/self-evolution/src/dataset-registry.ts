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
export const TIER_A_DATASETS: DatasetRegistryEntry[] = [
  { id: 'databricks/databricks-dolly-15k', tier: 'A', config: 'default', split: 'train', domain: 'instruct', compatible: true, totalRows: 15011, rateLimitRisk: 'low' },
  { id: 'google/boolq', tier: 'A', config: 'default', split: 'validation', domain: 'qa', compatible: true, totalRows: 9427, rateLimitRisk: 'low' },
  { id: 'allenai/sciq', tier: 'A', config: 'default', split: 'train', domain: 'qa', compatible: true, totalRows: 12968, rateLimitRisk: 'low' },
  { id: 'HuggingFaceH4/no_robots', tier: 'A', config: 'default', split: 'train', domain: 'instruct', compatible: true, totalRows: 9500, rateLimitRisk: 'low' },
];

export const TIER_B_DATASETS: DatasetRegistryEntry[] = [
  { id: 'yahma/alpaca-cleaned', tier: 'B', config: 'default', split: 'train', domain: 'instruct', compatible: true, totalRows: 51760, rateLimitRisk: 'medium' },
  { id: 'tatsu-lab/alpaca', tier: 'B', config: 'default', split: 'train', domain: 'instruct', compatible: true, totalRows: 52002, rateLimitRisk: 'medium' },
  { id: 'teknium/GPTeacher-General-Instruct', tier: 'B', config: 'default', split: 'train', domain: 'instruct', compatible: true, totalRows: 89260, rateLimitRisk: 'medium' },
  { id: 'Anthropic/hh-rlhf', tier: 'B', config: 'default', split: 'train', domain: 'preference', compatible: true, totalRows: 160800, rateLimitRisk: 'medium' },
  { id: 'cais/mmlu', tier: 'B', config: 'high_school_biology', split: 'test', domain: 'reasoning', compatible: true, totalRows: 14042, rateLimitRisk: 'medium' },
  { id: 'mlabonne/FineTome-100k', tier: 'B', config: 'default', split: 'train', domain: 'instruct', compatible: true, totalRows: 100000, rateLimitRisk: 'medium' },
];

export const TIER_C_DATASETS: DatasetRegistryEntry[] = [
  { id: 'Open-Orca/OpenOrca', tier: 'C', config: 'default', split: 'train', domain: 'reasoning', compatible: true, totalRows: 2942029, rateLimitRisk: 'high' },
  { id: 'teknium/OpenHermes-2.5', tier: 'C', config: 'default', split: 'train', domain: 'dialogue', compatible: true, totalRows: 1000000, rateLimitRisk: 'high' },
  { id: 'HuggingFaceTB/smoltalk', tier: 'C', config: 'all', split: 'train', domain: 'instruct', compatible: true, totalRows: 1043917, rateLimitRisk: 'high' },
  { id: 'mosaicml/instruct-v3', tier: 'C', config: 'default', split: 'train', domain: 'instruct', compatible: true, totalRows: 500000, rateLimitRisk: 'high' },
  { id: 'nvidia/OpenMathInstruct-1', tier: 'C', config: 'default', split: 'train', domain: 'math', compatible: true, totalRows: 2000000, rateLimitRisk: 'high' },
];

export const ROTATION_DATASETS: DatasetRegistryEntry[] = [
  ...TIER_A_DATASETS,
  ...TIER_B_DATASETS,
  { id: 'sahil2801/CodeAlpaca-20k', tier: 'A', config: 'default', split: 'train', domain: 'code', compatible: true, totalRows: 20022, rateLimitRisk: 'low' },
  { id: 'HuggingFaceTB/smoltalk', tier: 'C', config: 'all', split: 'train', domain: 'instruct', compatible: true, totalRows: 1043917, rateLimitRisk: 'high' },
  { id: 'nvidia/OpenMathInstruct-1', tier: 'C', config: 'default', split: 'train', domain: 'math', compatible: true, totalRows: 2000000, rateLimitRisk: 'high' },
  { id: 'Open-Orca/OpenOrca', tier: 'C', config: 'default', split: 'train', domain: 'reasoning', compatible: true, totalRows: 2942029, rateLimitRisk: 'high' },
];

export function inferTier(totalRows: number | null): DatasetTier {
  if (!totalRows || totalRows <= 20000) return 'A';
  if (totalRows <= 200000) return 'B';
  return 'C';
}

export function inferDomain(category: string): DatasetDomain {
  const c = category.toLowerCase();
  if (c.includes('code')) return 'code';
  if (c.includes('math')) return 'math';
  if (c.includes('rlhf') || c.includes('preference')) return 'preference';
  if (c.includes('dialogue') || c.includes('chat') || c.includes('oasst')) return 'dialogue';
  if (c.includes('qa') || c.includes('reading')) return 'qa';
  if (c.includes('reasoning') || c.includes('orca')) return 'reasoning';
  return 'instruct';
}

export function inferRateLimitRisk(totalRows: number | null): RateLimitRisk {
  if (!totalRows || totalRows < 100000) return 'low';
  if (totalRows < 500000) return 'medium';
  return 'high';
}

export function probeResultToRegistryEntry(r: {
  id: string;
  category: string;
  totalRows: number | null;
  compatible: boolean;
  status: string;
  configs?: string[];
  splits?: string[];
}, candidate?: { config?: string; split?: string; tier?: DatasetTier }): DatasetRegistryEntry {
  const config = candidate?.config ?? r.configs?.[0] ?? 'default';
  const split =
    candidate?.split ??
    (r.splits?.includes('train') ? 'train' : r.splits?.[0] ?? 'train');
  return {
    id: r.id,
    tier: candidate?.tier ?? inferTier(r.totalRows),
    config,
    split,
    domain: inferDomain(r.category),
    compatible: r.compatible && r.status === 'compatible',
    totalRows: r.totalRows,
    rateLimitRisk: inferRateLimitRisk(r.totalRows),
    category: r.category,
  };
}
