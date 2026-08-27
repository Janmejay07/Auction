import type { FilterQuery } from 'mongoose';
import { UserModel } from './user.model';
import type { IUser, CreateUserDTO } from '../common/types/domain';

export class UserRepository {
  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).lean();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).lean();
  }

  /** Find by email, including the passwordHash field which is normally excluded. */
  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .lean();
  }

  async create(dto: CreateUserDTO): Promise<IUser> {
    const user = await UserModel.create(dto);
    return user.toObject();
  }

  async update(
    id: string,
    data: Partial<Pick<IUser, 'name' | 'avatar'>>,
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  }

  async exists(filter: FilterQuery<IUser>): Promise<boolean> {
    const doc = await UserModel.exists(filter);
    return doc !== null;
  }
}
