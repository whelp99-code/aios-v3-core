"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityRegistry = void 0;
class CommunityRegistry {
    constructor() {
        this.contributions = [
            {
                id: 'skill-accelerator',
                type: 'skill',
                name: 'aios-project-accelerator',
                author: 'Manus AI',
                description: 'Project planning and architecture acceleration skill',
                version: '1.0',
                downloads: 0,
                createdAt: new Date().toISOString(),
            },
            {
                id: 'adapter-vibe',
                type: 'adapter',
                name: 'vibe-coding-os',
                author: 'AIOS Team',
                description: 'MCP adapter for vibe-coding-os',
                version: '1.0',
                downloads: 0,
                createdAt: new Date().toISOString(),
            },
        ];
    }
    list(type) {
        return type ? this.contributions.filter((c) => c.type === type) : [...this.contributions];
    }
    publish(contribution) {
        const entry = {
            ...contribution,
            id: `contrib-${Date.now()}`,
            downloads: 0,
            createdAt: new Date().toISOString(),
        };
        this.contributions.push(entry);
        return entry;
    }
    incrementDownloads(id) {
        const c = this.contributions.find((x) => x.id === id);
        if (c)
            c.downloads++;
    }
}
exports.CommunityRegistry = CommunityRegistry;
//# sourceMappingURL=community-registry.js.map