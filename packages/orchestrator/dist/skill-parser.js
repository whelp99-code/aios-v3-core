"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillParser = void 0;
const js_yaml_1 = __importDefault(require("js-yaml"));
class SkillParser {
    parse(skillMarkdown) {
        const parts = skillMarkdown.split('---\n');
        if (parts.length < 3) {
            throw new Error('Invalid SKILL.md format: Missing YAML frontmatter delimiters.');
        }
        const yamlFrontmatter = this.sanitizeYamlFrontmatter(parts[1].trim());
        const markdownContent = parts.slice(2).join('---\n').trim();
        let metadata;
        try {
            metadata = js_yaml_1.default.load(yamlFrontmatter, { schema: js_yaml_1.default.DEFAULT_SCHEMA });
        }
        catch (e) {
            throw new Error(`Failed to parse SKILL.md YAML frontmatter: ${e.message}`);
        }
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
    validateSkillStepsAgainstTools(skill, availableTools) {
        const referencedTools = this.extractReferencedTools(skill);
        const normalizedAvailable = new Set(availableTools.map((t) => t.toLowerCase()));
        const missingTools = referencedTools.filter((tool) => !normalizedAvailable.has(tool.toLowerCase()));
        return {
            valid: missingTools.length === 0,
            missingTools,
        };
    }
    sanitizeYamlFrontmatter(frontmatter) {
        return frontmatter
            .split('\n')
            .map((line) => {
            const keyValueMatch = line.match(/^(\s*[\w_-]+):\s*(.+)$/);
            if (!keyValueMatch)
                return line;
            const [, key, value] = keyValueMatch;
            const trimmed = value.trim();
            if (trimmed.startsWith('"') ||
                trimmed.startsWith("'") ||
                trimmed.startsWith('{') ||
                trimmed.startsWith('[') ||
                trimmed === 'true' ||
                trimmed === 'false' ||
                trimmed === 'null' ||
                !isNaN(Number(trimmed))) {
                return line;
            }
            if (trimmed.includes(':') || trimmed.includes('#')) {
                const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                return `${key}: "${escaped}"`;
            }
            return line;
        })
            .join('\n');
    }
    extractReferencedTools(skill) {
        const tools = new Set();
        const sources = [skill.dependencies ?? '', skill.workflowSteps, skill.usageExample ?? ''];
        for (const source of sources) {
            const backtickMatches = source.match(/`([a-zA-Z0-9_-]+)`/g) ?? [];
            for (const match of backtickMatches) {
                tools.add(match.replace(/`/g, ''));
            }
            const bulletMatches = source.match(/^\*\s+([a-zA-Z0-9_-]+)/gm) ?? [];
            for (const match of bulletMatches) {
                tools.add(match.replace(/^\*\s+/, ''));
            }
        }
        return Array.from(tools);
    }
}
exports.SkillParser = SkillParser;
