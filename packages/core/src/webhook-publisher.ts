import axios from 'axios';

export type WebhookEvent =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'approval.required'
  | 'knowledge.updated'
  | 'evolution.proposal'
  | 'evolution.applied'
  | 'training.completed';

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

export class WebhookPublisher {
  private subscriptions: WebhookSubscription[] = [];

  subscribe(url: string, events: WebhookEvent[], secret?: string): WebhookSubscription {
    const sub: WebhookSubscription = {
      id: `wh-${Date.now()}`,
      url,
      events,
      secret,
      active: true,
    };
    this.subscriptions.push(sub);
    return sub;
  }

  unsubscribe(id: string): boolean {
    const idx = this.subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.subscriptions.splice(idx, 1);
    return true;
  }

  getSubscriptions(): WebhookSubscription[] {
    return [...this.subscriptions];
  }

  async publish(event: WebhookEvent, data: Record<string, unknown>): Promise<{ sent: number; failed: number }> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const targets = this.subscriptions.filter((s) => s.active && s.events.includes(event));
    let sent = 0;
    let failed = 0;

    for (const sub of targets) {
      try {
        await axios.post(sub.url, payload, {
          timeout: 5000,
          headers: sub.secret ? { 'X-AIOS-Secret': sub.secret } : {},
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  }
}
