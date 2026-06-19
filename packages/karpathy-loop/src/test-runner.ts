import { TestResult } from './types.js';

/**
 * TestRunner handles executing tests on modified code.
 *
 * Uses dynamic import to execute code in an isolated context
 * and catches any errors that occur during execution.
 */
export class TestRunner {
  private timeout: number;

  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout ?? 5000;
  }

  /**
   * Run tests on the specified file or code.
   *
   * @param filePath - Path to the file to test
   * @param testCode - Optional test code to execute
   * @returns TestResult with pass/fail status and any errors
   */
  async runTest(filePath: string, testCode?: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Create a sandboxed module context
      const moduleContent = testCode ?? await this.loadTestFile(filePath);

      // Execute the test code with a timeout
      const result = await this.executeWithTimeout(moduleContent);

      return {
        passed: true,
        output: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);

      return {
        passed: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Load test file content.
   */
  private async loadTestFile(filePath: string): Promise<string> {
    const { readFile } = await import('./utils.js');
    return readFile(filePath);
  }

  /**
   * Execute code with a timeout using dynamic import.
   */
  private async executeWithTimeout(code: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test execution timed out after ${this.timeout}ms`));
      }, this.timeout);

      // Create a temporary file and import it
      const tempFile = `data:text/javascript,${encodeURIComponent(code)}`;

      import(tempFile)
        .then((module) => {
          clearTimeout(timer);

          // If the module exports a test function, run it
          if (typeof module.default === 'function') {
            const result = module.default();
            resolve(String(result));
          } else if (typeof module.test === 'function') {
            const result = module.test();
            resolve(String(result));
          } else {
            resolve('Module loaded successfully');
          }
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Run a simple validation check on code syntax.
   */
  async validateSyntax(code: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Try to parse the code as a module
      new Function(code);

      return {
        passed: true,
        output: 'Syntax validation passed',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);

      return {
        passed: false,
        error: `Syntax error: ${errorMessage}`,
        duration: Date.now() - startTime,
      };
    }
  }
}
