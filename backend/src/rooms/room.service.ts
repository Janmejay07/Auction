import { Types } from 'mongoose';
import { RoomRepository } from './room.repository';
import { ParticipantRepository } from '../participants/participant.repository';
import { RoomPlayerRepository } from '../roomPlayers/roomPlayer.repository';
import { generateUniqueRoomCode } from './room.utils';
import { sharedAuctionEngine } from '../auction/auction.engine';
import {
  RoomNotFoundError,
  RoomNotJoinableError,
  AlreadyJoinedError,
  RoomFullError,
  TeamNameTakenError,
  InvalidRoomStateError,
  NotRoomCreatorError,
  MinParticipantsRequiredError,
  PlayerPoolEmptyError,
  NotFoundError,
  ConflictError,
  DuplicateRoomPlayerError,
  AuctionOrderTakenError,
  PlayerNotFoundError,
} from '../common/errors';
import {
  RoomStatus,
  ParticipantStatus,
} from '../common/types/domain';
import { getClubGroup, getPositionRank } from '../common/utils/clubGroups';
import type { IAuctionRoom, IParticipant } from '../common/types/domain';
import type { CreateRoomInput, JoinRoomInput } from './room.validation';
import { PlayerRepository } from '../players/player.repository';
import type { CreateRoomPlayerDTO, IRoomPlayer } from '../common/types/domain';

export interface CreateRoomResult {
  room: IAuctionRoom;
  participant: IParticipant;
}

export interface RoomDetailsResult {
  room: IAuctionRoom;
  roomId: string;
  roomCode: string;
  status: RoomStatus;
  settings: IAuctionRoom['settings'];
  participantCount: number;
  creatorUserId: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export class RoomService {
  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly participantRepo: ParticipantRepository,
    private readonly roomPlayerRepo: RoomPlayerRepository,
    private readonly playerRepo = new PlayerRepository(),
    private readonly auctionEngine = sharedAuctionEngine,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────────────

  async createRoom(
    userId: string,
    input: CreateRoomInput,
  ): Promise<CreateRoomResult> {
    const roomCode = await generateUniqueRoomCode(this.roomRepo);
    const creatorId = new Types.ObjectId(userId);

    const room = await this.roomRepo.createRoom({
      roomCode,
      creatorUserId: creatorId,
      status: RoomStatus.WAITING,
      settings: input.settings,
    });

    // Creator is immediately a participant with full purse and ready
    const participant = await this.participantRepo.createParticipant({
      roomId: room._id,
      userId: creatorId,
      teamName: input.teamName,
      initialPurse: input.settings.purseTotal,
      purseRemaining: input.settings.purseTotal,
      totalSpent: 0,
      squadCount: 0,
      status: ParticipantStatus.ACTIVE,
      isReady: true,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });

    return { room, participant };
  }

  // ─── Join ────────────────────────────────────────────────────────────────

  async joinRoom(
    userId: string,
    roomCode: string,
    input: JoinRoomInput,
  ): Promise<IParticipant> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new RoomNotFoundError('Room not found');

    if (room.status !== RoomStatus.WAITING) {
      throw new RoomNotJoinableError('Room is not accepting new participants');
    }

    // Check if user already has a membership record in this room
    const alreadyJoined = await this.participantRepo.findParticipant(
      room._id.toString(),
      userId,
    );
    if (alreadyJoined && alreadyJoined.status === ParticipantStatus.ACTIVE) {
      throw new AlreadyJoinedError('You have already joined this room');
    }

    // Capacity check (count only currently active members)
    const count = await this.participantRepo.countByRoom(room._id.toString());
    if (count >= room.maxParticipants) {
      throw new RoomFullError('Room is full');
    }

    // Team name uniqueness among active members
    const teamTaken = await this.participantRepo.findByTeamName(
      room._id.toString(),
      input.teamName,
    );
    if (teamTaken && teamTaken.status === ParticipantStatus.ACTIVE && teamTaken.userId.toString() !== userId) {
      throw new TeamNameTakenError('Team name is already taken in this room');
    }

    // If user previously left and is rejoining: reactivate with NOT READY
    if (alreadyJoined && alreadyJoined.status !== ParticipantStatus.ACTIVE) {
      const reactivated = await this.participantRepo.updateStatus(
        alreadyJoined._id.toString(),
        ParticipantStatus.ACTIVE,
        {
          teamName: input.teamName,
          isReady: false,
          initialPurse: room.settings.purseTotal,
          purseRemaining: room.settings.purseTotal,
          totalSpent: 0,
          squadCount: 0,
          joinedAt: new Date(),
          lastSeenAt: new Date(),
        },
      );
      return reactivated!;
    }

    return this.participantRepo.createParticipant({
      roomId: room._id,
      userId: new Types.ObjectId(userId),
      teamName: input.teamName,
      initialPurse: room.settings.purseTotal,
      purseRemaining: room.settings.purseTotal,
      totalSpent: 0,
      squadCount: 0,
      status: ParticipantStatus.ACTIVE,
      isReady: false,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    });
  }

