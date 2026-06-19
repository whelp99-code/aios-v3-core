import { describe, it, expect } from 'vitest';
import { MailThread, MailMessage, ConfidenceScore, DateRange, SourceSystem } from '../src/index.js';

describe('MailThread', () => {
  it('should create with default status', () => {
    const thread = new MailThread(
      't1',
      { system: 'mail-intelligence', id: 'ext-1', equals: () => false },
      'Test Subject',
      ['a@test.com', 'b@test.com']
    );
    expect(thread.status).toBe('ingested');
    expect(thread.participants).toHaveLength(2);
  });

  it('should transition to analyzed', () => {
    const thread = new MailThread(
      't1',
      { system: 'mail-intelligence', id: 'ext-1', equals: () => false },
      'Test',
      []
    );
    thread.analyze();
    expect(thread.status).toBe('analyzed');
  });

  it('should not analyze twice', () => {
    const thread = new MailThread(
      't1',
      { system: 'mail-intelligence', id: 'ext-1', equals: () => false },
      'Test',
      []
    );
    thread.analyze();
    expect(() => thread.analyze()).toThrow();
  });
});

describe('ConfidenceScore', () => {
  it('should create valid score', () => {
    const score = new ConfidenceScore(0.85);
    expect(score.value).toBe(0.85);
    expect(score.isHigh()).toBe(true);
  });

  it('should reject out of range', () => {
    expect(() => new ConfidenceScore(1.5)).toThrow();
    expect(() => new ConfidenceScore(-0.1)).toThrow();
  });

  it('should classify correctly', () => {
    expect(new ConfidenceScore(0.9).isHigh()).toBe(true);
    expect(new ConfidenceScore(0.6).isMedium()).toBe(true);
    expect(new ConfidenceScore(0.3).isLow()).toBe(true);
  });
});

describe('DateRange', () => {
  it('should create valid range', () => {
    const range = new DateRange(new Date('2024-01-01'), new Date('2024-01-31'));
    expect(range.contains(new Date('2024-01-15'))).toBe(true);
    expect(range.contains(new Date('2024-02-01'))).toBe(false);
  });

  it('should reject invalid range', () => {
    expect(() => new DateRange(new Date('2024-01-31'), new Date('2024-01-01'))).toThrow();
  });
});

describe('SourceSystem', () => {
  it('should create from constants', () => {
    expect(SourceSystem.MAIL_INTELLIGENCE.name).toBe('mail-intelligence');
    expect(SourceSystem.AIOS_V1.name).toBe('aios-v1');
  });
});
