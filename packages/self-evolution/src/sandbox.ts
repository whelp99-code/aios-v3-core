export interface SandboxResult {
  success: boolean;
  output: string;
  errors: string[];
  durationMs: number;
}

export class SandboxExecutor {
  async executeCode(code: string, language = 'typescript'): Promise<SandboxResult> {
    const start = Date.now();
    const errors: string[] = [];

    if (code.includes('process.exit') || code.includes('require("fs")') || code.includes("require('fs')")) {
      errors.push('Blocked: potentially unsafe operation detected');
      return {
        success: false,
        output: '',
        errors,
        durationMs: Date.now() - start,
      };
    }

    if (code.includes('throw ') || code.includes('SyntaxError')) {
      errors.push('Code contains error patterns');
      return {
        success: false,
        output: '',
        errors,
        durationMs: Date.now() - start,
      };
    }

    return {
      success: true,
      output: `[Sandbox] ${language} code validated (${code.split('\n').length} lines)`,
      errors: [],
      durationMs: Date.now() - start,
    };
  }

  async runTests(tests: string[]): Promise<SandboxResult> {
    const start = Date.now();
    const passed = tests.length;
    return {
      success: passed > 0 || tests.length === 0,
      output: `Ran ${tests.length} tests: ${passed} passed (simulated)`,
      errors: [],
      durationMs: Date.now() - start,
    };
  }
}
