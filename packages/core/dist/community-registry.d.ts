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
export declare class CommunityRegistry {
    private contributions;
    list(type?: CommunityContribution['type']): CommunityContribution[];
    publish(contribution: Omit<CommunityContribution, 'id' | 'downloads' | 'createdAt'>): CommunityContribution;
    incrementDownloads(id: string): void;
}
