import { SquadPlayerModel } from './squadPlayer.model';
import type { ISquadPlayer, CreateSquadPlayerDTO } from '../common/types/domain';
import type { ClientSession } from 'mongoose';

export class SquadPlayerRepository {
  async findById(id: string): Promise<ISquadPlayer | null> {
    return SquadPlayerModel.findById(id).lean();
  }

  /** Get the full squad for a participant. */
  async getSquad(
    roomId: string,
    participantId: string,
  ): Promise<ISquadPlayer[]> {
    return SquadPlayerModel.find({ roomId, participantId }).lean();
  }

  async createSquadPlayer(dto: CreateSquadPlayerDTO, session?: ClientSession): Promise<ISquadPlayer> {
    const [sp] = await SquadPlayerModel.create([dto], { session });
    if (!sp) throw new Error('Squad player creation returned no document');
    return sp.toObject();
  }

  async isPlayerSold(roomId: string, playerId: string): Promise<boolean> {
    const doc = await SquadPlayerModel.exists({ roomId, playerId });
    return doc !== null;
  }

  async countSquadSize(
    roomId: string,
    participantId: string,
  ): Promise<number> {
    return SquadPlayerModel.countDocuments({ roomId, participantId });
  }

  async countStartingXI(
    roomId: string,
    participantId: string,
  ): Promise<number> {
    return SquadPlayerModel.countDocuments({ roomId, participantId, status: 'STARTING_XI' });
  }

  async findByRoom(roomId: string): Promise<ISquadPlayer[]> {
    return SquadPlayerModel.find({ roomId }).populate('playerId').lean();
  }

  async updateSquadPlayerStatus(
    id: string,
    status: 'STARTING_XI' | 'RESERVE',
    pitchPosition?: string | null,
  ): Promise<ISquadPlayer | null> {
    const update: { status: 'STARTING_XI' | 'RESERVE'; pitchPosition?: string | null } = { status };
    if (pitchPosition !== undefined) {
      update.pitchPosition = pitchPosition;
    }
    return SquadPlayerModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    ).lean();
  }

  async swapSquadPlayers(
    startingPlayerId: string,
    reservePlayerId: string,
  ): Promise<{ startingPlayer: ISquadPlayer | null; reservePlayer: ISquadPlayer | null }> {
    const [startingPlayer, reservePlayer] = await Promise.all([
      SquadPlayerModel.findByIdAndUpdate(
        startingPlayerId,
        { $set: { status: 'RESERVE', pitchPosition: null } },
        { new: true },
      ).lean(),
      SquadPlayerModel.findByIdAndUpdate(
        reservePlayerId,
        { $set: { status: 'STARTING_XI' } },
        { new: true },
      ).lean(),
    ]);
    return { startingPlayer, reservePlayer };
  }
}
