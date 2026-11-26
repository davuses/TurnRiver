import type { Card, Rank, Suit } from './types';

export const RANKS: readonly Rank[] = [
  'A',
  'K',
  'Q',
  'J',
  'T',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
] as const;

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'] as const;

export const RANK_VALUE: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

export const VALUE_TO_RANK: Record<number, Rank> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: 'T',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function assertUniqueCards(cards: Card[], context = 'card list'): void {
  const seen = new Set<string>();
  for (const card of cards) {
    const key = cardKey(card);
    if (seen.has(key)) {
      throw new Error(`Duplicate card ${key} in ${context}`);
    }
    seen.add(key);
  }
}

export function parseCard(code: string): Card {
  const rank = code[0] as Rank;
  const suit = code[1] as Suit;
  if (!(rank in RANK_VALUE) || !SUITS.includes(suit)) {
    throw new Error(`Invalid card code: ${code}`);
  }
  return { rank, suit };
}

export function parseCards(codes: string[]): Card[] {
  return codes.map(parseCard);
}

export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Returns the canonical 169-grid key for any two hole cards:
 * e.g. As Ah -> "AA", As Ks -> "AKs", As Kh -> "AKo"
 */
export function canonicalHandKey(c1: Card, c2: Card): string {
  const v1 = RANK_VALUE[c1.rank];
  const v2 = RANK_VALUE[c2.rank];
  const high = v1 >= v2 ? c1 : c2;
  const low = v1 >= v2 ? c2 : c1;
  if (high.rank === low.rank) {
    return `${high.rank}${low.rank}`;
  }
  return `${high.rank}${low.rank}${high.suit === low.suit ? 's' : 'o'}`;
}

export function gridCellLabel(row: number, col: number): string {
  const r1 = RANKS[row];
  const r2 = RANKS[col];
  if (row === col) return `${r1}${r2}`;
  if (row < col) return `${r1}${r2}s`;
  return `${r2}${r1}o`;
}

export function comboCountForHand(handKey: string): number {
  if (handKey.length === 2) return 6; // Pocket pair
  if (handKey.endsWith('s')) return 4; // Suited
  return 12; // Offsuit
}

/**
 * Generates concrete hole-card combos for a 169 hand key excluding dead cards.
 */
export function expandHandCombos(handKey: string, deadCards: Card[] = []): [Card, Card][] {
  const dead = new Set(deadCards.map(cardKey));
  const r1 = handKey[0] as Rank;
  const r2 = handKey[1] as Rank;
  const combos: [Card, Card][] = [];

  if (handKey.length === 2) {
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        const c1: Card = { rank: r1, suit: SUITS[i] };
        const c2: Card = { rank: r2, suit: SUITS[j] };
        if (!dead.has(cardKey(c1)) && !dead.has(cardKey(c2))) {
          combos.push([c1, c2]);
        }
      }
    }
  } else if (handKey.endsWith('s')) {
    for (const s of SUITS) {
      const c1: Card = { rank: r1, suit: s };
      const c2: Card = { rank: r2, suit: s };
      if (!dead.has(cardKey(c1)) && !dead.has(cardKey(c2))) {
        combos.push([c1, c2]);
      }
    }
  } else {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 === s2) continue;
        const c1: Card = { rank: r1, suit: s1 };
        const c2: Card = { rank: r2, suit: s2 };
        if (!dead.has(cardKey(c1)) && !dead.has(cardKey(c2))) {
          combos.push([c1, c2]);
        }
      }
    }
  }
  return combos;
}

/**
 * Creates a valid suit permutation (suit isomorphism) to deal visually fresh
 * spots while preserving exact flush/blocker geometry.
 */
export function createSuitRotation(rng: () => number = Math.random): Record<Suit, Suit> {
  const shuffled = [...SUITS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    s: shuffled[0],
    h: shuffled[1],
    d: shuffled[2],
    c: shuffled[3],
  };
}

export function rotateCards(cards: Card[], map: Record<Suit, Suit>): Card[] {
  return cards.map((c) => ({ rank: c.rank, suit: map[c.suit] }));
}

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export interface EvaluatedHand {
  category: HandCategory;
  score: number;
  label: string;
  tiebreakers: number[];
}

function encodeScore(category: HandCategory, kickers: number[]): number {
  let score = category * 16 ** 5;
  for (let i = 0; i < 5; i++) {
    score += (kickers[i] ?? 0) * 16 ** (4 - i);
  }
  return score;
}

const RANK_NAME_PLURAL: Record<number, string> = {
  14: 'Aces',
  13: 'Kings',
  12: 'Queens',
  11: 'Jacks',
  10: 'Tens',
  9: 'Nines',
  8: 'Eights',
  7: 'Sevens',
  6: 'Sixes',
  5: 'Fives',
  4: 'Fours',
  3: 'Threes',
  2: 'Twos',
};

