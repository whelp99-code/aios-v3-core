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
        const yamlFrontmatter = parts[1].trim();
        const markdownContent = parts.slice(2).join('---\n').trim();
        let metadata;
        try {
            metadata = js_yaml_1.default.load(yamlFrontmatter);
        }
        catch (e) {
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
exports.SkillParser = SkillParser;
