import type { PlayerPosition } from '../types/domain';

export const BIG_SIX_CLUBS = [
  'Arsenal',
  'Chelsea',
  'Liverpool',
  'Manchester City',
  'Manchester United',
  'Tottenham Hotspur',
] as const;

export const NEXT_SIX_CLUBS = [
  'Newcastle United',
  'Aston Villa',
  'West Ham United',
  'Crystal Palace',
  'Brighton',
  'Brighton & Hove Albion',
  'Everton',
] as const;

export const POSITION_ORDER: PlayerPosition[] = ['GK', 'DEF', 'MID', 'FWD'];

export const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeepers',
  DEF: 'Defenders',
  MID: 'Midfielders',
  FWD: 'Forwards',
};

export const ROUND_CONFIGS = [
  {
    round: 1,
    id: 'ROUND_1',
    name: 'Round 1 — Big Six',
    clubGroup: 'BIG_SIX',
    label: 'TOP 6 CLUBS',
  },
  {
    round: 2,
    id: 'ROUND_2',
    name: 'Round 2 — Next 6',
    clubGroup: 'NEXT_SIX',
    label: 'NEXT CLUB GROUP',
  },
  {
    round: 3,
    id: 'ROUND_3',
    name: 'Round 3 — Remaining Clubs',
    clubGroup: 'REMAINING',
    label: 'ALL REMAINING CLUBS',
  },
] as const;

/**
 * Determine round and clubGroup for a given club name.
 */
export function getClubGroup(clubName?: string): {
  round: number;
  clubGroup: 'BIG_SIX' | 'NEXT_SIX' | 'REMAINING';
  roundName: string;
  groupLabel: string;
} {
  if (!clubName) {
    return {
      round: 3,
      clubGroup: 'REMAINING',
      roundName: 'Round 3 — Remaining Clubs',
      groupLabel: 'ALL REMAINING CLUBS',
    };
  }

  const clean = clubName.trim().toLowerCase();

  const isBigSix = BIG_SIX_CLUBS.some((c) => {
    const target = c.toLowerCase();
    return clean === target || clean.includes(target) || (target === 'manchester united' && clean.includes('man utd')) || (target === 'manchester city' && clean.includes('man city')) || (target === 'tottenham hotspur' && clean.includes('spurs'));
  });

  if (isBigSix) {
    return {
      round: 1,
      clubGroup: 'BIG_SIX',
      roundName: 'Round 1 — Big Six',
      groupLabel: 'TOP 6 CLUBS',
    };
  }

  const isNextSix = NEXT_SIX_CLUBS.some((c) => {
    const target = c.toLowerCase();
    return clean === target || clean.includes(target);
  });

  if (isNextSix) {
    return {
      round: 2,
      clubGroup: 'NEXT_SIX',
      roundName: 'Round 2 — Next 6',
      groupLabel: 'NEXT CLUB GROUP',
    };
  }

  return {
    round: 3,
    clubGroup: 'REMAINING',
    roundName: 'Round 3 — Remaining Clubs',
    groupLabel: 'ALL REMAINING CLUBS',
  };
}

export function getPositionRank(pos?: string): number {
  if (!pos) return 99;
  const upper = pos.toUpperCase();
  const idx = POSITION_ORDER.indexOf(upper as PlayerPosition);
  return idx !== -1 ? idx : 99;
}