const RANK_NAME_SINGULAR: Record<number, string> = {
  14: 'Ace',
  13: 'King',
  12: 'Queen',
  11: 'Jack',
  10: 'Ten',
  9: 'Nine',
  8: 'Eight',
  7: 'Seven',
  6: 'Six',
  5: 'Five',
  4: 'Four',
  3: 'Three',
  2: 'Two',
};

function findStraightHigh(uniqueDescValues: number[]): number {
  if (uniqueDescValues.length < 5) return 0;
  for (let i = 0; i <= uniqueDescValues.length - 5; i++) {
    const high = uniqueDescValues[i];
    if (
      uniqueDescValues[i + 1] === high - 1 &&
      uniqueDescValues[i + 2] === high - 2 &&
      uniqueDescValues[i + 3] === high - 3 &&
      uniqueDescValues[i + 4] === high - 4
    ) {
      return high;
    }
  }
  // Wheel straight: A-5-4-3-2
  if (
    uniqueDescValues.includes(14) &&
    uniqueDescValues.includes(5) &&
    uniqueDescValues.includes(4) &&
    uniqueDescValues.includes(3) &&
    uniqueDescValues.includes(2)
  ) {
    return 5;
  }
  return 0;
}

const SUIT_INDEX: Record<Suit, number> = { s: 0, h: 1, d: 2, c: 3 };

/**
 * Exact 5-to-7 card Texas Hold'em hand evaluator.
 */
export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error(`evaluateHand requires at least 5 cards, received ${cards.length}`);
  }

  const rankCounts = new Map<number, number>();
  const suitGroups: Record<Suit, number[]> = { s: [], h: [], d: [], c: [] };
  let seenLo = 0;
  let seenHi = 0;

  for (const card of cards) {
    const val = RANK_VALUE[card.rank];
    const bitId = (val - 2) * 4 + SUIT_INDEX[card.suit];
    if (bitId < 30) {
      const bit = 1 << bitId;
      if ((seenLo & bit) !== 0) {
        throw new Error(`Duplicate card ${cardKey(card)} in evaluateHand`);
      }
      seenLo |= bit;
    } else {
      const bit = 1 << (bitId - 30);
      if ((seenHi & bit) !== 0) {
        throw new Error(`Duplicate card ${cardKey(card)} in evaluateHand`);
      }
      seenHi |= bit;
    }
    rankCounts.set(val, (rankCounts.get(val) ?? 0) + 1);
    suitGroups[card.suit].push(val);
  }

  // Check Flush & Straight Flush
  let flushValues: number[] | null = null;
  for (const suit of SUITS) {
    if (suitGroups[suit].length >= 5) {
      flushValues = [...suitGroups[suit]].sort((a, b) => b - a);
      break;
    }
  }

  if (flushValues) {
    const uniqueFlush = Array.from(new Set(flushValues));
    const sfHigh = findStraightHigh(uniqueFlush);
    if (sfHigh > 0) {
      return {
        category: HandCategory.StraightFlush,
        score: encodeScore(HandCategory.StraightFlush, [sfHigh]),
        label: sfHigh === 14 ? 'Royal Flush' : `Straight Flush, ${RANK_NAME_SINGULAR[sfHigh]}-high`,
        tiebreakers: [sfHigh],
      };
    }
  }

  // Group ranks by frequency (descending count, then descending rank)
  const groups = Array.from(rankCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  // Four of a Kind
  if (groups[0][1] === 4) {
    const quadRank = groups[0][0];
    const kicker = groups
      .filter(([r]) => r !== quadRank)
      .map(([r]) => r)
      .sort((a, b) => b - a)[0];
    return {
      category: HandCategory.FourOfAKind,
      score: encodeScore(HandCategory.FourOfAKind, [quadRank, kicker]),
      label: `Four of a Kind, ${RANK_NAME_PLURAL[quadRank]}`,
      tiebreakers: [quadRank, kicker],
    };
  }

  // Full House
  const trips = groups.filter(([, c]) => c === 3).map(([r]) => r);
  const pairs = groups.filter(([, c]) => c === 2).map(([r]) => r);
  if (trips.length >= 2 || (trips.length === 1 && pairs.length >= 1)) {
    const tripRank = trips[0];
    const pairRank = trips.length >= 2 ? trips[1] : pairs[0];
    return {
      category: HandCategory.FullHouse,
      score: encodeScore(HandCategory.FullHouse, [tripRank, pairRank]),
      label: `Full House, ${RANK_NAME_PLURAL[tripRank]} full of ${RANK_NAME_PLURAL[pairRank]}`,
      tiebreakers: [tripRank, pairRank],
    };
  }

  // Flush
  if (flushValues) {
    const top5 = flushValues.slice(0, 5);
    return {
      category: HandCategory.Flush,
      score: encodeScore(HandCategory.Flush, top5),
      label: `Flush, ${RANK_NAME_SINGULAR[top5[0]]}-high`,
      tiebreakers: top5,
    };
  }

  // Straight
  const uniqueRanks = Array.from(rankCounts.keys()).sort((a, b) => b - a);
  const straightHigh = findStraightHigh(uniqueRanks);
  if (straightHigh > 0) {
    return {
      category: HandCategory.Straight,
      score: encodeScore(HandCategory.Straight, [straightHigh]),
      label: `Straight, ${RANK_NAME_SINGULAR[straightHigh]}-high`,
      tiebreakers: [straightHigh],
    };
  }

  // Three of a Kind
  if (trips.length === 1) {
    const tripRank = trips[0];
    const kickers = uniqueRanks.filter((r) => r !== tripRank).slice(0, 2);
    return {
      category: HandCategory.ThreeOfAKind,
      score: encodeScore(HandCategory.ThreeOfAKind, [tripRank, ...kickers]),
      label: `Three of a Kind, ${RANK_NAME_PLURAL[tripRank]}`,
      tiebreakers: [tripRank, ...kickers],
    };
  }

  // Two Pair
  if (pairs.length >= 2) {
    const highPair = pairs[0];
    const lowPair = pairs[1];
    const kicker = uniqueRanks.filter((r) => r !== highPair && r !== lowPair)[0];
    return {
      category: HandCategory.TwoPair,
      score: encodeScore(HandCategory.TwoPair, [highPair, lowPair, kicker]),
      label: `Two Pair, ${RANK_NAME_PLURAL[highPair]} & ${RANK_NAME_PLURAL[lowPair]}`,
      tiebreakers: [highPair, lowPair, kicker],
    };
  }

  // One Pair
  if (pairs.length === 1) {
    const pairRank = pairs[0];
    const kickers = uniqueRanks.filter((r) => r !== pairRank).slice(0, 3);
    return {
      category: HandCategory.OnePair,
      score: encodeScore(HandCategory.OnePair, [pairRank, ...kickers]),
      label: `Pair of ${RANK_NAME_PLURAL[pairRank]}`,
      tiebreakers: [pairRank, ...kickers],
    };
  }

  // High Card
  const top5 = uniqueRanks.slice(0, 5);
  return {
    category: HandCategory.HighCard,
    score: encodeScore(HandCategory.HighCard, top5),
    label: `${RANK_NAME_SINGULAR[top5[0]]}-high`,
    tiebreakers: top5,
  };
}

