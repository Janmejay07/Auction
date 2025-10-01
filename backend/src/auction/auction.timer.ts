import type { IAuction } from '../common/types/domain';
import { logger } from '../common/logger';

export type AuctionExpirationHandler = (auctionId: string) => Promise<void>;

export class AuctionTimerManager {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly onExpire: AuctionExpirationHandler) {}

  start(auction: IAuction): void {
    if (auction.timerEndsAt) this.schedule(auction._id.toString(), auction.timerEndsAt);
  }

  reset(auction: IAuction): void {
    this.cancel(auction._id.toString());
    this.start(auction);
  }

  cancel(auctionId: string): void {
    const timer = this.timers.get(auctionId);
    if (timer) clearTimeout(timer);
    this.timers.delete(auctionId);
  }

  async recover(auctions: IAuction[]): Promise<void> {
    for (const auction of auctions) {
      if (auction.timerEndsAt && auction.timerEndsAt.getTime() <= Date.now()) {
        await this.onExpire(auction._id.toString());
      } else {
        this.start(auction);
      }
    }
  }

  private schedule(auctionId: string, timerEndsAt: Date): void {
    const delay = Math.max(0, timerEndsAt.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(auctionId);
      void this.onExpire(auctionId).catch((error: unknown) => {
        logger.error({ err: error, auctionId, event: 'auction.expiration' }, 'Auction expiration failed');
      });
    }, delay);
    this.timers.set(auctionId, timer);
  }
}