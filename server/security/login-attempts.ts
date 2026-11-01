/**
 * Single-process bounded failed-login state for the JSON-db pilot.
 *
 * Never store passwords or OTPs. Records expire after inactivity or lockout,
 * and the number of remembered mobile identities stays bounded even when an
 * attacker tries large numbers of different identifiers.
 *
 * For multiple Node instances this must be replaced by a shared rate limiter.
 */
export interface FailedLoginAttempt {
  count: number;
  lockedUntil: number;
}

type StoredAttempt = FailedLoginAttempt & { lastAttemptAt: number };

export class FailedLoginTracker {
  private readonly entries = new Map<string, StoredAttempt>();

  constructor(
    private readonly maxEntries = 4096,
    private readonly inactivityMs = 5 * 60 * 1000,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error('Invalid login tracker capacity');
    if (!Number.isFinite(inactivityMs) || inactivityMs <= 0) throw new Error('Invalid login tracker TTL');
  }

  get(mobile: string, now = Date.now()): FailedLoginAttempt | undefined {
    const found = this.entries.get(mobile);
    if (!found) return undefined;
    // A completed lockout must never immediately re-lock a user on the
    // first new mistake; likewise old failures expire after inactivity.
    if (found.lockedUntil > 0 ? found.lockedUntil <= now :
        now - found.lastAttemptAt >= this.inactivityMs) {
      this.entries.delete(mobile);
      return undefined;
    }
    return { count: found.count, lockedUntil: found.lockedUntil };
  }

  set(mobile: string, attempt: FailedLoginAttempt, now = Date.now()): void {
    this.entries.delete(mobile);
    this.entries.set(mobile, { ...attempt, lastAttemptAt: now });

    // First remove expired records, then evict the oldest if the cap is
    // still reached. Never allow one request to grow memory without bound.
    if (this.entries.size > this.maxEntries) {
      for (const [key, value] of this.entries) {
        if (key !== mobile && (value.lockedUntil > 0 ? value.lockedUntil <= now :
            now - value.lastAttemptAt >= this.inactivityMs)) {
          this.entries.delete(key);
        }
      }
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (typeof oldest !== 'string') break;
      this.entries.delete(oldest);
    }
  }

  delete(mobile: string): void {
    this.entries.delete(mobile);
  }

  get size(): number {
    return this.entries.size;
  }
}
