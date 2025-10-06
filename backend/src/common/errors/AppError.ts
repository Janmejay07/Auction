/**
 * Base application error.
 *
 * All known / operational errors should extend this class.
 * The error handler uses `isOperational` to distinguish expected
 * errors from unexpected crashes.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Restore prototype chain broken by extending built-ins
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', code = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', code = 'AUTHENTICATION_ERROR') {
    super(message, 401, code);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', code = 'AUTHORIZATION_ERROR') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

// ─── Specialized Domain Errors ────────────────────────────────────────────────

export class InvalidCredentialsError extends AuthenticationError {
  constructor(message = 'Invalid email or password') {
    super(message, 'INVALID_CREDENTIALS');
  }
}

export class UnauthorizedError extends AuthenticationError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AuthorizationError {
  constructor(message = 'Access forbidden') {
    super(message, 'FORBIDDEN');
  }
}

export class NotRoomCreatorError extends AuthorizationError {
  constructor(message = 'Only the room creator can perform this action') {
    super(message, 'NOT_ROOM_CREATOR');
  }
}

export class RoomNotFoundError extends NotFoundError {
  constructor(message = 'Room not found') {
    super(message, 'ROOM_NOT_FOUND');
  }
}

export class RoomNotJoinableError extends ConflictError {
  constructor(message = 'Room is not accepting new participants') {
    super(message, 'ROOM_NOT_JOINABLE');
  }
}

export class RoomFullError extends ConflictError {
  constructor(message = 'Room is full') {
    super(message, 'ROOM_FULL');
  }
}

export class AlreadyJoinedError extends ConflictError {
  constructor(message = 'You have already joined this room') {
    super(message, 'ALREADY_JOINED');
  }
}

export class TeamNameTakenError extends ConflictError {
  constructor(message = 'Team name is already taken in this room') {
    super(message, 'TEAM_NAME_TAKEN');
  }
}

export class InvalidRoomStateError extends ConflictError {
  constructor(message = 'Invalid room state for this action') {
    super(message, 'INVALID_ROOM_STATE');
  }
}

export class MinParticipantsRequiredError extends ConflictError {
  constructor(message = 'At least 2 participants are required to start') {
    super(message, 'MIN_PARTICIPANTS_REQUIRED');
  }
}

export class PlayerPoolEmptyError extends ConflictError {
  constructor(message = 'Player pool is empty – add players before starting') {
    super(message, 'PLAYER_POOL_EMPTY');
  }
}

export class AdminAccessRequiredError extends AuthorizationError {
  constructor(message = 'Administrative access is required') {
    super(message, 'ADMIN_ACCESS_REQUIRED');
  }
}

export class PlayerNotFoundError extends NotFoundError {
  constructor(message = 'Player not found') {
    super(message, 'PLAYER_NOT_FOUND');
  }
}

export class DuplicateRoomPlayerError extends ConflictError {
  constructor(message = 'Player is already in this room') {
    super(message, 'DUPLICATE_ROOM_PLAYER');
  }
}

export class AuctionOrderTakenError extends ConflictError {
  constructor(message = 'Auction order is already used in this room') {
    super(message, 'AUCTION_ORDER_TAKEN');
  }
}

export class InvalidAuctionTransitionError extends ConflictError {
  constructor(message = 'Invalid auction state transition') {
    super(message, 'INVALID_AUCTION_TRANSITION');
  }
}

export class AuctionNotFoundError extends NotFoundError {
  constructor(message = 'Auction not found') {
    super(message, 'AUCTION_NOT_FOUND');
  }
}

export class BidRejectedError extends ConflictError {
  constructor(message = 'Bid rejected', code = 'BID_REJECTED') {
    super(message, code);
  }
}

