import type { Card, DecisionGrade, Position, Street } from './types';
import { accuracyFromGrade } from './types';
import {
  canonicalHandKey,
  createDeck,
  evaluateHand,
  handStrengthScore,
  RANK_VALUE,
  shuffleDeck,
} from './evaluator';
import { requiredEquityPct } from './math';

export type BotArchetype =
  | 'Balanced Reg'
  | 'Tight-Aggressive'
  | 'Loose-Aggressive'
  | 'Calling Station'
  | 'Tight Nit'
  | 'Maniac';

export const ALL_BOT_ARCHETYPES: BotArchetype[] = [
  'Balanced Reg',
  'Tight-Aggressive',
  'Loose-Aggressive',
  'Calling Station',
  'Tight Nit',
  'Maniac',
];

export type ArenaSize = 2 | 3 | 4 | 6;
export type PoolPresetId =
  | 'mixed'
  | 'microstakes'
  | 'reg_wars'
  | 'lag_chaos'
  | 'heads_up'
  | 'custom';

export type HeroPositionLock = 'ROTATE' | 'BTN' | 'BB' | 'CO';
export type BotSpeed = 'normal' | 'fast';

export interface ArenaConfig {
  tableSize: ArenaSize;
  startingStackBb: 50 | 100 | 200;
  poolPreset: PoolPresetId;
  botArchetypes: BotArchetype[]; // Length = tableSize - 1
  heroPositionLock: HeroPositionLock;
  blindReadMode: boolean;
  fastFold: boolean;
  speed: BotSpeed;
}

export interface SeatHudStats {
  handsDealt: number;
  vpipHands: number;
  pfrHands: number;
  threeBetHands: number;
  threeBetOpps: number;
  postflopAggActs: number;
  postflopCalls: number;
  handsWon: number;
}

export interface HudDisplayMetrics {
  vpipPct: number;
  pfrPct: number;
  threeBetPct: number;
  af: string;
}

export type TableActionKind =
  | 'post_sb'
  | 'post_bb'
  | 'blind'
  | 'fold'
  | 'folded'
  | 'check'
  | 'call'
  | 'call_allin'
  | 'bet'
  | 'raise'
  | 'three_bet'
  | 'four_bet'
  | 'all_in';

export interface TableActionSpec {
  kind: TableActionKind;
  amountBb?: number;
}

export type AuditBaseReason =
  | 'strong_value'
  | 'semi_bluff_cbet'
  | 'weak_showdown'
  | 'pot_control'
  | 'value_protect_raise'
  | 'pot_odds_call'
  | 'pot_odds_fold';

export type AuditExploitTipKind =
  | 'cs_value'
  | 'cs_no_bluff'
  | 'nit_respect'
  | 'nit_pressure'
  | 'lag_bluffcatch'
  | 'tag_discipline'
  | 'reg_mix';

export interface AuditNoteSpec {
  reason: AuditBaseReason;
  street: Street;
  handKey?: string;
  toCallBb?: number;
  reqEqPct?: number;
  exploitTip?: AuditExploitTipKind;
  villainName?: string;
  villainArchetype?: BotArchetype;
}

export interface PotSlice {
  potIndex: number; // 0 = Main pot, 1+ = Side pot
  amountBb: number;
  eligibleSeatIndices: number[];
}

export interface PotPayoutBreakdown {
  potIndex: number;
  amountBb: number;
  winners: {
    seatIndex: number;
    name: string;
    isHero: boolean;
    position: Position;
    payoutBb: number;
  }[];
  handLabel?: string;
  isSplit: boolean;
  isUncalledReturn?: boolean;
}

export interface WinnerSummarySpec {
  type: 'uncontested' | 'showdown';
  winners: { name: string; isHero: boolean; position: Position }[];
  potBb: number;
  handLabel?: string;
  isSplit: boolean;
  potBreakdowns?: PotPayoutBreakdown[];
}

export interface TableSeat {
  seatIndex: number; // 0 = Hero (bottom center), 1..(N-1) clockwise
  name: string;
  isHero: boolean;
  archetype: BotArchetype | 'Hero';
  position: Position;
  stackBb: number;
  streetBetBb: number;
  totalInvestedBb: number;
  cards: [Card, Card] | null;
  folded: boolean;
  allIn: boolean;
  actedThisStreet: boolean;
  lastActionText: string;
  lastActionSpec?: TableActionSpec;
  // Per-hand HUD tracking flags
  didVpipThisHand: boolean;
  didPfrThisHand: boolean;
  didThreeBetThisHand: boolean;
  hadThreeBetOppThisHand: boolean;
  stats: SeatHudStats;
}

export interface HeroStreetAudit {
  street: Street;
  position: Position;
  chosenAction: string;
  recommendedAction: string;
  chosenActionSpec?: TableActionSpec;
  recommendedActionSpec?: TableActionSpec;
  evLossBb?: number;
  grade: DecisionGrade;
  accuracyScore: number;
  note: string;
  noteSpec?: AuditNoteSpec;
  villainName?: string;
  villainArchetype?: BotArchetype;
}

export interface TableActionLogItem {
  street: Street;
  seatName: string;
  isHero?: boolean;
  position: Position;
  text: string;
  actionSpec?: TableActionSpec;
}

export type TablePhase = 'IDLE' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export interface PokerTableState {
  config: ArenaConfig;
  handNumber: number;
  phase: TablePhase;
  buttonSeatIndex: number;
  actingSeatIndex: number | null;
  preflopAggressorSeatIndex: number | null;
  preflopRaiseCount: number;
  potBb: number;
  currentBetBb: number;
  minRaiseBb: number;
  lastFullRaiseIncrementBb?: number;
  callOnlySeatIndices?: number[];
  board: Card[];
  deck: Card[];
  seats: TableSeat[];
  actionLog: TableActionLogItem[];
  heroAudits: HeroStreetAudit[];
  winnerSummary: string | null;
  winnerSpec?: WinnerSummarySpec | null;
  winnerSeatIndices: number[];
}

export const POSITIONS_BY_SIZE: Record<ArenaSize, Position[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
};

export const SEAT_POSITIONS_FROM_BTN: Position[] = POSITIONS_BY_SIZE[6];

const BOT_NAMES = ['V. Mercer', 'K. Sato', 'D. Novak', 'M. Vance', 'E. Lind'];

export const POOL_PRESET_SPECS: Record<
  Exclude<PoolPresetId, 'custom'>,
  {
    tableSize: ArenaSize;
    startingStackBb: 50 | 100 | 200;
    archetypes: BotArchetype[];
  }
> = {
  mixed: {
    tableSize: 6,
    startingStackBb: 100,
    archetypes: [
      'Balanced Reg',
      'Tight-Aggressive',
      'Loose-Aggressive',
      'Calling Station',
      'Tight Nit',
    ],
  },
  microstakes: {
    tableSize: 6,
    startingStackBb: 100,
    archetypes: [
      'Calling Station',
      'Tight Nit',
      'Calling Station',
      'Maniac',
      'Calling Station',
    ],
  },
  reg_wars: {
    tableSize: 6,
    startingStackBb: 100,
    archetypes: [
      'Balanced Reg',
      'Tight-Aggressive',
      'Balanced Reg',
      'Loose-Aggressive',
      'Tight-Aggressive',
    ],
  },
  lag_chaos: {
    tableSize: 4,
    startingStackBb: 100,
    archetypes: ['Loose-Aggressive', 'Maniac', 'Loose-Aggressive'],
  },
  heads_up: {
    tableSize: 2,
    startingStackBb: 100,
    archetypes: ['Balanced Reg'],
  },
};

