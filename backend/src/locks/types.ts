/**
 * Auction lock abstraction.
 *
 * The initial implementation uses an in-memory Map.
 * When scaling beyond a single process, replace with a
 * Redis-based implementation that satisfies this interface.
 */
export interface AuctionLock {
  /**
   * Attempt to acquire an exclusive lock on the given key.
   *
   * @param key  – unique identifier (e.g. `auction:<roomId>`)
   * @param ttlMs – auto-release timeout in milliseconds
   * @returns `true` if the lock was acquired, `false` if already held
   */
  acquire(key: string, ttlMs?: number): Promise<boolean>;

  /**
   * Release a previously acquired lock.
   */
  release(key: string): Promise<void>;

  /**
   * Check whether a lock is currently held.
   */
  isLocked(key: string): Promise<boolean>;
}
