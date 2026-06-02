import yaml from 'js-yaml';

export interface SkillMetadata {
  name: string;
  description: string;
  input_schema: any;
  output_schema: any;
  version?: string;
  author?: string;
}

export interface ParsedSkill {
  metadata: SkillMetadata;
  workflowSteps: string;
  dependencies?: string;
  usageExample?: string;
}

export class SkillParser {
  parse(skillMarkdown: string): ParsedSkill {
    const parts = skillMarkdown.split('---\n');
    if (parts.length < 3) {
      throw new Error('Invalid SKILL.md format: Missing YAML frontmatter delimiters.');
    }

    const yamlFrontmatter = parts[1].trim();
    const markdownContent = parts.slice(2).join('---\n').trim();

    let metadata: SkillMetadata;
    try {
      metadata = yaml.load(yamlFrontmatter) as SkillMetadata;
    } catch (e: any) {
      throw new Error(`Failed to parse SKILL.md YAML frontmatter: ${e.message}`);
    }

    // Extract workflow steps, dependencies, usage example from markdown content
    const workflowStepsMatch = markdownContent.match(/## Workflow Steps\n([\s\S]*?)(?:\n## Dependencies|\n## Usage Example|\n## Version|\n## Author|$)/);
    const dependenciesMatch = markdownContent.match(/## Dependencies\n([\s\S]*?)(?:\n## Usage Example|\n## Version|\n## Author|$)/);
    const usageExampleMatch = markdownContent.match(/## Usage Example\n([\s\S]*?)(?:\n## Version|\n## Author|$)/);

    return {
      metadata,
      workflowSteps: workflowStepsMatch ? workflowStepsMatch[1].trim() : '',
      dependencies: dependenciesMatch ? dependenciesMatch[1].trim() : undefined,
      usageExample: usageExampleMatch ? usageExampleMatch[1].trim() : undefined,
    };
  }
}