export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  tableSize: 6,
  startingStackBb: 100,
  poolPreset: 'mixed',
  botArchetypes: [...POOL_PRESET_SPECS.mixed.archetypes],
  heroPositionLock: 'ROTATE',
  blindReadMode: false,
  fastFold: false,
  speed: 'normal',
};

export function buildPresetConfig(
  preset: Exclude<PoolPresetId, 'custom'>,
  base: ArenaConfig = DEFAULT_ARENA_CONFIG
): ArenaConfig {
  const spec = POOL_PRESET_SPECS[preset];
  const validLock: HeroPositionLock =
    base.heroPositionLock !== 'ROTATE' &&
    POSITIONS_BY_SIZE[spec.tableSize].includes(base.heroPositionLock)
      ? base.heroPositionLock
      : 'ROTATE';

  return {
    ...base,
    poolPreset: preset,
    tableSize: spec.tableSize,
    startingStackBb: spec.startingStackBb,
    botArchetypes: [...spec.archetypes],
    heroPositionLock: validLock,
  };
}

export function resizeConfigArchetypes(
  current: BotArchetype[],
  tableSize: ArenaSize
): BotArchetype[] {
  const needed = tableSize - 1;
  const fallback = POOL_PRESET_SPECS.mixed.archetypes;
  const out: BotArchetype[] = [];
  for (let i = 0; i < needed; i++) {
    out.push(current[i] ?? fallback[i % fallback.length]);
  }
  return out;
}

export function createEmptyHudStats(): SeatHudStats {
  return {
    handsDealt: 0,
    vpipHands: 0,
    pfrHands: 0,
    threeBetHands: 0,
    threeBetOpps: 0,
    postflopAggActs: 0,
    postflopCalls: 0,
    handsWon: 0,
  };
}

export function computeHudDisplay(stats: SeatHudStats): HudDisplayMetrics {
  const h = Math.max(1, stats.handsDealt);
  const vpipPct = stats.handsDealt > 0 ? Math.round((stats.vpipHands / h) * 100) : 0;
  const pfrPct = stats.handsDealt > 0 ? Math.round((stats.pfrHands / h) * 100) : 0;
  const threeBetPct =
    stats.threeBetOpps > 0
      ? Math.round((stats.threeBetHands / stats.threeBetOpps) * 100)
      : 0;
  const af =
    stats.postflopCalls === 0
      ? stats.postflopAggActs > 0
        ? `${stats.postflopAggActs.toFixed(1)}`
        : '—'
      : (stats.postflopAggActs / stats.postflopCalls).toFixed(1);

  return { vpipPct, pfrPct, threeBetPct, af };
}

export function roundBb(v: number): number {
  return Math.round(v * 10) / 10;
}

export function createTableFromConfig(config: ArenaConfig): PokerTableState {
  const normalizedArchetypes = resizeConfigArchetypes(config.botArchetypes, config.tableSize);
  const normalizedConfig: ArenaConfig = {
    ...config,
    botArchetypes: normalizedArchetypes,
  };
  const positions = POSITIONS_BY_SIZE[normalizedConfig.tableSize];

  const seats: TableSeat[] = [
    {
      seatIndex: 0,
      name: 'Hero (You)',
      isHero: true,
      archetype: 'Hero',
      position: positions[0],
      stackBb: normalizedConfig.startingStackBb,
      streetBetBb: 0,
      totalInvestedBb: 0,
      cards: null,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastActionText: '',
      didVpipThisHand: false,
      didPfrThisHand: false,
      didThreeBetThisHand: false,
      hadThreeBetOppThisHand: false,
      stats: createEmptyHudStats(),
    },
    ...normalizedArchetypes.map((arch, i) => ({
      seatIndex: i + 1,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isHero: false,
      archetype: arch,
      position: positions[i + 1],
      stackBb: normalizedConfig.startingStackBb,
      streetBetBb: 0,
      totalInvestedBb: 0,
      cards: null,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastActionText: '',
      didVpipThisHand: false,
      didPfrThisHand: false,
      didThreeBetThisHand: false,
      hadThreeBetOppThisHand: false,
      stats: createEmptyHudStats(),
    })),
  ];

  return {
    config: normalizedConfig,
    handNumber: 0,
    phase: 'IDLE',
    // Set so the first deal rotates BTN cleanly onto seat 0 (Hero)
    buttonSeatIndex: normalizedConfig.tableSize - 1,
    actingSeatIndex: null,
    preflopAggressorSeatIndex: null,
    preflopRaiseCount: 0,
    potBb: 0,
    currentBetBb: 0,
    minRaiseBb: 1,
    lastFullRaiseIncrementBb: 1.0,
    callOnlySeatIndices: [],
    board: [],
    deck: [],
    seats,
    actionLog: [],
    heroAudits: [],
    winnerSummary: null,
    winnerSeatIndices: [],
  };
}

export function createInitialTable(): PokerTableState {
  return createTableFromConfig(DEFAULT_ARENA_CONFIG);
}

function assignPositions(seats: TableSeat[], buttonSeatIndex: number, size: ArenaSize): TableSeat[] {
  const posOrder = POSITIONS_BY_SIZE[size];
  return seats.map((s) => {
    const offset = (s.seatIndex - buttonSeatIndex + size) % size;
    return {
      ...s,
      position: posOrder[offset],
    };
  });
}

function computeNextButtonIndex(prev: PokerTableState): number {
  const size = prev.config.tableSize;
  const lock = prev.config.heroPositionLock;
  if (lock !== 'ROTATE') {
    const posOrder = POSITIONS_BY_SIZE[size];
    const desiredOffset = posOrder.indexOf(lock);
    if (desiredOffset >= 0) {
      // Hero is seatIndex 0 -> (0 - btn + size) % size === desiredOffset => btn = (size - desiredOffset) % size
      return (size - desiredOffset) % size;
    }
  }
  return (prev.buttonSeatIndex + 1) % size;
}

