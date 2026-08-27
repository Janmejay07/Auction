import { RoomPlayerModel } from './roomPlayer.model';
import type {
  IRoomPlayer,
  CreateRoomPlayerDTO,
  RoomPlayerStatus,
} from '../common/types/domain';
import { Types, type ClientSession } from 'mongoose';

import {
  getPositionRank,
  POSITION_ORDER,
  ROUND_CONFIGS,
  POSITION_LABELS,
} from '../common/utils/clubGroups';

import { PlayerModel } from '../players/player.model';

export class RoomPlayerRepository {
  async findById(id: string): Promise<IRoomPlayer | null> {
    return RoomPlayerModel.findById(id).lean();
  }

  async findRoomPlayer(
    roomId: string,
    playerId: string,
  ): Promise<IRoomPlayer | null> {
    return RoomPlayerModel.findOne({ roomId, playerId }).lean();
  }

  async findByRoom(roomId: string): Promise<IRoomPlayer[]> {
    return RoomPlayerModel.find({ roomId }).populate('playerId').sort({ auctionOrder: 1 }).lean();
  }

  async findByStatus(
    roomId: string,
    status: RoomPlayerStatus,
  ): Promise<IRoomPlayer[]> {
    return RoomPlayerModel.find({ roomId, status })
      .populate('playerId')
      .sort({ auctionOrder: 1 })
      .lean();
  }

  /**
   * Return the next player to be auctioned using round-based club groups & position hierarchy with random selection.
   * Round 1 (Top 6) -> GK -> MID -> FWD -> DEF
   * Round 2 (Next 6) -> GK -> MID -> FWD -> DEF
   * Round 3 (Remaining) -> GK -> MID -> FWD -> DEF
   */
  async findNextPending(roomId: string): Promise<IRoomPlayer | null> {
    const pendingList = await RoomPlayerModel.find({ roomId, status: 'PENDING' }).lean();
    if (pendingList.length === 0) return null;

    // 1. Determine the lowest active round among pending players
    const minRound = Math.min(...pendingList.map((rp) => rp.round ?? 1));
    const roundPending = pendingList.filter((rp) => (rp.round ?? 1) === minRound);

    // 2. Resolve positions for any players that do not have position cached
    const unpositioned = roundPending.filter((rp) => !rp.position);
    if (unpositioned.length > 0) {
      const playerIds = unpositioned.map((rp) => rp.playerId);
      const players = await PlayerModel.find({ _id: { $in: playerIds } }).lean();
      const playerMap = new Map(players.map((p) => [p._id.toString(), p]));
      for (const rp of roundPending) {
        if (!rp.position && rp.playerId) {
          const p = playerMap.get(rp.playerId.toString());
          if (p?.position) rp.position = p.position;
        }
      }
    }

    // 3. Determine the lowest position rank in this round
    const minRank = Math.min(...roundPending.map((rp) => getPositionRank(rp.position)));

    // 4. Filter pending players matching the active (round, position)
    const matching = roundPending.filter((rp) => getPositionRank(rp.position) === minRank);

    if (matching.length === 0) return roundPending[0] ?? null;
    if (matching.length === 1) return matching[0] ?? null;

    const hasExplicitPosition = matching.some((rp) => Boolean(rp.position));
    if (!hasExplicitPosition) {
      matching.sort((a, b) => a.auctionOrder - b.auctionOrder);
      return matching[0] ?? null;
    }

    // 5. Randomly select from the active pool only
    const randomIndex = Math.floor(Math.random() * matching.length);
    return matching[randomIndex] ?? null;
  }

