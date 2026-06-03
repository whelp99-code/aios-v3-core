export interface CodePatch {
    filePath: string;
    diff: string;
    description: string;
}
export interface SynthesisResult {
    patches: CodePatch[];
    tests: string[];
    confidence: number;
    reasoning: string;
}
export declare class CodeSynthesisEngine {
    synthesize(review: string, executionResult: string | null, existingChanges?: CodePatch[]): SynthesisResult;
}