/**
 * Calibrated 13x13 preflop hand strength matrix (0..1 scale) for 6-max Hold'em.
 * Rows/cols follow RANKS order: A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2.
 * Diagonal = pocket pairs; upper triangle (r < c) = suited; lower triangle (r > c) = offsuit.
 */
const PREFLOP_STRENGTH_MATRIX: readonly (readonly number[])[] = [
  //  A     K     Q     J     T     9     8     7     6     5     4     3     2
  [0.98, 0.88, 0.83, 0.79, 0.75, 0.66, 0.63, 0.60, 0.58, 0.64, 0.61, 0.59, 0.57], // A
  [0.84, 0.95, 0.77, 0.73, 0.70, 0.62, 0.55, 0.52, 0.50, 0.48, 0.46, 0.44, 0.42], // K
  [0.75, 0.69, 0.92, 0.71, 0.67, 0.60, 0.53, 0.46, 0.44, 0.42, 0.40, 0.38, 0.36], // Q
  [0.70, 0.63, 0.60, 0.86, 0.67, 0.59, 0.52, 0.45, 0.39, 0.37, 0.35, 0.33, 0.31], // J
  [0.64, 0.58, 0.55, 0.56, 0.81, 0.62, 0.55, 0.48, 0.41, 0.34, 0.32, 0.30, 0.28], // T
  [0.54, 0.48, 0.46, 0.46, 0.49, 0.76, 0.58, 0.51, 0.44, 0.37, 0.29, 0.27, 0.25], // 9
  [0.50, 0.41, 0.39, 0.39, 0.42, 0.44, 0.72, 0.56, 0.49, 0.42, 0.34, 0.25, 0.23], // 8
  [0.47, 0.38, 0.32, 0.32, 0.34, 0.37, 0.41, 0.67, 0.54, 0.47, 0.39, 0.30, 0.22], // 7
  [0.44, 0.36, 0.30, 0.26, 0.27, 0.30, 0.34, 0.39, 0.63, 0.52, 0.45, 0.36, 0.26], // 6
  [0.47, 0.34, 0.28, 0.24, 0.22, 0.23, 0.27, 0.32, 0.37, 0.59, 0.50, 0.42, 0.32], // 5
  [0.45, 0.32, 0.26, 0.23, 0.20, 0.19, 0.21, 0.25, 0.30, 0.35, 0.56, 0.41, 0.31], // 4
  [0.43, 0.30, 0.25, 0.21, 0.19, 0.17, 0.16, 0.18, 0.22, 0.27, 0.26, 0.53, 0.33], // 3
  [0.41, 0.28, 0.23, 0.20, 0.18, 0.16, 0.15, 0.14, 0.16, 0.19, 0.18, 0.16, 0.50], // 2
];

