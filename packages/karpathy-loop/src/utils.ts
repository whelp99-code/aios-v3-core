import { readFile as fsReadFile, writeFile as fsWriteFile } from 'node:fs/promises';

/**
 * Read a file's content.
 */
export async function readFile(filePath: string): Promise<string> {
  return fsReadFile(filePath, 'utf-8');
}

/**
 * Write content to a file.
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fsWriteFile(filePath, content, 'utf-8');
}

/**
 * Create a backup of a file.
 */
export async function backup(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  // Could write to .backup directory if needed
  return content;
}

/**
 * Generate a hash for content (for change detection).
 */
export function hashContent(content: string): number {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Simple LLM interface for generating responses.
 */
export interface LLMClient {
  generate(prompt: string): Promise<string>;
}

/**
 * Create a simple LLM client (placeholder for actual implementation).
 */
export function createLLMClient(model?: string): LLMClient {
  return {
    async generate(prompt: string): Promise<string> {
      // Placeholder - in real implementation, this would call an LLM API
      console.log(`[LLM] Generating response for prompt (${prompt.length} chars) using ${model ?? 'default'}`);

      // Return a mock response for now
      return `// Generated code improvement for: ${prompt.substring(0, 50)}...`;
    }
  };
}
