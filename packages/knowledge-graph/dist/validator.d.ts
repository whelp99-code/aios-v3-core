import { KnowledgeGraphStore } from './store';
import { ValidationIssue } from './types';
export declare class KnowledgeValidator {
    private store;
    constructor(store: KnowledgeGraphStore);
    validate(): ValidationIssue[];
    autoFix(issues: ValidationIssue[]): number;
}
//# sourceMappingURL=validator.d.ts.map