export function startNewHand(
  prev: PokerTableState,
  rng: () => number = Math.random
): PokerTableState {
  const size = prev.config.tableSize;
  const defaultStack = prev.config.startingStackBb;
  const nextBtn = computeNextButtonIndex(prev);
  const deck = shuffleDeck(createDeck(), rng);
  let cursor = 0;

  // Auto top-up short stacks below 20% of starting stack for seamless practice
  const minThreshold = Math.max(15, defaultStack * 0.2);
  let seats: TableSeat[] = prev.seats.map((s) => {
    const toppedStack = s.stackBb < minThreshold ? defaultStack : roundBb(s.stackBb);
    const c1 = deck[cursor++];
    const c2 = deck[cursor++];
    return {
      ...s,
      stackBb: toppedStack,
      streetBetBb: 0,
      totalInvestedBb: 0,
      cards: [c1, c2],
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastActionText: '',
      lastActionSpec: undefined,
      didVpipThisHand: false,
      didPfrThisHand: false,
      didThreeBetThisHand: false,
      hadThreeBetOppThisHand: false,
      stats: {
        ...s.stats,
        handsDealt: s.stats.handsDealt + 1,
      },
    };
  });

  seats = assignPositions(seats, nextBtn, size);

  // Heads-Up rule: BTN posts SB (0.5bb) and acts FIRST preflop; BB posts 1bb and acts first postflop
  const sbSeat =
    size === 2
      ? seats.find((s) => s.position === 'BTN')!
      : seats.find((s) => s.position === 'SB')!;
  const bbSeat = seats.find((s) => s.position === 'BB')!;

  const postBlind = (seat: TableSeat, amount: number, kind: 'post_sb' | 'post_bb') => {
    const posted = Math.min(seat.stackBb, amount);
    seat.stackBb = roundBb(seat.stackBb - posted);
    seat.streetBetBb = roundBb(posted);
    seat.totalInvestedBb = roundBb(posted);
    if (seat.stackBb <= 0) seat.allIn = true;
    seat.lastActionText = `Blind ${posted}bb`;
    seat.lastActionSpec = { kind, amountBb: posted };
    return posted;
  };

  const sbAmt = postBlind(sbSeat, 0.5, 'post_sb');
  const bbAmt = postBlind(bbSeat, 1.0, 'post_bb');

  // First preflop actor: seat immediately left of BB (in 2-max that wraps to BTN/SB!)
  const firstPreflopIndex = (bbSeat.seatIndex + 1) % size;

  return {
    ...prev,
    handNumber: prev.handNumber + 1,
    phase: 'PREFLOP',
    buttonSeatIndex: nextBtn,
    actingSeatIndex: firstPreflopIndex,
    preflopAggressorSeatIndex: null,
    preflopRaiseCount: 0,
    potBb: roundBb(sbAmt + bbAmt),
    currentBetBb: 1.0,
    minRaiseBb: 2.0,
    lastFullRaiseIncrementBb: 1.0,
    callOnlySeatIndices: [],
    board: [],
    deck: deck.slice(cursor),
    seats,
    actionLog: [
      {
        street: 'preflop',
        seatName: sbSeat.name,
        isHero: sbSeat.isHero,
        position: sbSeat.position,
        text: `Posts SB ${sbAmt}bb`,
        actionSpec: { kind: 'post_sb', amountBb: sbAmt },
      },
      {
        street: 'preflop',
        seatName: bbSeat.name,
        isHero: bbSeat.isHero,
        position: bbSeat.position,
        text: `Posts BB ${bbAmt}bb`,
        actionSpec: { kind: 'post_bb', amountBb: bbAmt },
      },
    ],
    heroAudits: [],
    winnerSummary: null,
    winnerSpec: null,
    winnerSeatIndices: [],
  };
}

export function rebuyHeroTo100(state: PokerTableState): PokerTableState {
  if (state.phase !== 'IDLE' && state.phase !== 'SHOWDOWN') {
    return state;
  }
  const target = state.config.startingStackBb;
  return {
    ...state,
    seats: state.seats.map((s) => {
      if (!s.isHero) return s;
      const nextStack = Math.max(s.stackBb, target);
      return {
        ...s,
        stackBb: nextStack,
        allIn: nextStack > 0 ? false : s.allIn,
      };
    }),
  };
}

/**
 * Cleanly finishes any in-progress hand (folding Hero if still active and stepping remaining bots
 * to showdown so pot chips are never vaporized) before dealing the next hand.
 */
export function settleAndStartNewHand(
  state: PokerTableState,
  rng: () => number = Math.random
): PokerTableState {
  if (state.phase === 'IDLE' || state.phase === 'SHOWDOWN') {
    return startNewHand(state, rng);
  }

  let curr = state;
  const hero = curr.seats[0];
  if (hero && !hero.folded) {
    if (curr.actingSeatIndex === 0) {
      curr = applyPlayerAction(curr, 0, 'fold');
    } else {
      const seats = curr.seats.map((s) =>
        s.seatIndex === 0
          ? {
              ...s,
              folded: true,
              actedThisStreet: true,
              lastActionText: 'Fold',
              lastActionSpec: { kind: 'fold' } as TableActionSpec,
            }
          : s
      );
      curr = { ...curr, seats };
      if (activeSeats(seats).length <= 1) {
        curr = resolveShowdown(curr);
      }
    }
  }

  let guard = 0;
  while (curr.phase !== 'SHOWDOWN' && curr.actingSeatIndex !== null && guard < 120) {
    const actorIdx = curr.actingSeatIndex;
    if (actorIdx === 0) {
      curr = applyPlayerAction(curr, 0, 'fold');
    } else {
      const move = chooseBotAction(curr, actorIdx, rng);
      curr = applyPlayerAction(curr, actorIdx, move.type, move.raiseToBb);
    }
    guard++;
  }

  if (curr.phase !== 'SHOWDOWN') {
    curr = resolveShowdown(curr);
  }

  return startNewHand(curr, rng);
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  callAmountBb: number;
  canBetOrRaise: boolean;
  isBet: boolean;
  minTotalBetBb: number;
  maxTotalBetBb: number;
}

export function getLegalActions(state: PokerTableState, seatIndex: number): LegalActions {
  const seat = state.seats[seatIndex];
  const toCall = Math.max(0, roundBb(state.currentBetBb - seat.streetBetBb));
  const callAmountBb = Math.min(seat.stackBb, toCall);
  const canCheck = toCall === 0;
  const maxTotalBetBb = roundBb(seat.streetBetBb + seat.stackBb);
  const isBet = state.currentBetBb === 0;
  const minTotalBetBb = isBet
    ? Math.min(maxTotalBetBb, 1.0)
    : Math.min(maxTotalBetBb, roundBb(Math.max(state.currentBetBb + 1.0, state.minRaiseBb)));
  const isCallOnly = (state.callOnlySeatIndices ?? []).includes(seatIndex);
  const canBetOrRaise =
    !isCallOnly && seat.stackBb > callAmountBb && maxTotalBetBb > state.currentBetBb;

  return {
    canFold: toCall > 0,
    canCheck,
    callAmountBb,
    canBetOrRaise,
    isBet,
    minTotalBetBb,
    maxTotalBetBb,
  };
}

/**
 * Fast draw & board-texture detector for smarter postflop bot strategy & EV audits.
 */
function detectDrawBonus(hole: [Card, Card], board: Card[]): {
  flushDraw: boolean;
  straightDraw: boolean;
  bonus: number;
} {
  if (board.length < 3 || board.length >= 5) {
    return { flushDraw: false, straightDraw: false, bonus: 0 };
  }
  const all = [...hole, ...board];
  const suitCounts: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
  for (const c of all) suitCounts[c.suit]++;
  const flushDraw =
    (suitCounts[hole[0].suit] === 4 || suitCounts[hole[1].suit] === 4) &&
    (board.filter((b) => b.suit === hole[0].suit).length >= 2 ||
      board.filter((b) => b.suit === hole[1].suit).length >= 2);

  // Open-ended or strong straight draw check (4 distinct ranks within a 5-card span)
  const vals = Array.from(new Set(all.map((c) => RANK_VALUE[c.rank]))).sort((a, b) => a - b);
  if (vals.includes(14)) vals.unshift(1); // Ace low
  let straightDraw = false;
  for (let i = 0; i <= vals.length - 4; i++) {
    if (vals[i + 3] - vals[i] <= 4) {
      straightDraw = true;
      break;
    }
  }

  let bonus = 0;
  if (flushDraw) bonus += 0.14;
  if (straightDraw) bonus += 0.1;
  return { flushDraw, straightDraw, bonus };
}