  /**
   * Get active pool metadata and players in the current active round + position pool.
   */
  async getActivePoolState(roomId: string): Promise<{
    round: number;
    roundName: string;
    clubGroup: string;
    groupLabel: string;
    position: string;
    positionLabel: string;
    totalRounds: number;
    completedPositions: string[];
    poolPlayers: any[];
  }> {
    try {
      const allRoomPlayers = await RoomPlayerModel.find({ roomId: new Types.ObjectId(roomId) })
        .populate('playerId')
        .sort({ auctionOrder: 1 })
        .lean();

      if (!allRoomPlayers || allRoomPlayers.length === 0) {
        return {
          round: 1,
          roundName: 'Round 1 — Big Six',
          clubGroup: 'BIG_SIX',
          groupLabel: 'TOP 6 CLUBS',
          position: 'GK',
          positionLabel: 'Goalkeepers',
          totalRounds: 3,
          completedPositions: [],
          poolPlayers: [],
        };
      }

      // Check if there is a LIVE player
      const livePlayer = allRoomPlayers.find((rp) => rp.status === 'LIVE');
      const pendingPlayers = allRoomPlayers.filter((rp) => rp.status === 'PENDING');

      let activeRound = 1;
      let activePosition = 'GK';

      if (livePlayer) {
        activeRound = livePlayer.round ?? 1;
        const playerObj: any = livePlayer.playerId;
        activePosition = livePlayer.position || playerObj?.position || 'GK';
      } else if (pendingPlayers.length > 0) {
        activeRound = Math.min(...pendingPlayers.map((rp) => rp.round ?? 1));
        const roundPending = pendingPlayers.filter((rp) => (rp.round ?? 1) === activeRound);
        const minRank = Math.min(
          ...roundPending.map((rp) => {
            const playerObj: any = rp.playerId;
            const pos = rp.position || playerObj?.position || 'GK';
            return getPositionRank(pos);
          }),
        );
        const firstMatch = roundPending.find((rp) => {
          const playerObj: any = rp.playerId;
          const pos = rp.position || playerObj?.position || 'GK';
          return getPositionRank(pos) === minRank;
        });
        const playerObj: any = firstMatch?.playerId;
        activePosition = firstMatch?.position || playerObj?.position || 'GK';
      } else {
        // Completed all
        activeRound = 3;
        activePosition = 'FWD';
      }

      const roundCfg = ROUND_CONFIGS.find((r) => r.round === activeRound) || ROUND_CONFIGS[0];

      // Determine completed positions in the current round
      const roundPlayers = allRoomPlayers.filter((rp) => (rp.round ?? 1) === activeRound);
      const completedPositions: string[] = [];

      for (const pos of POSITION_ORDER) {
        const posPlayers = roundPlayers.filter((rp) => {
          const playerObj: any = rp.playerId;
          const p = rp.position || playerObj?.position;
          return p === pos;
        });
        if (posPlayers.length > 0 && posPlayers.every((rp) => rp.status === 'SOLD' || rp.status === 'UNSOLD')) {
          completedPositions.push(pos);
        }
      }

      // Players in current active pool (all states: SOLD, LIVE, UNSOLD, PENDING)
      const poolPlayers = roundPlayers.filter((rp) => {
        const playerObj: any = rp.playerId;
        const p = rp.position || playerObj?.position;
        return p === activePosition;
      });

      return {
        round: activeRound,
        roundName: roundCfg.name,
        clubGroup: roundCfg.clubGroup,
        groupLabel: roundCfg.label,
        position: activePosition,
        positionLabel: POSITION_LABELS[activePosition] || activePosition,
        totalRounds: 3,
        completedPositions,
        poolPlayers,
      };
    } catch {
      return {
        round: 1,
        roundName: 'Round 1 — Big Six',
        clubGroup: 'BIG_SIX',
        groupLabel: 'TOP 6 CLUBS',
        position: 'GK',
        positionLabel: 'Goalkeepers',
        totalRounds: 3,
        completedPositions: [],
        poolPlayers: [],
      };
    }
  }

  async createRoomPlayer(dto: CreateRoomPlayerDTO): Promise<IRoomPlayer> {
    const rp = await RoomPlayerModel.create(dto);
    return rp.toObject();
  }

  async createMany(dtos: CreateRoomPlayerDTO[]): Promise<IRoomPlayer[]> {
    const docs = await RoomPlayerModel.insertMany(dtos);
    return docs.map((d) => d.toObject());
  }

  async updateStatus(
    id: string,
    status: RoomPlayerStatus,
    extra?: Partial<
      Pick<IRoomPlayer, 'soldToParticipantId' | 'soldPrice'>
    >,
    session?: ClientSession,
  ): Promise<IRoomPlayer | null> {
    return RoomPlayerModel.findByIdAndUpdate(
      id,
      { $set: { status, ...extra } },
      { new: true },
    ).session(session ?? null).lean();
  }

  async countByStatus(
    roomId: string,
    status: RoomPlayerStatus,
  ): Promise<number> {
    return RoomPlayerModel.countDocuments({ roomId, status });
  }

  async updateConfiguration(
    id: string,
    data: Partial<Pick<IRoomPlayer, 'bucket' | 'basePrice' | 'auctionOrder'>>,
  ): Promise<IRoomPlayer | null> {
    return RoomPlayerModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await RoomPlayerModel.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async auctionOrderExists(
    roomId: string,
    auctionOrder: number,
    excludeId?: string,
  ): Promise<boolean> {
    const query: Record<string, unknown> = { roomId, auctionOrder };
    if (excludeId) query._id = { $ne: excludeId };
    return (await RoomPlayerModel.exists(query)) !== null;
  }

  async reorder(
    items: Array<{ roomPlayerId: string; auctionOrder: number }>,
  ): Promise<void> {
    // Move every row outside the real order range first so swaps do not
    // collide with the unique room/order index.
    await RoomPlayerModel.bulkWrite(
      items.map((item, index) => ({
        updateOne: {
          filter: { _id: item.roomPlayerId },
          update: { $set: { auctionOrder: -(index + 1) } },
        },
      })),
    );
    await RoomPlayerModel.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item.roomPlayerId },
          update: { $set: { auctionOrder: item.auctionOrder } },
        },
      })),
    );
  }
}
