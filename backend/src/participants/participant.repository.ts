import { ParticipantModel } from './participant.model';
import type {
  IParticipant,
  CreateParticipantDTO,
  ParticipantStatus,
} from '../common/types/domain';
import type { ClientSession } from 'mongoose';

export class ParticipantRepository {
  async findById(id: string, session?: ClientSession): Promise<IParticipant | null> {
    return ParticipantModel.findById(id).session(session ?? null).lean();
  }

  /** Find a specific participant – enforces one-per-room-per-user. */
  async findParticipant(
    roomId: string,
    userId: string,
  ): Promise<IParticipant | null> {
    return ParticipantModel.findOne({ roomId, userId }).lean();
  }

  async findByRoom(roomId: string): Promise<IParticipant[]> {
    return ParticipantModel.find({ roomId }).lean();
  }

  async findActiveByRoom(roomId: string): Promise<IParticipant[]> {
    return ParticipantModel.find({ roomId, status: 'ACTIVE' }).lean();
  }

  async findByUser(userId: string): Promise<IParticipant[]> {
    return ParticipantModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async createParticipant(dto: CreateParticipantDTO): Promise<IParticipant> {
    const participant = await ParticipantModel.create(dto);
    return participant.toObject();
  }

  async countByRoom(roomId: string): Promise<number> {
    return ParticipantModel.countDocuments({ roomId, status: 'ACTIVE' });
  }

  async updateStatus(
    id: string,
    status: ParticipantStatus,
    extra?: Partial<IParticipant>,
  ): Promise<IParticipant | null> {
    return ParticipantModel.findByIdAndUpdate(
      id,
      { $set: { status, ...extra } },
      { new: true },
    ).lean();
  }

  async setReady(
    id: string,
    isReady: boolean,
  ): Promise<IParticipant | null> {
    return ParticipantModel.findByIdAndUpdate(
      id,
      { $set: { isReady, lastSeenAt: new Date() } },
      { new: true },
    ).lean();
  }

  async updateStatusesByRoom(
    roomId: string,
    status: ParticipantStatus,
  ): Promise<void> {
    await ParticipantModel.updateMany(
      { roomId, status: 'ACTIVE' },
      { $set: { status } },
    );
  }

  async updateLastSeen(id: string): Promise<void> {
    await ParticipantModel.updateOne(
      { _id: id },
      { $set: { lastSeenAt: new Date() } },
    );
  }

  /**
   * Atomically deduct from purse and increment squad count.
   * Used during player purchase – must be fast.
   */
  async deductPurse(
    participantId: string,
    amount: number,
  ): Promise<IParticipant | null> {
    return ParticipantModel.findByIdAndUpdate(
      participantId,
      {
        $inc: {
          purseRemaining: -amount,
          totalSpent: amount,
          squadCount: 1,
        },
      },
      { new: true },
    ).lean();
  }

  async purchasePlayer(
    participantId: string,
    amount: number,
    squadLimit: number,
    session?: ClientSession,
  ): Promise<IParticipant | null> {
    return ParticipantModel.findOneAndUpdate(
      { _id: participantId, purseRemaining: { $gte: amount }, squadCount: { $lt: squadLimit } },
      { $inc: { purseRemaining: -amount, totalSpent: amount, squadCount: 1 } },
      { new: true },
    ).session(session ?? null).lean();
  }

  /** Check whether a teamName is already used in a room (case-sensitive). */
  async findByTeamName(
    roomId: string,
    teamName: string,
  ): Promise<IParticipant | null> {
    return ParticipantModel.findOne({
      roomId,
      teamName,
      status: 'ACTIVE',
    }).lean();
  }

  async updateFormation(
    id: string,
    formation: string,
  ): Promise<IParticipant | null> {
    return ParticipantModel.findByIdAndUpdate(
      id,
      { $set: { formation } },
      { new: true },
    ).lean();
  }
}