function isBoardWet(board: Card[]): boolean {
  if (board.length < 3) return false;
  const suitCounts: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
  for (const c of board) suitCounts[c.suit]++;
  const twoToneOrMonotone = Object.values(suitCounts).some((n) => n >= 2);
  const vals = Array.from(new Set(board.map((c) => RANK_VALUE[c.rank]))).sort((a, b) => a - b);
  let connected = false;
  for (let i = 0; i < vals.length - 1; i++) {
    if (vals[i + 1] - vals[i] <= 2) {
      connected = true;
      break;
    }
  }
  return twoToneOrMonotone && connected;
}

function getPrimaryVillain(state: PokerTableState): TableSeat | null {
  if (
    state.preflopAggressorSeatIndex !== null &&
    state.preflopAggressorSeatIndex !== 0 &&
    !state.seats[state.preflopAggressorSeatIndex]?.folded
  ) {
    return state.seats[state.preflopAggressorSeatIndex];
  }
  const activeBots = state.seats.filter((s) => !s.isHero && !s.folded);
  if (activeBots.length === 0) return null;
  return activeBots.sort((a, b) => b.totalInvestedBb - a.totalInvestedBb)[0];
}

function buildExploitativeTip(
  villain: TableSeat | null,
  recommended: 'fold' | 'check' | 'call' | 'raise',
  strength: number
): { text: string; kind?: AuditExploitTipKind } {
  if (!villain || villain.archetype === 'Hero') return { text: '' };
  const name = villain.name;
  switch (villain.archetype) {
    case 'Calling Station':
      if (recommended === 'raise' && strength >= 0.6) {
        return {
          text: ` Exploit vs ${name} (Calling Station): size up value bets—they call too wide.`,
          kind: 'cs_value',
        };
      }
      if (recommended === 'check' && strength < 0.35) {
        return {
          text: ` Exploit vs ${name} (Calling Station): avoid low-equity bluffs that rarely fold them out.`,
          kind: 'cs_no_bluff',
        };
      }
      return { text: '' };
    case 'Tight Nit':
      if (recommended === 'fold') {
        return {
          text: ` Exploit vs ${name} (Tight Nit): respect heavy aggression—their continuing range is value-heavy.`,
          kind: 'nit_respect',
        };
      }
      if (recommended === 'raise' && strength < 0.55) {
        return {
          text: ` Exploit vs ${name} (Tight Nit): steady pressure steals pots when they miss.`,
          kind: 'nit_pressure',
        };
      }
      return { text: '' };
    case 'Loose-Aggressive':
    case 'Maniac':
      if (recommended === 'call') {
        return {
          text: ` Exploit vs ${name} (${villain.archetype}): widen bluff-catching calls against over-aggression.`,
          kind: 'lag_bluffcatch',
        };
      }
      return { text: '' };
    case 'Tight-Aggressive':
      return {
        text: ` Note vs ${name} (TAG): keep ranges disciplined and watch blockers on draw-heavy boards.`,
        kind: 'tag_discipline',
      };
    case 'Balanced Reg':
      return {
        text: ` Note vs ${name} (Balanced Reg): mix value and draw semi-bluffs to stay unexploitable.`,
        kind: 'reg_mix',
      };
  }
}

function evaluateHeroActionForAudit(
  state: PokerTableState,
  seat: TableSeat,
  actionType: 'fold' | 'check' | 'call' | 'raise',
  raiseToBb?: number
): HeroStreetAudit {
  const street: Street =
    state.phase === 'PREFLOP'
      ? 'preflop'
      : state.phase === 'FLOP'
        ? 'flop'
        : state.phase === 'TURN'
          ? 'turn'
          : 'river';
  const cards = seat.cards!;
  const handKey = canonicalHandKey(cards[0], cards[1]);
  const baseStrength = handStrengthScore(cards, state.board);
  const drawInfo = detectDrawBonus(cards, state.board);
  const strength = Math.min(1, baseStrength + drawInfo.bonus * 0.65);
  const toCall = Math.max(0, roundBb(state.currentBetBb - seat.streetBetBb));
  const reqEq = toCall > 0 ? requiredEquityPct(state.potBb, toCall) / 100 : 0;
  const reqEqPct = Math.round(reqEq * 100);
  const villain = getPrimaryVillain(state);

  // Subtle exploitative threshold shifts vs extreme bot archetypes
  let villainCallAdjust = 0;
  if (villain?.archetype === 'Tight Nit' && toCall > 2) villainCallAdjust = 0.08;
  if (villain?.archetype === 'Maniac' || villain?.archetype === 'Loose-Aggressive') {
    villainCallAdjust = -0.05;
  }

  let recommended: 'fold' | 'check' | 'call' | 'raise' = 'check';
  let note = '';
  let reason: AuditBaseReason = 'pot_control';

  if (toCall === 0) {
    if (strength >= 0.62) {
      recommended = 'raise';
      reason = 'strong_value';
      note = `Strong holding (${handKey}) builds value by betting/raising on ${street}.`;
    } else if (drawInfo.flushDraw && state.preflopAggressorSeatIndex === 0 && street !== 'river') {
      recommended = 'raise';
      reason = 'semi_bluff_cbet';
      note = `High-equity draw with preflop initiative makes a strong semi-bluff c-bet on ${street}.`;
    } else if (strength <= 0.28 && street !== 'preflop') {
      recommended = 'check';
      reason = 'weak_showdown';
      note = `Weak showdown value prefers checking or selective bluffing rather than thin betting.`;
    } else {
      recommended = 'check';
      reason = 'pot_control';
      note = `Medium strength hand plays cleanly as a check for pot control on ${street}.`;
    }
  } else if (street === 'preflop' && state.preflopRaiseCount === 0) {
    // Unopened preflop pot: prefer RFI raise with playable range instead of open-limping
    const openThreshold = 0.56 - preflopPositionShift(seat.position, state.config.tableSize);
    if (strength >= openThreshold) {
      recommended = 'raise';
      reason = 'strong_value';
      note = `Strong holding (${handKey}) opens for value and initiative from ${seat.position}.`;
    } else if (strength >= openThreshold - 0.10 && seat.position === 'SB') {
      recommended = 'call';
      reason = 'pot_odds_call';
      note = `Facing ${toCall}bb from SB requires ${reqEqPct}% equity; completing is playable.`;
    } else {
      recommended = 'fold';
      reason = 'pot_odds_fold';
      note = `Marginal off-range hand (${handKey}) prefers folding from ${seat.position} rather than open-limping.`;
    }
  } else {
    if (strength >= Math.max(0.72, reqEq + 0.32)) {
      recommended = 'raise';
      reason = 'value_protect_raise';
      note = `High equity vs current bet supports raising for value and protection.`;
    } else if (strength >= reqEq - 0.04 + villainCallAdjust) {
      recommended = 'call';
      reason = 'pot_odds_call';
      note = `Facing ${toCall}bb requires ${reqEqPct}% equity; this holding is strong enough to continue with a call.`;
    } else {
      recommended = 'fold';
      reason = 'pot_odds_fold';
      note = `Facing ${toCall}bb requires ${reqEqPct}% equity; folding preserves stack.`;
    }
  }

  let exploitTipKind: AuditExploitTipKind | undefined;
  if (!state.config.blindReadMode) {
    const tip = buildExploitativeTip(villain, recommended, strength);
    note += tip.text;
    exploitTipKind = tip.kind;
  }

  const chosenAmount = roundBb(raiseToBb ?? state.minRaiseBb);

  let grade: DecisionGrade = 'Optimal';
  if (actionType !== recommended) {
    if (actionType === 'fold' && strength > reqEq + 0.34) {
      grade = 'Blunder';
    } else if (actionType === 'fold' && strength > reqEq + 0.2) {
      grade = 'Mistake';
    } else if (actionType === 'call' && strength < reqEq - 0.24) {
      grade = 'Blunder';
    } else if (actionType === 'call' && strength < reqEq - 0.14) {
      grade = 'Mistake';
    } else if (actionType === 'raise' && strength < 0.32 && (chosenAmount >= 15 || toCall > 2)) {
      grade = 'Blunder';
    } else if (actionType === 'raise' && strength < 0.42 && (chosenAmount >= 8 || toCall > 2)) {
      grade = 'Mistake';
    } else {
      grade = 'Inaccuracy';
    }
  }
  const chosenLabel =
    actionType === 'fold'
      ? 'Fold'
      : actionType === 'check'
        ? 'Check'
        : actionType === 'call'
          ? `Call ${toCall}bb`
          : `${state.currentBetBb === 0 ? 'Bet' : 'Raise'} ${chosenAmount}bb`;

  const chosenActionSpec: TableActionSpec =
    actionType === 'fold'
      ? { kind: 'fold' }
      : actionType === 'check'
        ? { kind: 'check' }
        : actionType === 'call'
          ? { kind: 'call', amountBb: toCall }
          : { kind: state.currentBetBb === 0 ? 'bet' : 'raise', amountBb: chosenAmount };

  const recLabel =
    recommended === 'fold'
      ? 'Fold'
      : recommended === 'check'
        ? 'Check'
        : recommended === 'call'
          ? `Call ${toCall}bb`
          : state.currentBetBb === 0
            ? 'Bet'
            : 'Raise';

  const recommendedActionSpec: TableActionSpec =
    recommended === 'fold'
      ? { kind: 'fold' }
      : recommended === 'check'
        ? { kind: 'check' }
        : recommended === 'call'
          ? { kind: 'call', amountBb: toCall }
          : { kind: state.currentBetBb === 0 ? 'bet' : 'raise' };

  const villainArchetype = villain && villain.archetype !== 'Hero' ? villain.archetype : undefined;
  return {
    street,
    position: seat.position,
    chosenAction: chosenLabel,
    recommendedAction: recLabel,
    chosenActionSpec,
    recommendedActionSpec,
    grade,
    accuracyScore: accuracyFromGrade(grade),
    note,
    noteSpec: {
      reason,
      street,
      handKey,
      toCallBb: toCall,
      reqEqPct,
      exploitTip: exploitTipKind,
      villainName: villain?.name,
      villainArchetype,
    },
    villainName: villain?.name,
    villainArchetype,
  };
}

