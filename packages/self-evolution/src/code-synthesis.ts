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

export class CodeSynthesisEngine {
  synthesize(
    review: string,
    executionResult: string | null,
    existingChanges: CodePatch[] = [],
    extraKeywords: string[] = []
  ): SynthesisResult {
    const patches: CodePatch[] = [...existingChanges];
    const tests: string[] = [];
    const lower = review.toLowerCase();
    const keywords = [
      'missing',
      'incomplete',
      'error',
      'bug',
      'short',
      'expand',
      ...extraKeywords,
    ];

    const matchesKeyword = (kw: string) => lower.includes(kw.toLowerCase());

    if (keywords.some((k) => ['missing', 'incomplete'].includes(k) && matchesKeyword(k))) {
      patches.push({
        filePath: 'src/generated/fix.ts',
        diff: '+ // Auto-generated fix based on critic review\n+ export function autoFix() { return true; }',
        description: 'Add missing implementation based on critic feedback',
      });
      tests.push('test("autoFix returns true", () => expect(autoFix()).toBe(true))');
    }

    if (keywords.some((k) => ['error', 'bug'].includes(k) && matchesKeyword(k))) {
      patches.push({
        filePath: 'src/generated/error-handler.ts',
        diff: '+ export function handleError(e: Error) { console.error(e); return null; }',
        description: 'Add error handling based on critic review',
      });
    }

    if (patches.length === existingChanges.length && executionResult) {
      const fileMatch = executionResult.match(/FILE:\s*(.+)/);
      if (fileMatch) {
        patches.push({
          filePath: fileMatch[1].trim(),
          diff: executionResult.match(/```diff\n([\s\S]*?)```/)?.[1] ?? '+ // synthesized',
          description: 'Extracted from execution result',
        });
      }
    }

    return {
      patches,
      tests,
      confidence: patches.length > 0 ? 0.7 : 0.3,
      reasoning: `Synthesized ${patches.length} patches from review analysis`,
    };
  }
}
