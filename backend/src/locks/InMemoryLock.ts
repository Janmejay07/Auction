import type { AuctionLock } from './types';

/**
 * In-memory auction lock.
 *
 * Suitable for a single-process deployment.
 * Swap with a Redis-backed implementation of {@link AuctionLock}
 * when horizontal scaling is needed.
 */
export class InMemoryAuctionLock implements AuctionLock {
  private readonly locks = new Map<string, number>();

  async acquire(key: string, ttlMs = 30_000): Promise<boolean> {
    this.cleanup();

    const existing = this.locks.get(key);
    if (existing !== undefined && existing > Date.now()) {
      return false;
    }

    this.locks.set(key, Date.now() + ttlMs);
    return true;
  }

  async release(key: string): Promise<void> {
    this.locks.delete(key);
  }

  async isLocked(key: string): Promise<boolean> {
    this.cleanup();
    const expiresAt = this.locks.get(key);
    return expiresAt !== undefined && expiresAt > Date.now();
  }

  /** Remove expired entries so the Map doesn't grow unbounded. */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.locks) {
      if (expiresAt <= now) {
        this.locks.delete(key);
      }
    }
  }
}

export class AuctionLockManager extends InMemoryAuctionLock {}
