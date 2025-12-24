export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type RoomStatus = 'WAITING' | 'STARTING' | 'LIVE' | 'COMPLETING' | 'COMPLETED' | 'CANCELLED';

export interface RoomSettings {
  purseTotal: number;
  squadLimit: number;
  bidIncrement: number;
  bidTimerSeconds: number;
}

export interface AuctionRoom {
  _id: string;
  name: string;
  roomCode: string;
  creatorUserId: string;
  status: RoomStatus;
  settings: RoomSettings;
  createdAt: string;
  updatedAt: string;
}

export type ParticipantStatus = 'ACTIVE' | 'INACTIVE' | 'LEFT' | 'DISCONNECTED' | 'KICKED';

export interface Participant {
  _id: string;
  roomId: string;
  userId: string;
  teamName: string;
  purse: number;
  purseRemaining?: number;
  spent: number;
  totalSpent?: number;
  squadCount: number;
  status: ParticipantStatus;
  isReady?: boolean;
  isOnline?: boolean;
  formation?: string;
  squad?: SquadPlayer[];
  isCreator: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    _id: string;
    name: string;
    email: string;
  };
}

export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface Player {
  _id?: string;
  externalId?: number;
  name: string;
  fullName?: string;
  position: PlayerPosition;
  nationality?: string;
  club: string;
  clubLogo?: string;
  rating: number;
  overallRating?: number;
  basePrice: number;
  imageUrl?: string;
  image?: string;
  age?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type RoomPlayerStatus = 'PENDING' | 'QUEUED' | 'LIVE' | 'SOLD' | 'UNSOLD';

export interface RoomPlayer {
  _id: string;
  roomId: string;
  playerId: string | Player;
  order: number;
  basePrice: number;
  status: RoomPlayerStatus;
  createdAt: string;
  updatedAt: string;
}

export type AuctionStatus = 'CREATED' | 'LIVE' | 'FINALIZING' | 'SOLD' | 'UNSOLD' | 'CANCELLED';

export interface Auction {
  _id: string;
  roomId: string;
  roomPlayerId: string;
  playerId: string;
  sequence: number;
  status: AuctionStatus;
  basePrice?: number;
  startingPrice?: number;
  currentHighestBid: number | null;
  currentHighestParticipantId: string | null;
  winnerParticipantId?: string | null;
  winningAmount?: number;
  timerEndsAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bid {
  _id: string;
  auctionId: string;
  roomId: string;
  participantId: string;
  amount: number;
  sequence: number;
  clientBidId: string;
  createdAt: string;
  participant?: Participant;
}

export type SquadPlayerStatus = 'STARTING_XI' | 'RESERVE';

export interface SquadPlayer {
  _id: string;
  roomId: string;
  participantId: string;
  playerId: string | Player;
  purchasePrice?: number;
  boughtFor?: number;
  status?: SquadPlayerStatus;
  pitchPosition?: string | null;
  purchasedAt: string;
}

export interface PoolPlayerItem {
  _id: string;
  roomId: string;
  playerId: Player;
  round?: number;
  clubGroup?: string;
  position?: PlayerPosition;
  basePrice: number;
  status: RoomPlayerStatus;
  soldPrice?: number;
}

export interface AuctionPoolState {
  round: number;
  roundName: string;
  clubGroup: string;
  groupLabel: string;
  position: string;
  positionLabel: string;
  totalRounds: number;
  completedPositions: string[];
  poolPlayers: PoolPlayerItem[];
}

export interface RoomSyncData {
  room: AuctionRoom;
  participants: Participant[];
  currentAuction: Auction | null;
  currentPlayer: Player | null;
  currentHighestBid: number | null;
  highestParticipant: Participant | null;
  timerEndsAt: string | null;
  serverTime: string;
  recentBids: Bid[];
  auctionSequence: number | null;
  poolState?: AuctionPoolState;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