function preflopHandStrength(hole: [Card, Card]): number {
  const i1 = 14 - RANK_VALUE[hole[0].rank];
  const i2 = 14 - RANK_VALUE[hole[1].rank];
  const hiIdx = Math.min(i1, i2); // Lower index = higher rank (A=0 .. 2=12)
  const loIdx = Math.max(i1, i2);
  if (hiIdx === loIdx) {
    return PREFLOP_STRENGTH_MATRIX[hiIdx][loIdx];
  }
  const suited = hole[0].suit === hole[1].suit;
  return suited
    ? PREFLOP_STRENGTH_MATRIX[hiIdx][loIdx]
    : PREFLOP_STRENGTH_MATRIX[loIdx][hiIdx];
}

function highestStraightRankFromSet(ranks: Set<number>): number {
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let offset = 0; offset < 5; offset++) {
      const needed = high - offset === 1 ? 14 : high - offset;
      if (!ranks.has(needed)) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  return 0;
}

function isBoardFourStraight(board: Card[]): boolean {
  if (board.length < 4) return false;
  const unique = Array.from(new Set(board.map((c) => RANK_VALUE[c.rank])));
  if (unique.length < 4) return false;
  // Check any 5-rank straight window (including A-2-3-4-5) containing >= 4 distinct board ranks
  for (let high = 14; high >= 5; high--) {
    let count = 0;
    for (let offset = 0; offset < 5; offset++) {
      const needed = high - offset === 1 ? 14 : high - offset;
      if (unique.includes(needed)) count++;
    }
    if (count >= 4) return true;
  }
  return false;
}

function highestMissingRankInSuit(board: Card[], suit: Suit, aboveRank: number): number {
  const boardInSuit = new Set(
    board.filter((c) => c.suit === suit).map((c) => RANK_VALUE[c.rank])
  );
  let missingAbove = 0;
  for (let r = 14; r > aboveRank; r--) {
    if (!boardInSuit.has(r)) missingAbove++;
  }
  return missingAbove;
}

/**
 * Evaluates preflop + postflop made-hand strength normalized 0..1 for bot AI & quick readouts.
 * Accounts for paired/made/4-flush/4-straight boards so weak flushes, underfulls, or
 * non-flush hands on 4-flush boards are not over-valued.
 */
