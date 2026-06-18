import {
  LoopIteration,
  LoopReport,
  LoopOptions,
  CodePatch
} from './types.js';
import { CodePatcher } from './code-patcher.js';
import { TestRunner } from './test-runner.js';
import { createLLMClient, LLMClient } from './utils.js';

/**
 * KarpathyLoop implements Karpathy-style automatic learning loop.
 *
 * The loop pattern:
 * 1. Analyze code
 * 2. Propose improvement (via LLM)
 * 3. Generate patch (via LLM)
 * 4. Test the patch
 * 5. Commit if better / Rollback if not
 * 6. Repeat
 *
 * Inspired by Andrej Karpathy's approach to iterative code improvement
 * through automated feedback loops.
 */
export class KarpathyLoop {
  private options: Required<Omit<LoopOptions, 'onIteration'>> & { onIteration?: (iteration: LoopIteration) => void };
  private patcher: CodePatcher;
  private testRunner: TestRunner;
  private llm: LLMClient;
  private iterations: LoopIteration[] = [];

  constructor(options: LoopOptions) {
    this.options = {
      maxIterations: options.maxIterations ?? 20,
      improvementThreshold: options.improvementThreshold ?? 0.1,
      codebasePath: options.codebasePath,
      model: options.model ?? 'qwen/qwen3.5-9b',
      onIteration: options.onIteration,
    };

    this.patcher = new CodePatcher();
    this.testRunner = new TestRunner();
    this.llm = createLLMClient(this.options.model);
  }

  /**
   * Run the learning loop for up to maxIterations.
   *
   * @returns LoopReport with summary of all iterations
   */
  async run(): Promise<LoopReport> {
    console.log(`[KarpathyLoop] Starting learning loop (max ${this.options.maxIterations} iterations)`);

    this.iterations = [];

    for (let i = 1; i <= this.options.maxIterations; i++) {
      console.log(`\n[Iteration ${i}/${this.options.maxIterations}]`);

      try {
        const iteration = await this.runIteration(i);
        this.iterations.push(iteration);

        // Call the iteration callback if provided
        if (this.options.onIteration) {
          this.options.onIteration(iteration);
        }

        // Log result
        if (iteration.committed) {
          console.log(`[Iteration ${i}] ✓ Committed (improvement: ${iteration.improvement.toFixed(3)})`);
        } else {
          console.log(`[Iteration ${i}] ✗ Rolled back (improvement: ${iteration.improvement.toFixed(3)})`);
        }
      } catch (error) {
        console.error(`[Iteration ${i}] Error:`, error);
        // Record failed iteration
        this.iterations.push({
          iteration: i,
          proposal: 'Failed to generate proposal',
          patch: '',
          testResult: { passed: false, error: String(error), duration: 0 },
          committed: false,
          improvement: 0,
        });
      }
    }

    return this.generateReport();
  }

  /**
   * Run a single iteration of the learning loop.
   */
  private async runIteration(iterationNumber: number): Promise<LoopIteration> {
    // Step 1: Analyze code and generate proposal
    console.log('  → Generating improvement proposal...');
    const proposal = await this.generateProposal();
    console.log(`    Proposal: ${proposal.substring(0, 100)}...`);

    // Step 2: Generate patch based on proposal
    console.log('  → Generating code patch...');
    const patch = await this.generatePatch(proposal);

    // Step 3: Apply the patch
    console.log('  → Applying patch...');
    const codePatch: CodePatch = {
      filePath: this.options.codebasePath,
      content: patch,
      description: proposal,
    };

    const previousContent = await this.patcher.applyPatch(codePatch);

    // Step 4: Run tests
    console.log('  → Running tests...');
    const testResult = await this.testRunner.runTest(this.options.codebasePath);

    // Step 5: Evaluate improvement
    console.log('  → Evaluating improvement...');
    const improvement = await this.evaluateImprovement(previousContent, patch);

    // Step 6: Commit or rollback
    let committed = false;

    if (testResult.passed && improvement > this.options.improvementThreshold) {
      // Commit: keep the changes
      console.log('  → Tests passed and improvement detected, committing...');
      committed = true;
      this.patcher.clearBackups();

      // Record skill on success
      await this.recordSkill(proposal, improvement);
    } else {
      // Rollback: revert changes
      console.log('  → Rolling back changes...');
      await this.patcher.rollback(this.options.codebasePath);
    }

    return {
      iteration: iterationNumber,
      proposal,
      patch,
      testResult,
      committed,
      improvement,
    };
  }

  /**
   * Generate an improvement proposal using the LLM.
   */
  private async generateProposal(): Promise<string> {
    const code = await this.readCurrentCode();

    const prompt = `Analyze this code and propose a specific improvement:

${code}

Focus on:
- Performance improvements
- Code clarity and readability
- Bug fixes
- Best practices

Provide a clear, actionable proposal.`;

    return this.llm.generate(prompt);
  }

  /**
   * Generate a code patch based on the proposal.
   */
  private async generatePatch(proposal: string): Promise<string> {
    const code = await this.readCurrentCode();

    const prompt = `Based on this proposal, generate the improved code:

Proposal: ${proposal}

Current code:
${code}

Generate the complete improved code. Return only the code, no explanation.`;

    return this.llm.generate(prompt);
  }

  /**
   * Evaluate the improvement between old and new code.
   */
  private async evaluateImprovement(oldCode: string, newCode: string): Promise<number> {
    const prompt = `Compare these two versions of code and rate the improvement from -1.0 to 1.0:

OLD CODE:
${oldCode}

NEW CODE:
${newCode}

Rate the improvement (positive = better, negative = worse). Return only a number.`;

    const response = await this.llm.generate(prompt);

    // Parse the improvement score
    const match = response.match(/-?\d+\.?\d*/);
    if (match) {
      return parseFloat(match[0]);
    }

    // Default to slight positive if parsing fails
    return 0.05;
  }

  /**
   * Record a successful improvement as a skill/learning.
   */
  private async recordSkill(proposal: string, improvement: number): Promise<void> {
    console.log(`  → Recording skill: ${proposal.substring(0, 50)}... (improvement: ${improvement.toFixed(3)})`);
    // In a real implementation, this would:
    // 1. Save the successful pattern to a knowledge base
    // 2. Update embeddings for retrieval
    // 3. Track metrics for the learning history
  }

  /**
   * Read the current code from the codebase.
   */
  private async readCurrentCode(): Promise<string> {
    const { readFile } = await import('./utils.js');
    return readFile(this.options.codebasePath);
  }

  /**
   * Generate a summary report of all iterations.
   */
  private generateReport(): LoopReport {
    const committedCount = this.iterations.filter(i => i.committed).length;
    const rolledBackCount = this.iterations.filter(i => !i.committed).length;
    const totalImprovement = this.iterations.reduce((sum, i) => sum + i.improvement, 0);

    return {
      totalIterations: this.iterations.length,
      committedCount,
      rolledBackCount,
      totalImprovement,
      iterations: this.iterations,
    };
  }

  /**
   * Get the current iteration count.
   */
  getIterationCount(): number {
    return this.iterations.length;
  }

  /**
   * Get all iterations so far.
   */
  getIterations(): LoopIteration[] {
    return [...this.iterations];
  }
}
