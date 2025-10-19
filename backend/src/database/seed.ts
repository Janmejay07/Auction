import { config } from '../config';
import { connectDatabase, disconnectDatabase } from './connection';
import { PlayerModel } from '../players/player.model';
import { logger } from '../common/logger';
import playersData from '../data/players.json';

export async function seedPlayers(): Promise<void> {
  try {
    logger.info('Connecting to database for player seeding...');
    await connectDatabase(config.MONGODB_URI);

    logger.info({ count: playersData.length }, 'Seeding Premier League players into database...');

    let inserted = 0;
    let updated = 0;

    for (const p of playersData) {
      const result = await PlayerModel.updateOne(
        { name: p.name, club: p.club },
        {
          $set: {
            name: p.name,
            position: p.position,
            club: p.club,
            nationality: p.nationality,
            age: p.age,
            rating: p.rating,
            image: p.image,
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) {
        inserted++;
      } else if (result.modifiedCount > 0) {
        updated++;
      }
    }

    const totalInDb = await PlayerModel.countDocuments();

    logger.info(
      {
        totalParsed: playersData.length,
        inserted,
        updated,
        totalInDb,
      },
      'Player seeding completed successfully!',
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed players');
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

// If run directly via CLI
if (require.main === module) {
  seedPlayers()
    .then(() => {
      console.log('Player seed script finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Player seed script failed:', err);
      process.exit(1);
    });
}