export function handStrengthScore(hole: [Card, Card], board: Card[]): number {
  if (board.length === 0) {
    return preflopHandStrength(hole);
  }

  const evalResult = evaluateHand([...hole, ...board]);
  const boardOnly = board.length >= 5 ? evaluateHand(board) : null;
  const boardRankCounts = new Map<number, number>();
  const boardSuitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
  let boardMax = 0;
  for (const c of board) {
    const val = RANK_VALUE[c.rank];
    boardRankCounts.set(val, (boardRankCounts.get(val) ?? 0) + 1);
    boardSuitCounts[c.suit]++;
    if (val > boardMax) boardMax = val;
  }

  let maxBoardSuit: Suit = 's';
  let maxBoardSuitCount = 0;
  for (const s of SUITS) {
    if (boardSuitCounts[s] > maxBoardSuitCount) {
      maxBoardSuitCount = boardSuitCounts[s];
      maxBoardSuit = s;
    }
  }
  const boardHasFourFlush = maxBoardSuitCount >= 4;
  const boardHasFourStraight = isBoardFourStraight(board);
  const scarePenalty =
    (boardHasFourFlush ? 0.24 : 0) + (boardHasFourStraight ? 0.14 : 0);

  const h1 = RANK_VALUE[hole[0].rank];
  const h2 = RANK_VALUE[hole[1].rank];
  const hiHole = Math.max(h1, h2);
  const playingBoardOnly = boardOnly !== null && evalResult.score === boardOnly.score;

  switch (evalResult.category) {
    case HandCategory.StraightFlush:
      return playingBoardOnly ? 0.5 : 1.0;

    case HandCategory.FourOfAKind: {
      const quadRank = evalResult.tiebreakers[0];
      if ((boardRankCounts.get(quadRank) ?? 0) >= 4) {
        return hiHole === 14 ? 0.55 : 0.22 + (hiHole / 14) * 0.2;
      }
      return 0.99;
    }

    case HandCategory.FullHouse: {
      if (playingBoardOnly) return 0.36;
      const tripRank = evalResult.tiebreakers[0];
      const pairRank = evalResult.tiebreakers[1] ?? 2;
      if ((boardRankCounts.get(tripRank) ?? 0) >= 3) {
        // Trips on board (e.g. Ks Kh Kd 7c 2s): strength hinges heavily on the pair kicker!
        const heroHasOverPocket = h1 === h2 && h1 > tripRank;
        if (heroHasOverPocket) {
          return 0.94 + (pairRank / 14) * 0.04;
        }
        return 0.72 + (pairRank / 14) * 0.16;
      }
      // Genuine full house (pocket pair + board pair, or board pair + hero trips)
      const isUnderfull =
        (boardRankCounts.get(tripRank) ?? 0) === 1 &&
        Array.from(boardRankCounts.entries()).some(([r, cnt]) => cnt >= 2 && r > tripRank);
      if (isUnderfull) {
        return 0.86 + (tripRank / 14) * 0.05 + (pairRank / 14) * 0.02;
      }
      return 0.92 + (tripRank / 14) * 0.04 + (pairRank / 14) * 0.025;
    }

    case HandCategory.Flush: {
      if (playingBoardOnly) {
        return evalResult.tiebreakers[0] === 14 ? 0.42 : 0.25;
      }
      // Determine the flush suit and Hero's highest card in that suit
      let flushSuit: Suit = maxBoardSuit;
      for (const s of SUITS) {
        const totalInSuit =
          boardSuitCounts[s] + (hole[0].suit === s ? 1 : 0) + (hole[1].suit === s ? 1 : 0);
        if (totalInSuit >= 5) {
          flushSuit = s;
          break;
        }
      }
      const heroSuitRanks = hole
        .filter((c) => c.suit === flushSuit)
        .map((c) => RANK_VALUE[c.rank]);
      const heroTopFlushRank = heroSuitRanks.length > 0 ? Math.max(...heroSuitRanks) : 2;
      const higherMissing = highestMissingRankInSuit(board, flushSuit, heroTopFlushRank);

      if (boardSuitCounts[flushSuit] >= 4) {
        // 4-flush on board: nut flush is strong, baby flush (e.g. 3s) is a bluff-catcher
        if (higherMissing === 0) return 0.94;
        if (higherMissing === 1) return 0.86;
        if (higherMissing === 2) return 0.78;
        if (higherMissing === 3) return 0.70;
        return Math.min(0.66, 0.50 + (heroTopFlushRank / 14) * 0.14);
      }
      // 3-flush board (Hero uses both hole cards)
      if (higherMissing === 0) return 0.95;
      if (higherMissing === 1) return 0.91;
      return 0.84 + (heroTopFlushRank / 14) * 0.06;
    }

    case HandCategory.Straight: {
      if (playingBoardOnly) {
        return evalResult.tiebreakers[0] === 14 ? 0.44 : 0.25;
      }
      const straightHigh = evalResult.tiebreakers[0];
      let score = 0.82 + (straightHigh / 14) * 0.06;
      if (boardHasFourFlush) {
        score -= 0.22;
      }
      if (boardHasFourStraight) {
        // Check if a single higher card could beat Hero's straight on this 4-straight board
        const boardRankSet = new Set(board.map((c) => RANK_VALUE[c.rank]));
        let maxPossibleOneCardStraight = straightHigh;
        for (let r = 2; r <= 14; r++) {
          if (boardRankSet.has(r)) continue;
          const possible = highestStraightRankFromSet(new Set([...boardRankSet, r]));
          if (possible > maxPossibleOneCardStraight) {
            maxPossibleOneCardStraight = possible;
          }
        }
        if (maxPossibleOneCardStraight > straightHigh) {
          score -= 0.11;
        }
      }
      return Math.max(0.42, score);
    }

    case HandCategory.ThreeOfAKind: {
      const tripRank = evalResult.tiebreakers[0];
      if ((boardRankCounts.get(tripRank) ?? 0) >= 3) {
        // Trips are entirely on the board — Hero only holds a kicker
        return 0.14 + (hiHole / 14) * 0.16;
      }
      const isSet = h1 === h2 && h1 === tripRank;
      const base = (isSet ? 0.79 : 0.75) + (tripRank / 14) * 0.05;
      return Math.max(0.42, base - scarePenalty);
    }

    case HandCategory.TwoPair: {
      const highPair = evalResult.tiebreakers[0];
      const lowPair = evalResult.tiebreakers[1];
      const boardHasHigh = (boardRankCounts.get(highPair) ?? 0) >= 2;
      const boardHasLow = (boardRankCounts.get(lowPair) ?? 0) >= 2;

      if (boardHasHigh && boardHasLow) {
        // Double-paired board — Hero did not pair either hole card
        return 0.12 + (hiHole / 14) * 0.16;
      }

      if (boardHasHigh || boardHasLow) {
        // Single-paired board + Hero holds one real pair (effectively One Pair strength)
        const heroPair = boardHasHigh ? lowPair : highPair;
        const unpairedBoardMax = Math.max(
          0,
          ...board
            .map((c) => RANK_VALUE[c.rank])
            .filter((r) => (boardRankCounts.get(r) ?? 0) < 2)
        );
        let base: number;
        if (heroPair > boardMax) base = 0.66 + (heroPair / 14) * 0.05;
        else if (heroPair >= unpairedBoardMax && unpairedBoardMax > 0) {
          base = 0.54 + (heroPair / 14) * 0.08;
        } else {
          base = 0.36 + (heroPair / 14) * 0.14;
        }
        return Math.max(0.24, base - scarePenalty * 0.85);
      }

      // Genuine Two Pair using both hole cards
      const base = 0.71 + (highPair / 14) * 0.06;
      return Math.max(0.38, base - scarePenalty * 0.9);
    }

    case HandCategory.OnePair: {
      const pairRank = evalResult.tiebreakers[0];
      if ((boardRankCounts.get(pairRank) ?? 0) >= 2) {
        // Pair is entirely on the board — Hero is unpaired (high-card showdown value)
        return 0.12 + (hiHole / 14) * 0.15;
      }
      const kicker = evalResult.tiebreakers[1] ?? 7;
      let base: number;
      if (pairRank > boardMax) base = 0.67 + (pairRank / 14) * 0.05; // Overpair
      else if (pairRank === boardMax) base = 0.55 + (kicker / 14) * 0.1; // Top pair
      else base = 0.33 + (pairRank / 14) * 0.15; // Middle / bottom pair
      return Math.max(0.22, base - scarePenalty * 0.8);
    }

    default: {
      return 0.10 + (hiHole / 14) * 0.15;
    }
  }
}

