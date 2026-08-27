import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db';
import { ParticipantRepository } from '../src/participants/participant.repository';
import { ParticipantStatus } from '../src/common/types/domain';

const participantRepo = new ParticipantRepository();

const roomId = new Types.ObjectId();
const userId1 = new Types.ObjectId();
const userId2 = new Types.ObjectId();

function makeParticipantDTO(userId: Types.ObjectId, teamName: string) {
  return {
    roomId,
    userId,
    teamName,
    initialPurse: 500_000,
    purseRemaining: 500_000,
    totalSpent: 0,
    squadCount: 0,
    status: ParticipantStatus.ACTIVE,
    joinedAt: new Date(),
    lastSeenAt: new Date(),
  };
}

describe('ParticipantRepository', () => {
  beforeAll(setupTestDb);
  afterEach(clearTestDb);
  afterAll(teardownTestDb);

  it('creates a participant successfully', async () => {
    const p = await participantRepo.createParticipant(
      makeParticipantDTO(userId1, 'Team Alpha'),
    );

    expect(p._id).toBeDefined();
    expect(p.teamName).toBe('Team Alpha');
    expect(p.purseRemaining).toBe(500_000);
    expect(p.status).toBe(ParticipantStatus.ACTIVE);
  });

  it('findParticipant returns the correct participant', async () => {
    await participantRepo.createParticipant(makeParticipantDTO(userId1, 'Alpha'));

    const found = await participantRepo.findParticipant(
      roomId.toString(),
      userId1.toString(),
    );
    expect(found).not.toBeNull();
    expect(found!.teamName).toBe('Alpha');
  });

  it('enforces unique roomId + userId (one participant per user per room)', async () => {
    await participantRepo.createParticipant(makeParticipantDTO(userId1, 'First'));

    await expect(
      participantRepo.createParticipant(makeParticipantDTO(userId1, 'Second')),
    ).rejects.toThrow();
  });

  it('two different users can join the same room', async () => {
    await participantRepo.createParticipant(makeParticipantDTO(userId1, 'Alpha'));
    await participantRepo.createParticipant(makeParticipantDTO(userId2, 'Beta'));

    const all = await participantRepo.findByRoom(roomId.toString());
    expect(all.length).toBe(2);
  });

  it('countByRoom returns active participant count', async () => {
    await participantRepo.createParticipant(makeParticipantDTO(userId1, 'Alpha'));
    await participantRepo.createParticipant(makeParticipantDTO(userId2, 'Beta'));

    const count = await participantRepo.countByRoom(roomId.toString());
    expect(count).toBe(2);
  });

  it('deductPurse atomically updates purse and squad count', async () => {
    const p = await participantRepo.createParticipant(
      makeParticipantDTO(userId1, 'Buyers'),
    );

    const updated = await participantRepo.deductPurse(
      p._id.toString(),
      100_000,
    );

    expect(updated!.purseRemaining).toBe(400_000);
    expect(updated!.totalSpent).toBe(100_000);
    expect(updated!.squadCount).toBe(1);
  });

  it('findParticipant returns null when not joined', async () => {
    const found = await participantRepo.findParticipant(
      roomId.toString(),
      new Types.ObjectId().toString(),
    );
    expect(found).toBeNull();
  });
});
