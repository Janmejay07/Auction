import { Types } from 'mongoose';
import { SquadPlayerRepository } from './squadPlayer.repository';
import { SquadPlayerModel } from './squadPlayer.model';
import { ParticipantRepository } from '../participants/participant.repository';
import { RoomRepository } from '../rooms/room.repository';
import { PlayerRepository } from '../players/player.repository';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../common/errors';
import { sharedAuctionEngine } from '../auction/auction.engine';

export const SUPPORTED_FORMATIONS = [
  '4-3-3',
  '4-4-2',
  '4-2-3-1',
  '3-5-2',
  '3-4-3',
  '4-3-1-2',
] as const;

export class SquadService {
  constructor(
    private readonly squadRepo = new SquadPlayerRepository(),
    private readonly participantRepo = new ParticipantRepository(),
    private readonly roomRepo = new RoomRepository(),
    private readonly playerRepo = new PlayerRepository(),
  ) {}

  /**
   * Get all historical auction squads for an authenticated user across all rooms they joined.
   */
  async getUserSquadsHistory(userId: string) {
    const participants = await this.participantRepo.findByUser(userId);
    const history = [];

    for (const p of participants) {
      const room = await this.roomRepo.findById(p.roomId.toString());
      if (!room) continue;

      const squadPlayers = await this.squadRepo.findByRoom(room._id.toString());
      const managerSquad = squadPlayers.filter(
        (sp) => sp.participantId.toString() === p._id.toString(),
      );

      history.push({
        roomId: room._id.toString(),
        roomCode: room.roomCode,
        roomName: room.name,
        roomStatus: room.status,
        teamName: p.teamName,
        participantId: p._id.toString(),
        formation: p.formation || '4-3-3',
        squadSize: managerSquad.length,
        maxSquadSize: room.settings?.squadLimit || 11,
        totalSpent: p.totalSpent || (room.settings?.purseTotal ? room.settings.purseTotal - p.purseRemaining : 0),
        purseRemaining: p.purseRemaining,
        createdAt: p.createdAt,
      });
    }

    return history;
  }

  /**
   * Get all squads for a given room (used on the main arena Managers & Squads section).
   */
  async getRoomSquadsSummary(roomCode: string) {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');

    const [participants, squadPlayers] = await Promise.all([
      this.participantRepo.findByRoom(room._id.toString()),
      this.squadRepo.findByRoom(room._id.toString()),
    ]);

    const squadsByParticipant: Record<string, any[]> = {};
    for (const p of participants) {
      squadsByParticipant[p._id.toString()] = [];
    }

    for (const sp of squadPlayers) {
      const pId = sp.participantId.toString();
      if (!squadsByParticipant[pId]) {
        squadsByParticipant[pId] = [];
      }
      squadsByParticipant[pId].push({
        _id: sp._id.toString(),
        playerId: sp.playerId,
        purchasePrice: sp.purchasePrice,
        status: sp.status || 'RESERVE',
        pitchPosition: sp.pitchPosition,
        purchasedAt: sp.purchasedAt,
      });
    }

    return {
      roomCode: room.roomCode,
      participants: participants.map((p) => ({
        ...p,
        formation: p.formation || '4-3-3',
        squad: squadsByParticipant[p._id.toString()] || [],
      })),
    };
  }

  /**
   * Get authenticated user's squad for the room.
   */
  async getMySquad(userId: string, roomCode: string) {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');

    const participant = await this.participantRepo.findParticipant(room._id.toString(), userId);
    if (!participant) {
      throw new NotFoundError('You are not a participant in this room', 'PARTICIPANT_NOT_FOUND');
    }

    return this.getManagerSquad(roomCode, participant._id.toString());
  }

  /**
   * Get manager's squad: starting XI, reserves, and formation.
   */
  async getManagerSquad(roomCode: string, participantId: string) {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');

    const participant = await this.participantRepo.findById(participantId);
    if (!participant || participant.roomId.toString() !== room._id.toString()) {
      throw new NotFoundError('Manager participant not found in this room', 'PARTICIPANT_NOT_FOUND');
    }

    const squadPlayers = await this.squadRepo.findByRoom(room._id.toString());
    const managerSquad = squadPlayers.filter(
      (sp) => sp.participantId.toString() === participant._id.toString(),
    );

    const startingXI = managerSquad.filter((sp) => sp.status === 'STARTING_XI');
    const reserves = managerSquad.filter((sp) => sp.status !== 'STARTING_XI');
    const totalSpent = participant.totalSpent || (room.settings?.purseTotal ? room.settings.purseTotal - participant.purseRemaining : 0);

    return {
      manager: {
        id: participant._id.toString(),
        name: participant.teamName,
        teamName: participant.teamName,
        userId: participant.userId.toString(),
      },
      room: {
        id: room._id.toString(),
        roomCode: room.roomCode,
        status: room.status,
        settings: room.settings,
      },
      participant: {
        _id: participant._id.toString(),
        teamName: participant.teamName,
        userId: participant.userId.toString(),
        purseRemaining: participant.purseRemaining,
        totalSpent,
        squadCount: managerSquad.length,
        formation: participant.formation || '4-3-3',
      },
      formation: participant.formation || '4-3-3',
      startingXI,
      reserves,
      allPlayers: managerSquad,
      totalCount: managerSquad.length,
      squadSize: managerSquad.length,
      maxSquadSize: room.settings?.squadLimit || 11,
      startingXICount: startingXI.length,
      reserveCount: reserves.length,
      totalSpent,
      purseRemaining: participant.purseRemaining,
    };
  }

