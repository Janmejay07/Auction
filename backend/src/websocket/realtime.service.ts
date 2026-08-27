import { AuctionEngine, sharedAuctionEngine, type AuctionEngineEvent } from '../auction/auction.engine';
import { AuctionRepository } from '../auction/auction.repository';
import { BidRepository } from '../bids/bid.repository';
import { ParticipantRepository } from '../participants/participant.repository';
import { PlayerRepository } from '../players/player.repository';
import { RoomRepository } from '../rooms/room.repository';
import { RoomPlayerRepository } from '../roomPlayers/roomPlayer.repository';
import { RoomService } from '../rooms/room.service';
import { ConflictError, NotFoundError } from '../common/errors';
import type { IAuctionRoom, IAuction, IBid, IParticipant, IPlayer, AuctionPoolState } from '../common/types/domain';

export interface RoomSync {
  room: IAuctionRoom;
  participants: IParticipant[];
  currentAuction: IAuction | null;
  currentPlayer: IPlayer | null;
  currentHighestBid: number | null;
  highestParticipant: IParticipant | null;
  timerEndsAt: Date | null;
  serverTime: Date;
  recentBids: IBid[];
  auctionSequence: number | null;
  poolState?: any;
}

export interface PlaceBidInput {
  roomCode: string;
  amount: number;
  clientBidId: string;
}

export class RealtimeService {
  constructor(
    private readonly roomRepo = new RoomRepository(),
    private readonly participantRepo = new ParticipantRepository(),
    private readonly playerRepo = new PlayerRepository(),
    private readonly auctionRepo = new AuctionRepository(),
    private readonly bidRepo = new BidRepository(),
    private readonly roomPlayerRepo = new RoomPlayerRepository(),
    private readonly roomService = new RoomService(roomRepo, participantRepo, roomPlayerRepo),
    private readonly auctionEngine: AuctionEngine = sharedAuctionEngine,
  ) {}

  async getRoomAccess(userId: string, roomCode: string): Promise<{ room: IAuctionRoom; participant: IParticipant }> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');
    const participant = await this.participantRepo.findParticipant(room._id.toString(), userId);
    if (!participant || participant.status !== 'ACTIVE') {
      throw new ConflictError('You are not an active participant in this room', 'ROOM_ACCESS_DENIED');
    }
    await this.participantRepo.updateLastSeen(participant._id.toString());
    return { room, participant };
  }

  async sync(userId: string, roomCode: string): Promise<RoomSync> {
    const { room } = await this.getRoomAccess(userId, roomCode);
    const roomId = room._id.toString();
    const [participants, activeAuction, poolState] = await Promise.all([
      this.participantRepo.findByRoom(roomId),
      this.auctionRepo.findCurrentAuction(roomId),
      this.roomPlayerRepo.getActivePoolState(roomId),
    ]);

    const currentAuction =
      activeAuction ||
      (room.status === 'LIVE' ? await this.auctionRepo.findLatestByRoom(roomId) : null);

    const currentPlayer = currentAuction
      ? await this.playerRepo.findById(currentAuction.playerId.toString())
      : null;
    const highestParticipant = currentAuction?.currentHighestParticipantId
      ? participants.find((p) => p._id.toString() === currentAuction.currentHighestParticipantId!.toString()) ?? null
      : null;
    const recentBids = currentAuction
      ? await this.bidRepo.findByAuction(currentAuction._id.toString())
      : [];
    return {
      room,
      participants,
      currentAuction,
      currentPlayer,
      currentHighestBid: currentAuction?.currentHighestBid ?? null,
      highestParticipant,
      timerEndsAt: currentAuction?.timerEndsAt ?? null,
      serverTime: new Date(),
      recentBids: recentBids.slice(-50),
      auctionSequence: currentAuction?.sequence ?? null,
      poolState,
    };
  }

  async leaveRoom(userId: string, roomCode: string): Promise<{ room: IAuctionRoom; participant: IParticipant }> {
    return this.roomService.leaveRoom(userId, roomCode);
  }

  async setReady(userId: string, roomCode: string, isReady: boolean): Promise<IParticipant> {
    return this.roomService.setReady(userId, roomCode, isReady);
  }

  async placeBid(userId: string, input: PlaceBidInput): Promise<{ auction: IAuction; bid: IBid; participant: IParticipant }> {
    return this.auctionEngine.placeBid(userId, input.roomCode, input.amount, input.clientBidId);
  }

  async recoverAuctions(): Promise<void> {
    await this.auctionEngine.recover();
  }

  setAuctionEventHandler(handler: (event: AuctionEngineEvent) => void): void {
    this.auctionEngine.setEventHandler(handler);
  }
}