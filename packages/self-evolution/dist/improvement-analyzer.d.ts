import { ExperienceEntry } from './experience-buffer';
import { LearnedPolicy } from './learned-policy-store';
export interface Improvement {
    id: string;
    type: 'routing' | 'synthesis' | 'quality' | 'batch' | 'category';
    description: string;
    action: Record<string, unknown>;
    priority: number;
}
export interface AnalysisResult {
    successRate: number;
    avgReward: number;
    totalSamples: number;
    failurePatterns: Record<string, number>;
    improvements: Improvement[];
}
export declare class ImprovementAnalyzer {
    analyze(experiences: ExperienceEntry[], currentPolicy: LearnedPolicy, iteration: number): AnalysisResult;
}