  /**
   * Move player to STARTING_XI or RESERVE.
   */
  async updatePlayerStatus(
    userId: string,
    roomCode: string,
    participantId: string,
    squadPlayerId: string,
    status: 'STARTING_XI' | 'RESERVE',
    pitchPosition?: string | null,
  ) {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');

    const participant = await this.participantRepo.findById(participantId);
    if (!participant || participant.roomId.toString() !== room._id.toString()) {
      throw new NotFoundError('Manager participant not found in this room', 'PARTICIPANT_NOT_FOUND');
    }

    // Authorization: only the participant's user can modify their squad
    if (participant.userId.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to modify another manager\'s squad');
    }

    const squadPlayer = await this.squadRepo.findById(squadPlayerId);
    if (!squadPlayer || squadPlayer.participantId.toString() !== participant._id.toString()) {
      throw new NotFoundError('Player not found in your squad', 'SQUAD_PLAYER_NOT_FOUND');
    }

    if (status === 'STARTING_XI') {
      if (pitchPosition) {
        // If another player in this manager's squad is in this slot, move them to reserves (auto-replace)
        await SquadPlayerModel.updateMany(
          {
            roomId: room._id,
            participantId: participant._id,
            _id: { $ne: squadPlayer._id },
            pitchPosition: pitchPosition.toLowerCase(),
          },
          {
            $set: { status: 'RESERVE', pitchPosition: null },
          },
        );
      }

      if (squadPlayer.status !== 'STARTING_XI') {
        const startingCount = await this.squadRepo.countStartingXI(
          room._id.toString(),
          participant._id.toString(),
        );
        if (startingCount >= 11) {
          throw new ValidationError('Starting XI is full. Move a player to reserves first.');
        }
      }
    }

    const updatedPlayer = await this.squadRepo.updateSquadPlayerStatus(
      squadPlayerId,
      status,
      status === 'STARTING_XI' ? (pitchPosition ? pitchPosition.toLowerCase() : null) : null,
    );

    const squadState = await this.getManagerSquad(roomCode, participantId);

    // Broadcast real-time update
    sharedAuctionEngine.broadcast(room.roomCode, 'squad:updated', {
      participantId: participant._id.toString(),
      squadState,
    });

    return {
      updatedPlayer,
      squadState,
    };
  }

  /**
   * Swap a Starting XI player and a Reserve player atomically.
   */
  async swapPlayers(
    userId: string,
    roomCode: string,
    participantId: string,
    startingPlayerId: string,
    reservePlayerId: string,
  ) {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');

    const participant = await this.participantRepo.findById(participantId);
    if (!participant || participant.roomId.toString() !== room._id.toString()) {
      throw new NotFoundError('Manager participant not found in this room', 'PARTICIPANT_NOT_FOUND');
    }

    if (participant.userId.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to modify another manager\'s squad');
    }

    const [startingP, reserveP] = await Promise.all([
      this.squadRepo.findById(startingPlayerId),
      this.squadRepo.findById(reservePlayerId),
    ]);

    if (
      !startingP ||
      !reserveP ||
      startingP.participantId.toString() !== participant._id.toString() ||
      reserveP.participantId.toString() !== participant._id.toString()
    ) {
      throw new NotFoundError('One or both players not found in your squad', 'SQUAD_PLAYER_NOT_FOUND');
    }

    if (startingP.status !== 'STARTING_XI' || reserveP.status !== 'RESERVE') {
      throw new ConflictError('Swap requires one Starting XI player and one Reserve player');
    }

    await this.squadRepo.swapSquadPlayers(startingPlayerId, reservePlayerId);

    const squadState = await this.getManagerSquad(roomCode, participantId);

    sharedAuctionEngine.broadcast(room.roomCode, 'squad:updated', {
      participantId: participant._id.toString(),
      squadState,
    });

    return squadState;
  }

  /**
   * Update formation for manager.
   */
  async updateFormation(
    userId: string,
    roomCode: string,
    participantId: string,
    formation: string,
  ) {
    const room = await this.roomRepo.findRoomByCode(roomCode);
    if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');

    const participant = await this.participantRepo.findById(participantId);
    if (!participant || participant.roomId.toString() !== room._id.toString()) {
      throw new NotFoundError('Manager participant not found in this room', 'PARTICIPANT_NOT_FOUND');
    }

    if (participant.userId.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to modify another manager\'s squad');
    }

    if (!SUPPORTED_FORMATIONS.includes(formation as any)) {
      throw new ValidationError(`Unsupported formation. Supported: ${SUPPORTED_FORMATIONS.join(', ')}`);
    }

    await this.participantRepo.updateFormation(participant._id.toString(), formation);

    const squadState = await this.getManagerSquad(roomCode, participantId);

    sharedAuctionEngine.broadcast(room.roomCode, 'squad:updated', {
      participantId: participant._id.toString(),
      squadState,
    });

    return squadState;
  }
}
