/**
 * AGUIClient - Client-side AG-UI protocol implementation
 *
 * Connects to an SSE endpoint and parses AG-UI events,
 * dispatching callbacks for each event type.
 */

import type {
  AGUIClientConfig,
  AGUICallbacks,
  AGUIEvent,
  EventType,
} from './types.js';

export class AGUIClient {
  private config: Required<AGUIClientConfig>;
  private callbacks: AGUICallbacks;
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _isConnected = false;

  constructor(config: AGUIClientConfig, callbacks: AGUICallbacks = {}) {
    this.config = {
      endpoint: config.endpoint,
      headers: config.headers ?? {},
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
    };
    this.callbacks = callbacks;
  }

  /** Whether the client is currently connected */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Connect to the SSE endpoint and start listening for events.
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    // Note: EventSource doesn't support custom headers in all browsers.
    // For full header support, consider using fetch() with manual SSE parsing.
    // The headers are stored for implementations that use fetch-based SSE.
    this.eventSource = new EventSource(this.config.endpoint);

    this.eventSource.onopen = () => {
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this.callbacks.onOpen?.();
    };

    this.eventSource.onerror = (event) => {
      this._isConnected = false;

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.callbacks.onClose?.();
        this.attemptReconnect();
      } else {
        this.callbacks.onError?.(
          new Error(`SSE connection error: ${JSON.stringify(event)}`),
        );
      }
    };

    // Register listeners for all known event types
    this.registerEventListeners();
  }

  /**
   * Disconnect from the SSE endpoint.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this._isConnected = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Send a POST request to trigger a task on the server.
   * Returns the response body (not SSE — this is for triggering, not receiving).
   */
  async sendTask(input: string, metadata?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({ input, metadata }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send task: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  /**
   * Connect and consume an SSE stream via fetch (supports headers).
   *
   * This is an alternative to connect() that uses the Fetch API
   * instead of EventSource, allowing custom headers.
   */
  async connectWithFetch(input?: string): Promise<void> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: input ? JSON.stringify({ input }) : undefined,
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    this._isConnected = true;
    this.reconnectAttempts = 0;
    this.callbacks.onOpen?.();

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parsed = this.parseBuffer(buffer);
        buffer = parsed.remaining;

        for (const event of parsed.events) {
          this.dispatchEvent(event);
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const remaining = this.parseBuffer(buffer + '\n\n');
        for (const event of remaining.events) {
          this.dispatchEvent(event);
        }
      }
    } catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      this._isConnected = false;
      this.callbacks.onClose?.();
    }
  }

  /**
   * Parse an SSE text buffer into structured events.
   */
  private parseBuffer(buffer: string): { events: AGUIEvent[]; remaining: string } {
    const events: AGUIEvent[] = [];
    const lines = buffer.split('\n');
    let remaining = '';

    let currentEvent = '';
    let currentData: string[] = [];
    let i = 0;

    // Find complete events (terminated by empty line)
    while (i < lines.length) {
      const line = lines[i];

      if (line === '' || line === '\r') {
        // Empty line = end of event
        if (currentEvent && currentData.length > 0) {
          const payload = currentData.join('\n');
          try {
            const parsed = JSON.parse(payload) as AGUIEvent;
            events.push(parsed);
          } catch {
            // Skip malformed events
          }
        }
        currentEvent = '';
        currentData = [];
        i++;
      } else if (line.startsWith('event: ')) {
        currentEvent = line.slice(7);
        i++;
      } else if (line.startsWith('data: ')) {
        currentData.push(line.slice(6));
        i++;
      } else if (line.startsWith(': ')) {
        // Comment (heartbeat) — skip
        i++;
      } else {
        // Incomplete line or unknown prefix — stop here
        remaining = lines.slice(i).join('\n');
        break;
      }
    }

    return { events, remaining };
  }

  /**
   * Dispatch a parsed event to the appropriate callback.
   */
  private dispatchEvent(event: AGUIEvent): void {
    switch (event.type) {
      case 'TEXT_MESSAGE_START':
        this.callbacks.onTextMessageStart?.(event);
        break;
      case 'TEXT_MESSAGE_CONTENT':
        this.callbacks.onTextMessageContent?.(event);
        break;
      case 'TEXT_MESSAGE_END':
        this.callbacks.onTextMessageEnd?.(event);
        break;
      case 'TOOL_CALL_START':
        this.callbacks.onToolCallStart?.(event);
        break;
      case 'TOOL_CALL_CONTENT':
        this.callbacks.onToolCallContent?.(event);
        break;
      case 'TOOL_CALL_END':
        this.callbacks.onToolCallEnd?.(event);
        break;
      case 'STATE_UPDATE':
        this.callbacks.onStateUpdate?.(event);
        break;
      case 'TASK_STARTED':
        this.callbacks.onTaskStarted?.(event);
        break;
      case 'TASK_COMPLETED':
        this.callbacks.onTaskCompleted?.(event);
        break;
      case 'TASK_FAILED':
        this.callbacks.onTaskFailed?.(event);
        break;
      case 'PLANNER_OUTPUT':
        this.callbacks.onPlannerOutput?.(event);
        break;
      case 'EXECUTOR_OUTPUT':
        this.callbacks.onExecutorOutput?.(event);
        break;
      case 'CRITIC_OUTPUT':
        this.callbacks.onCriticOutput?.(event);
        break;
    }
  }

  /**
   * Register EventSource listeners for all known event types.
   */
  private registerEventListeners(): void {
    if (!this.eventSource) return;

    const eventTypes: EventType[] = [
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'TOOL_CALL_START',
      'TOOL_CALL_CONTENT',
      'TOOL_CALL_END',
      'STATE_UPDATE',
      'TASK_STARTED',
      'TASK_COMPLETED',
      'TASK_FAILED',
      'PLANNER_OUTPUT',
      'EXECUTOR_OUTPUT',
      'CRITIC_OUTPUT',
    ];

    for (const eventType of eventTypes) {
      this.eventSource.addEventListener(eventType, (e) => {
        try {
          const event = JSON.parse((e as MessageEvent).data) as AGUIEvent;
          this.dispatchEvent(event);
        } catch {
          // Skip malformed events
        }
      });
    }
  }

  /**
   * Attempt to reconnect with exponential backoff.
   */
  private attemptReconnect(): void {
    if (!this.config.autoReconnect) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.callbacks.onError?.(
        new Error(`Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`),
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
