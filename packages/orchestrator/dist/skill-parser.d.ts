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
export declare class SkillParser {
    parse(skillMarkdown: string): ParsedSkill;
    validateSkillStepsAgainstTools(skill: ParsedSkill, availableTools: string[]): {
        valid: boolean;
        missingTools: string[];
    };
    private sanitizeYamlFrontmatter;
    private extractReferencedTools;
}
//# sourceMappingURL=skill-parser.d.ts.map