function activeSeats(seats: TableSeat[]): TableSeat[] {
  return seats.filter((s) => !s.folded);
}

function canActSeats(seats: TableSeat[]): TableSeat[] {
  return seats.filter((s) => !s.folded && !s.allIn);
}

function nextSeatToAct(seats: TableSeat[], fromIndex: number): number | null {
  const n = seats.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    const s = seats[idx];
    if (!s.folded && !s.allIn && !s.actedThisStreet) {
      return idx;
    }
  }
  return null;
}

/**
 * Constructs main and side pots directly from each seat's actual totalInvestedBb.
 * Folded players' dead money stays in the pot layers they contributed to, while only
 * non-folded seats remain eligible to win each layer. Consecutive layers with identical
 * eligible contenders are merged into a single pot.
 */
export function buildSidePots(seats: TableSeat[]): PotSlice[] {
  const levels = Array.from(
    new Set(seats.map((s) => roundBb(s.totalInvestedBb)).filter((v) => v > 0))
  ).sort((a, b) => a - b);

  if (levels.length === 0) return [];

  const merged: { amountBb: number; eligibleSeatIndices: number[] }[] = [];
  let prevLevel = 0;

  for (const level of levels) {
    const band = roundBb(level - prevLevel);
    if (band <= 0) continue;

    const contributors = seats.filter((s) => roundBb(s.totalInvestedBb) >= level);
    const sliceAmount = roundBb(band * contributors.length);
    const eligibleSeatIndices = contributors
      .filter((s) => !s.folded)
      .map((s) => s.seatIndex)
      .sort((a, b) => a - b);

    if (eligibleSeatIndices.length === 0) {
      // Dead money above all remaining contenders folds back into the previous eligible slice
      if (merged.length > 0) {
        merged[merged.length - 1].amountBb = roundBb(
          merged[merged.length - 1].amountBb + sliceAmount
        );
      } else {
        const activeFallback = seats
          .filter((s) => !s.folded)
          .map((s) => s.seatIndex)
          .sort((a, b) => a - b);
        if (activeFallback.length > 0) {
          merged.push({ amountBb: sliceAmount, eligibleSeatIndices: activeFallback });
        }
      }
    } else {
      const prev = merged[merged.length - 1];
      const sameEligible =
        prev &&
        prev.eligibleSeatIndices.length === eligibleSeatIndices.length &&
        prev.eligibleSeatIndices.every((idx, i) => idx === eligibleSeatIndices[i]);

      if (sameEligible) {
        prev.amountBb = roundBb(prev.amountBb + sliceAmount);
      } else {
        merged.push({ amountBb: sliceAmount, eligibleSeatIndices });
      }
    }

    prevLevel = level;
  }

  return merged.map((slice, idx) => ({
    potIndex: idx,
    amountBb: roundBb(slice.amountBb),
    eligibleSeatIndices: slice.eligibleSeatIndices,
  }));
}