  // ─── Start ───────────────────────────────────────────────────────────────

  async startRoom(userId: string, roomCode: string): Promise<IAuctionRoom> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new RoomNotFoundError('Room not found');

    if (room.status !== RoomStatus.WAITING) {
      throw new InvalidRoomStateError('Room is not in WAITING state');
    }

    if (room.creatorUserId.toString() !== userId) {
      throw new NotRoomCreatorError('Only the room creator can start the auction');
    }

    const participantCount = await this.participantRepo.countByRoom(
      room._id.toString(),
    );
    if (participantCount < room.minParticipants) {
      throw new MinParticipantsRequiredError(
        `At least ${room.minParticipants} participants are required to start`,
      );
    }

    let playerCount = await this.roomPlayerRepo.countByStatus(
      room._id.toString(),
      'PENDING',
    );
    if (playerCount === 0) {
      await this.populatePlayerPool(room._id.toString());
      playerCount = await this.roomPlayerRepo.countByStatus(room._id.toString(), 'PENDING');
    }
    if (playerCount === 0) {
      throw new PlayerPoolEmptyError('Player pool is empty – add players before starting');
    }

    const updated = await this.roomRepo.updateStatus(
      room._id.toString(),
      RoomStatus.STARTING,
      { startedAt: new Date() },
    );

