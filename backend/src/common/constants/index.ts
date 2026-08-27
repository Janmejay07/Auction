export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Auction-related constants.
 *
 * These govern the core rules of the auction system.
 * The timer starts only after the first valid bid and resets
 * on every subsequent valid higher bid.
 */
export const AUCTION = {
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS: 10,
  DEFAULT_BID_TIMER_SECONDS: 15,
} as const;
