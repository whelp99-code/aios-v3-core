export interface SandboxResult {
    success: boolean;
    output: string;
    errors: string[];
    durationMs: number;
}
export declare class SandboxExecutor {
    executeCode(code: string, language?: string): Promise<SandboxResult>;
    runTests(tests: string[]): Promise<SandboxResult>;
}
