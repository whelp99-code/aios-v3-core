/**
 * AlertManager
 * 알림 관리
 */

import { AlertConfig, Alert } from './types.js';

export class AlertManager {
  private alerts: Alert[] = [];
  private config: AlertConfig;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      errorThreshold: config.errorThreshold ?? 5,
      latencyThreshold: config.latencyThreshold ?? 5000,
      costThreshold: config.costThreshold ?? 10000,
    };
  }

  /**
   * 에러 알림 생성
   */
  createErrorAlert(message: string, metadata?: Record<string, any>): Alert {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'error',
      message,
      severity: 'high',
      timestamp: new Date(),
      metadata,
    };

    this.alerts.push(alert);
    return alert;
  }

  /**
   * 지연 시간 알림 생성
   */
  createLatencyAlert(durationMs: number, metadata?: Record<string, any>): Alert {
    const severity = durationMs > (this.config.latencyThreshold ?? 5000) * 2
      ? 'high'
      : 'medium';

    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'latency',
      message: `지연 시간 초과: ${durationMs}ms`,
      severity,
      timestamp: new Date(),
      metadata: { durationMs, ...metadata },
    };

    this.alerts.push(alert);
    return alert;
  }

  /**
   * 비용 알림 생성
   */
  createCostAlert(costKRW: number, metadata?: Record<string, any>): Alert {
    const severity = costKRW > (this.config.costThreshold ?? 10000) * 2
      ? 'high'
      : 'medium';

    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'cost',
      message: `비용 초과: ₩${costKRW.toLocaleString()}`,
      severity,
      timestamp: new Date(),
      metadata: { costKRW, ...metadata },
    };

    this.alerts.push(alert);
    return alert;
  }

  /**
   * 알림 조회
   */
  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * 최근 알림 조회
   */
  getRecentAlerts(limit: number = 10): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * 심각도별 알림 조회
   */
  getAlertsBySeverity(severity: Alert['severity']): Alert[] {
    return this.alerts.filter(a => a.severity === severity);
  }

  /**
   * 알림 초기화
   */
  clearAlerts(): void {
    this.alerts = [];
  }
}
