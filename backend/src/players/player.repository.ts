import { PlayerModel } from './player.model';
import type { IPlayer, CreatePlayerDTO } from '../common/types/domain';
import playersData from '../data/players.json';

export class PlayerRepository {
  async findById(id: string): Promise<IPlayer | null> {
    return PlayerModel.findById(id).lean();
  }

  async findByIds(ids: string[]): Promise<IPlayer[]> {
    return PlayerModel.find({ _id: { $in: ids } }).lean();
  }

  async createPlayer(dto: CreatePlayerDTO): Promise<IPlayer> {
    const player = await PlayerModel.create(dto);
    return player.toObject();
  }

  async createMany(dtos: CreatePlayerDTO[]): Promise<IPlayer[]> {
    const players = await PlayerModel.insertMany(dtos);
    return players.map((p) => p.toObject());
  }

  async search(query: string): Promise<IPlayer[]> {
    return PlayerModel.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { club: { $regex: query, $options: 'i' } },
      ],
    })
      .limit(20)
      .lean();
  }

  async findAll(limit = 50, skip = 0): Promise<IPlayer[]> {
    return PlayerModel.find().skip(skip).limit(limit).lean();
  }

  async count(): Promise<number> {
    return PlayerModel.countDocuments();
  }

  async seedDefaultsIfEmpty(): Promise<void> {
    if (await this.count()) return;

    await PlayerModel.insertMany(
      playersData.map((player) => ({
        name: player.name,
        position: player.position,
        image: player.image,
        nationality: player.nationality,
        club: player.club,
        age: player.age,
        rating: player.rating,
      })),
    );
  }
}
