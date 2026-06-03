"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookPublisher = void 0;
const axios_1 = __importDefault(require("axios"));
class WebhookPublisher {
    constructor() {
        this.subscriptions = [];
    }
    subscribe(url, events, secret) {
        const sub = {
            id: `wh-${Date.now()}`,
            url,
            events,
            secret,
            active: true,
        };
        this.subscriptions.push(sub);
        return sub;
    }
    unsubscribe(id) {
        const idx = this.subscriptions.findIndex((s) => s.id === id);
        if (idx === -1)
            return false;
        this.subscriptions.splice(idx, 1);
        return true;
    }
    getSubscriptions() {
        return [...this.subscriptions];
    }
    async publish(event, data) {
        const payload = {
            event,
            timestamp: new Date().toISOString(),
            data,
        };
        const targets = this.subscriptions.filter((s) => s.active && s.events.includes(event));
        let sent = 0;
        let failed = 0;
        for (const sub of targets) {
            try {
                await axios_1.default.post(sub.url, payload, {
                    timeout: 5000,
                    headers: sub.secret ? { 'X-AIOS-Secret': sub.secret } : {},
                });
                sent++;
            }
            catch {
                failed++;
            }
        }
        return { sent, failed };
    }
}
exports.WebhookPublisher = WebhookPublisher;
//# sourceMappingURL=webhook-publisher.js.map