const RANK_ZH_SHORT: Record<number, string> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: '10',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

const RANK_CODE_SHORT: Record<number, string> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: 'T',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

/**
 * Returns a concise live hand strength + active draw description for Hero in EN or zh-CN.
 * Examples:
 * - Preflop: "Pocket Aces" / "口袋对 A", "Ace-King Suited" / "AK 同花"
 * - Postflop: "Top Pair, Ace Kicker · Flush Draw" / "顶对（A 踢脚）· 同花听牌",
 *   "Overpair" / "超对", "Set of Kings" / "暗三条 K", "Two Pair" / "两对",
 *   "Nut Flush Draw + OESD" / "坚果同花+两头顺听牌"
 */
export function describeHeroHand(
  hole: [Card, Card],
  board: Card[],
  locale: 'en' | 'zh-CN'
): string {
  const isZh = locale === 'zh-CN';
  const v1 = RANK_VALUE[hole[0].rank];
  const v2 = RANK_VALUE[hole[1].rank];
  const hi = Math.max(v1, v2);
  const lo = Math.min(v1, v2);

  // Preflop description
  if (board.length === 0) {
    if (hi === lo) {
      return isZh
        ? `口袋对 ${RANK_ZH_SHORT[hi]}`
        : `Pocket ${RANK_NAME_PLURAL[hi]}`;
    }
    const suited = hole[0].suit === hole[1].suit;
    if (isZh) {
      const code = `${RANK_CODE_SHORT[hi]}${RANK_CODE_SHORT[lo]}`;
      return suited ? `${code} 同花` : `${code} 杂色`;
    }
    return `${RANK_NAME_SINGULAR[hi]}-${RANK_NAME_SINGULAR[lo]} ${suited ? 'Suited' : 'Offsuit'}`;
  }

  // Postflop evaluation
  const all = [...hole, ...board];
  const evalResult = evaluateHand(all);
  const boardOnly = board.length >= 5 ? evaluateHand(board) : null;
  const playingBoardOnly = boardOnly !== null && evalResult.score === boardOnly.score;

  const boardRankCounts = new Map<number, number>();
  const boardSuitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
  const uniqueBoardRanksDesc = Array.from(
    new Set(board.map((c) => RANK_VALUE[c.rank]))
  ).sort((a, b) => b - a);
  const boardMax = uniqueBoardRanksDesc[0] ?? 0;
  const boardMin = uniqueBoardRanksDesc[uniqueBoardRanksDesc.length - 1] ?? 0;

  for (const c of board) {
    const val = RANK_VALUE[c.rank];
    boardRankCounts.set(val, (boardRankCounts.get(val) ?? 0) + 1);
    boardSuitCounts[c.suit]++;
  }

  // Active draws (Flop & Turn only)
  let hasNutFd = false;
  let hasFd = false;
  let hasOesd = false;
  let hasGutshot = false;

  if (board.length === 3 || board.length === 4) {
    if (evalResult.category < HandCategory.Flush) {
      for (const s of SUITS) {
        const heroSuitCards = hole.filter((c) => c.suit === s);
        const totalSuit = boardSuitCounts[s] + heroSuitCards.length;
        if (totalSuit === 4 && heroSuitCards.length >= 1) {
          hasFd = true;
          const heroTopSuit = Math.max(...heroSuitCards.map((c) => RANK_VALUE[c.rank]));
          if (highestMissingRankInSuit(board, s, heroTopSuit) === 0) {
            hasNutFd = true;
          }
          break;
        }
      }
    }

    if (evalResult.category < HandCategory.Straight) {
      const allRanks = new Set(all.map((c) => RANK_VALUE[c.rank]));
      const boardRanks = new Set(board.map((c) => RANK_VALUE[c.rank]));
      if (highestStraightRankFromSet(allRanks) === 0) {
        let straightOutRanks = 0;
        for (let r = 2; r <= 14; r++) {
          if (allRanks.has(r)) continue;
          const heroStraight = highestStraightRankFromSet(new Set([...allRanks, r]));
          if (heroStraight === 0) continue;
          const boardStraight =
            board.length >= 4 ? highestStraightRankFromSet(new Set([...boardRanks, r])) : 0;
          if (heroStraight > boardStraight) {
            straightOutRanks++;
          }
        }
        if (straightOutRanks >= 2) hasOesd = true;
        else if (straightOutRanks === 1) hasGutshot = true;
      }
    }
  }

  let drawLabel = '';
  if (hasFd && (hasOesd || hasGutshot)) {
    if (isZh) {
      const fdPart = hasNutFd ? '坚果同花' : '同花';
      const sdPart = hasOesd ? '两头顺听牌' : '卡顺听牌';
      drawLabel = `${fdPart}+${sdPart}`;
    } else {
      const fdPart = hasNutFd ? 'Nut Flush Draw' : 'Flush Draw';
      const sdPart = hasOesd ? 'OESD' : 'Gutshot';
      drawLabel = `${fdPart} + ${sdPart}`;
    }
  } else if (hasFd) {
    drawLabel = isZh
      ? hasNutFd
        ? '坚果同花听牌'
        : '同花听牌'
      : hasNutFd
        ? 'Nut Flush Draw'
        : 'Flush Draw';
  } else if (hasOesd) {
    drawLabel = isZh ? '两头顺听牌' : 'OESD';
  } else if (hasGutshot) {
    drawLabel = isZh ? '卡顺听牌' : 'Gutshot';
  }

  let madeLabel = '';
  let isUnpairedEffective = false;

  switch (evalResult.category) {
    case HandCategory.StraightFlush: {
      const sfHigh = evalResult.tiebreakers[0];
      if (sfHigh === 14) {
        madeLabel = isZh ? '皇家同花顺' : 'Royal Flush';
      } else {
        madeLabel = isZh
          ? `同花顺（${RANK_ZH_SHORT[sfHigh]} 高）`
          : `Straight Flush, ${RANK_NAME_SINGULAR[sfHigh]}-High`;
      }
      break;
    }

    case HandCategory.FourOfAKind: {
      const quadRank = evalResult.tiebreakers[0];
      if ((boardRankCounts.get(quadRank) ?? 0) >= 4) {
        madeLabel = isZh
          ? `牌面四条（${RANK_ZH_SHORT[hi]} 踢脚）`
          : `Board Quads, ${RANK_NAME_SINGULAR[hi]} Kicker`;
      } else {
        madeLabel = isZh
          ? `四条（${RANK_ZH_SHORT[quadRank]}）`
          : `Four of a Kind, ${RANK_NAME_PLURAL[quadRank]}`;
      }
      break;
    }

    case HandCategory.FullHouse: {
      if (playingBoardOnly) {
        madeLabel = isZh ? '牌面葫芦' : 'Board Full House';
      } else {
        const tripRank = evalResult.tiebreakers[0];
        const pairRank = evalResult.tiebreakers[1];
        madeLabel = isZh
          ? `葫芦（${RANK_ZH_SHORT[tripRank]} 带 ${RANK_ZH_SHORT[pairRank]}）`
          : `Full House, ${RANK_NAME_PLURAL[tripRank]} Full`;
      }
      break;
    }

    case HandCategory.Flush: {
      if (playingBoardOnly) {
        madeLabel = isZh ? '牌面同花' : 'Board Flush';
      } else {
        let flushSuit: Suit = 's';
        for (const s of SUITS) {
          if (
            boardSuitCounts[s] + (hole[0].suit === s ? 1 : 0) + (hole[1].suit === s ? 1 : 0) >=
            5
          ) {
            flushSuit = s;
            break;
          }
        }
        const heroSuitRanks = hole
          .filter((c) => c.suit === flushSuit)
          .map((c) => RANK_VALUE[c.rank]);
        const heroTopFlush = heroSuitRanks.length > 0 ? Math.max(...heroSuitRanks) : 2;
        if (highestMissingRankInSuit(board, flushSuit, heroTopFlush) === 0) {
          madeLabel = isZh ? '坚果同花' : 'Nut Flush';
        } else {
          const topRank = evalResult.tiebreakers[0];
          madeLabel = isZh
            ? `同花（${RANK_ZH_SHORT[topRank]} 高）`
            : `Flush, ${RANK_NAME_SINGULAR[topRank]}-High`;
        }
      }
      break;
    }

    case HandCategory.Straight: {
      if (playingBoardOnly) {
        madeLabel = isZh ? '牌面顺子' : 'Board Straight';
      } else {
        const high = evalResult.tiebreakers[0];
        madeLabel = isZh
          ? `顺子（${RANK_ZH_SHORT[high]} 高）`
          : `Straight, ${RANK_NAME_SINGULAR[high]}-High`;
      }
      break;
    }

    case HandCategory.ThreeOfAKind: {
      const tripRank = evalResult.tiebreakers[0];
      if ((boardRankCounts.get(tripRank) ?? 0) >= 3) {
        madeLabel = isZh
          ? `牌面三条（${RANK_ZH_SHORT[hi]} 踢脚）`
          : `Board Trips, ${RANK_NAME_SINGULAR[hi]} Kicker`;
      } else if (v1 === v2 && v1 === tripRank) {
        madeLabel = isZh
          ? `暗三条 ${RANK_ZH_SHORT[tripRank]}`
          : `Set of ${RANK_NAME_PLURAL[tripRank]}`;
      } else {
        madeLabel = isZh
          ? `明三条 ${RANK_ZH_SHORT[tripRank]}`
          : `Trips, ${RANK_NAME_PLURAL[tripRank]}`;
      }
      break;
    }

    case HandCategory.TwoPair: {
      const highPair = evalResult.tiebreakers[0];
      const lowPair = evalResult.tiebreakers[1];
      const boardHasHigh = (boardRankCounts.get(highPair) ?? 0) >= 2;
      const boardHasLow = (boardRankCounts.get(lowPair) ?? 0) >= 2;
      if (boardHasHigh && boardHasLow) {
        isUnpairedEffective = true;
        madeLabel = isZh
          ? `牌面两对（${RANK_ZH_SHORT[hi]} 高）`
          : `Board Two Pair, ${RANK_NAME_SINGULAR[hi]}-High`;
      } else if (
        !boardHasHigh &&
        !boardHasLow &&
        uniqueBoardRanksDesc.length >= 2 &&
        highPair === uniqueBoardRanksDesc[0] &&
        lowPair === uniqueBoardRanksDesc[1]
      ) {
        madeLabel = isZh ? '顶两对' : 'Top Two Pair';
      } else {
        madeLabel = isZh ? '两对' : 'Two Pair';
      }
      break;
    }

    case HandCategory.OnePair: {
      const pairRank = evalResult.tiebreakers[0];
      if ((boardRankCounts.get(pairRank) ?? 0) >= 2) {
        isUnpairedEffective = true;
        madeLabel = isZh
          ? `牌面对（${RANK_ZH_SHORT[hi]} 高）`
          : `Board Pair, ${RANK_NAME_SINGULAR[hi]}-High`;
      } else if (v1 === v2 && pairRank > boardMax) {
        madeLabel = isZh ? '超对' : 'Overpair';
      } else if (pairRank === boardMax) {
        const kickerVal = v1 === pairRank ? v2 : v1;
        madeLabel = isZh
          ? `顶对（${RANK_ZH_SHORT[kickerVal]} 踢脚）`
          : `Top Pair, ${RANK_NAME_SINGULAR[kickerVal]} Kicker`;
      } else if (v1 === v2 && pairRank < boardMin) {
        madeLabel = isZh ? '小口袋对' : 'Underpair';
      } else if (uniqueBoardRanksDesc.length >= 2 && pairRank >= uniqueBoardRanksDesc[1]) {
        madeLabel = isZh ? '中对' : 'Middle Pair';
      } else {
        madeLabel = isZh ? '底对' : 'Bottom Pair';
      }
      break;
    }

    default: {
      isUnpairedEffective = true;
      madeLabel = isZh
        ? `${RANK_ZH_SHORT[hi]} 高牌`
        : `${RANK_NAME_SINGULAR[hi]}-High`;
      break;
    }
  }

  if (drawLabel) {
    if (isUnpairedEffective) {
      return drawLabel;
    }
    const sep = isZh && madeLabel.endsWith('）') ? '· ' : ' · ';
    return `${madeLabel}${sep}${drawLabel}`;
  }
  return madeLabel;
}
