import type { Card, Position, Street, Suit } from './types';
import {
  canonicalHandKey,
  evaluateHand,
  HandCategory,
  handStrengthScore,
  RANK_VALUE,
  SUITS,
} from './evaluator';
import { PREFLOP_TEMPLATES, type PreflopCellStrategy } from './preflopRanges';
import type {
  ArenaSize,
  BotArchetype,
  LegalActions,
  PokerTableState,
  TableSeat,
} from './tableEngine';

// ---------------------------------------------------------------------------
// Utility Helpers
// ---------------------------------------------------------------------------

function roundBbLocal(v: number): number {
  return Math.round(v * 10) / 10;
}

function roundHalfBb(v: number): number {
  return Math.round(v * 2) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function highestStraightRank(ranks: Set<number>): number {
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

function missingHigherCardsInSuit(board: Card[], suit: Suit, aboveRank: number): number {
  const boardInSuit = new Set(
    board.filter((c) => c.suit === suit).map((c) => RANK_VALUE[c.rank])
  );
  let missing = 0;
  for (let r = 14; r > aboveRank; r--) {
    if (!boardInSuit.has(r)) missing++;
  }
  return missing;
}

// ---------------------------------------------------------------------------
// 1. Board Texture Analysis
// ---------------------------------------------------------------------------

export interface BoardTexture {
  wetness: number; // 0 (K72r dry) .. 1 (876ss / monotone connected)
  highCardRank: number;
  lowCardRank: number;
  isPaired: boolean;
  isDoublePaired: boolean;
  isTripsOnBoard: boolean;
  isMonotone: boolean;
  isTwoTone: boolean;
  isThreeFlush: boolean;
  isFourFlush: boolean;
  isThreeStraight: boolean;
  isFourStraight: boolean;
  connectedScore: number; // 0..1
  broadwayCount: number;
  rangeAdvForPfr: number; // -1 (low connected 765 favors BB) .. +1 (AK4r favors PFR)
  dominantSuit: Suit | null;
  fourFlushSuit: Suit | null;
}

export function analyzeBoardTexture(board: Card[]): BoardTexture {
  if (board.length === 0) {
    return {
      wetness: 0,
      highCardRank: 0,
      lowCardRank: 0,
      isPaired: false,
      isDoublePaired: false,
      isTripsOnBoard: false,
      isMonotone: false,
      isTwoTone: false,
      isThreeFlush: false,
      isFourFlush: false,
      isThreeStraight: false,
      isFourStraight: false,
      connectedScore: 0,
      broadwayCount: 0,
      rangeAdvForPfr: 0,
      dominantSuit: null,
      fourFlushSuit: null,
    };
  }

  const rankCounts = new Map<number, number>();
  const suitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
  for (const c of board) {
    const v = RANK_VALUE[c.rank];
    rankCounts.set(v, (rankCounts.get(v) ?? 0) + 1);
    suitCounts[c.suit]++;
  }

  const uniqueRanks = Array.from(rankCounts.keys()).sort((a, b) => a - b);
  const highCardRank = uniqueRanks[uniqueRanks.length - 1] ?? 0;
  const lowCardRank = uniqueRanks[0] ?? 0;
  const broadwayCount = uniqueRanks.filter((r) => r >= 10).length;

  let pairCount = 0;
  let maxRankCount = 0;
  for (const cnt of rankCounts.values()) {
    if (cnt >= 2) pairCount++;
    if (cnt > maxRankCount) maxRankCount = cnt;
  }
  const isPaired = pairCount >= 1;
  const isDoublePaired = pairCount >= 2;
  const isTripsOnBoard = maxRankCount >= 3;

  let maxSuitCount = 0;
  let dominantSuit: Suit | null = null;
  for (const s of SUITS) {
    if (suitCounts[s] > maxSuitCount) {
      maxSuitCount = suitCounts[s];
      dominantSuit = s;
    }
  }
  const isMonotone = board.length === 3 ? maxSuitCount === 3 : maxSuitCount >= 4;
  const isThreeFlush = maxSuitCount === 3;
  const isFourFlush = maxSuitCount >= 4;
  const isTwoTone = board.length === 3 ? maxSuitCount === 2 : maxSuitCount === 2;
  const fourFlushSuit = isFourFlush ? dominantSuit : null;

  // Straight-window density across all 10 five-card straight windows (A2345 .. TJQKA)
  let maxInWindow = 0;
  for (let high = 14; high >= 5; high--) {
    let count = 0;
    for (let off = 0; off < 5; off++) {
      const needed = high - off === 1 ? 14 : high - off;
      if (rankCounts.has(needed)) count++;
    }
    if (count > maxInWindow) maxInWindow = count;
  }
  const isThreeStraight = maxInWindow >= 3;
  const isFourStraight = maxInWindow >= 4;

  // Connectedness: adjacent & 1-gap pairs among unique board ranks
  let tightLinks = 0;
  let looseLinks = 0;
  for (let i = 0; i < uniqueRanks.length - 1; i++) {
    const gap = uniqueRanks[i + 1] - uniqueRanks[i];
    if (gap === 1) tightLinks++;
    else if (gap === 2) looseLinks++;
  }
  // Wheel connectedness (Ace + 2/3/4/5)
  if (rankCounts.has(14) && (rankCounts.has(2) || rankCounts.has(3) || rankCounts.has(4) || rankCounts.has(5))) {
    looseLinks += 0.5;
  }
  const connectedScore = clamp(
    tightLinks * 0.42 +
      looseLinks * 0.22 +
      (isThreeStraight ? 0.25 : 0) +
      (isFourStraight ? 0.25 : 0),
    0,
    1
  );

  // Calibrated wetness:
  // - Monotone As 8s 3s -> ~0.72 (wet!)
  // - Rainbow straight Js Td 9c -> ~0.66 (wet!)
  // - Two-tone disconnected As 7s 5c -> ~0.34 (dry-medium!)
  // - Rainbow disconnected Ks 7d 2c -> ~0.08 (very dry!)
  let suitWetness = 0;
  if (isFourFlush) suitWetness = 0.65;
  else if (isThreeFlush) suitWetness = board.length === 3 ? 0.55 : 0.42;
  else if (maxSuitCount === 2) suitWetness = board.length === 3 ? 0.22 : 0.14;

  const pairedDryDiscount = isPaired ? -0.14 : 0;
  const highCardDryDiscount = highCardRank >= 13 && !isThreeStraight && maxSuitCount <= 2 ? -0.06 : 0;
  const wetness = clamp(
    suitWetness + connectedScore * 0.58 + pairedDryDiscount + highCardDryDiscount,
    0.04,
    0.98
  );

  // Range advantage for Preflop Aggressor (PFR):
  // High broadway boards (AK4, K72, QJ3, A82) strongly favor PFR (+0.45..+0.85)
  // Low connected boards (765, 654, 875) favor BB/caller (-0.35..-0.75)
  let rangeAdv = 0;
  if (highCardRank === 14) rangeAdv += 0.48;
  else if (highCardRank === 13) rangeAdv += 0.36;
  else if (highCardRank === 12) rangeAdv += 0.20;
  else if (highCardRank === 11) rangeAdv += 0.08;
  else if (highCardRank <= 8) rangeAdv -= 0.35;
  else if (highCardRank <= 9) rangeAdv -= 0.18;

  rangeAdv += (broadwayCount - 1) * 0.14;
  if (isPaired) rangeAdv += 0.15;
  if (isThreeStraight && highCardRank <= 10) rangeAdv -= 0.35;
  if (isFourStraight && highCardRank <= 10) rangeAdv -= 0.20;
  if (isMonotone) rangeAdv -= 0.12;
  const rangeAdvForPfr = clamp(rangeAdv, -1, 1);

  return {
    wetness,
    highCardRank,
    lowCardRank,
    isPaired,
    isDoublePaired,
    isTripsOnBoard,
    isMonotone,
    isTwoTone,
    isThreeFlush,
    isFourFlush,
    isThreeStraight,
    isFourStraight,
    connectedScore,
    broadwayCount,
    rangeAdvForPfr,
    dominantSuit: maxSuitCount >= 2 ? dominantSuit : null,
    fourFlushSuit,
  };
}

// ---------------------------------------------------------------------------
// 2. Hero Draw & Blocker Analysis
// ---------------------------------------------------------------------------

export interface HeroDrawInfo {
  flushDraw: boolean;
  nutFlushDraw: boolean;
  nonNutFlushDraw: boolean;
  backdoorFlushDraw: boolean;
  oesd: boolean;
  gutshot: boolean;
  straightDraw: boolean;
  comboDraw: boolean;
  overcards: number;
  approxOuts: number;
  drawEquityBoost: number;
  hasNutFlushBlocker: boolean;
  hasStraightBlocker: boolean;
  missedFlushDraw: boolean;
  missedStraightDraw: boolean;
}

export function analyzeHeroDraws(hole: [Card, Card], board: Card[]): HeroDrawInfo {
  const empty: HeroDrawInfo = {
    flushDraw: false,
    nutFlushDraw: false,
    nonNutFlushDraw: false,
    backdoorFlushDraw: false,
    oesd: false,
    gutshot: false,
    straightDraw: false,
    comboDraw: false,
    overcards: 0,
    approxOuts: 0,
    drawEquityBoost: 0,
    hasNutFlushBlocker: false,
    hasStraightBlocker: false,
    missedFlushDraw: false,
    missedStraightDraw: false,
  };
  if (board.length < 3) return empty;

  const all = [...hole, ...board];
  const currentEval = evaluateHand(all);
  const boardSuitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
  let boardMax = 0;
  for (const c of board) {
    boardSuitCounts[c.suit]++;
    const v = RANK_VALUE[c.rank];
    if (v > boardMax) boardMax = v;
  }

  const isFlop = board.length === 3;
  const isTurn = board.length === 4;
  const isRiver = board.length >= 5;

  // Blocker analysis (useful across all streets, especially river bluffs!)
  let hasNutFlushBlocker = false;
  for (const s of SUITS) {
    if (boardSuitCounts[s] >= 3) {
      const heroInSuit = hole.filter((c) => c.suit === s);
      if (heroInSuit.length > 0 && currentEval.category < HandCategory.Flush) {
        const topHero = Math.max(...heroInSuit.map((c) => RANK_VALUE[c.rank]));
        if (missingHigherCardsInSuit(board, s, topHero) === 0) {
          hasNutFlushBlocker = true;
        }
      }
    }
  }

  let hasStraightBlocker = false;
  if (currentEval.category < HandCategory.Straight) {
    const boardRankSet = new Set(board.map((c) => RANK_VALUE[c.rank]));
    // Check if Hero holds a card that completes the highest 3+ card straight window on the board
    for (let high = 14; high >= 6; high--) {
      let boardInWin = 0;
      let heroMatchesMissing = false;
      for (let off = 0; off < 5; off++) {
        const needed = high - off === 1 ? 14 : high - off;
        if (boardRankSet.has(needed)) boardInWin++;
        else if (RANK_VALUE[hole[0].rank] === needed || RANK_VALUE[hole[1].rank] === needed) {
          heroMatchesMissing = true;
        }
      }
      if (boardInWin >= 3 && heroMatchesMissing) {
        hasStraightBlocker = true;
        break;
      }
    }
  }

  // Missed draws on River (for authentic river bluff selection!)
  let missedFlushDraw = false;
  let missedStraightDraw = false;
  if (isRiver && currentEval.category <= HandCategory.OnePair) {
    if (hole[0].suit === hole[1].suit && boardSuitCounts[hole[0].suit] === 2) {
      // Hero held 2 suited hole cards matching a 2-tone flop/turn that bricked
      const flopTurnMatch = board.slice(0, 4).filter((c) => c.suit === hole[0].suit).length;
      if (flopTurnMatch === 2) missedFlushDraw = true;
    }
    // Check if Hero had a straight draw on flop or turn that missed on river
    const turnCards = [...hole, ...board.slice(0, 4)];
    const turnRanks = new Set(turnCards.map((c) => RANK_VALUE[c.rank]));
    const turnBoardRanks = new Set(board.slice(0, 4).map((c) => RANK_VALUE[c.rank]));
    if (highestStraightRank(turnRanks) === 0) {
      let turnOuts = 0;
      for (let r = 2; r <= 14; r++) {
        if (turnRanks.has(r)) continue;
        const hStr = highestStraightRank(new Set([...turnRanks, r]));
        if (hStr === 0) continue;
        const bStr = highestStraightRank(new Set([...turnBoardRanks, r]));
        if (hStr > bStr) turnOuts++;
      }
      if (turnOuts >= 1) missedStraightDraw = true;
    }
  }

  if (isRiver) {
    return {
      ...empty,
      hasNutFlushBlocker,
      hasStraightBlocker,
      missedFlushDraw,
      missedStraightDraw,
    };
  }

  // Active Flush Draw (Flop or Turn)
  let flushDraw = false;
  let nutFlushDraw = false;
  let nonNutFlushDraw = false;
  let backdoorFlushDraw = false;

  if (currentEval.category < HandCategory.Flush) {
    for (const s of SUITS) {
      const heroSuitCards = hole.filter((c) => c.suit === s);
      const totalSuit = boardSuitCounts[s] + heroSuitCards.length;
      if (totalSuit === 4 && heroSuitCards.length >= 1) {
        flushDraw = true;
        const heroTop = Math.max(...heroSuitCards.map((c) => RANK_VALUE[c.rank]));
        if (missingHigherCardsInSuit(board, s, heroTop) === 0) {
          nutFlushDraw = true;
        } else {
          nonNutFlushDraw = true;
        }
        break;
      }
    }
    if (!flushDraw && isFlop && hole[0].suit === hole[1].suit && boardSuitCounts[hole[0].suit] === 1) {
      backdoorFlushDraw = true;
    }
  }

  // Active Straight Draw (OESD vs Gutshot, excluding made straights & board-only 4-straights)
  let straightOutRanks = 0;
  if (currentEval.category < HandCategory.Straight) {
    const allRanks = new Set(all.map((c) => RANK_VALUE[c.rank]));
    const boardRanks = new Set(board.map((c) => RANK_VALUE[c.rank]));
    if (highestStraightRank(allRanks) === 0) {
      for (let r = 2; r <= 14; r++) {
        if (allRanks.has(r)) continue;
        const heroStr = highestStraightRank(new Set([...allRanks, r]));
        if (heroStr === 0) continue;
        const boardStr = isTurn ? highestStraightRank(new Set([...boardRanks, r])) : 0;
        if (heroStr > boardStr) {
          straightOutRanks++;
        }
      }
    }
  }

  const oesd = straightOutRanks >= 2;
  const gutshot = straightOutRanks === 1;
  const straightDraw = oesd || gutshot;
  const comboDraw = flushDraw && straightDraw;

  const overcards = hole.filter((c) => RANK_VALUE[c.rank] > boardMax).length;

  // Deduplicated approximate outs
  let approxOuts = 0;
  if (flushDraw) approxOuts += 9;
  if (oesd) approxOuts += flushDraw ? 6 : 8;
  else if (gutshot) approxOuts += flushDraw ? 3 : 4;
  if (currentEval.category === HandCategory.HighCard && overcards > 0) {
    // Discount overcards somewhat as half-clean outs
    approxOuts += overcards * 2;
  }

  // Flop (2 cards to come) vs Turn (1 card to come) equity boost
  const streetMult = isFlop ? 1.0 : 0.56;
  let drawEquityBoost = 0;
  if (nutFlushDraw) drawEquityBoost += 0.24 * streetMult;
  else if (flushDraw) drawEquityBoost += 0.20 * streetMult;

  if (oesd) drawEquityBoost += (flushDraw ? 0.13 : 0.19) * streetMult;
  else if (gutshot) drawEquityBoost += (flushDraw ? 0.06 : 0.095) * streetMult;

  if (backdoorFlushDraw && isFlop) drawEquityBoost += 0.035;
  if (overcards === 2 && currentEval.category === HandCategory.HighCard) {
    drawEquityBoost += isFlop ? 0.075 : 0.04;
  } else if (overcards === 1 && currentEval.category === HandCategory.HighCard) {
    drawEquityBoost += isFlop ? 0.03 : 0.015;
  }

  return {
    flushDraw,
    nutFlushDraw,
    nonNutFlushDraw,
    backdoorFlushDraw,
    oesd,
    gutshot,
    straightDraw,
    comboDraw,
    overcards,
    approxOuts,
    drawEquityBoost: clamp(drawEquityBoost, 0, 0.42),
    hasNutFlushBlocker,
    hasStraightBlocker,
    missedFlushDraw,
    missedStraightDraw,
  };
}

// ---------------------------------------------------------------------------
// 3. Preflop Range Solver Anchored on PREFLOP_TEMPLATES
// ---------------------------------------------------------------------------

export interface PreflopFreqs {
  raise: number; // 0..100
  call: number; // 0..100
  fold: number; // 0..100
}

const TEMPLATE_BY_ID = new Map(PREFLOP_TEMPLATES.map((t) => [t.id, t]));

const RFI_TEMPLATE_BY_POS: Partial<Record<Position, Record<string, PreflopCellStrategy>>> = {
  UTG: TEMPLATE_BY_ID.get('rfi-utg')?.matrix,
  HJ: TEMPLATE_BY_ID.get('rfi-hj')?.matrix,
  CO: TEMPLATE_BY_ID.get('rfi-co')?.matrix,
  BTN: TEMPLATE_BY_ID.get('rfi-btn')?.matrix,
  SB: TEMPLATE_BY_ID.get('rfi-sb')?.matrix,
};

const BLOCKER_3BET_HANDS = new Set([
  'A5s',
  'A4s',
  'A3s',
  'A2s',
  'K9s',
  'K8s',
  'K7s',
  'K6s',
  'K5s',
  'Q9s',
  '76s',
  '65s',
  '54s',
]);

const SUITED_CONNECTORS_AND_PAIRS = new Set([
  '22',
  '33',
  '44',
  '55',
  '66',
  '77',
  '88',
  '99',
  'T9s',
  '98s',
  '87s',
  '76s',
  '65s',
  '54s',
  'J9s',
  'T8s',
  '97s',
  '86s',
  '75s',
  '64s',
]);

function normalizeFreqs(raise: number, call: number, fold: number): PreflopFreqs {
  const r = Math.max(0, raise);
  const c = Math.max(0, call);
  const f = Math.max(0, fold);
  const sum = r + c + f;
  if (sum <= 0) return { raise: 0, call: 0, fold: 100 };
  const nr = Math.round((r / sum) * 100);
  const nc = Math.round((c / sum) * 100);
  const nf = Math.max(0, 100 - nr - nc);
  return { raise: nr, call: nc, fold: nf };
}

function preflopStrengthFromKey(handKey: string): number {
  const r1 = handKey[0] as Card['rank'];
  const r2 = handKey[1] as Card['rank'];
  const suited = handKey.endsWith('s');
  const c1: Card = { rank: r1, suit: 's' };
  const c2: Card = { rank: r2, suit: suited ? 's' : 'h' };
  return handStrengthScore([c1, c2], []);
}

function tightenCell(cell: PreflopCellStrategy, keepFactor: number): PreflopFreqs {
  // Scales raise & call downward smoothly toward fold while preserving pure premiums
  const rawStr = preflopStrengthFromKey(cell.hand);
  if (rawStr >= 0.86) return { raise: cell.raise, call: cell.call, fold: cell.fold };
  const r = cell.raise * (rawStr >= 0.72 ? Math.min(1, keepFactor + 0.15) : keepFactor);
  const c = cell.call * keepFactor;
  const f = 100 - r - c;
  return normalizeFreqs(r, c, f);
}

function widenCell(
  cell: PreflopCellStrategy,
  handKey: string,
  extraCallThreshold: number,
  extraRaiseThreshold: number
): PreflopFreqs {
  if (cell.fold === 0) return { raise: cell.raise, call: cell.call, fold: 0 };
  const rawStr = preflopStrengthFromKey(handKey);
  let r = cell.raise;
  let c = cell.call;
  let f = cell.fold;
  if (rawStr >= extraRaiseThreshold && r < 70) {
    const add = Math.min(f, 55);
    r += add;
    f -= add;
  } else if (rawStr >= extraCallThreshold && f > 0) {
    const add = Math.min(f, 65);
    c += add;
    f -= add;
  }
  return normalizeFreqs(r, c, f);
}

export interface PreflopSpotContext {
  handKey: string;
  heroPos: Position;
  villainPos: Position | null;
  preflopRaiseCount: number;
  limperCount: number;
  coldCallerCount: number;
  heroAlreadyRaised: boolean;
  canCheck: boolean;
  toCallBb: number;
  tableSize: ArenaSize;
}

/**
 * Extracts exact preflop context from table state & actionLog.
 */
export function extractPreflopContext(
  state: PokerTableState,
  seatIndex: number,
  legal: LegalActions
): PreflopSpotContext {
  const seat = state.seats[seatIndex];
  const handKey = seat.cards ? canonicalHandKey(seat.cards[0], seat.cards[1]) : '72o';
  const preLogs = state.actionLog.filter((l) => l.street === 'preflop');

  let limperCount = 0;
  let coldCallerCount = 0;
  let seenRaise = false;
  let villainPos: Position | null = null;

  for (const log of preLogs) {
    const kind = log.actionSpec?.kind;
    if (kind === 'post_sb' || kind === 'post_bb' || kind === 'blind') continue;
    if (kind === 'raise' || kind === 'bet' || kind === 'three_bet' || kind === 'four_bet' || kind === 'all_in') {
      seenRaise = true;
      coldCallerCount = 0;
      if (log.position !== seat.position) {
        villainPos = log.position;
      }
    } else if (kind === 'call' || kind === 'call_allin') {
      if (!seenRaise) limperCount++;
      else coldCallerCount++;
    }
  }

  if (!villainPos && state.preflopAggressorSeatIndex !== null && state.preflopAggressorSeatIndex !== seatIndex) {
    villainPos = state.seats[state.preflopAggressorSeatIndex]?.position ?? null;
  }

  return {
    handKey,
    heroPos: seat.position,
    villainPos,
    preflopRaiseCount: state.preflopRaiseCount,
    limperCount,
    coldCallerCount,
    heroAlreadyRaised: seat.didPfrThisHand,
    canCheck: legal.canCheck,
    toCallBb: legal.callAmountBb,
    tableSize: state.config.tableSize,
  };
}

/**
 * Unified GTO Preflop Strategy anchored directly to TurnRiver's PREFLOP_TEMPLATES.
 * Used both as the baseline for Balanced Reg / archetype shifts AND for Hero EV Audits!
 */
export function getGtoPreflopFreqs(ctx: PreflopSpotContext): PreflopFreqs {
  const {
    handKey,
    heroPos,
    villainPos,
    preflopRaiseCount,
    limperCount,
    coldCallerCount,
    heroAlreadyRaised,
    canCheck,
    toCallBb,
    tableSize,
  } = ctx;
  const rawStr = preflopStrengthFromKey(handKey);

  // 1. Unopened pot (RFI) or facing limpers
  if (preflopRaiseCount === 0) {
    if (limperCount === 0) {
      // Pure RFI — direct lookup in PREFLOP_TEMPLATES
      if (tableSize === 2 && heroPos === 'BTN') {
        const btnCell = RFI_TEMPLATE_BY_POS.BTN?.[handKey];
        if (btnCell && btnCell.raise > 0) return { raise: btnCell.raise, call: 0, fold: btnCell.fold };
        // HU BTN opens ~72% of hands
        if (rawStr >= 0.34) return { raise: 100, call: 0, fold: 0 };
        if (rawStr >= 0.28) return { raise: 55, call: 0, fold: 45 };
        return { raise: 0, call: 0, fold: 100 };
      }

      const rfiMatrix = RFI_TEMPLATE_BY_POS[heroPos];
      if (rfiMatrix && rfiMatrix[handKey]) {
        const c = rfiMatrix[handKey];
        return { raise: c.raise, call: c.call, fold: c.fold };
      }
      // Fallback (e.g. BB checked to): never fold when canCheck
      if (canCheck) {
        return rawStr >= 0.68 ? { raise: 80, call: 20, fold: 0 } : { raise: 0, call: 100, fold: 0 };
      }
      return rawStr >= 0.56 ? { raise: 100, call: 0, fold: 0 } : { raise: 0, call: 0, fold: 100 };
    }

    // Facing 1+ limpers (ISO-raise or check/over-limp)
    const baseMatrix = RFI_TEMPLATE_BY_POS[heroPos] ?? RFI_TEMPLATE_BY_POS.HJ!;
    const cell = baseMatrix[handKey];
    if (canCheck) {
      // BB facing limpers: ISO-raise top ~22% + check rest for free
      const isoMatrix = RFI_TEMPLATE_BY_POS.HJ!;
      const isoCell = isoMatrix[handKey];
      if (isoCell && isoCell.raise >= 50 && rawStr >= 0.60) {
        return { raise: 85, call: 15, fold: 0 };
      }
      if (BLOCKER_3BET_HANDS.has(handKey)) {
        return { raise: 30, call: 70, fold: 0 };
      }
      return { raise: 0, call: 100, fold: 0 };
    }

    // Non-BB facing limper(s): ISO-raise strong hands, selective over-limp with speculative LP hands
    const isoTighten = Math.max(0.65, 1 - limperCount * 0.12);
    if (cell && cell.raise > 0 && rawStr >= 0.56) {
      return { raise: Math.round(cell.raise * isoTighten + (100 - cell.raise * isoTighten) * 0.35), call: 0, fold: Math.round((100 - cell.raise) * 0.5) };
    }
    if ((heroPos === 'BTN' || heroPos === 'CO' || heroPos === 'SB') && SUITED_CONNECTORS_AND_PAIRS.has(handKey)) {
      return { raise: 35, call: 45, fold: 20 };
    }
    if (cell && cell.raise >= 50) {
      return { raise: 75, call: 0, fold: 25 };
    }
    return { raise: 0, call: 0, fold: 100 };
  }

  // Huge open-shove / massive overbet open (>= 22bb): treat like facing a 3-bet/4-bet jam!
  if (preflopRaiseCount === 1 && toCallBb >= 22) {
    if (rawStr >= 0.88) return { raise: 50, call: 50, fold: 0 };
    if (rawStr >= 0.83) return { raise: 20, call: 65, fold: 15 };
    if (rawStr >= 0.78) return { raise: 0, call: 40, fold: 60 };
    return { raise: 0, call: 0, fold: 100 };
  }

  // 2. Facing a single open raise (FACING_OPEN)
  if (preflopRaiseCount === 1) {
    const bbVsBtn = TEMPLATE_BY_ID.get('vs-open-bb-btn')!.matrix;
    const sbVsBtn = TEMPLATE_BY_ID.get('vs-open-sb-btn')!.matrix;
    const btnVsCo = TEMPLATE_BY_ID.get('vs-open-btn-co')!.matrix;

    // Exact PREFLOP_TEMPLATES hits (100% alignment with Preflop Trainer!)
    if (heroPos === 'BB' && villainPos === 'BTN' && coldCallerCount === 0 && tableSize >= 3) {
      const c = bbVsBtn[handKey];
      return { raise: c.raise, call: c.call, fold: c.fold };
    }
    if (heroPos === 'SB' && villainPos === 'BTN' && coldCallerCount === 0) {
      const c = sbVsBtn[handKey];
      return { raise: c.raise, call: c.call, fold: c.fold };
    }
    if (heroPos === 'BTN' && villainPos === 'CO' && coldCallerCount === 0) {
      const c = btnVsCo[handKey];
      return { raise: c.raise, call: c.call, fold: c.fold };
    }

    // Interpolated GTO matchups anchored on the templates above
    if (heroPos === 'BB') {
      const baseCell = bbVsBtn[handKey];
      let res: PreflopFreqs;
      if (tableSize === 2 || villainPos === 'SB') {
        res = widenCell(baseCell, handKey, 0.36, 0.76);
      } else if (villainPos === 'CO') {
        res = tightenCell(baseCell, 0.86);
      } else if (villainPos === 'HJ') {
        res = tightenCell(baseCell, 0.72);
      } else {
        // vs UTG
        res = tightenCell(baseCell, 0.58);
      }
      // Adjust for cold-callers (multiway squeeze / multiway odds)
      if (coldCallerCount > 0) {
        if (SUITED_CONNECTORS_AND_PAIRS.has(handKey) && res.fold > 0) {
          res = normalizeFreqs(res.raise, res.call + 35, Math.max(0, res.fold - 35));
        } else if (rawStr < 0.55 && !handKey.endsWith('s') && handKey.length === 3) {
          res = normalizeFreqs(res.raise * 0.5, res.call * 0.45, res.fold + res.call * 0.55);
        }
      }
      return res;
    }

    if (heroPos === 'SB') {
      const baseCell = sbVsBtn[handKey];
      const keep =
        villainPos === 'CO' ? 0.85 : villainPos === 'HJ' ? 0.74 : 0.62; // UTG tightest
      let res = tightenCell(baseCell, keep);
      // With cold callers, allow occasional speculative flat with pairs/suited connectors
      if (coldCallerCount > 0 && SUITED_CONNECTORS_AND_PAIRS.has(handKey) && rawStr >= 0.50) {
        res = normalizeFreqs(res.raise * 0.5, 45, Math.max(0, 55 - res.raise * 0.5));
      }
      return res;
    }

    if (heroPos === 'BTN') {
      const baseCell = btnVsCo[handKey];
      const keep = villainPos === 'HJ' ? 0.88 : 0.74; // vs UTG tighter
      let res = tightenCell(baseCell, keep);
      if (coldCallerCount > 0 && SUITED_CONNECTORS_AND_PAIRS.has(handKey) && rawStr >= 0.48) {
        res = normalizeFreqs(res.raise, Math.max(res.call, 65), Math.max(0, 35 - res.raise));
      }
      return res;
    }

    // CO or HJ facing UTG/HJ open (players left behind -> tighter flats, disciplined linear 3-bets)
    const baseCell = btnVsCo[handKey];
    const keep = heroPos === 'CO' && villainPos === 'HJ' ? 0.82 : 0.68;
    const tightened = tightenCell(baseCell, keep);
    // Reduce flatting of marginal offsuit/weak hands with BTN+blinds still behind
    if (rawStr < 0.62 && tightened.call > 0 && !SUITED_CONNECTORS_AND_PAIRS.has(handKey)) {
      return normalizeFreqs(tightened.raise, tightened.call * 0.4, tightened.fold + tightened.call * 0.6);
    }
    return tightened;
  }

  // 3. Facing a 3-Bet (preflopRaiseCount === 2)
  if (preflopRaiseCount === 2) {
    const btnVsBb = TEMPLATE_BY_ID.get('vs-3bet-btn-bb')!.matrix;
    const coVsBtn = TEMPLATE_BY_ID.get('vs-3bet-co-btn')!.matrix;

    // Cold facing a 3-bet (Hero was NOT the original opener -> very tight cold-4bet/fold!)
    if (!heroAlreadyRaised && toCallBb > 3) {
      if (handKey === 'AA' || handKey === 'KK' || handKey === 'AKs') {
        return { raise: 100, call: 0, fold: 0 };
      }
      if (handKey === 'QQ' || handKey === 'AKo') {
        return { raise: 70, call: 30, fold: 0 };
      }
      if (handKey === 'JJ' || handKey === 'AQs') {
        return { raise: 25, call: 45, fold: 30 };
      }
      if (handKey === 'A5s') {
        return { raise: 30, call: 0, fold: 70 };
      }
      return { raise: 0, call: 0, fold: 100 };
    }

    // Exact PREFLOP_TEMPLATES hits
    if (heroPos === 'BTN' && villainPos === 'BB') {
      const c = btnVsBb[handKey];
      return { raise: c.raise, call: c.call, fold: c.fold };
    }
    if (heroPos === 'CO' && villainPos === 'BTN') {
      const c = coVsBtn[handKey];
      return { raise: c.raise, call: c.call, fold: c.fold };
    }

    // IP vs blinds 3-bet -> btnVsBb; OOP vs IP 3-bet -> coVsBtn
    const isIpVs3Bet =
      heroPos === 'BTN' ||
      (heroPos === 'CO' && (villainPos === 'SB' || villainPos === 'BB')) ||
      (heroPos === 'HJ' && (villainPos === 'SB' || villainPos === 'BB'));
    const baseCell = isIpVs3Bet ? btnVsBb[handKey] : coVsBtn[handKey];
    const keep = heroPos === 'UTG' ? 0.85 : 1.0;
    return tightenCell(baseCell, keep);
  }

  // 4. Facing a 4-Bet+ (preflopRaiseCount >= 3)
  if (handKey === 'AA' || handKey === 'KK') {
    return { raise: 88, call: 12, fold: 0 };
  }
  if (handKey === 'AKs') {
    return { raise: 72, call: 28, fold: 0 };
  }
  if (handKey === 'QQ') {
    return { raise: 52, call: 48, fold: 0 };
  }
  if (handKey === 'AKo') {
    return { raise: 42, call: 43, fold: 15 };
  }
  if (handKey === 'JJ' || handKey === 'AQs') {
    return preflopRaiseCount === 3
      ? { raise: 18, call: 52, fold: 30 }
      : { raise: 10, call: 30, fold: 60 };
  }
  if ((handKey === 'A5s' || handKey === 'A4s') && preflopRaiseCount === 3) {
    return { raise: 25, call: 0, fold: 75 };
  }
  if ((handKey === 'TT' || handKey === 'KQs') && preflopRaiseCount === 3 && toCallBb <= 22) {
    return { raise: 0, call: 35, fold: 65 };
  }
  return { raise: 0, call: 0, fold: 100 };
}

/**
 * Applies clean archetype-specific preflop adjustments on top of the GTO frequencies.
 * Guarantees 0% open-limp for Balanced Reg, TAG, LAG, and Tight Nit;
 * realistic heavy limping for Calling Station; calibrated 10-14% PFR for Tight Nit.
 */
function adjustPreflopFreqsForArchetype(
  gto: PreflopFreqs,
  ctx: PreflopSpotContext,
  archetype: BotArchetype
): PreflopFreqs {
  const { handKey, heroPos, preflopRaiseCount, limperCount, canCheck, toCallBb } = ctx;
  const rawStr = preflopStrengthFromKey(handKey);
  const isSuited = handKey.endsWith('s');
  const isPair = handKey.length === 2;
  const isBlocker = BLOCKER_3BET_HANDS.has(handKey);
  const isLatePos = heroPos === 'BTN' || heroPos === 'CO' || heroPos === 'SB';
  const isUnopened = preflopRaiseCount === 0 && limperCount === 0 && !canCheck;

  switch (archetype) {
    case 'Balanced Reg': {
      // Pure GTO ranges; strictly zero open-limp, calibrated ~8.5-10% 3-bet with blocker mixes
      if (isUnopened) {
        return { raise: gto.raise, call: 0, fold: 100 - gto.raise };
      }
      if (preflopRaiseCount === 1) {
        let r = gto.raise;
        let c = gto.call;
        if (isBlocker && r < 55 && (isLatePos || heroPos === 'BB')) {
          const boost = Math.min(28, 100 - r);
          r += boost;
          c = Math.max(0, c - Math.round(boost * 0.5));
        } else if (rawStr >= 0.72 && r < 85 && c > 0) {
          const shift = Math.min(c, 22);
          r += shift;
          c -= shift;
        }
        return normalizeFreqs(r, c, Math.max(0, 100 - r - c));
      }
      return gto;
    }

    case 'Tight-Aggressive': {
      if (isUnopened) {
        // Trim bottom ~18% of GTO opens, strictly zero open-limp
        const cutoff =
          heroPos === 'UTG'
            ? 0.60
            : heroPos === 'HJ'
              ? 0.55
              : heroPos === 'CO'
                ? 0.51
                : 0.43;
        if (rawStr < cutoff && gto.raise < 100) {
          return { raise: 0, call: 0, fold: 100 };
        }
        const r = rawStr < cutoff ? Math.round(gto.raise * 0.45) : Math.round(gto.raise * 0.94);
        return { raise: r, call: 0, fold: 100 - r };
      }
      if (preflopRaiseCount === 1) {
        // Tighter flats, solid value-leaning 3-bets (~7-9%)
        const r = rawStr >= 0.72 ? gto.raise : Math.round(gto.raise * 0.72);
        const c = rawStr >= 0.52 || isPair ? Math.round(gto.call * 0.72) : Math.round(gto.call * 0.35);
        return normalizeFreqs(r, c, Math.max(0, 100 - r - c));
      }
      if (preflopRaiseCount >= 2) {
        const r = Math.round(gto.raise * 0.85);
        const c = Math.round(gto.call * 0.78);
        return normalizeFreqs(r, c, Math.max(0, 100 - r - c));
      }
      return gto;
    }

    case 'Loose-Aggressive': {
      if (isUnopened) {
        // Widen opens ~30% with suited/connected/broadway hands, strictly 0% open-limp
        const widenCut =
          heroPos === 'UTG'
            ? 0.48
            : heroPos === 'HJ'
              ? 0.43
              : heroPos === 'CO'
                ? 0.35
                : 0.27;
        let r = gto.raise;
        if (r < 100 && rawStr >= widenCut) {
          r = Math.min(100, Math.max(r + 45, isSuited || isPair ? 88 : 70));
        }
        return { raise: r, call: 0, fold: 100 - r };
      }
      if (preflopRaiseCount === 1) {
        // Higher 3-bet (~12-15%) prioritizing suited blockers + connectors + linear value, wider IP flat
        let r = gto.raise;
        let c = gto.call;
        if (isBlocker) {
          r = Math.max(r, 65);
          c = Math.max(0, Math.min(c, 100 - r));
        } else if (rawStr >= 0.60) {
          const boost = Math.max(25, Math.round(c * 0.45));
          r = Math.min(95, r + boost);
          c = Math.max(0, Math.min(c, 100 - r));
        } else if (isSuited && rawStr >= 0.46 && (isLatePos || heroPos === 'BB')) {
          r = Math.max(r, 28);
        }
        if (gto.fold > 0 && rawStr >= (isLatePos || heroPos === 'BB' ? 0.36 : 0.46)) {
          const addCall = Math.min(gto.fold, isSuited || isPair ? 50 : 26);
          c += addCall;
        }
        return normalizeFreqs(r, c, Math.max(0, 100 - r - c));
      }
      if (preflopRaiseCount === 2) {
        // Active 4-betting with blockers + wider IP peels
        let r = gto.raise;
        let c = gto.call;
        if (isBlocker && r < 55) r += 28;
        if (rawStr >= 0.56 && gto.fold > 0) c += 22;
        return normalizeFreqs(r, c, Math.max(0, 100 - r - c));
      }
      return gto;
    }

    case 'Calling Station': {
      if (isUnopened) {
        // Classic passive Calling Station: raises ~9-12% (PFR), open-limps ~22-30%, VPIP ~45-51%, folds worst trash
        const raiseCut = isLatePos ? 0.57 : 0.62;
        const limpCut = heroPos === 'BTN' || heroPos === 'SB' ? 0.28 : heroPos === 'CO' ? 0.33 : 0.39;
        if (rawStr >= raiseCut) {
          return { raise: 88, call: 12, fold: 0 };
        }
        if (rawStr >= limpCut || (isPair && rawStr >= 0.46) || (isSuited && rawStr >= limpCut - 0.03)) {
          return { raise: rawStr >= raiseCut - 0.05 ? 18 : 0, call: rawStr >= raiseCut - 0.05 ? 82 : 92, fold: rawStr >= raiseCut - 0.05 ? 0 : 8 };
        }
        return { raise: 0, call: 0, fold: 100 };
      }
      if (preflopRaiseCount === 0 && limperCount > 0) {
        if (canCheck) {
          return rawStr >= 0.72 ? { raise: 70, call: 30, fold: 0 } : { raise: 0, call: 100, fold: 0 };
        }
        if (rawStr >= 0.68) return { raise: 70, call: 30, fold: 0 };
        if (rawStr >= 0.33 || isPair || isSuited) return { raise: 0, call: 88, fold: 12 };
        return { raise: 0, call: 0, fold: 100 };
      }
      if (preflopRaiseCount === 1) {
        // Low 3-bet (~2.5-4%), flats wide vs opens, still folds worst unplayable garbage
        if (rawStr >= 0.80) return { raise: 68, call: 32, fold: 0 };
        if (rawStr >= 0.74) return { raise: 25, call: 75, fold: 0 };
        const flatCut = heroPos === 'BB' ? 0.30 : isLatePos ? 0.39 : 0.46;
        if (rawStr >= flatCut || isPair) {
          return { raise: 0, call: 90, fold: 10 };
        }
        return { raise: 0, call: 0, fold: 100 };
      }
      if (preflopRaiseCount === 2) {
        // Calls wide vs 3-bets with pairs/broadways/suited Ax, rarely 4-bets
        if (rawStr >= 0.94) return { raise: 55, call: 45, fold: 0 };
        if (rawStr >= 0.54 || (isPair && toCallBb <= 12)) return { raise: 0, call: 82, fold: 18 };
        return { raise: 0, call: 10, fold: 90 };
      }
      // Facing 4-bet+
      if (rawStr >= 0.82) return { raise: 25, call: 75, fold: 0 };
      if (rawStr >= 0.70) return { raise: 0, call: 55, fold: 45 };
      return { raise: 0, call: 0, fold: 100 };
    }

    case 'Tight Nit': {
      if (isUnopened) {
        // Disciplined tight range (~12-15% VPIP) that RAISES what it plays (PFR ~11-14%, 0% open-limp!)
        const nitOpenCut =
          heroPos === 'UTG'
            ? 0.66
            : heroPos === 'HJ'
              ? 0.62
              : heroPos === 'CO'
                ? 0.58
                : 0.52;
        if (rawStr >= nitOpenCut && gto.raise > 0) {
          return { raise: 100, call: 0, fold: 0 };
        }
        if (rawStr >= nitOpenCut - 0.03 && gto.raise >= 50) {
          return { raise: 55, call: 0, fold: 45 };
        }
        return { raise: 0, call: 0, fold: 100 };
      }
      if (preflopRaiseCount === 0 && limperCount > 0) {
        if (canCheck) {
          return rawStr >= 0.75 ? { raise: 85, call: 15, fold: 0 } : { raise: 0, call: 100, fold: 0 };
        }
        return rawStr >= 0.65 ? { raise: 90, call: 0, fold: 10 } : { raise: 0, call: 0, fold: 100 };
      }
      if (preflopRaiseCount === 1) {
        // 3-bet only premiums (~3.5-5%), flat very tightly
        if (rawStr >= 0.82) return { raise: 95, call: 5, fold: 0 };
        if (rawStr >= 0.76) return { raise: 45, call: 55, fold: 0 };
        const flatCut = heroPos === 'BB' ? 0.58 : 0.65;
        if (rawStr >= flatCut && (gto.call > 0 || gto.raise > 0)) {
          return { raise: 0, call: 75, fold: 25 };
        }
        return { raise: 0, call: 0, fold: 100 };
      }
      if (preflopRaiseCount === 2) {
        if (rawStr >= 0.90) return { raise: 80, call: 20, fold: 0 };
        if (rawStr >= 0.80) return { raise: 10, call: 75, fold: 15 };
        return { raise: 0, call: 0, fold: 100 };
      }
      // Facing 4-bet+
      if (rawStr >= 0.94) return { raise: 80, call: 20, fold: 0 };
      if (rawStr >= 0.88) return { raise: 10, call: 65, fold: 25 };
      return { raise: 0, call: 0, fold: 100 };
    }

    case 'Maniac': {
      if (isUnopened) {
        // Wide hyper-aggressive opens (~50-56% VPIP, ~40-45% PFR), folds worst pure garbage
        const maniacCut =
          heroPos === 'UTG'
            ? 0.42
            : heroPos === 'HJ'
              ? 0.36
              : heroPos === 'CO'
                ? 0.30
                : 0.24;
        if (gto.raise >= 50 || rawStr >= maniacCut + 0.06) {
          return { raise: 96, call: 2, fold: 2 };
        }
        if (rawStr >= maniacCut || isPair || (isSuited && rawStr >= maniacCut - 0.03)) {
          return { raise: 65, call: 8, fold: 27 };
        }
        return { raise: 5, call: 0, fold: 95 };
      }
      if (preflopRaiseCount === 0 && limperCount > 0) {
        if (canCheck) {
          return rawStr >= 0.42 ? { raise: 75, call: 25, fold: 0 } : { raise: 25, call: 75, fold: 0 };
        }
        if (rawStr >= 0.38) return { raise: 78, call: 12, fold: 10 };
        return { raise: 12, call: 25, fold: 63 };
      }
      if (preflopRaiseCount === 1) {
        // Aggressive 3-betting (~20-25%) with blockers + speculative hands, folds bottom garbage
        if (rawStr >= 0.70 || gto.raise >= 50) return { raise: 82, call: 18, fold: 0 };
        if (isBlocker || (isSuited && rawStr >= 0.48)) return { raise: 45, call: 38, fold: 17 };
        if (rawStr >= (heroPos === 'BB' ? 0.33 : 0.41)) {
          return { raise: 18, call: 52, fold: 30 };
        }
        return { raise: 5, call: 10, fold: 85 };
      }
      if (preflopRaiseCount === 2) {
        // Active 4-betting, calls wide, folds worst air
        if (rawStr >= 0.78) return { raise: 72, call: 28, fold: 0 };
        if (isBlocker || rawStr >= 0.58) return { raise: 28, call: 45, fold: 27 };
        if (rawStr >= 0.44) return { raise: 10, call: 35, fold: 55 };
        return { raise: 4, call: 5, fold: 91 };
      }
      // Facing 4-bet+
      if (rawStr >= 0.76) return { raise: 65, call: 35, fold: 0 };
      if (rawStr >= 0.58) return { raise: 15, call: 40, fold: 45 };
      return { raise: 0, call: 5, fold: 95 };
    }
  }
}

function pickPreflopRaiseSize(
  state: PokerTableState,
  seat: TableSeat,
  ctx: PreflopSpotContext,
  legal: LegalActions,
  archetype: BotArchetype,
  rng: () => number
): number {
  const jitter = (rng() - 0.5) * 0.2;
  let target: number;

  if (state.preflopRaiseCount === 0) {
    if (ctx.limperCount > 0) {
      // ISO-raise over limpers: 3bb + 1bb per limper (+0.5bb OOP)
      const oopBonus = seat.position === 'SB' || seat.position === 'BB' ? 0.5 : 0;
      target = 3.0 + ctx.limperCount * 1.0 + oopBonus;
    } else if (seat.position === 'SB') {
      target = 3.0;
    } else if (state.config.tableSize === 2) {
      target = 2.2;
    } else if (seat.position === 'BTN') {
      target = archetype === 'Maniac' ? 2.8 : 2.3;
    } else {
      target = archetype === 'Maniac' ? 3.0 : 2.5;
    }
  } else if (state.preflopRaiseCount === 1) {
    // 3-Bet sizing: IP ~3.0x, OOP ~4.0x, +1.0x per cold caller (squeeze)
    const isOop = seat.position === 'SB' || seat.position === 'BB';
    const baseMult = isOop ? 3.9 : 3.0;
    const squeezeAdd = ctx.coldCallerCount * 1.0;
    const maniacBump = archetype === 'Maniac' ? 0.4 : 0;
    target = state.currentBetBb * (baseMult + squeezeAdd + maniacBump + jitter);
  } else if (state.preflopRaiseCount === 2) {
    // 4-Bet sizing: IP ~2.25x, OOP ~2.5x
    const isOop = seat.position === 'SB' || seat.position === 'BB';
    const mult = (isOop ? 2.5 : 2.25) + jitter * 0.5;
    target = state.currentBetBb * mult;
  } else {
    // 5-Bet+ -> Jam All-In!
    target = legal.maxTotalBetBb;
  }

  target = roundHalfBb(target);
  // SPR / Stack commitment: if raise consumes >= 46% of max commit (or leaves < 28% behind), jam cleanly!
  if (target >= legal.maxTotalBetBb * 0.46) {
    target = legal.maxTotalBetBb;
  }
  return roundBbLocal(clamp(target, legal.minTotalBetBb, legal.maxTotalBetBb));
}

// ---------------------------------------------------------------------------
// 4. Multi-Street Postflop Context Tracker (derived from state.actionLog)
// ---------------------------------------------------------------------------

export interface PostflopContext {
  street: Exclude<Street, 'preflop'>;
  contenders: number;
  isMultiway: boolean;
  isInPosition: boolean; // Acts last among all active non-folded contenders
  isIpVsAggressor: boolean; // Acts after the primary aggressor
  wasPfr: boolean;
  preflopPotType: 'limped' | 'srp' | '3bp' | '4bp';
  pfrCheckedFlop: boolean;
  flopCheckedThrough: boolean;
  turnCheckedThrough: boolean;
  heroBarreledFlop: boolean;
  heroBarreledTurn: boolean;
  heroCheckedThisStreet: boolean;
  facingDonk: boolean;
  facingCheckRaise: boolean;
  streetRaiseCount: number;
  lastAggressorSeatIndex: number | null;
  lastAggressorArchetype: BotArchetype | 'Hero' | null;
  hasCallingStationOpponent: boolean;
  effectiveStackBb: number;
  effectiveSpr: number;
  facingBetFracOfPot: number;
}

function postflopOrderRank(seatIndex: number, buttonSeatIndex: number, tableSize: number): number {
  // Postflop order starts left of button (offset 1 = earliest OOP, offset 0 = BTN = latest IP)
  const offset = (seatIndex - buttonSeatIndex + tableSize) % tableSize;
  return offset === 0 ? tableSize : offset;
}

export function extractPostflopContext(
  state: PokerTableState,
  seatIndex: number,
  effectivePotBb?: number,
  effectiveToCall?: number
): PostflopContext {
  const street: Exclude<Street, 'preflop'> =
    state.phase === 'FLOP' ? 'flop' : state.phase === 'TURN' ? 'turn' : 'river';
  const seat = state.seats[seatIndex];
  const active = state.seats.filter((s) => !s.folded);
  const contenders = active.length;
  const isMultiway = contenders >= 3;
  const tableSize = state.config.tableSize;

  const posBySeat = new Map<Position, TableSeat>();
  for (const s of state.seats) posBySeat.set(s.position, s);

  const actorOrder = postflopOrderRank(seatIndex, state.buttonSeatIndex, tableSize);
  const maxActiveOrder = Math.max(
    ...active.map((s) => postflopOrderRank(s.seatIndex, state.buttonSeatIndex, tableSize))
  );
  const isInPosition = actorOrder === maxActiveOrder;

  const wasPfr = state.preflopAggressorSeatIndex === seatIndex;
  const pfrPos =
    state.preflopAggressorSeatIndex !== null
      ? state.seats[state.preflopAggressorSeatIndex]?.position ?? null
      : null;

  const preflopPotType: PostflopContext['preflopPotType'] =
    state.preflopRaiseCount === 0
      ? 'limped'
      : state.preflopRaiseCount === 1
        ? 'srp'
        : state.preflopRaiseCount === 2
          ? '3bp'
          : '4bp';

  const isAggKind = (k?: string) =>
    k === 'bet' || k === 'raise' || k === 'three_bet' || k === 'four_bet' || k === 'all_in';

  let flopHasBet = false;
  let turnHasBet = false;
  let pfrCheckedFlop = false;
  let pfrBetFlop = false;
  let heroBarreledFlop = false;
  let heroBarreledTurn = false;
  let heroBetThisStreet = false;
  let heroCheckedThisStreet = false;
  let streetRaiseCount = 0;
  let lastAggressorSeatIndex: number | null = null;
  let firstFlopAggSeatIndex: number | null = null;

  for (const log of state.actionLog) {
    const kind = log.actionSpec?.kind;
    const logSeat = posBySeat.get(log.position);
    const logIdx = logSeat?.seatIndex ?? -1;

    if (log.street === 'flop') {
      if (isAggKind(kind)) {
        flopHasBet = true;
        if (firstFlopAggSeatIndex === null) firstFlopAggSeatIndex = logIdx;
        if (logIdx === seatIndex) heroBarreledFlop = true;
        if (pfrPos && log.position === pfrPos) pfrBetFlop = true;
      } else if (kind === 'check') {
        if (pfrPos && log.position === pfrPos && !pfrBetFlop) {
          pfrCheckedFlop = true;
        }
      }
    }

    if (log.street === 'turn') {
      if (isAggKind(kind)) {
        turnHasBet = true;
        if (logIdx === seatIndex) heroBarreledTurn = true;
      }
    }

    if (log.street === street) {
      if (isAggKind(kind)) {
        streetRaiseCount++;
        if (logIdx >= 0) lastAggressorSeatIndex = logIdx;
        if (logIdx === seatIndex) heroBetThisStreet = true;
      } else if (kind === 'check' && logIdx === seatIndex) {
        heroCheckedThisStreet = true;
      }
    }
  }

  // Fallback aggressor if none on current street yet: previous street aggressor or PFR
  if (lastAggressorSeatIndex === null) {
    for (let i = state.actionLog.length - 1; i >= 0; i--) {
      const log = state.actionLog[i];
      if (log.street === 'preflop') break;
      if (isAggKind(log.actionSpec?.kind)) {
        const logSeat = posBySeat.get(log.position);
        if (logSeat && !logSeat.folded) {
          lastAggressorSeatIndex = logSeat.seatIndex;
          break;
        }
      }
    }
  }
  if (
    lastAggressorSeatIndex === null &&
    state.preflopAggressorSeatIndex !== null &&
    !state.seats[state.preflopAggressorSeatIndex]?.folded
  ) {
    lastAggressorSeatIndex = state.preflopAggressorSeatIndex;
  }

  const aggressorOrder =
    lastAggressorSeatIndex !== null
      ? postflopOrderRank(lastAggressorSeatIndex, state.buttonSeatIndex, tableSize)
      : -1;
  const isIpVsAggressor =
    lastAggressorSeatIndex !== null && lastAggressorSeatIndex !== seatIndex
      ? actorOrder > aggressorOrder
      : isInPosition;

  const flopLogsExist = state.actionLog.some((l) => l.street === 'flop');
  const turnLogsExist = state.actionLog.some((l) => l.street === 'turn');
  const flopCheckedThrough = flopLogsExist && !flopHasBet;
  const turnCheckedThrough = turnLogsExist && !turnHasBet;

  const facingDonk =
    street === 'flop' &&
    wasPfr &&
    streetRaiseCount === 1 &&
    firstFlopAggSeatIndex !== null &&
    firstFlopAggSeatIndex !== seatIndex;

  const facingCheckRaise =
    heroBetThisStreet &&
    streetRaiseCount >= 2 &&
    lastAggressorSeatIndex !== null &&
    lastAggressorSeatIndex !== seatIndex;

  // Effective stack & SPR
  const otherStacks = active
    .filter((s) => s.seatIndex !== seatIndex)
    .map((s) => s.stackBb + s.streetBetBb);
  const maxOppCommit = otherStacks.length > 0 ? Math.max(...otherStacks) : seat.stackBb;
  const heroTotalAvail = seat.stackBb + seat.streetBetBb;
  const effectiveStackBb = Math.max(0, roundBbLocal(Math.min(heroTotalAvail, maxOppCommit) - seat.streetBetBb));

  const callAmt = effectiveToCall ?? Math.max(0, state.currentBetBb - seat.streetBetBb);
  const effPot = effectivePotBb ?? state.potBb;
  const potBeforeBet = Math.max(1, effPot - callAmt);
  const effectiveSpr = effectiveStackBb / potBeforeBet;
  const facingBetFracOfPot = callAmt > 0 ? callAmt / potBeforeBet : 0;

  const lastAggressorArchetype =
    lastAggressorSeatIndex !== null
      ? state.seats[lastAggressorSeatIndex]?.archetype ?? null
      : null;
  const hasCallingStationOpponent = active.some(
    (s) => s.seatIndex !== seatIndex && s.archetype === 'Calling Station'
  );

  return {
    street,
    contenders,
    isMultiway,
    isInPosition,
    isIpVsAggressor,
    wasPfr,
    preflopPotType,
    pfrCheckedFlop,
    flopCheckedThrough,
    turnCheckedThrough,
    heroBarreledFlop,
    heroBarreledTurn,
    heroCheckedThisStreet,
    facingDonk,
    facingCheckRaise,
    streetRaiseCount,
    lastAggressorSeatIndex,
    lastAggressorArchetype,
    hasCallingStationOpponent,
    effectiveStackBb,
    effectiveSpr,
    facingBetFracOfPot,
  };
}

// ---------------------------------------------------------------------------
// 5. Postflop Hand Bucketing & Realistic Range-Equity Estimation
// ---------------------------------------------------------------------------

export type PostflopHandBucket =
  | 'nuts_strong_value'
  | 'strong_one_pair'
  | 'medium_showdown'
  | 'weak_showdown'
  | 'strong_draw'
  | 'medium_draw'
  | 'weak_draw_overcards'
  | 'pure_air';

export interface PostflopHandEval {
  rawStrength: number;
  bucket: PostflopHandBucket;
  category: HandCategory;
  isRealPairOrBetter: boolean;
  isAceHigh: boolean;
  estEquity: number; // Realistic estimated equity vs villain's betting/continuing range (0.03..0.96)
}

export function classifyAndEstimatePostflop(
  hole: [Card, Card],
  board: Card[],
  texture: BoardTexture,
  draws: HeroDrawInfo,
  ctx: PostflopContext
): PostflopHandEval {
  const rawStrength = handStrengthScore(hole, board);
  const evalRes = evaluateHand([...hole, ...board]);
  const v1 = RANK_VALUE[hole[0].rank];
  const v2 = RANK_VALUE[hole[1].rank];
  const hiHole = Math.max(v1, v2);
  const isAceHigh = hiHole === 14;

  // Check if Hero has an actual made pair (not just board pair/double-pair/board-trips)
  const boardCounts = new Map<number, number>();
  for (const c of board) {
    const r = RANK_VALUE[c.rank];
    boardCounts.set(r, (boardCounts.get(r) ?? 0) + 1);
  }
  const boardOnly = board.length >= 5 ? evaluateHand(board) : null;
  const playingBoardOnly = boardOnly !== null && evalRes.score === boardOnly.score;

  let isRealPairOrBetter = false;
  if (!playingBoardOnly) {
    if (evalRes.category >= HandCategory.Straight) {
      isRealPairOrBetter = true;
    } else if (evalRes.category === HandCategory.ThreeOfAKind) {
      isRealPairOrBetter = (boardCounts.get(evalRes.tiebreakers[0]) ?? 0) < 3;
    } else if (evalRes.category === HandCategory.TwoPair) {
      const bHi = (boardCounts.get(evalRes.tiebreakers[0]) ?? 0) >= 2;
      const bLo = (boardCounts.get(evalRes.tiebreakers[1]) ?? 0) >= 2;
      isRealPairOrBetter = !(bHi && bLo);
    } else if (evalRes.category === HandCategory.OnePair) {
      isRealPairOrBetter = (boardCounts.get(evalRes.tiebreakers[0]) ?? 0) < 2;
    }
  }

  // Classify hand into strategic bucket
  let bucket: PostflopHandBucket;
  if (rawStrength >= 0.72 && isRealPairOrBetter) {
    bucket = 'nuts_strong_value';
  } else if (rawStrength >= 0.59 && isRealPairOrBetter) {
    bucket = 'strong_one_pair';
  } else if (rawStrength >= 0.44 && isRealPairOrBetter) {
    bucket = 'medium_showdown';
  } else if (isRealPairOrBetter && rawStrength >= 0.30) {
    bucket = 'weak_showdown';
  } else if (
    ctx.street !== 'river' &&
    (draws.comboDraw || draws.nutFlushDraw || (draws.flushDraw && draws.overcards >= 1) || (draws.oesd && draws.overcards >= 1))
  ) {
    bucket = 'strong_draw';
  } else if (
    ctx.street !== 'river' &&
    (draws.flushDraw || draws.oesd || (draws.gutshot && draws.overcards >= 2))
  ) {
    bucket = 'medium_draw';
  } else if (
    ctx.street !== 'river' &&
    (draws.gutshot || (draws.overcards === 2 && draws.backdoorFlushDraw) || (draws.overcards === 2 && ctx.street === 'flop'))
  ) {
    bucket = 'weak_draw_overcards';
  } else if (isRealPairOrBetter) {
    bucket = 'weak_showdown';
  } else if (isAceHigh && hiHole === 14 && Math.min(v1, v2) >= 10 && !texture.isFourFlush && !texture.isFourStraight) {
    bucket = 'weak_showdown';
  } else {
    bucket = 'pure_air';
  }

  // Realistic range-equity estimation (NOT raw heuristic score!)
  let estEquity: number;
  switch (bucket) {
    case 'nuts_strong_value':
      estEquity = clamp(0.76 + (rawStrength - 0.72) * 0.78, 0.74, 0.96);
      break;
    case 'strong_one_pair':
      estEquity = clamp(0.56 + (rawStrength - 0.59) * 1.15, 0.54, 0.74);
      break;
    case 'medium_showdown':
      estEquity = clamp(0.36 + (rawStrength - 0.44) * 1.15, 0.34, 0.54);
      break;
    case 'weak_showdown':
      if (isRealPairOrBetter) {
        estEquity = clamp(0.24 + (rawStrength - 0.25) * 0.65, 0.22, 0.38);
      } else {
        // Ace-high (AT+)
        estEquity = ctx.street === 'river' ? 0.17 : 0.24;
      }
      break;
    case 'strong_draw':
      estEquity = ctx.street === 'flop' ? 0.44 + (draws.comboDraw ? 0.12 : 0) : 0.27 + (draws.comboDraw ? 0.08 : 0);
      break;
    case 'medium_draw':
      estEquity = ctx.street === 'flop' ? 0.33 : 0.20;
      break;
    case 'weak_draw_overcards':
      estEquity = ctx.street === 'flop' ? 0.23 : 0.13;
      break;
    case 'pure_air':
    default:
      // Pure air has near-zero showdown equity vs a betting range (especially on the river!)
      if (ctx.street === 'river') {
        estEquity = isAceHigh ? 0.11 : 0.03 + (hiHole / 14) * 0.03; // 7-high -> ~0.045 (4.5%)!
      } else {
        estEquity = 0.06 + draws.drawEquityBoost * 0.65;
      }
      break;
  }

  // Add draw equity for pair + draw combos (e.g. Middle Pair + Flush Draw on flop!)
  if (isRealPairOrBetter && ctx.street !== 'river' && draws.drawEquityBoost > 0) {
    estEquity = Math.min(0.92, estEquity + draws.drawEquityBoost * 0.65);
  }

  // Context adjustments when facing aggression
  if (ctx.streetRaiseCount >= 2) {
    // Facing a raise / check-raise narrows villain to a very strong polarized range
    if (bucket === 'strong_one_pair') estEquity -= 0.14;
    else if (bucket === 'medium_showdown' || bucket === 'weak_showdown') estEquity -= 0.18;
    else if (bucket === 'nuts_strong_value' && rawStrength < 0.84) estEquity -= 0.08;
  } else if (ctx.streetRaiseCount === 1) {
    // Large bets / overbets narrow villain's value threshold
    if (ctx.facingBetFracOfPot >= 1.0 && bucket !== 'nuts_strong_value') {
      estEquity -= 0.08;
    } else if (ctx.facingBetFracOfPot >= 0.7 && (bucket === 'medium_showdown' || bucket === 'weak_showdown')) {
      estEquity -= 0.05;
    }
    // River bets are inherently stronger than flop c-bets
    if (ctx.street === 'river' && bucket !== 'nuts_strong_value') {
      estEquity -= 0.06;
    }
  }

  // Multiway discount (harder for one-pair hands to hold up against 2+ opponents)
  if (ctx.isMultiway && bucket !== 'nuts_strong_value') {
    estEquity -= 0.06 * (ctx.contenders - 2);
  }

  // Villain archetype read (slight equity adjustment vs tight/wild ranges)
  if (ctx.streetRaiseCount >= 1) {
    if (ctx.lastAggressorArchetype === 'Tight Nit') estEquity -= 0.06;
    else if (ctx.lastAggressorArchetype === 'Maniac') estEquity += 0.08;
    else if (ctx.lastAggressorArchetype === 'Loose-Aggressive') estEquity += 0.03;
  }

  return {
    rawStrength,
    bucket,
    category: evalRes.category,
    isRealPairOrBetter,
    isAceHigh,
    estEquity: clamp(estEquity, 0.03, 0.96),
  };
}

// ---------------------------------------------------------------------------
// 6. Unexploitable SPR-Aware Postflop Sizing Tree (NO strength tells!)
// ---------------------------------------------------------------------------

type BetSizeIntent = 'range_small' | 'standard' | 'large' | 'overbet' | 'block';

function pickPostflopBetSize(
  state: PokerTableState,
  legal: LegalActions,
  texture: BoardTexture,
  ctx: PostflopContext,
  intent: BetSizeIntent,
  archetype: BotArchetype,
  rng: () => number
): number {
  const jitter = (rng() - 0.5) * 0.08; // +-4% pot jitter
  let potFrac: number;

  if (intent === 'block') {
    potFrac = 0.32 + jitter * 0.5;
  } else if (intent === 'overbet') {
    potFrac = (archetype === 'Maniac' ? 1.32 : 1.20) + jitter;
  } else if (intent === 'range_small') {
    potFrac = 0.32 + jitter * 0.5;
  } else if (intent === 'large') {
    potFrac = (archetype === 'Maniac' ? 0.82 : 0.70) + jitter;
  } else {
    // Texture + street bound sizing (identical for value & bluffs -> kills the 0.72 tell!)
    if (ctx.street === 'flop') {
      if (texture.wetness < 0.34 && ctx.wasPfr && !ctx.isMultiway) {
        potFrac = 0.33 + jitter * 0.5;
      } else if (texture.wetness >= 0.52) {
        potFrac = 0.64 + jitter;
      } else {
        potFrac = 0.48 + jitter;
      }
    } else if (ctx.street === 'turn') {
      potFrac = (texture.wetness >= 0.45 ? 0.70 : 0.62) + jitter;
    } else {
      potFrac = 0.70 + jitter;
    }
    if (archetype === 'Maniac') potFrac += 0.14;
    if (archetype === 'Calling Station') potFrac = Math.min(potFrac, 0.55);
  }

  let target = roundHalfBb(Math.max(1.0, state.potBb * potFrac));

  // SPR commitment: auto-jam if bet uses >= 62% of remaining stack (no silly 3bb stubs!)
  if (target >= legal.maxTotalBetBb * 0.62 || ctx.effectiveSpr <= 0.65) {
    target = legal.maxTotalBetBb;
  }
  return roundBbLocal(clamp(target, legal.minTotalBetBb, legal.maxTotalBetBb));
}

function pickPostflopRaiseSize(
  state: PokerTableState,
  legal: LegalActions,
  ctx: PostflopContext,
  archetype: BotArchetype,
  rng: () => number
): number {
  const jitter = (rng() - 0.5) * 0.25;
  const mult = (ctx.isIpVsAggressor ? 2.95 : 3.65) + (archetype === 'Maniac' ? 0.45 : 0) + jitter;
  // Scale to pot as well so raising a tiny 1bb min-bet into a 20bb pot is meaningful!
  const multTarget = state.currentBetBb * mult;
  const potFloorTarget = state.currentBetBb + Math.max(state.potBb * 0.52, state.currentBetBb * 1.4);
  let target = roundHalfBb(Math.max(multTarget, potFloorTarget));

  // SPR commitment: auto-jam if target >= 62% of max commit or SPR <= 0.85
  if (target >= legal.maxTotalBetBb * 0.62 || ctx.effectiveSpr <= 0.85) {
    target = legal.maxTotalBetBb;
  }
  return roundBbLocal(clamp(target, legal.minTotalBetBb, legal.maxTotalBetBb));
}

// ---------------------------------------------------------------------------
// 7. Postflop Archetype Policy Parameters (Cleanly Separated — ZERO Double-Counting!)
// ---------------------------------------------------------------------------

interface PostflopArchetypeConfig {
  cbetBias: number; // Additive shift to flop c-bet probability
  barrelBias: number; // Additive shift to turn/river barrel probability
  donkFreq: number; // Base OOP non-PFR flop donk frequency
  raiseAggression: number; // Multiplier on value-raise & semi-bluff-raise frequencies
  riverBluffScale: number; // Multiplier on optimal river bluff ratio
  callEquitySlack: number; // Single clean offset to reqEq (positive = tighter folds, negative = looser calls)
  pureAirFoldGuard: boolean; // Prevents calling big river bets with 7-high pure air
}

const POSTFLOP_ARCHETYPE_CONFIG: Record<BotArchetype, PostflopArchetypeConfig> = {
  'Balanced Reg': {
    cbetBias: 0.07,
    barrelBias: 0.03,
    donkFreq: 0.025,
    raiseAggression: 1.0,
    riverBluffScale: 1.35,
    callEquitySlack: 0.035,
    pureAirFoldGuard: true,
  },
  'Tight-Aggressive': {
    cbetBias: 0.09,
    barrelBias: 0.0,
    donkFreq: 0.02,
    raiseAggression: 0.92,
    riverBluffScale: 0.90,
    callEquitySlack: 0.055,
    pureAirFoldGuard: true,
  },
  'Loose-Aggressive': {
    cbetBias: 0.16,
    barrelBias: 0.14,
    donkFreq: 0.07,
    raiseAggression: 1.32,
    riverBluffScale: 1.75,
    callEquitySlack: 0.015,
    pureAirFoldGuard: true,
  },
  'Calling Station': {
    cbetBias: -0.14,
    barrelBias: -0.22,
    donkFreq: 0.08,
    raiseAggression: 0.25,
    riverBluffScale: 0.08,
    callEquitySlack: -0.21,
    pureAirFoldGuard: true, // Calls down wide with any pair/Ace-high, STILL folds 7-high pure air to big bets!
  },
  'Tight Nit': {
    cbetBias: 0.03,
    barrelBias: -0.10,
    donkFreq: 0.01,
    raiseAggression: 0.62,
    riverBluffScale: 0.28,
    callEquitySlack: 0.155,
    pureAirFoldGuard: true,
  },
  Maniac: {
    cbetBias: 0.34,
    barrelBias: 0.28,
    donkFreq: 0.24,
    raiseAggression: 2.15,
    riverBluffScale: 2.15,
    callEquitySlack: -0.09,
    pureAirFoldGuard: true, // Aggressive & sticky, yet still folds worst pure air to big bets when not raising!
  },
};

// ---------------------------------------------------------------------------
// 8. Main Postflop Decision Engine
// ---------------------------------------------------------------------------

function decidePostflopBotAction(
  state: PokerTableState,
  seat: TableSeat,
  legal: LegalActions,
  effectivePotOdds: { effectiveToCall: number; effectivePotBb: number; reqEq: number },
  archetype: BotArchetype,
  rng: () => number
): { type: 'fold' | 'check' | 'call' | 'raise'; raiseToBb?: number } {
  const hole = seat.cards!;
  const texture = analyzeBoardTexture(state.board);
  const draws = analyzeHeroDraws(hole, state.board);
  const ctx = extractPostflopContext(
    state,
    seat.seatIndex,
    effectivePotOdds.effectivePotBb,
    effectivePotOdds.effectiveToCall
  );
  const hand = classifyAndEstimatePostflop(hole, state.board, texture, draws, ctx);
  const cfg = POSTFLOP_ARCHETYPE_CONFIG[archetype];

  // =========================================================================
  // CASE A: Checked to Bot (legal.canCheck)
  // =========================================================================
  if (legal.canCheck) {
    if (!legal.canBetOrRaise) return { type: 'check' };

    // ----- FLOP -----
    if (ctx.street === 'flop') {
      // 1. OOP non-PFR: disciplined checking to the PFR (~88-96% check!)
      if (!ctx.wasPfr && !ctx.isInPosition && state.preflopAggressorSeatIndex !== null) {
        const lowConnectedFavorsBb = texture.rangeAdvForPfr <= -0.30;
        let donkProb = cfg.donkFreq * (lowConnectedFavorsBb ? 2.4 : 0.65);
        if (hand.bucket === 'nuts_strong_value' || hand.bucket === 'strong_draw') {
          donkProb *= 1.6;
        } else if (hand.bucket === 'medium_showdown' || hand.bucket === 'weak_showdown') {
          donkProb *= 0.35;
        }
        if (ctx.isMultiway) donkProb *= 0.55;
        if (rng() < clamp(donkProb, 0, 0.45)) {
          return {
            type: 'raise',
            raiseToBb: pickPostflopBetSize(state, legal, texture, ctx, 'standard', archetype, rng),
          };
        }
        return { type: 'check' };
      }

      // 2. PFR C-Bet Decision (texture + range advantage + multiway aware!)
      if (ctx.wasPfr) {
        const isDryRangeAdv = texture.wetness < 0.38 && texture.rangeAdvForPfr >= 0.20;
        let cbetProb: number;
        let intent: BetSizeIntent = 'standard';

        if (isDryRangeAdv && !ctx.isMultiway) {
          // Dry A/K/Q-high board HU: high-frequency small range c-bet (identical sizing for nuts & bluffs!)
          intent = 'range_small';
          if (hand.bucket === 'nuts_strong_value') cbetProb = 0.80;
          else if (hand.bucket === 'strong_one_pair') cbetProb = 0.84;
          else if (hand.bucket === 'medium_showdown') cbetProb = 0.55;
          else if (hand.bucket === 'weak_showdown') cbetProb = 0.52;
          else if (hand.bucket === 'strong_draw' || hand.bucket === 'medium_draw') cbetProb = 0.82;
          else if (hand.bucket === 'weak_draw_overcards') cbetProb = 0.72;
          else cbetProb = 0.56;
        } else if (texture.wetness >= 0.50) {
          // Wet / connected / monotone board: polarized medium-large sizing
          intent = 'large';
          if (hand.bucket === 'nuts_strong_value') cbetProb = 0.86;
          else if (hand.bucket === 'strong_one_pair') cbetProb = 0.68;
          else if (hand.bucket === 'strong_draw') cbetProb = 0.82;
          else if (hand.bucket === 'medium_draw') cbetProb = 0.58;
          else if (hand.bucket === 'medium_showdown' || hand.bucket === 'weak_showdown') cbetProb = 0.22;
          else cbetProb = 0.16;
        } else {
          // Neutral board
          intent = 'standard';
          if (hand.bucket === 'nuts_strong_value') cbetProb = 0.84;
          else if (hand.bucket === 'strong_one_pair') cbetProb = 0.78;
          else if (hand.bucket === 'strong_draw') cbetProb = 0.78;
          else if (hand.bucket === 'medium_draw') cbetProb = 0.62;
          else if (hand.bucket === 'weak_draw_overcards') cbetProb = 0.50;
          else if (hand.bucket === 'medium_showdown') cbetProb = 0.36;
          else if (hand.bucket === 'weak_showdown') cbetProb = 0.28;
          else cbetProb = 0.32;
        }

        // Multiway c-bet tightening
        if (ctx.isMultiway) {
          if (hand.bucket === 'nuts_strong_value' || hand.bucket === 'strong_draw') cbetProb *= 0.92;
          else if (hand.bucket === 'strong_one_pair') cbetProb *= 0.78;
          else cbetProb *= 0.32;
        }

        cbetProb = clamp(cbetProb + cfg.cbetBias, 0.02, 0.96);
        if (rng() < cbetProb) {
          return {
            type: 'raise',
            raiseToBb: pickPostflopBetSize(state, legal, texture, ctx, intent, archetype, rng),
          };
        }
        return { type: 'check' };
      }

      // 3. IP non-PFR when PFR checked (or limped pot) -> stab/float-bet
      let stabProb: number;
      if (hand.bucket === 'nuts_strong_value') stabProb = 0.82;
      else if (hand.bucket === 'strong_one_pair') stabProb = 0.70;
      else if (hand.bucket === 'strong_draw') stabProb = 0.74;
      else if (hand.bucket === 'medium_draw') stabProb = 0.52;
      else if (hand.bucket === 'medium_showdown' || hand.bucket === 'weak_showdown') stabProb = 0.18;
      else stabProb = 0.28;
      if (ctx.isMultiway) stabProb *= 0.55;
      stabProb = clamp(stabProb + cfg.cbetBias * 0.7, 0.02, 0.92);
      if (rng() < stabProb) {
        return {
          type: 'raise',
          raiseToBb: pickPostflopBetSize(state, legal, texture, ctx, 'standard', archetype, rng),
        };
      }
      return { type: 'check' };
    }

    // ----- TURN -----
    if (ctx.street === 'turn') {
      const canDoubleBarrel = ctx.heroBarreledFlop;
      const canProbeOrDelay = ctx.flopCheckedThrough;
      let betProb: number;
      let intent: BetSizeIntent = 'standard';

      // Overbet polarized turn spot on brick turns when PFR has nut advantage
      const overbetSpot =
        canDoubleBarrel &&
        !ctx.isMultiway &&
        ctx.effectiveSpr >= 1.4 &&
        texture.wetness < 0.55 &&
        archetype !== 'Calling Station' &&
        archetype !== 'Tight Nit';

      if (hand.bucket === 'nuts_strong_value') {
        betProb = 0.88;
        if (overbetSpot && rng() < 0.35) intent = 'overbet';
      } else if (hand.bucket === 'strong_one_pair') {
        betProb = canDoubleBarrel ? 0.74 : canProbeOrDelay ? 0.72 : 0.55;
      } else if (hand.bucket === 'strong_draw') {
        betProb = canDoubleBarrel ? 0.76 : 0.64;
        if (overbetSpot && draws.nutFlushDraw && rng() < 0.30) intent = 'overbet';
      } else if (hand.bucket === 'medium_draw') {
        betProb = canDoubleBarrel ? 0.48 : 0.44;
      } else if (hand.bucket === 'medium_showdown') {
        // Pot control medium pairs on turn!
        betProb = canProbeOrDelay ? 0.30 : 0.14;
      } else if (hand.bucket === 'weak_showdown') {
        betProb = canProbeOrDelay ? 0.18 : 0.08;
      } else {
        // Air / weak overcards: mostly give up unless delayed c-betting or Maniac/LAG
        const blockerBonus = draws.hasNutFlushBlocker || draws.hasStraightBlocker ? 0.14 : 0;
        betProb = (canProbeOrDelay ? 0.24 : 0.12) + blockerBonus;
      }

      if (ctx.isMultiway && hand.bucket !== 'nuts_strong_value') {
        betProb *= 0.5;
      }
      betProb = clamp(betProb + cfg.barrelBias, 0.02, 0.95);
      if (rng() < betProb) {
        return {
          type: 'raise',
          raiseToBb: pickPostflopBetSize(state, legal, texture, ctx, intent, archetype, rng),
        };
      }
      return { type: 'check' };
    }

    // ----- RIVER (Strictly Polarized: Value vs Blocker/Missed-Draw Bluffs; Medium Pairs Check!) -----
    if (hand.bucket === 'nuts_strong_value') {
      const useOverbet =
        !ctx.isMultiway &&
        ctx.effectiveSpr >= 1.2 &&
        hand.rawStrength >= 0.84 &&
        archetype !== 'Calling Station' &&
        rng() < 0.35;
      const betProb = clamp(0.90 + cfg.barrelBias * 0.3, 0.65, 0.98);
      if (rng() < betProb) {
        return {
          type: 'raise',
          raiseToBb: pickPostflopBetSize(
            state,
            legal,
            texture,
            ctx,
            useOverbet ? 'overbet' : 'large',
            archetype,
            rng
          ),
        };
      }
      return { type: 'check' };
    }

    if (hand.bucket === 'strong_one_pair') {
      // Thin value bet (smaller block-bet or medium bet), checks more multiway or on 4-flush/4-straight boards
      const scaryBoard = texture.isFourFlush || texture.isFourStraight;
      let valProb = scaryBoard ? 0.25 : ctx.isMultiway ? 0.42 : 0.68;
      if (ctx.hasCallingStationOpponent && !scaryBoard && archetype !== 'Calling Station') {
        valProb = Math.max(valProb, 0.92);
      }
      if (archetype === 'Calling Station') valProb = 0.42;
      if (rng() < clamp(valProb + cfg.barrelBias * 0.4, 0.1, 0.96)) {
        const intent: BetSizeIntent =
          ctx.isInPosition || scaryBoard || hand.rawStrength < 0.64 ? 'block' : 'standard';
        return {
          type: 'raise',
          raiseToBb: pickPostflopBetSize(state, legal, texture, ctx, intent, archetype, rng),
        };
      }
      return { type: 'check' };
    }

    if (hand.bucket === 'medium_showdown' || hand.bucket === 'weak_showdown') {
      // NEVER turn medium showdown pairs into random river bluffs!
      // Tiny thin block-bet only when checked through and top of medium showdown IP
      if (
        hand.bucket === 'medium_showdown' &&
        ctx.flopCheckedThrough &&
        ctx.turnCheckedThrough &&
        ctx.isInPosition &&
        !texture.isFourFlush &&
        rng() < 0.22
      ) {
        return {
          type: 'raise',
          raiseToBb: pickPostflopBetSize(state, legal, texture, ctx, 'block', archetype, rng),
        };
      }
      return { type: 'check' };
    }

    // Pure air on River: select bluffs prioritizing missed draws & nut blockers!
    const hasGreatBluffCandidate =
      draws.missedFlushDraw ||
      draws.missedStraightDraw ||
      draws.hasNutFlushBlocker ||
      draws.hasStraightBlocker;

    // Theoretical alpha for ~70% pot bet is 0.70 / 1.70 = 41% of betting range -> calibrated river bluff ratio
    let riverBluffProb: number;
    if (hasGreatBluffCandidate) {
      riverBluffProb = 0.56 * cfg.riverBluffScale;
    } else if (ctx.heroBarreledTurn || ctx.flopCheckedThrough) {
      riverBluffProb = 0.28 * cfg.riverBluffScale;
    } else {
      riverBluffProb = 0.16 * cfg.riverBluffScale;
    }
    if (ctx.isMultiway) riverBluffProb *= 0.35;
    if (
      (ctx.hasCallingStationOpponent || ctx.lastAggressorArchetype === 'Calling Station') &&
      archetype !== 'Maniac'
    ) {
      riverBluffProb *= 0.08;
    }

    if (rng() < clamp(riverBluffProb, 0, 0.78)) {
      const useOverbetBluff =
        draws.hasNutFlushBlocker &&
        !ctx.isMultiway &&
        ctx.effectiveSpr >= 1.2 &&
        archetype !== 'Calling Station' &&
        rng() < 0.30;
      return {
        type: 'raise',
        raiseToBb: pickPostflopBetSize(
          state,
          legal,
          texture,
          ctx,
          useOverbetBluff ? 'overbet' : 'large', // SAME size as strong value -> unexploitable!
          archetype,
          rng
        ),
      };
    }
    return { type: 'check' };
  }

  // =========================================================================
  // CASE B: Facing a Bet or Raise (!legal.canCheck)
  // =========================================================================
  const reqEq = effectivePotOdds.reqEq;

  // 1. Low-SPR commitment override: NEVER fold top pair+ at SPR <= 0.85 or getting > 3:1!
  const isCommittedTopPairPlus =
    (hand.bucket === 'nuts_strong_value' || hand.bucket === 'strong_one_pair') &&
    (ctx.effectiveSpr <= 0.85 || reqEq <= 0.24);
  if (isCommittedTopPairPlus) {
    if (
      legal.canBetOrRaise &&
      (hand.bucket === 'nuts_strong_value' || (ctx.effectiveSpr <= 0.7 && rng() < 0.65))
    ) {
      return { type: 'raise', raiseToBb: legal.maxTotalBetBb };
    }
    return { type: 'call' };
  }

  // 2. Raising / Check-Raising (Value + Semi-Bluffs + Calibrated River Blocker Bluff-Raises)
  if (legal.canBetOrRaise) {
    let raiseProb = 0;

    if (hand.bucket === 'nuts_strong_value') {
      // Value raise strong hands (slowplay occasionally IP on dry boards)
      const slowplayPenalty = ctx.isIpVsAggressor && texture.wetness < 0.30 && ctx.street !== 'river' ? 0.25 : 0;
      raiseProb = clamp((0.68 - slowplayPenalty) * cfg.raiseAggression, 0.12, 0.92);
      // Cap infinite min-raising wars unless holding near-nuts
      if (ctx.streetRaiseCount >= 2 && hand.rawStrength < 0.84) {
        raiseProb *= 0.25;
      }
    } else if (hand.bucket === 'strong_one_pair' && ctx.streetRaiseCount === 1 && ctx.street !== 'river') {
      // Occasional protection raise on wet boards / vs small bets
      if (texture.wetness >= 0.45 && ctx.facingBetFracOfPot <= 0.6) {
        raiseProb = 0.18 * cfg.raiseAggression;
      }
    } else if (hand.bucket === 'strong_draw' && ctx.street !== 'river' && ctx.streetRaiseCount === 1) {
      // Semi-bluff check-raise / raise with combo draws & nut flush draws
      raiseProb = 0.34 * cfg.raiseAggression;
    } else if (hand.bucket === 'medium_draw' && ctx.street === 'flop' && ctx.streetRaiseCount === 1) {
      raiseProb = 0.16 * cfg.raiseAggression;
    } else if (
      ctx.street === 'river' &&
      ctx.streetRaiseCount === 1 &&
      hand.bucket === 'pure_air' &&
      (draws.hasNutFlushBlocker || draws.hasStraightBlocker) &&
      ctx.effectiveSpr >= 0.7 &&
      !ctx.isMultiway
    ) {
      // Calibrated river blocker bluff-raise for Balanced Reg / LAG / Maniac!
      const baseRiverBluffRaise =
        archetype === 'Maniac'
          ? 0.22
          : archetype === 'Loose-Aggressive'
            ? 0.14
            : archetype === 'Balanced Reg'
              ? 0.08
              : 0.02;
      raiseProb = baseRiverBluffRaise;
    } else if (
      archetype === 'Maniac' &&
      ctx.streetRaiseCount === 1 &&
      hand.bucket === 'pure_air' &&
      !ctx.isMultiway
    ) {
      // Maniac occasional pure bluff-raise on flop/turn
      raiseProb = ctx.street === 'river' ? 0.06 : 0.12;
    }

    if (raiseProb > 0 && rng() < clamp(raiseProb, 0, 0.92)) {
      return {
        type: 'raise',
        raiseToBb: pickPostflopRaiseSize(state, legal, ctx, archetype, rng),
      };
    }
  }

  // 3. Pure-Air Fold Guard (eliminates 0% FoldToBet & 40-50% River Air Call bugs!)
  if (cfg.pureAirFoldGuard && hand.bucket === 'pure_air') {
    if (ctx.street === 'river') {
      // On river, pure air has ~4% equity -> ALWAYS fold to any meaningful bet (>= 15% pot)!
      // Even Calling Station folds 7-high air facing real river bets (calls only tiny <15% pot with Ace-high)
      if (ctx.facingBetFracOfPot >= 0.15 || !hand.isAceHigh) {
        return { type: 'fold' };
      }
      if (archetype !== 'Calling Station') {
        return { type: 'fold' };
      }
    } else {
      // Flop / Turn pure air with zero draws: fold to any real bet (>= 25% pot), tiny IP float for LAG/Maniac only
      if (ctx.facingBetFracOfPot >= 0.25) {
        const ipFloat =
          ctx.street === 'flop' &&
          ctx.isIpVsAggressor &&
          ctx.facingBetFracOfPot <= 0.40 &&
          !ctx.isMultiway &&
          (archetype === 'Loose-Aggressive' || archetype === 'Maniac') &&
          rng() < 0.12;
        if (!ipFloat) return { type: 'fold' };
      }
    }
  }

  // 4. Equity vs Pot Odds Calling Math (Single clean callEquitySlack — ZERO double-counting!)
  const impliedOddsBonus =
    ctx.street !== 'river' &&
    ctx.effectiveSpr >= 2.2 &&
    (hand.bucket === 'strong_draw' || hand.bucket === 'medium_draw')
      ? ctx.street === 'flop'
        ? 0.075
        : 0.045
      : 0;

  // Small MDF cushion vs tiny min-bets (<= 25% pot) with any real pair or draw
  const tinyBetCushion =
    ctx.facingBetFracOfPot <= 0.26 && (hand.isRealPairOrBetter || hand.bucket !== 'pure_air')
      ? 0.05
      : 0;

  // Calling Station calls down extra wide with ANY actual pair or Ace-high (but NOT 7-high air!)
  const stationPairBonus =
    archetype === 'Calling Station' && (hand.isRealPairOrBetter || (hand.isAceHigh && ctx.facingBetFracOfPot <= 0.75))
      ? 0.08
      : 0;

  const adjustedEquity = hand.estEquity + impliedOddsBonus + tinyBetCushion + stationPairBonus;
  // Turn/River betting ranges polarize & strengthen vs flop c-bets; tighten calling threshold
  // for disciplined archetypes on later streets except against hyper-bluffing Maniacs.
  let streetCallTighten = 0;
  if (
    archetype !== 'Calling Station' &&
    archetype !== 'Maniac' &&
    ctx.street !== 'flop' &&
    ctx.lastAggressorArchetype !== 'Maniac'
  ) {
    const riverBase = archetype === 'Tight Nit' ? 0.11 : 0.155;
    const baseTighten = ctx.street === 'turn' ? 0.06 : riverBase;
    streetCallTighten = ctx.lastAggressorArchetype === 'Loose-Aggressive' ? baseTighten * 0.5 : baseTighten;
  }
  const threshold = reqEq + cfg.callEquitySlack + streetCallTighten;

  // Smooth mixed boundary (+/- 0.04 around threshold) so decisions aren't robotic cliff edges
  const margin = adjustedEquity - threshold;
  if (margin >= 0.045) return { type: 'call' };
  if (margin <= -0.045) return { type: 'fold' };
  const callProb = clamp(0.5 + (margin / 0.09) * 0.5, 0.08, 0.92);
  return rng() < callProb ? { type: 'call' } : { type: 'fold' };
}

// ---------------------------------------------------------------------------
// 9. Unified Public Entry Point for Bot Decisions
// ---------------------------------------------------------------------------

export function decideBotAction(
  state: PokerTableState,
  seatIndex: number,
  legal: LegalActions,
  effectivePotOdds: { effectiveToCall: number; effectivePotBb: number; reqEq: number },
  rng: () => number = Math.random
): { type: 'fold' | 'check' | 'call' | 'raise'; raiseToBb?: number } {
  const seat = state.seats[seatIndex];
  const archetype: BotArchetype =
    seat.archetype === 'Hero' ? 'Balanced Reg' : seat.archetype;

  // Preflop Engine
  if (state.phase === 'PREFLOP') {
    const preCtx = extractPreflopContext(state, seatIndex, legal);
    const gtoFreqs = getGtoPreflopFreqs(preCtx);
    const freqs = adjustPreflopFreqsForArchetype(gtoFreqs, preCtx, archetype);

    // If cannot raise (e.g. call-only after short all-in), roll raise freq into call
    const effRaise = legal.canBetOrRaise ? freqs.raise : 0;
    const effCall = legal.canBetOrRaise ? freqs.call : Math.min(100, freqs.call + freqs.raise);

    const roll = rng() * 100;
    if (roll < effRaise) {
      return {
        type: 'raise',
        raiseToBb: pickPreflopRaiseSize(state, seat, preCtx, legal, archetype, rng),
      };
    }
    if (roll < effRaise + effCall || legal.canCheck) {
      return legal.canCheck ? { type: 'check' } : { type: 'call' };
    }
    return { type: 'fold' };
  }

  // Postflop Engine
  if (!seat.cards || state.board.length < 3) {
    return legal.canCheck ? { type: 'check' } : { type: 'fold' };
  }
  return decidePostflopBotAction(state, seat, legal, effectivePotOdds, archetype, rng);
}

// ---------------------------------------------------------------------------
// 10. Postflop GTO Frequency Estimator for Hero EV Audit
// ---------------------------------------------------------------------------

export interface PostflopAuditFreqs {
  fold: number;
  check: number;
  call: number;
  raise: number;
  primaryReason:
    | 'strong_value'
    | 'semi_bluff_cbet'
    | 'weak_showdown'
    | 'pot_control'
    | 'value_protect_raise'
    | 'pot_odds_call'
    | 'pot_odds_fold';
  estEquityPct: number;
  hand: PostflopHandEval;
  draws: HeroDrawInfo;
  texture: BoardTexture;
  ctx: PostflopContext;
}

export function evaluatePostflopGtoFreqs(
  state: PokerTableState,
  seat: TableSeat,
  effectivePotOdds: { effectiveToCall: number; effectivePotBb: number; reqEq: number }
): PostflopAuditFreqs {
  const hole = seat.cards!;
  const texture = analyzeBoardTexture(state.board);
  const draws = analyzeHeroDraws(hole, state.board);
  const ctx = extractPostflopContext(
    state,
    seat.seatIndex,
    effectivePotOdds.effectivePotBb,
    effectivePotOdds.effectiveToCall
  );
  const hand = classifyAndEstimatePostflop(hole, state.board, texture, draws, ctx);
  const estEquityPct = Math.round(hand.estEquity * 100);

  let fold = 0;
  let check = 0;
  let call = 0;
  let raise = 0;
  let primaryReason: PostflopAuditFreqs['primaryReason'] = 'pot_control';

  if (effectivePotOdds.effectiveToCall === 0) {
    // Checked to Hero
    const isDryPfrCbet =
      ctx.street === 'flop' &&
      ctx.wasPfr &&
      !ctx.isMultiway &&
      texture.wetness < 0.38 &&
      texture.rangeAdvForPfr >= 0.20;

    if (hand.bucket === 'nuts_strong_value') {
      raise = 85;
      check = 15;
      primaryReason = 'strong_value';
    } else if (hand.bucket === 'strong_one_pair') {
      const scary = texture.isFourFlush || texture.isFourStraight;
      raise = scary ? 40 : 78;
      check = 100 - raise;
      primaryReason = raise >= 50 ? 'strong_value' : 'pot_control';
    } else if (hand.bucket === 'strong_draw' && ctx.street !== 'river') {
      raise = 72;
      check = 28;
      primaryReason = 'semi_bluff_cbet';
    } else if (hand.bucket === 'medium_draw' && ctx.street !== 'river') {
      raise = ctx.wasPfr || ctx.isInPosition ? 60 : 35;
      check = 100 - raise;
      primaryReason = raise >= 50 ? 'semi_bluff_cbet' : 'pot_control';
    } else if (isDryPfrCbet) {
      // Dry A/K-high flop PFR range c-bet -> betting small is GTO Optimal, checking is Acceptable!
      raise = 65;
      check = 35;
      primaryReason = 'semi_bluff_cbet';
    } else if (hand.bucket === 'medium_showdown' || hand.bucket === 'weak_showdown') {
      check = 80;
      raise = 20;
      primaryReason = 'pot_control';
    } else if (
      ctx.street === 'river' &&
      hand.bucket === 'pure_air' &&
      (draws.hasNutFlushBlocker || draws.missedFlushDraw || draws.missedStraightDraw)
    ) {
      // River blocker bluff: check is primary, bluff is solid Acceptable/Optimal mix
      check = 62;
      raise = 38;
      primaryReason = 'weak_showdown';
    } else {
      check = 84;
      raise = 16;
      primaryReason = 'weak_showdown';
    }
  } else {
    // Facing a bet or raise
    const reqEq = effectivePotOdds.reqEq;
    const impliedBonus =
      ctx.street !== 'river' &&
      ctx.effectiveSpr >= 2.2 &&
      (hand.bucket === 'strong_draw' || hand.bucket === 'medium_draw')
        ? ctx.street === 'flop'
          ? 0.08
          : 0.045
        : 0;
    const effEq = hand.estEquity + impliedBonus;
    const diff = effEq - reqEq;

    if (hand.bucket === 'nuts_strong_value') {
      raise = 68;
      call = 32;
      fold = 0;
      primaryReason = 'value_protect_raise';
    } else if (hand.bucket === 'pure_air' && ctx.street === 'river') {
      // Pure air on river: clear fold (unless nut-blocker bluff-raise mix)
      const blockerRaise =
        ctx.streetRaiseCount === 1 && (draws.hasNutFlushBlocker || draws.hasStraightBlocker) ? 14 : 0;
      raise = blockerRaise;
      call = 0;
      fold = 100 - blockerRaise;
      primaryReason = 'pot_odds_fold';
    } else if (hand.bucket === 'strong_draw' && ctx.street !== 'river') {
      if (diff >= -0.02) {
        raise = ctx.streetRaiseCount === 1 ? 38 : 10;
        call = 100 - raise;
        fold = 0;
        primaryReason = 'pot_odds_call';
      } else {
        raise = 15;
        call = 30;
        fold = 55;
        primaryReason = 'pot_odds_fold';
      }
    } else if (diff >= 0.14) {
      raise = hand.bucket === 'strong_one_pair' && ctx.streetRaiseCount === 1 ? 22 : 8;
      call = 100 - raise;
      fold = 0;
      primaryReason = 'pot_odds_call';
    } else if (diff >= 0.04) {
      call = 84;
      raise = 6;
      fold = 10;
      primaryReason = 'pot_odds_call';
    } else if (diff >= -0.04) {
      // Borderline spot: both Call and Fold are reasonable
      call = Math.round(50 + diff * 400);
      call = clamp(call, 25, 75);
      fold = 100 - call;
      raise = 0;
      primaryReason = call >= fold ? 'pot_odds_call' : 'pot_odds_fold';
    } else if (diff >= -0.10) {
      call = 15;
      fold = 85;
      raise = 0;
      primaryReason = 'pot_odds_fold';
    } else {
      call = 0;
      fold = 100;
      raise = 0;
      primaryReason = 'pot_odds_fold';
    }
  }

  return {
    fold,
    check,
    call,
    raise,
    primaryReason,
    estEquityPct,
    hand,
    draws,
    texture,
    ctx,
  };
}