export function resolveShowdown(state: PokerTableState): PokerTableState {
  const contenders = activeSeats(state.seats);
  const seats = state.seats.map((s) => ({ ...s, stats: { ...s.stats } }));
  const deck = [...state.deck];
  const board = [...state.board];

  if (contenders.length === 1) {
    const winner = seats[contenders[0].seatIndex];
    winner.stackBb = roundBb(winner.stackBb + state.potBb);
    winner.stats.handsWon += 1;
    return {
      ...state,
      phase: 'SHOWDOWN',
      actingSeatIndex: null,
      board,
      deck,
      seats,
      winnerSeatIndices: [winner.seatIndex],
      winnerSummary: `${winner.name} (${winner.position}) wins ${state.potBb}bb uncontested.`,
      winnerSpec: {
        type: 'uncontested',
        winners: [{ name: winner.name, isHero: winner.isHero, position: winner.position }],
        potBb: state.potBb,
        isSplit: false,
      },
    };
  }

  while (board.length < 5 && deck.length > 0) {
    board.push(deck.shift()!);
  }

  const evalBySeat = new Map<number, ReturnType<typeof evaluateHand>>();
  for (const c of contenders) {
    evalBySeat.set(c.seatIndex, evaluateHand([...c.cards!, ...board]));
  }

  let slices = buildSidePots(seats);
  const totalFromSlices = roundBb(slices.reduce((sum, sl) => sum + sl.amountBb, 0));

  if (slices.length === 0 && state.potBb > 0) {
    slices = [
      {
        potIndex: 0,
        amountBb: roundBb(state.potBb),
        eligibleSeatIndices: contenders.map((c) => c.seatIndex).sort((a, b) => a - b),
      },
    ];
  } else if (slices.length > 0 && Math.abs(totalFromSlices - state.potBb) >= 0.05) {
    // Reconcile any floating-point rounding drift onto the main pot
    slices[0].amountBb = roundBb(slices[0].amountBb + (state.potBb - totalFromSlices));
  }

  const potBreakdowns: PotPayoutBreakdown[] = [];
  const contestedWinnerSet = new Set<number>();

  for (const slice of slices) {
    if (slice.amountBb <= 0 || slice.eligibleSeatIndices.length === 0) continue;

    // Uncalled excess bet: return directly to the sole contributor without showdown
    if (slice.eligibleSeatIndices.length === 1) {
      const onlyIdx = slice.eligibleSeatIndices[0];
      seats[onlyIdx].stackBb = roundBb(seats[onlyIdx].stackBb + slice.amountBb);
      potBreakdowns.push({
        potIndex: slice.potIndex,
        amountBb: slice.amountBb,
        winners: [
          {
            seatIndex: onlyIdx,
            name: seats[onlyIdx].name,
            isHero: seats[onlyIdx].isHero,
            position: seats[onlyIdx].position,
            payoutBb: slice.amountBb,
          },
        ],
        isSplit: false,
        isUncalledReturn: true,
      });
      continue;
    }

    const sliceEvaluated = slice.eligibleSeatIndices.map((seatIndex) => ({
      seatIndex,
      eval: evalBySeat.get(seatIndex)!,
    }));
    const bestScore = Math.max(...sliceEvaluated.map((e) => e.eval.score));
    const sliceWinners = sliceEvaluated.filter((e) => e.eval.score === bestScore);
    const splitShare = roundBb(slice.amountBb / sliceWinners.length);
    let distributed = 0;

    const winnerPayouts = sliceWinners.map((w, i) => {
      const payoutBb =
        i === sliceWinners.length - 1 ? roundBb(slice.amountBb - distributed) : splitShare;
      distributed = roundBb(distributed + payoutBb);
      seats[w.seatIndex].stackBb = roundBb(seats[w.seatIndex].stackBb + payoutBb);
      contestedWinnerSet.add(w.seatIndex);
      return {
        seatIndex: w.seatIndex,
        name: seats[w.seatIndex].name,
        isHero: seats[w.seatIndex].isHero,
        position: seats[w.seatIndex].position,
        payoutBb,
      };
    });

    potBreakdowns.push({
      potIndex: slice.potIndex,
      amountBb: slice.amountBb,
      winners: winnerPayouts,
      handLabel: sliceWinners[0].eval.label,
      isSplit: sliceWinners.length > 1,
    });
  }

  for (const seatIdx of contestedWinnerSet) {
    seats[seatIdx].stats.handsWon += 1;
  }

  const contestedPots = potBreakdowns.filter((p) => !p.isUncalledReturn);
  const winnerSeatIndices = Array.from(contestedWinnerSet);
  const mainPot = contestedPots[0];

  if (contestedPots.length <= 1 && mainPot) {
    const winnerEntries = mainPot.winners.map((w) => ({
      name: w.name,
      isHero: w.isHero,
      position: w.position,
    }));
    const winnerNames = winnerEntries.map((w) => `${w.name} (${w.position})`).join(' & ');

    return {
      ...state,
      phase: 'SHOWDOWN',
      actingSeatIndex: null,
      board,
      deck,
      seats,
      winnerSeatIndices,
      winnerSummary: mainPot.isSplit
        ? `${winnerNames} split ${mainPot.amountBb}bb with ${mainPot.handLabel}.`
        : `${winnerNames} wins ${mainPot.amountBb}bb with ${mainPot.handLabel}.`,
      winnerSpec: {
        type: 'showdown',
        winners: winnerEntries,
        potBb: mainPot.amountBb,
        handLabel: mainPot.handLabel,
        isSplit: mainPot.isSplit,
        potBreakdowns,
      },
    };
  }

  // Multi-pot showdown summary (Main pot + Side pot(s))
  const parts = contestedPots.map((p, idx) => {
    const label = idx === 0 ? 'Main pot' : `Side pot ${idx}`;
    const names = p.winners.map((w) => `${w.name} (${w.position})`).join(' & ');
    return p.isSplit
      ? `${label} (${p.amountBb}bb): ${names} split with ${p.handLabel}`
      : `${label} (${p.amountBb}bb): ${names} wins with ${p.handLabel}`;
  });

  const allWinnerEntries = winnerSeatIndices.map((idx) => ({
    name: seats[idx].name,
    isHero: seats[idx].isHero,
    position: seats[idx].position,
  }));

  return {
    ...state,
    phase: 'SHOWDOWN',
    actingSeatIndex: null,
    board,
    deck,
    seats,
    winnerSeatIndices,
    winnerSummary: `${parts.join(' · ')}.`,
    winnerSpec: {
      type: 'showdown',
      winners: allWinnerEntries,
      potBb: state.potBb,
      handLabel: mainPot?.handLabel,
      isSplit: Boolean(mainPot?.isSplit),
      potBreakdowns,
    },
  };
}

function advanceStreet(state: PokerTableState): PokerTableState {
  const deck = [...state.deck];
  const board = [...state.board];
  let nextPhase: TablePhase = state.phase;

  if (state.phase === 'PREFLOP') {
    board.push(deck.shift()!, deck.shift()!, deck.shift()!);
    nextPhase = 'FLOP';
  } else if (state.phase === 'FLOP') {
    board.push(deck.shift()!);
    nextPhase = 'TURN';
  } else if (state.phase === 'TURN') {
    board.push(deck.shift()!);
    nextPhase = 'RIVER';
  } else {
    return resolveShowdown(state);
  }

  const seats = state.seats.map((s) => ({
    ...s,
    streetBetBb: 0,
    actedThisStreet: s.folded || s.allIn,
    lastActionText: s.folded ? 'Folded' : s.allIn ? 'All-In' : '',
    lastActionSpec: s.folded
      ? ({ kind: 'folded' } as TableActionSpec)
      : s.allIn
        ? ({ kind: 'all_in' } as TableActionSpec)
        : undefined,
  }));

  if (canActSeats(seats).length <= 1) {
    return resolveShowdown({
      ...state,
      phase: nextPhase,
      board,
      deck,
      seats,
      currentBetBb: 0,
      minRaiseBb: 1.0,
      lastFullRaiseIncrementBb: 1.0,
      callOnlySeatIndices: [],
    });
  }

  // Postflop starts with first active player left of Button (in 2-max that's BB!)
  const firstActor = nextSeatToAct(seats, state.buttonSeatIndex);

  return {
    ...state,
    phase: nextPhase,
    board,
    deck,
    seats,
    currentBetBb: 0,
    minRaiseBb: 1.0,
    lastFullRaiseIncrementBb: 1.0,
    callOnlySeatIndices: [],
    actingSeatIndex: firstActor,
  };
}

