import { CodePatch } from './types.js';
import { readFile, writeFile, backup } from './utils.js';

/**
 * CodePatcher handles applying code patches to the codebase.
 *
 * Supports full code replacement mode where the entire file content
 * is replaced with the new version. Maintains backups for rollback.
 */
export class CodePatcher {
  private backups: Map<string, string> = new Map();

  /**
   * Apply a patch to a file. Creates a backup before modification.
   *
   * @param patch - The code patch to apply
   * @returns The previous content (for rollback)
   * @throws Error if the file doesn't exist or write fails
   */
  async applyPatch(patch: CodePatch): Promise<string> {
    const { filePath, content } = patch;

    // Read the current content for backup
    const previousContent = await readFile(filePath);

    // Store backup for potential rollback
    this.backups.set(filePath, previousContent);

    // Apply the new content (full replacement)
    await writeFile(filePath, content);

    return previousContent;
  }

  /**
   * Rollback a previously applied patch.
   *
   * @param filePath - The file to rollback
   * @returns true if rollback succeeded, false if no backup exists
   */
  async rollback(filePath: string): Promise<boolean> {
    const backupContent = this.backups.get(filePath);

    if (backupContent === undefined) {
      return false;
    }

    await writeFile(filePath, backupContent);
    this.backups.delete(filePath);

    return true;
  }

  /**
   * Check if a backup exists for a file.
   *
   * @param filePath - The file to check
   */
  hasBackup(filePath: string): boolean {
    return this.backups.has(filePath);
  }

  /**
   * Clear all backups (call after successful commit).
   */
  clearBackups(): void {
    this.backups.clear();
  }

  /**
   * Get the list of files that have been backed up.
   */
  getBackedUpFiles(): string[] {
    return Array.from(this.backups.keys());
  }
}
