import argon2 from 'argon2';
import { UserRepository } from '../users/user.repository';
import { signToken } from '../common/utils/jwt';
import {
  ConflictError,
  InvalidCredentialsError,
  NotFoundError,
} from '../common/errors';
import type { IUser } from '../common/types/domain';
import type { RegisterInput, LoginInput } from './auth.validation';

/** Shape of the user object safe to return to clients. */
export interface SafeUser {
  id: string;
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
}

/** Result returned by register/login. */
export interface AuthResult {
  user: SafeUser;
  token: string;
}

function toSafeUser(user: IUser): SafeUser {
  return {
    id: user._id.toString(),
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.createdAt,
  };
}

export class AuthService {
  constructor(private readonly userRepo: UserRepository) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await this.userRepo.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'USER',
    });

    const token = signToken({ userId: user._id.toString() });

    return { user: toSafeUser(user), token };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmailWithPassword(input.email);

    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new InvalidCredentialsError('Invalid email or password');
    }

    const token = signToken({ userId: user._id.toString() });

    return { user: toSafeUser(user), token };
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toSafeUser(user);
  }
}
