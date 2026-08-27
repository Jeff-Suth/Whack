// XP awarded for a correct guess, keyed by how many guesses it took (1-6).
// Anchored so a 5-guess win = 100 XP (10 of those = 1000 XP = Iron -> Bronze).
export const XP_PER_GUESS_COUNT = {
  1: 300,
  2: 200,
  3: 150,
  4: 120,
  5: 100,
  6: 80
};

// Cumulative XP required to reach each badge. Each gap is roughly 1.5x the
// previous one, rounded to clean numbers.
export const RANK_THRESHOLDS = [
  { badge: 'Iron', xp: 0 },
  { badge: 'Bronze', xp: 1000 },
  { badge: 'Silver', xp: 2500 },
  { badge: 'Gold', xp: 4750 },
  { badge: 'Platinum', xp: 8100 },
  { badge: 'Diamond', xp: 13200 },
  { badge: 'Master', xp: 20800 },
  { badge: 'Grandmaster', xp: 32200 },
  { badge: 'Challenger', xp: 49300 }
];

export function getXpForGuesses(guessCount) {
  return XP_PER_GUESS_COUNT[guessCount] || 0;
}

export function getBadgeForXp(xp) {
  let current = RANK_THRESHOLDS[0].badge;
  for (const tier of RANK_THRESHOLDS) {
    if (xp >= tier.xp) {
      current = tier.badge;
    } else {
      break;
    }
  }
  return current;
}

export function getNextRankProgress(xp) {
  const index = RANK_THRESHOLDS.findIndex((tier) => tier.badge === getBadgeForXp(xp));
  const next = RANK_THRESHOLDS[index + 1];
  if (!next) {
    return { nextBadge: null, xpForNext: null };
  }
  return { nextBadge: next.badge, xpForNext: next.xp };
}
