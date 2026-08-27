import { Types } from 'mongoose';

// ────────────────────────────────────────────────────────────
//  Shared helpers
// ────────────────────────────────────────────────────────────

export type ObjectId = Types.ObjectId;
export type StringId = string;

// ────────────────────────────────────────────────────────────
//  User
// ────────────────────────────────────────────────────────────

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface IUser {
  _id: ObjectId;
  name: string;
  email?: string;
  passwordHash?: string;
  avatar?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserDTO = Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>;

// ────────────────────────────────────────────────────────────
//  Auction Room
// ────────────────────────────────────────────────────────────

export const RoomStatus = {
  WAITING: 'WAITING',
  STARTING: 'STARTING',
  LIVE: 'LIVE',
  COMPLETING: 'COMPLETING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

export interface RoomSettings {
  purseTotal: number;
  squadLimit: number;
  bidIncrement: number;
  bidTimerSeconds: number;
}

export interface IAuctionRoom {
  _id: ObjectId;
  roomCode: string;
  creatorUserId: ObjectId;
  status: RoomStatus;
  maxParticipants: number;
  minParticipants: number;
  settings: RoomSettings;
  currentAuctionId?: ObjectId;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type CreateRoomDTO = Omit<
  IAuctionRoom,
  '_id' | 'createdAt' | 'maxParticipants' | 'minParticipants'
> & {
  maxParticipants?: number;
  minParticipants?: number;
};

// ────────────────────────────────────────────────────────────
//  Participant
// ────────────────────────────────────────────────────────────

export const ParticipantStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  KICKED: 'KICKED',
} as const;
export type ParticipantStatus =
  (typeof ParticipantStatus)[keyof typeof ParticipantStatus];

export interface IParticipant {
  _id: ObjectId;
  roomId: ObjectId;
  userId: ObjectId;
  teamName: string;
  teamLogo?: string;
  initialPurse: number;
  purseRemaining: number;
  totalSpent: number;
  squadCount: number;
  status: ParticipantStatus;
  isReady?: boolean;
  formation?: string;
  joinedAt: Date;
  lastSeenAt: Date;
}

export type CreateParticipantDTO = Omit<IParticipant, '_id'>;

// ────────────────────────────────────────────────────────────
//  Player (global catalogue)
// ────────────────────────────────────────────────────────────

export const PlayerPosition = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
} as const;
export type PlayerPosition = (typeof PlayerPosition)[keyof typeof PlayerPosition];

export interface IPlayer {
  _id: ObjectId;
  name: string;
  image?: string;
  position: PlayerPosition;
  nationality?: string;
  club?: string;
  age?: number;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePlayerDTO = Omit<IPlayer, '_id' | 'createdAt' | 'updatedAt'>;

// ────────────────────────────────────────────────────────────
//  Room Player
// ────────────────────────────────────────────────────────────

export const RoomPlayerStatus = {
  PENDING: 'PENDING',
  LIVE: 'LIVE',
  SOLD: 'SOLD',
  UNSOLD: 'UNSOLD',
} as const;
export type RoomPlayerStatus =
  (typeof RoomPlayerStatus)[keyof typeof RoomPlayerStatus];

export interface IRoomPlayer {
  _id: ObjectId;
  roomId: ObjectId;
  playerId: ObjectId;
  bucket?: string;
  round?: number;
  clubGroup?: string;
  position?: PlayerPosition;
  basePrice: number;
  auctionOrder: number;
  status: RoomPlayerStatus;
  soldToParticipantId?: ObjectId | null;
  soldPrice?: number;
  createdAt: Date;
}

export interface AuctionPoolState {
  round: number;
  roundName: string;
  clubGroup: string;
  position: PlayerPosition;
  totalRounds: number;
}

export type CreateRoomPlayerDTO = Omit<IRoomPlayer, '_id' | 'createdAt'>;

// ────────────────────────────────────────────────────────────
//  Auction
// ────────────────────────────────────────────────────────────

export const AuctionStatus = {
  CREATED: 'CREATED',
  LIVE: 'LIVE',
  FINALIZING: 'FINALIZING',
  SOLD: 'SOLD',
  UNSOLD: 'UNSOLD',
  CANCELLED: 'CANCELLED',
} as const;
export type AuctionStatus = (typeof AuctionStatus)[keyof typeof AuctionStatus];

export interface IAuction {
  _id: ObjectId;
  roomId: ObjectId;
  roomPlayerId: ObjectId;
  playerId: ObjectId;
  status: AuctionStatus;
  startingPrice: number;
  currentHighestBid?: number;
  currentHighestParticipantId?: ObjectId | null;
  bidCount: number;
  /** Monotonically increasing bid sequence within this auction */
  sequence: number;
  /** Optimistic concurrency version */
  version: number;
  /** True once the first valid bid has been placed */
  hasStartedBidding: boolean;
  /** Server-authoritative timer deadline (null until first bid) */
  timerEndsAt?: Date | null;
  winnerParticipantId?: ObjectId | null;
  winningAmount?: number;
  startedAt: Date;
  completedAt?: Date;
}

export type CreateAuctionDTO = Omit<IAuction, '_id'>;

// ────────────────────────────────────────────────────────────
//  Bid
// ────────────────────────────────────────────────────────────

export interface IBid {
  _id: ObjectId;
  roomId: ObjectId;
  auctionId: ObjectId;
  playerId: ObjectId;
  participantId: ObjectId;
  userId: ObjectId;
  amount: number;
  /** Monotonically increasing within an auction */
  sequence: number;
  /** Client-generated idempotency key */
  clientBidId: string;
  createdAt: Date;
}

export type CreateBidDTO = Omit<IBid, '_id' | 'createdAt'>;

// ────────────────────────────────────────────────────────────
//  Squad Player
// ────────────────────────────────────────────────────────────

export const SquadPlayerStatus = {
  STARTING_XI: 'STARTING_XI',
  RESERVE: 'RESERVE',
} as const;
export type SquadPlayerStatus =
  (typeof SquadPlayerStatus)[keyof typeof SquadPlayerStatus];

export interface ISquadPlayer {
  _id: ObjectId;
  roomId: ObjectId;
  participantId: ObjectId;
  playerId: ObjectId;
  auctionId: ObjectId;
  purchasePrice: number;
  status: SquadPlayerStatus;
  pitchPosition?: string | null;
  purchasedAt: Date;
}

export type CreateSquadPlayerDTO = Omit<ISquadPlayer, '_id'>;

// ────────────────────────────────────────────────────────────
//  Transaction
// ────────────────────────────────────────────────────────────

export const TransactionType = {
  INITIAL_PURSE: 'INITIAL_PURSE',
  PLAYER_PURCHASE: 'PLAYER_PURCHASE',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export interface ITransaction {
  _id: ObjectId;
  roomId: ObjectId;
  participantId: ObjectId;
  auctionId?: ObjectId;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}

export type CreateTransactionDTO = Omit<ITransaction, '_id' | 'createdAt'>;

// ────────────────────────────────────────────────────────────
//  Auction Event
// ────────────────────────────────────────────────────────────

export const AuctionEventType = {
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_STARTED: 'ROOM_STARTED',
  ROOM_COMPLETED: 'ROOM_COMPLETED',
  ROOM_CANCELLED: 'ROOM_CANCELLED',
  PARTICIPANT_JOINED: 'PARTICIPANT_JOINED',
  PARTICIPANT_LEFT: 'PARTICIPANT_LEFT',
  AUCTION_STARTED: 'AUCTION_STARTED',
  AUCTION_BID_PLACED: 'AUCTION_BID_PLACED',
  AUCTION_BID_REJECTED: 'AUCTION_BID_REJECTED',
  AUCTION_FINALIZING: 'AUCTION_FINALIZING',
  AUCTION_SOLD: 'AUCTION_SOLD',
  AUCTION_UNSOLD: 'AUCTION_UNSOLD',
  AUCTION_CANCELLED: 'AUCTION_CANCELLED',
} as const;
export type AuctionEventType =
  (typeof AuctionEventType)[keyof typeof AuctionEventType];

export interface IAuctionEvent {
  _id: ObjectId;
  roomId: ObjectId;
  auctionId?: ObjectId;
  type: AuctionEventType;
  actorUserId?: ObjectId;
  participantId?: ObjectId;
  sequence: number;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export type CreateAuctionEventDTO = Omit<IAuctionEvent, '_id' | 'createdAt'>;