    return updated!;
  }

  // ─── Leave ───────────────────────────────────────────────────────────────

  private async populatePlayerPool(roomId: string): Promise<void> {
    const players = await this.playerRepo.findAll(1000);
    if (players.length === 0) return;

    const existing = await this.roomPlayerRepo.findByRoom(roomId);
    if (existing.length > 0) return;

    const sortedPlayers = [...players].sort((a, b) => {
      const groupA = getClubGroup(a.club);
      const groupB = getClubGroup(b.club);
      if (groupA.round !== groupB.round) return groupA.round - groupB.round;
      const rankA = getPositionRank(a.position);
      const rankB = getPositionRank(b.position);
      if (rankA !== rankB) return rankA - rankB;
      return (a.rating || 0) - (b.rating || 0);
    });

    await this.roomPlayerRepo.createMany(
      sortedPlayers.map((player, index) => {
        const { round, clubGroup } = getClubGroup(player.club);
        return {
          roomId: new Types.ObjectId(roomId),
          playerId: player._id,
          round,
          clubGroup,
          position: player.position,
          basePrice: 1_000_000,
          auctionOrder: index + 1,
          status: 'PENDING' as const,
        };
      }),
    );
  }

  /**
   * Remove a participant from a room.
   *
   * WAITING rooms: if the creator leaves, the room is cancelled and all
   * remaining participants are marked inactive.
   *
   * LIVE / other rooms: the participant is marked INACTIVE; the auction
   * continues normally.
   */
  async leaveRoom(userId: string, roomCode: string): Promise<{ room: IAuctionRoom; participant: IParticipant }> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new RoomNotFoundError('Room not found');

    const participant = await this.participantRepo.findParticipant(
      room._id.toString(),
      userId,
    );
    if (!participant) throw new NotFoundError('You are not in this room');
    if (participant.status !== ParticipantStatus.ACTIVE) {
      throw new ConflictError('You have already left this room');
    }

    // Mark the leaving participant as inactive and clear ready state
    const updatedParticipant = await this.participantRepo.updateStatus(
      participant._id.toString(),
      ParticipantStatus.INACTIVE,
      { isReady: false, lastSeenAt: new Date() },
    );

    let updatedRoom: IAuctionRoom = room;

    // Creator-transfer logic only applies while WAITING
    if (room.status === RoomStatus.WAITING) {
      const isCreator = room.creatorUserId.toString() === userId;
      if (isCreator) {
        await this.participantRepo.updateStatusesByRoom(
          room._id.toString(),
          ParticipantStatus.INACTIVE,
        );
        updatedRoom = (await this.roomRepo.updateStatus(
          room._id.toString(),
          RoomStatus.CANCELLED,
          { completedAt: new Date() },
        )) || room;
      }
    } else if (room.status === RoomStatus.LIVE || room.status === RoomStatus.STARTING) {
      // If remaining active participants drop below 2, complete the auction immediately
      const activeParticipants = await this.participantRepo.findActiveByRoom(room._id.toString());
      if (activeParticipants.length < 2) {
        const completed = await this.auctionEngine.completeAuction(room._id.toString(), 'NOT_ENOUGH_PLAYERS');
        if (completed) updatedRoom = completed;
      }
    }

    return { room: updatedRoom, participant: updatedParticipant || participant };
  }

  async setReady(userId: string, roomCode: string, isReady: boolean): Promise<IParticipant> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new RoomNotFoundError('Room not found');

    if (room.status !== RoomStatus.WAITING) {
      throw new InvalidRoomStateError('Ready state can only be modified in lobby');
    }

    const participant = await this.participantRepo.findParticipant(
      room._id.toString(),
      userId,
    );
    if (!participant || participant.status !== ParticipantStatus.ACTIVE) {
      throw new ConflictError('You are not an active participant in this room');
    }

    const updated = await this.participantRepo.setReady(participant._id.toString(), isReady);
    return updated!;
  }

  // ─── Room details ────────────────────────────────────────────────────────

  async getRoomByCode(roomCode: string): Promise<IAuctionRoom> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new RoomNotFoundError('Room not found');
    return room;
  }

  async getRoomDetails(roomCode: string): Promise<RoomDetailsResult> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new RoomNotFoundError('Room not found');

    const participantCount = await this.participantRepo.countByRoom(
      room._id.toString(),
    );

    return {
      room,
      roomId: room._id.toString(),
      roomCode: room.roomCode,
      status: room.status,
      settings: room.settings,
      participantCount,
      creatorUserId: room.creatorUserId.toString(),
      createdAt: room.createdAt,
      startedAt: room.startedAt,
      completedAt: room.completedAt,
    };
  }

  async getRoomParticipants(roomCode: string): Promise<IParticipant[]> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new RoomNotFoundError('Room not found');
    return this.participantRepo.findByRoom(room._id.toString());
  }

  private async getWaitingCreatorRoom(userId: string, roomCode: string): Promise<IAuctionRoom> {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new RoomNotFoundError('Room not found');
    if (room.creatorUserId.toString() !== userId) {
      throw new NotRoomCreatorError('Only the room creator can modify the player pool');
    }
    if (room.status !== RoomStatus.WAITING) {
      throw new InvalidRoomStateError('Player pool can only be modified while WAITING');
    }
    return room;
  }

  async addRoomPlayer(userId: string, roomCode: string, input: CreateRoomPlayerDTO): Promise<IRoomPlayer> {
    const room = await this.getWaitingCreatorRoom(userId, roomCode);
    if (!(await this.playerRepo.findById(input.playerId.toString()))) {
      throw new PlayerNotFoundError();
    }
    if (await this.roomPlayerRepo.findRoomPlayer(room._id.toString(), input.playerId.toString())) {
      throw new DuplicateRoomPlayerError();
    }
    if (await this.roomPlayerRepo.auctionOrderExists(room._id.toString(), input.auctionOrder)) {
      throw new AuctionOrderTakenError();
    }
    try {
      return await this.roomPlayerRepo.createRoomPlayer({
        ...input,
        roomId: room._id,
        status: 'PENDING',
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictError('Player or auction order is already used in this room');
      }
      throw error;
    }
  }

  async removeRoomPlayer(userId: string, roomCode: string, roomPlayerId: string): Promise<void> {
    const room = await this.getWaitingCreatorRoom(userId, roomCode);
    const roomPlayer = await this.roomPlayerRepo.findById(roomPlayerId);
    if (!roomPlayer || roomPlayer.roomId.toString() !== room._id.toString()) {
      throw new NotFoundError('Room player not found');
    }
    await this.roomPlayerRepo.deleteById(roomPlayerId);
  }

  async updateRoomPlayer(userId: string, roomCode: string, roomPlayerId: string, data: Partial<Pick<IRoomPlayer, 'bucket' | 'basePrice' | 'auctionOrder'>>): Promise<IRoomPlayer> {
    const room = await this.getWaitingCreatorRoom(userId, roomCode);
    const roomPlayer = await this.roomPlayerRepo.findById(roomPlayerId);
    if (!roomPlayer || roomPlayer.roomId.toString() !== room._id.toString()) {
      throw new NotFoundError('Room player not found');
    }
    if (data.auctionOrder !== undefined && await this.roomPlayerRepo.auctionOrderExists(room._id.toString(), data.auctionOrder, roomPlayerId)) {
      throw new AuctionOrderTakenError();
    }
    try {
      return (await this.roomPlayerRepo.updateConfiguration(roomPlayerId, data))!;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new AuctionOrderTakenError();
      throw error;
    }
  }

  async reorderRoomPlayers(userId: string, roomCode: string, items: Array<{ roomPlayerId: string; auctionOrder: number }>): Promise<IRoomPlayer[]> {
    const room = await this.getWaitingCreatorRoom(userId, roomCode);
    const ids = new Set<string>();
    const orders = new Set<number>();
    for (const item of items) {
      if (ids.has(item.roomPlayerId) || orders.has(item.auctionOrder)) throw new AuctionOrderTakenError('Reorder contains duplicate players or auction orders');
      ids.add(item.roomPlayerId); orders.add(item.auctionOrder);
      const roomPlayer = await this.roomPlayerRepo.findById(item.roomPlayerId);
      if (!roomPlayer || roomPlayer.roomId.toString() !== room._id.toString()) throw new NotFoundError('Room player not found');
    }
    await this.roomPlayerRepo.reorder(items);
    return this.roomPlayerRepo.findByRoom(room._id.toString());
  }
}