export function applyPlayerAction(
  state: PokerTableState,
  seatIndex: number,
  actionType: 'fold' | 'check' | 'call' | 'raise',
  raiseToBb?: number
): PokerTableState {
  if (state.phase === 'IDLE' || state.phase === 'SHOWDOWN') return state;
  if (state.actingSeatIndex !== seatIndex) return state;

  const seats = state.seats.map((s) => ({ ...s, stats: { ...s.stats } }));
  const actor = seats[seatIndex];
  const legal = getLegalActions(state, seatIndex);
  const currentStreet: Street =
    state.phase === 'PREFLOP'
      ? 'preflop'
      : state.phase === 'FLOP'
        ? 'flop'
        : state.phase === 'TURN'
          ? 'turn'
          : 'river';

  const heroAudits = [...state.heroAudits];
  if (actor.isHero && actor.cards) {
    heroAudits.push(evaluateHeroActionForAudit(state, actor, actionType, raiseToBb));
  }

  let potBb = state.potBb;
  let currentBetBb = state.currentBetBb;
  let minRaiseBb = state.minRaiseBb;
  let lastFullRaiseIncrementBb = state.lastFullRaiseIncrementBb ?? 1.0;
  let callOnlySeatIndices = [...(state.callOnlySeatIndices ?? [])];
  let preflopAggressorSeatIndex = state.preflopAggressorSeatIndex;
  let preflopRaiseCount = state.preflopRaiseCount;
  let actionText = '';
  let actionSpec: TableActionSpec = { kind: 'check' };

  // Enforce call-only restriction after an incomplete short all-in
  const effectiveActionType: 'fold' | 'check' | 'call' | 'raise' =
    actionType === 'raise' && !legal.canBetOrRaise
      ? legal.canCheck
        ? 'check'
        : 'call'
      : actionType;

  // Record 3-bet opportunity when facing a single open raise preflop
  if (currentStreet === 'preflop' && preflopRaiseCount === 1 && !actor.hadThreeBetOppThisHand) {
    actor.hadThreeBetOppThisHand = true;
    actor.stats.threeBetOpps += 1;
  }

  if (effectiveActionType === 'fold') {
    actor.folded = true;
    actor.actedThisStreet = true;
    actor.lastActionText = 'Fold';
    actor.lastActionSpec = { kind: 'fold' };
    actionText = 'Folds';
    actionSpec = { kind: 'fold' };
  } else if (effectiveActionType === 'check') {
    actor.actedThisStreet = true;
    actor.lastActionText = 'Check';
    actor.lastActionSpec = { kind: 'check' };
    actionText = 'Checks';
    actionSpec = { kind: 'check' };
  } else if (effectiveActionType === 'call') {
    const putIn = legal.callAmountBb;
    actor.stackBb = roundBb(actor.stackBb - putIn);
    actor.streetBetBb = roundBb(actor.streetBetBb + putIn);
    actor.totalInvestedBb = roundBb(actor.totalInvestedBb + putIn);
    potBb = roundBb(potBb + putIn);
    actor.actedThisStreet = true;

    if (currentStreet === 'preflop' && !actor.didVpipThisHand) {
      actor.didVpipThisHand = true;
      actor.stats.vpipHands += 1;
    } else if (currentStreet !== 'preflop') {
      actor.stats.postflopCalls += 1;
    }

    if (actor.stackBb <= 0) {
      actor.allIn = true;
      actor.lastActionText = `All-In ${actor.streetBetBb}bb`;
      actor.lastActionSpec = { kind: 'all_in', amountBb: actor.streetBetBb };
      actionText = `Calls All-In (${putIn}bb)`;
      actionSpec = { kind: 'call_allin', amountBb: putIn };
    } else {
      actor.lastActionText = `Call ${putIn}bb`;
      actor.lastActionSpec = { kind: 'call', amountBb: putIn };
      actionText = `Calls ${putIn}bb`;
      actionSpec = { kind: 'call', amountBb: putIn };
    }
  } else {
    const clampedTarget = roundBb(
      Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, raiseToBb ?? legal.minTotalBetBb))
    );
    const putIn = roundBb(clampedTarget - actor.streetBetBb);
    const raiseDelta = roundBb(clampedTarget - currentBetBb);
    const wasBet = currentBetBb === 0;
    const isFullRaise = wasBet ? clampedTarget >= 1.0 : raiseDelta >= lastFullRaiseIncrementBb;

    actor.stackBb = roundBb(actor.stackBb - putIn);
    actor.streetBetBb = clampedTarget;
    actor.totalInvestedBb = roundBb(actor.totalInvestedBb + putIn);
    potBb = roundBb(potBb + putIn);
    if (isFullRaise) {
      lastFullRaiseIncrementBb = Math.max(1.0, raiseDelta);
      minRaiseBb = roundBb(clampedTarget + lastFullRaiseIncrementBb);
      callOnlySeatIndices = [];
    } else {
      // Short all-in: preserve lastFullRaiseIncrementBb and do NOT reopen betting for prior actors
      minRaiseBb = roundBb(clampedTarget + lastFullRaiseIncrementBb);
    }
    currentBetBb = clampedTarget;

    if (currentStreet === 'preflop') {
      preflopRaiseCount += 1;
      preflopAggressorSeatIndex = seatIndex;
      if (!actor.didVpipThisHand) {
        actor.didVpipThisHand = true;
        actor.stats.vpipHands += 1;
      }
      if (!actor.didPfrThisHand) {
        actor.didPfrThisHand = true;
        actor.stats.pfrHands += 1;
      }
      if (preflopRaiseCount === 2 && !actor.didThreeBetThisHand) {
        actor.didThreeBetThisHand = true;
        actor.stats.threeBetHands += 1;
      }
    } else {
      actor.stats.postflopAggActs += 1;
    }

    for (const s of seats) {
      if (s.seatIndex === seatIndex) {
        s.actedThisStreet = true;
      } else if (!s.folded && !s.allIn) {
        if (!isFullRaise && s.actedThisStreet && !callOnlySeatIndices.includes(s.seatIndex)) {
          callOnlySeatIndices.push(s.seatIndex);
        }
        s.actedThisStreet = false;
      }
    }

    if (actor.stackBb <= 0) {
      actor.allIn = true;
      actor.lastActionText = `All-In ${clampedTarget}bb`;
      actor.lastActionSpec = { kind: 'all_in', amountBb: clampedTarget };
      actionText = `Goes All-In to ${clampedTarget}bb`;
      actionSpec = { kind: 'all_in', amountBb: clampedTarget };
    } else {
      const verb =
        currentStreet === 'preflop' && preflopRaiseCount === 2
          ? '3-Bet'
          : currentStreet === 'preflop' && preflopRaiseCount >= 3
            ? '4-Bet'
            : wasBet
              ? 'Bet'
              : 'Raise';
      const specKind: TableActionKind =
        verb === '3-Bet'
          ? 'three_bet'
          : verb === '4-Bet'
            ? 'four_bet'
            : wasBet
              ? 'bet'
              : 'raise';
      actor.lastActionText = `${verb} ${clampedTarget}bb`;
      actor.lastActionSpec = { kind: specKind, amountBb: clampedTarget };
      actionText =
        verb === '3-Bet' || verb === '4-Bet'
          ? `${verb}s to ${clampedTarget}bb`
          : `${wasBet ? 'Bets' : 'Raises to'} ${clampedTarget}bb`;
      actionSpec = { kind: specKind, amountBb: clampedTarget };
    }
  }

  const nextState: PokerTableState = {
    ...state,
    potBb,
    currentBetBb,
    minRaiseBb,
    lastFullRaiseIncrementBb,
    callOnlySeatIndices,
    preflopAggressorSeatIndex,
    preflopRaiseCount,
    seats,
    heroAudits,
    actionLog: [
      ...state.actionLog,
      {
        street: currentStreet,
        seatName: actor.name,
        isHero: actor.isHero,
        position: actor.position,
        text: actionText,
        actionSpec,
      },
    ],
  };

  if (activeSeats(seats).length === 1) {
    return resolveShowdown(nextState);
  }

  const nextActor = nextSeatToAct(seats, seatIndex);
  if (nextActor === null) {
    return advanceStreet(nextState);
  }

  return {
    ...nextState,
    actingSeatIndex: nextActor,
  };
}

