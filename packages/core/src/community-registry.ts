export interface CommunityContribution {
  id: string;
  type: 'skill' | 'adapter' | 'plugin' | 'model-config';
  name: string;
  author: string;
  description: string;
  version: string;
  downloads: number;
  createdAt: string;
}

export class CommunityRegistry {
  private contributions: CommunityContribution[] = [
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

  list(type?: CommunityContribution['type']): CommunityContribution[] {
    return type ? this.contributions.filter((c) => c.type === type) : [...this.contributions];
  }

  publish(contribution: Omit<CommunityContribution, 'id' | 'downloads' | 'createdAt'>): CommunityContribution {
    const entry: CommunityContribution = {
      ...contribution,
      id: `contrib-${Date.now()}`,
      downloads: 0,
      createdAt: new Date().toISOString(),
    };
    this.contributions.push(entry);
    return entry;
  }

  incrementDownloads(id: string): void {
    const c = this.contributions.find((x) => x.id === id);
    if (c) c.downloads++;
  }
}
