export type WebhookEvent = 'workflow.started' | 'workflow.completed' | 'workflow.failed' | 'approval.required' | 'knowledge.updated' | 'evolution.proposal' | 'evolution.applied';
export interface WebhookSubscription {
    id: string;
    url: string;
    events: WebhookEvent[];
    secret?: string;
    active: boolean;
}
export interface WebhookPayload {
    event: WebhookEvent;
    timestamp: string;
    data: Record<string, unknown>;
}
export declare class WebhookPublisher {
    private subscriptions;
    subscribe(url: string, events: WebhookEvent[], secret?: string): WebhookSubscription;
    unsubscribe(id: string): boolean;
    getSubscriptions(): WebhookSubscription[];
    publish(event: WebhookEvent, data: Record<string, unknown>): Promise<{
        sent: number;
        failed: number;
    }>;
}