/**
 * Position-looseness adjustment for preflop play:
 * UTG plays tightest (-0.09); BTN & HU BTN play widest (+0.07 to +0.14).
 */
function preflopPositionShift(pos: Position, tableSize: ArenaSize): number {
  if (tableSize === 2) {
    return pos === 'BTN' ? 0.14 : 0.08;
  }
  switch (pos) {
    case 'UTG':
      return -0.09;
    case 'HJ':
      return -0.04;
    case 'CO':
      return 0.02;
    case 'BTN':
      return 0.08;
    case 'SB':
      return 0.03;
    case 'BB':
      return 0.05;
  }
}

/**
 * Smarter position-, initiative-, texture-, and draw-aware strategic bot policy
 * across all 6 distinct poker archetypes.
 */
export function chooseBotAction(
  state: PokerTableState,
  seatIndex: number,
  rng: () => number = Math.random
): { type: 'fold' | 'check' | 'call' | 'raise'; raiseToBb?: number } {
  const seat = state.seats[seatIndex];
  const legal = getLegalActions(state, seatIndex);
  const rawStrength = seat.cards ? handStrengthScore(seat.cards, state.board) : 0.4;
  const draw = seat.cards
    ? detectDrawBonus(seat.cards, state.board)
    : { flushDraw: false, straightDraw: false, bonus: 0 };
  const wetBoard = isBoardWet(state.board);
  const contenders = activeSeats(state.seats).length;
  const isMultiway = contenders >= 3;
  const hasInitiative = state.preflopAggressorSeatIndex === seatIndex;
  const toCall = legal.callAmountBb;
  const potOdds = toCall > 0 ? requiredEquityPct(state.potBb, toCall) / 100 : 0;

  // Archetype parameters: [loosenessShift, aggressionBoost, bluffFreq, callStickiness]
  const profile: Record<BotArchetype, [number, number, number, number]> = {
    'Balanced Reg': [0.0, 0.05, 0.16, 0.0],
    'Tight-Aggressive': [-0.07, 0.1, 0.1, -0.03],
    'Loose-Aggressive': [0.09, 0.15, 0.27, 0.03],
    'Calling Station': [0.13, -0.15, 0.03, 0.16],
    'Tight Nit': [-0.15, -0.05, 0.03, -0.1],
    Maniac: [0.17, 0.24, 0.42, 0.08],
  };

  const [looseShift, aggBoost, bluffFreq, callStickiness] =
    seat.archetype === 'Hero' ? [0, 0, 0, 0] : profile[seat.archetype];

  const posShift =
    state.phase === 'PREFLOP' ? preflopPositionShift(seat.position, state.config.tableSize) : 0;
  const multiwayPenalty = isMultiway && state.phase !== 'PREFLOP' ? -0.05 : 0;
  const noise = (rng() - 0.5) * 0.07;

  const effStrength = Math.min(
    1,
    Math.max(0, rawStrength + draw.bonus * 0.7 + looseShift + posShift + multiwayPenalty + noise)
  );

  const pickSizing = () => {
    if (state.phase === 'PREFLOP') {
      if (state.currentBetBb <= 1.0) {
        const openSize = seat.position === 'SB' ? 3.0 : state.config.tableSize === 2 ? 2.2 : 2.5;
        return Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, openSize));
      }
      const mult = seat.archetype === 'Maniac' ? 3.5 : 3.0;
      const target = roundBb(Math.min(legal.maxTotalBetBb, state.currentBetBb * mult));
      return Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, target));
    }

    // Postflop texture-aware sizing: smaller c-bets on dry boards (33-50%), larger on wet boards (66-75%)
    const potFrac =
      seat.archetype === 'Maniac'
        ? 0.85
        : wetBoard || effStrength > 0.8
          ? 0.72
          : hasInitiative && state.phase === 'FLOP'
            ? 0.38
            : 0.52;
    const raw =
      state.currentBetBb === 0
        ? Math.max(1.0, state.potBb * potFrac)
        : state.currentBetBb * 2.6;
    return roundBb(Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, raw)));
  };

  // Preflop open / 3-bet / defense logic
  if (state.phase === 'PREFLOP') {
    if (legal.canCheck) {
      if (legal.canBetOrRaise && effStrength > 0.64 - aggBoost) {
        return { type: 'raise', raiseToBb: pickSizing() };
      }
      return { type: 'check' };
    }

    const facingOpen = state.preflopRaiseCount === 1;
    const facing3BetPlus = state.preflopRaiseCount >= 2;

    if (legal.canBetOrRaise && state.currentBetBb < state.config.startingStackBb * 0.35) {
      const raiseThresh = facing3BetPlus
        ? 0.84 - aggBoost * 0.4
        : facingOpen
          ? 0.74 - aggBoost
          : 0.56 - aggBoost * 0.7;
      const light3Bet = facingOpen && rng() < bluffFreq * 0.45 && rawStrength > 0.42;
      if (effStrength > raiseThresh || light3Bet) {
        return { type: 'raise', raiseToBb: pickSizing() };
      }
    }

    const callThreshold = facing3BetPlus
      ? potOdds + 0.24 - callStickiness
      : facingOpen
        ? potOdds + 0.14 - callStickiness
        : potOdds + 0.06 - callStickiness;

    if (effStrength >= callThreshold) {
      return { type: 'call' };
    }
    return { type: 'fold' };
  }

  // Postflop: checked to bot
  if (legal.canCheck) {
    const cbetBoost = hasInitiative && state.phase === 'FLOP' && !isMultiway ? 0.12 : 0;
    const semiBluff = (draw.flushDraw || draw.straightDraw) && rng() < 0.55 + aggBoost;
    const pureBluff = !isMultiway && rng() < bluffFreq * (wetBoard ? 0.75 : 1.0);

    if (
      legal.canBetOrRaise &&
      (effStrength > 0.62 - aggBoost - cbetBoost || semiBluff || pureBluff)
    ) {
      return { type: 'raise', raiseToBb: pickSizing() };
    }
    return { type: 'check' };
  }

  // Postflop: facing a bet or raise
  const semiBluffRaise =
    (draw.flushDraw || draw.straightDraw) &&
    state.phase !== 'RIVER' &&
    rng() < bluffFreq * 0.55;

  if (
    legal.canBetOrRaise &&
    state.currentBetBb < state.config.startingStackBb * 0.45 &&
    (effStrength > 0.78 - aggBoost || semiBluffRaise || (rng() < bluffFreq * 0.28 && state.phase !== 'RIVER'))
  ) {
    return { type: 'raise', raiseToBb: pickSizing() };
  }

  if (effStrength >= potOdds + 0.07 - callStickiness) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}
