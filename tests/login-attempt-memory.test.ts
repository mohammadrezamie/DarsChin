import { describe, expect, it } from 'vitest';
import { FailedLoginTracker } from '../server/security/login-attempts';

describe('bounded failed-login and lockout state', () => {
  it('never allows distinct unknown mobile attempts to grow RAM without a limit', () => {
    const tracker = new FailedLoginTracker(5, 300_000);
    for (let i = 0; i < 10_000; i++) {
      tracker.set('synthetic-mobile-' + i, { count: 1, lockedUntil: 0 }, i);
    }
    expect(tracker.size).toBeLessThanOrEqual(5);
    expect(tracker.get('synthetic-mobile-0', 10_001)).toBeUndefined();
    expect(tracker.get('synthetic-mobile-9999', 10_001)?.count).toBe(1);
  });

  it('keeps a live lockout and resets failures after the five-minute lock expires', () => {
    const tracker = new FailedLoginTracker(100, 300_000);
    const now = 2_000_000;
    tracker.set('synthetic-number', { count: 5, lockedUntil: now + 300_000 }, now);
    expect(tracker.get('synthetic-number', now + 10_000)).toEqual({
      count: 5, lockedUntil: now + 300_000,
    });
    expect(tracker.get('synthetic-number', now + 300_000)).toBeUndefined();
    tracker.set('synthetic-number', { count: 1, lockedUntil: 0 }, now + 300_000);
    expect(tracker.get('synthetic-number', now + 300_001)?.count).toBe(1);
  });

  it('forgets old failures, removes an account after success and keeps another lockout intact', () => {
    const tracker = new FailedLoginTracker(3, 10_000);
    tracker.set('synthetic-one', { count: 4, lockedUntil: 0 }, 1_000);
    tracker.set('synthetic-two', { count: 5, lockedUntil: 20_000 }, 1_000);
    expect(tracker.get('synthetic-one', 11_000)).toBeUndefined();
    expect(tracker.get('synthetic-two', 11_000)?.lockedUntil).toBe(20_000);
    tracker.delete('synthetic-two');
    expect(tracker.get('synthetic-two', 11_000)).toBeUndefined();
  });
});
