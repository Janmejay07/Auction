import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Register all models so they are available for index creation
import '../../src/users/user.model';
import '../../src/rooms/room.model';
import '../../src/participants/participant.model';
import '../../src/players/player.model';
import '../../src/roomPlayers/roomPlayer.model';
import '../../src/auction/auction.model';
import '../../src/bids/bid.model';
import '../../src/squads/squadPlayer.model';
import '../../src/wallet/transaction.model';
import '../../src/events/auctionEvent.model';

let mongod: MongoMemoryReplSet;

/**
 * Start an in-memory MongoDB instance and connect Mongoose.
 *
 * Mongoose's default `autoIndex: true` builds indexes in the background.
 * We call `ensureIndexes()` on every registered model and swallow
 * "index already exists" errors that appear when multiple test files
 * share the same mongoose model registry across Vitest workers.
 *
 * Call this in beforeAll.
 */
export async function setupTestDb(): Promise<void> {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  await mongoose.connect(uri, { autoIndex: true });

  // Build indexes synchronously so unique constraints work immediately.
  // Ignore "index already exists" conflicts between parallel test workers.
  await Promise.all(
    Object.values(mongoose.models).map(async (model) => {
      try {
        await model.ensureIndexes();
      } catch (err: unknown) {
        // Code 85 = IndexOptionsConflict, 86 = IndexKeySpecsConflict
        // Both are harmless when the same model is re-registered in a
        // fresh server – the index exists and is functionally correct.
        const code = (err as { code?: number }).code;
        if (code !== 85 && code !== 86) throw err;
      }
    }),
  );
}

/**
 * Delete all documents from every collection between individual tests.
 * Keeps state clean without rebuilding indexes.
 * Call this in afterEach.
 */
export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}

/**
 * Disconnect Mongoose and stop the in-memory server.
 * Call this in afterAll.
 */
export async function teardownTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
}
