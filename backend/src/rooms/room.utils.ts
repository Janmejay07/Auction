import { RoomRepository } from './room.repository';

// Unambiguous uppercase characters (no O/0, I/1/L confusion)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 10;

/**
 * Generate a random room code of `CODE_LENGTH` characters.
 */
function randomCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => {
    const idx = Math.floor(Math.random() * CHARS.length);
    return CHARS[idx] ?? 'A';
  }).join('');
}

/**
 * Generate a unique room code that does not exist in the database.
 *
 * @throws Error when a unique code cannot be found after MAX_ATTEMPTS
 */
export async function generateUniqueRoomCode(
  roomRepo: RoomRepository,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode();
    const exists = await roomRepo.roomCodeExists(code);
    if (!exists) return code;
  }
  throw new Error('Failed to generate a unique room code – try again');
}
