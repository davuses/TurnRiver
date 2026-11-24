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

/**
 * Evaluates preflop + postflop made-hand strength normalized 0..1 for bot AI & quick readouts.
 * Accounts for paired/made boards so playing the board with weak hole cards is not over-valued.
 */
export function handStrengthScore(hole: [Card, Card], board: Card[]): number {
  if (board.length === 0) {
    return preflopHandStrength(hole);
  }

  const evalResult = evaluateHand([...hole, ...board]);
  const boardOnly = board.length >= 5 ? evaluateHand(board) : null;
  const boardRankCounts = new Map<number, number>();
  let boardMax = 0;
  for (const c of board) {
    const val = RANK_VALUE[c.rank];
    boardRankCounts.set(val, (boardRankCounts.get(val) ?? 0) + 1);
    if (val > boardMax) boardMax = val;
  }

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
      if (playingBoardOnly) return 0.38;
      return 0.94 + (evalResult.tiebreakers[0] / 14) * 0.03;
    }

    case HandCategory.Flush: {
      if (playingBoardOnly) {
        return evalResult.tiebreakers[0] === 14 ? 0.42 : 0.28;
      }
      return 0.89 + (evalResult.tiebreakers[0] / 14) * 0.05;
    }

    case HandCategory.Straight: {
      if (playingBoardOnly) {
        return evalResult.tiebreakers[0] === 14 ? 0.45 : 0.28;
      }
      return 0.84 + (evalResult.tiebreakers[0] / 14) * 0.04;
    }

    case HandCategory.ThreeOfAKind: {
      const tripRank = evalResult.tiebreakers[0];
      if ((boardRankCounts.get(tripRank) ?? 0) >= 3) {
        // Trips are entirely on the board — Hero only holds a kicker
        return 0.14 + (hiHole / 14) * 0.18;
      }
      return 0.78 + (tripRank / 14) * 0.05;
    }

    case HandCategory.TwoPair: {
      const highPair = evalResult.tiebreakers[0];
      const lowPair = evalResult.tiebreakers[1];
      const boardHasHigh = (boardRankCounts.get(highPair) ?? 0) >= 2;
      const boardHasLow = (boardRankCounts.get(lowPair) ?? 0) >= 2;

      if (boardHasHigh && boardHasLow) {
        // Double-paired board — Hero did not pair either hole card
        return 0.12 + (hiHole / 14) * 0.18;
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
        if (heroPair > boardMax) return 0.66 + (heroPair / 14) * 0.05;
        if (heroPair >= unpairedBoardMax && unpairedBoardMax > 0) {
          return 0.54 + (heroPair / 14) * 0.08;
        }
        return 0.36 + (heroPair / 14) * 0.14;
      }

      // Genuine Two Pair using both hole cards
      return 0.71 + (highPair / 14) * 0.06;
    }

    case HandCategory.OnePair: {
      const pairRank = evalResult.tiebreakers[0];
      if ((boardRankCounts.get(pairRank) ?? 0) >= 2) {
        // Pair is entirely on the board — Hero is unpaired (high-card showdown value)
        return 0.12 + (hiHole / 14) * 0.16;
      }
      const kicker = evalResult.tiebreakers[1] ?? 7;
      if (pairRank > boardMax) return 0.68 + (pairRank / 14) * 0.05; // Overpair
      if (pairRank === boardMax) return 0.56 + (kicker / 14) * 0.1; // Top pair
      return 0.34 + (pairRank / 14) * 0.16; // Middle / bottom pair
    }

    default: {
      return 0.12 + (hiHole / 14) * 0.16;
    }
  }
}
