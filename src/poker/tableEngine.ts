import type { Card, DecisionGrade, Position, Street } from './types';
import { accuracyFromGrade, gradeFromFrequency } from './types';
import {
  canonicalHandKey,
  cardKey,
  createDeck,
  evaluateHand,
  handStrengthScore,
  shuffleDeck,
} from './evaluator';
import { requiredEquityPct } from './math';
import {
  analyzeHeroDraws,
  decideBotAction,
  evaluatePostflopGtoFreqs,
  extractPostflopContext,
  extractPreflopContext,
  getGtoPreflopFreqs,
} from './botAi';

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
export type BotDifficulty = 'casual' | 'standard' | 'pro';
export type ArenaFormat = 'cash' | 'sng_turbo_3' | 'sng_6max';

export const SNG_BLIND_MULTIPLIERS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 25] as const;

export function getSngBlindLevel(
  handNumber: number,
  format?: ArenaFormat
): { level: number; multiplier: number; handsPerLevel: number } {
  const handsPerLevel = format === 'sng_turbo_3' ? 3 : 5;
  const idx = Math.min(
    SNG_BLIND_MULTIPLIERS.length - 1,
    Math.floor(Math.max(0, handNumber - 1) / handsPerLevel)
  );
  return {
    level: idx + 1,
    multiplier: SNG_BLIND_MULTIPLIERS[idx],
    handsPerLevel,
  };
}

export interface ArenaConfig {
  tableSize: ArenaSize;
  startingStackBb: 50 | 100 | 200;
  arenaFormat?: ArenaFormat;
  sbBb?: number;
  anteBb?: number;
  straddleEnabled?: boolean;
  runItTwiceEnabled?: boolean;
  poolPreset: PoolPresetId;
  botArchetypes: BotArchetype[]; // Length = tableSize - 1
  heroPositionLock: HeroPositionLock;
  blindReadMode: boolean;
  fastFold: boolean;
  speed: BotSpeed;
  botDifficulty?: BotDifficulty;
}

export interface SeatHudStats {
  handsDealt: number;
  vpipHands: number;
  pfrHands: number;
  threeBetHands: number;
  threeBetOpps: number;
  cbetOpps: number;
  cbetHands: number;
  foldToCbetOpps: number;
  foldToCbetHands: number;
  sawFlopHands: number;
  wtsdHands: number;
  postflopAggActs: number;
  postflopCalls: number;
  handsWon: number;
}

export interface HudDisplayMetrics {
  vpipPct: number;
  pfrPct: number;
  threeBetPct: number;
  cbetPct: number;
  foldToCbetPct: number;
  wtsdPct: number;
  af: string;
}

export type TableActionKind =
  | 'post_ante'
  | 'post_sb'
  | 'post_bb'
  | 'post_straddle'
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
  | 'all_in'
  | 'show_hand';

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
  runBoard?: 1 | 2;
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
  didSawFlopThisHand?: boolean;
  hadCbetOppThisHand?: boolean;
  hadFoldToCbetOppThisHand?: boolean;
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
  flopCbetActive?: boolean;
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
  rabbitHuntBoard?: Card[];
  heroShowedUncontested?: boolean;
  runItTwiceBoards?: [Card[], Card[]] | null;
  awaitingRunItTwiceChoice?: boolean;
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
  botDifficulty: 'standard',
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
    cbetOpps: 0,
    cbetHands: 0,
    foldToCbetOpps: 0,
    foldToCbetHands: 0,
    sawFlopHands: 0,
    wtsdHands: 0,
    postflopAggActs: 0,
    postflopCalls: 0,
    handsWon: 0,
  };
}

export const emptyHudStats = createEmptyHudStats;

export function computeHudDisplay(stats: SeatHudStats): HudDisplayMetrics {
  const h = Math.max(1, stats.handsDealt);
  const vpipPct = stats.handsDealt > 0 ? Math.round((stats.vpipHands / h) * 100) : 0;
  const pfrPct = stats.handsDealt > 0 ? Math.round((stats.pfrHands / h) * 100) : 0;
  const threeBetPct =
    stats.threeBetOpps > 0
      ? Math.round((stats.threeBetHands / stats.threeBetOpps) * 100)
      : 0;
  const cbetPct =
    stats.cbetOpps > 0 ? Math.round((stats.cbetHands / stats.cbetOpps) * 100) : 0;
  const foldToCbetPct =
    stats.foldToCbetOpps > 0
      ? Math.round((stats.foldToCbetHands / stats.foldToCbetOpps) * 100)
      : 0;
  const wtsdPct =
    stats.sawFlopHands > 0
      ? Math.round((stats.wtsdHands / stats.sawFlopHands) * 100)
      : 0;
  const af =
    stats.postflopCalls === 0
      ? stats.postflopAggActs > 0
        ? `${stats.postflopAggActs.toFixed(1)}`
        : '—'
      : (stats.postflopAggActs / stats.postflopCalls).toFixed(1);

  return { vpipPct, pfrPct, threeBetPct, cbetPct, foldToCbetPct, wtsdPct, af };
}

export function roundBb(v: number): number {
  const rounded = Math.round(v * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
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
      didSawFlopThisHand: false,
      hadCbetOppThisHand: false,
      hadFoldToCbetOppThisHand: false,
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
      didSawFlopThisHand: false,
      hadCbetOppThisHand: false,
      hadFoldToCbetOppThisHand: false,
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
    flopCbetActive: false,
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
    rabbitHuntBoard: undefined,
    heroShowedUncontested: false,
    runItTwiceBoards: null,
    awaitingRunItTwiceChoice: false,
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

  const isSng =
    prev.config.arenaFormat === 'sng_turbo_3' || prev.config.arenaFormat === 'sng_6max';
  const nextHandNum = prev.handNumber + 1;
  const sngLevel = isSng ? getSngBlindLevel(nextHandNum, prev.config.arenaFormat) : null;
  const blindMult = sngLevel ? sngLevel.multiplier : 1;

  // Auto top-up short stacks below 20% of starting stack in cash mode; SNG never tops up busted seats
  const minThreshold = Math.max(15, defaultStack * 0.2);
  let seats: TableSeat[] = prev.seats.map((s) => {
    const toppedStack = isSng
      ? roundBb(Math.max(0, s.stackBb))
      : s.stackBb < minThreshold
        ? defaultStack
        : roundBb(s.stackBb);
    const busted = isSng && toppedStack <= 0;
    const c1 = busted ? null : deck[cursor++];
    const c2 = busted ? null : deck[cursor++];
    return {
      ...s,
      stackBb: toppedStack,
      streetBetBb: 0,
      totalInvestedBb: 0,
      cards: c1 && c2 ? [c1, c2] : null,
      folded: busted,
      allIn: false,
      actedThisStreet: busted,
      lastActionText: busted ? 'Eliminated' : '',
      lastActionSpec: undefined,
      didVpipThisHand: false,
      didPfrThisHand: false,
      didThreeBetThisHand: false,
      hadThreeBetOppThisHand: false,
      didSawFlopThisHand: false,
      hadCbetOppThisHand: false,
      hadFoldToCbetOppThisHand: false,
      stats: {
        ...s.stats,
        handsDealt: busted ? s.stats.handsDealt : s.stats.handsDealt + 1,
      },
    };
  });

  seats = assignPositions(seats, nextBtn, size);

  const actionLog: TableActionLogItem[] = [];
  let potBb = 0;

  // Optional Antes: every active seat with chips posts into potBb & totalInvestedBb (NOT streetBetBb or currentBetBb)
  const anteTarget = roundBb((prev.config.anteBb ?? 0) * blindMult);
  if (anteTarget > 0) {
    for (const seat of seats) {
      if (seat.folded || seat.stackBb <= 0) continue;
      const posted = roundBb(Math.min(seat.stackBb, anteTarget));
      if (posted <= 0) continue;
      seat.stackBb = roundBb(seat.stackBb - posted);
      seat.totalInvestedBb = roundBb(seat.totalInvestedBb + posted);
      if (seat.stackBb <= 0) seat.allIn = true;
      potBb = roundBb(potBb + posted);
      actionLog.push({
        street: 'preflop',
        seatName: seat.name,
        isHero: seat.isHero,
        position: seat.position,
        text: `Posts Ante ${posted}bb`,
        actionSpec: { kind: 'post_ante', amountBb: posted },
      });
    }
  }

  // Heads-Up rule: BTN posts SB (0.5bb) and acts FIRST preflop; BB posts 1bb and acts first postflop
  const activeSeats = seats.filter((s) => !s.folded && s.stackBb > 0);
  const sbSeat =
    (size === 2
      ? seats.find((s) => s.position === 'BTN' && !s.folded)
      : seats.find((s) => s.position === 'SB' && !s.folded)) ??
    activeSeats[0] ??
    seats[0];
  const bbSeat =
    seats.find((s) => s.position === 'BB' && !s.folded && s.seatIndex !== sbSeat.seatIndex) ??
    activeSeats.find((s) => s.seatIndex !== sbSeat.seatIndex) ??
    seats[1 % size];

  const postBlind = (seat: TableSeat, amount: number, kind: 'post_sb' | 'post_bb') => {
    const posted = roundBb(Math.min(seat.stackBb, amount));
    seat.stackBb = roundBb(seat.stackBb - posted);
    seat.streetBetBb = roundBb(seat.streetBetBb + posted);
    seat.totalInvestedBb = roundBb(seat.totalInvestedBb + posted);
    if (seat.stackBb <= 0) seat.allIn = true;
    seat.lastActionText = `Blind ${posted}bb`;
    seat.lastActionSpec = { kind, amountBb: posted };
    return posted;
  };

  const sbAmt = postBlind(sbSeat, roundBb((prev.config.sbBb ?? 0.5) * blindMult), 'post_sb');
  const bbAmt = postBlind(bbSeat, roundBb(1.0 * blindMult), 'post_bb');
  potBb = roundBb(potBb + sbAmt + bbAmt);

  actionLog.push(
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
    }
  );

  let currentBetBb = 1.0;
  let lastFullRaiseIncrementBb = 1.0;
  let minRaiseBb = 2.0;
  // First preflop actor: seat immediately left of BB (in 2-max that wraps to BTN/SB!)
  let firstPreflopIndex = (bbSeat.seatIndex + 1) % size;

  // Optional UTG Straddle (2.0bb live blind on 4-max+ tables)
  if (prev.config.straddleEnabled && size >= 4) {
    const utgIdx = (bbSeat.seatIndex + 1) % size;
    const utgSeat = seats[utgIdx];
    const straddleAmt = roundBb(Math.min(utgSeat.stackBb, 2.0));
    if (straddleAmt > 0) {
      utgSeat.stackBb = roundBb(utgSeat.stackBb - straddleAmt);
      utgSeat.streetBetBb = roundBb(utgSeat.streetBetBb + straddleAmt);
      utgSeat.totalInvestedBb = roundBb(utgSeat.totalInvestedBb + straddleAmt);
      if (utgSeat.stackBb <= 0) utgSeat.allIn = true;
      utgSeat.actedThisStreet = false; // Live option preflop!
      utgSeat.lastActionText = `Straddle ${straddleAmt}bb`;
      utgSeat.lastActionSpec = { kind: 'post_straddle', amountBb: straddleAmt };
      potBb = roundBb(potBb + straddleAmt);
      currentBetBb = Math.max(currentBetBb, straddleAmt);
      lastFullRaiseIncrementBb = Math.max(1, roundBb(straddleAmt - 1));
      minRaiseBb = roundBb(currentBetBb + lastFullRaiseIncrementBb);
      actionLog.push({
        street: 'preflop',
        seatName: utgSeat.name,
        isHero: utgSeat.isHero,
        position: utgSeat.position,
        text: `Straddles ${straddleAmt}bb`,
        actionSpec: { kind: 'post_straddle', amountBb: straddleAmt },
      });
      firstPreflopIndex = (utgIdx + 1) % size;
    }
  }

  return {
    ...prev,
    handNumber: prev.handNumber + 1,
    phase: 'PREFLOP',
    buttonSeatIndex: nextBtn,
    actingSeatIndex: firstPreflopIndex,
    preflopAggressorSeatIndex: null,
    preflopRaiseCount: 0,
    flopCbetActive: false,
    potBb,
    currentBetBb,
    minRaiseBb,
    lastFullRaiseIncrementBb,
    callOnlySeatIndices: [],
    board: [],
    deck: deck.slice(cursor),
    seats,
    actionLog,
    heroAudits: [],
    winnerSummary: null,
    winnerSpec: null,
    winnerSeatIndices: [],
    rabbitHuntBoard: undefined,
    heroShowedUncontested: false,
    runItTwiceBoards: null,
    awaitingRunItTwiceChoice: false,
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
  if (curr.awaitingRunItTwiceChoice) {
    curr = resolveRunItTwice(curr, false);
    return startNewHand(curr, rng);
  }

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

  if (curr.awaitingRunItTwiceChoice) {
    curr = resolveRunItTwice(curr, false);
  } else if (curr.phase !== 'SHOWDOWN') {
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
 * Computes effective call amount and effective pot size by capping against the seat's
 * remaining stack and excluding uncallable opponent excess above `streetBetBb + stackBb`.
 */
export function computeEffectivePotOdds(
  state: PokerTableState,
  seat: TableSeat
): {
  effectiveToCall: number;
  effectivePotBb: number;
  reqEqPct: number;
  reqEq: number;
} {
  const rawToCall = Math.max(0, roundBb(state.currentBetBb - seat.streetBetBb));
  const effectiveToCall = Math.min(rawToCall, seat.stackBb);
  if (effectiveToCall <= 0) {
    return {
      effectiveToCall: 0,
      effectivePotBb: state.potBb,
      reqEqPct: 0,
      reqEq: 0,
    };
  }
  const maxCommitThisStreet = roundBb(seat.streetBetBb + seat.stackBb);
  const seatExcess = roundBb(
    state.seats.reduce((sum, other) => {
      if (other.seatIndex === seat.seatIndex) return sum;
      return sum + Math.max(0, roundBb(other.streetBetBb - maxCommitThisStreet));
    }, 0)
  );
  const minBettorExcess = Math.max(0, roundBb(state.currentBetBb - maxCommitThisStreet));
  const uncallableExcessBb = Math.max(seatExcess, minBettorExcess);
  const effectivePotBb = Math.max(effectiveToCall, roundBb(state.potBb - uncallableExcessBb));
  const reqEqPct = requiredEquityPct(effectivePotBb, effectiveToCall);
  return {
    effectiveToCall,
    effectivePotBb,
    reqEqPct,
    reqEq: reqEqPct / 100,
  };
}

/**
 * Draw detector delegating to analyzeHeroDraws (distinguishes nut/non-nut FD, OESD vs gutshot,
 * and scales flop vs turn equity properly).
 */
export function detectDrawBonus(hole: [Card, Card], board: Card[]): {
  flushDraw: boolean;
  straightDraw: boolean;
  bonus: number;
} {
  const info = analyzeHeroDraws(hole, board);
  return {
    flushDraw: info.flushDraw,
    straightDraw: info.straightDraw,
    bonus: info.drawEquityBoost,
  };
}

function getPrimaryVillain(state: PokerTableState): TableSeat | null {
  // Postflop: prioritize the actual current street aggressor!
  if (state.phase !== 'PREFLOP' && state.phase !== 'IDLE') {
    const ctx = extractPostflopContext(state, 0);
    if (
      ctx.lastAggressorSeatIndex !== null &&
      ctx.lastAggressorSeatIndex !== 0 &&
      !state.seats[ctx.lastAggressorSeatIndex]?.folded
    ) {
      return state.seats[ctx.lastAggressorSeatIndex];
    }
  }

  if (
    state.preflopAggressorSeatIndex !== null &&
    state.preflopAggressorSeatIndex !== 0 &&
    !state.seats[state.preflopAggressorSeatIndex]?.folded
  ) {
    return state.seats[state.preflopAggressorSeatIndex];
  }
  const activeBots = state.seats.filter((s) => !s.isHero && !s.folded);
  if (activeBots.length === 0) return null;
  return activeBots.sort((a, b) => {
    if (b.streetBetBb !== a.streetBetBb) return b.streetBetBb - a.streetBetBb;
    return b.totalInvestedBb - a.totalInvestedBb;
  })[0];
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

function downgradeGrade(grade: DecisionGrade, steps = 1): DecisionGrade {
  const order: DecisionGrade[] = ['Optimal', 'Acceptable', 'Inaccuracy', 'Mistake', 'Blunder'];
  const idx = order.indexOf(grade);
  return order[Math.min(order.length - 1, Math.max(0, idx + steps))];
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
  const legal = getLegalActions(state, seat.seatIndex);
  const effPotOdds = computeEffectivePotOdds(state, seat);
  const { effectiveToCall, effectivePotBb, reqEqPct: rawReqEqPct } = effPotOdds;
  const reqEqPct = Math.round(rawReqEqPct);
  const villain = getPrimaryVillain(state);
  const chosenAmount = roundBb(raiseToBb ?? state.minRaiseBb);

  let recommended: 'fold' | 'check' | 'call' | 'raise' = 'check';
  let note = '';
  let reason: AuditBaseReason = 'pot_control';
  let grade: DecisionGrade = 'Optimal';
  let strengthForTip = handStrengthScore(cards, state.board);

  if (street === 'preflop') {
    // 100% aligned with TurnRiver's PREFLOP_TEMPLATES via shared GTO preflop solver
    const preCtx = extractPreflopContext(state, seat.seatIndex, legal);
    const freqs = getGtoPreflopFreqs(preCtx);

    const actionFreqs: Record<'fold' | 'check' | 'call' | 'raise', number> = legal.canCheck
      ? { fold: 0, check: freqs.call + freqs.fold, call: 0, raise: freqs.raise }
      : { fold: freqs.fold, check: 0, call: freqs.call, raise: freqs.raise };

    const entries = (Object.entries(actionFreqs) as [('fold' | 'check' | 'call' | 'raise'), number][])
      .sort((a, b) => b[1] - a[1]);
    recommended = entries[0][0];
    const bestFreq = entries[0][1];
    const chosenFreq = actionFreqs[actionType];
    grade = gradeFromFrequency(chosenFreq, bestFreq);

    // Preflop sizing sanity check (catches absurd 100bb open-shoves / massive over-raises)
    if (actionType === 'raise') {
      if (state.preflopRaiseCount === 0 && chosenAmount >= 15 && seat.stackBb >= 35) {
        grade = chosenFreq === 0 ? 'Blunder' : downgradeGrade(grade, chosenAmount >= 30 ? 2 : 1);
      } else if (state.preflopRaiseCount === 1 && chosenAmount >= 35 && seat.stackBb >= 60 && chosenFreq < 50) {
        grade = chosenFreq === 0 ? 'Blunder' : downgradeGrade(grade, 1);
      }
    }

    if (recommended === 'raise') {
      reason = state.preflopRaiseCount === 0 ? 'strong_value' : 'value_protect_raise';
      note =
        state.preflopRaiseCount === 0
          ? `Strong holding (${handKey}) opens for value and initiative from ${seat.position}.`
          : `Strong holding (${handKey}) supports raising for value and initiative from ${seat.position}.`;
    } else if (recommended === 'call') {
      reason = 'pot_odds_call';
      note = `Facing ${effectiveToCall}bb requires ${reqEqPct}% equity; ${handKey} continues cleanly with a call.`;
    } else if (recommended === 'check') {
      reason = 'pot_control';
      note = `Medium strength hand (${handKey}) checks cleanly to realize equity from ${seat.position}.`;
    } else {
      reason = 'pot_odds_fold';
      note =
        state.preflopRaiseCount === 0
          ? `Marginal off-range hand (${handKey}) prefers folding from ${seat.position} rather than open-limping.`
          : `Facing ${effectiveToCall}bb requires ${reqEqPct}% equity; folding ${handKey} preserves stack.`;
    }
  } else {
    // Postflop: realistic range-equity & GTO frequency distribution
    const pf = evaluatePostflopGtoFreqs(state, seat, effPotOdds);
    strengthForTip = pf.hand.rawStrength;

    // Apply light exploitative adjustment against extreme known archetypes
    let { fold, check, call, raise } = pf;
    if (!state.config.blindReadMode && villain && villain.archetype !== 'Hero') {
      if (villain.archetype === 'Tight Nit' && effectiveToCall > 0 && call > 0 && fold > 0) {
        const shift = Math.min(call, 12);
        call -= shift;
        fold += shift;
      } else if (
        (villain.archetype === 'Maniac' || villain.archetype === 'Loose-Aggressive') &&
        effectiveToCall > 0 &&
        pf.hand.isRealPairOrBetter &&
        fold > 0
      ) {
        const shift = Math.min(fold, 14);
        fold -= shift;
        call += shift;
      } else if (villain.archetype === 'Calling Station' && effectiveToCall === 0) {
        if (pf.hand.bucket === 'pure_air' && raise > 0) {
          const shift = Math.min(raise, 15);
          raise -= shift;
          check += shift;
        }
      }
    }

    const actionFreqs: Record<'fold' | 'check' | 'call' | 'raise', number> = {
      fold,
      check,
      call,
      raise,
    };
    const entries = (Object.entries(actionFreqs) as [('fold' | 'check' | 'call' | 'raise'), number][])
      .sort((a, b) => b[1] - a[1]);
    recommended = entries[0][0];
    const bestFreq = entries[0][1];
    const chosenFreq = actionFreqs[actionType];
    grade = gradeFromFrequency(chosenFreq, bestFreq);

    // Postflop sizing sanity check (penalize absurd 3x+ pot overbets with non-nuts at deep SPR)
    if (
      actionType === 'raise' &&
      pf.ctx.effectiveSpr > 2.0 &&
      chosenAmount > Math.max(effectivePotBb * 2.5, state.currentBetBb * 5) &&
      pf.hand.bucket !== 'nuts_strong_value'
    ) {
      grade = downgradeGrade(grade, 1);
    }

    reason = pf.primaryReason;
    if (effectiveToCall === 0) {
      if (recommended === 'raise') {
        note =
          reason === 'semi_bluff_cbet'
            ? `Strong draw or dry-board range advantage (${handKey}) supports betting/c-betting on ${street}.`
            : `Strong holding (${handKey}) builds value by betting on ${street}.`;
      } else if (reason === 'weak_showdown') {
        note = `Weak showdown value (${handKey}) prefers checking or selective blocker bluffing rather than thin betting.`;
      } else {
        note = `Medium strength hand (${handKey}) plays cleanly as a check for pot control on ${street}.`;
      }
    } else if (recommended === 'raise') {
      note = `High equity (~${pf.estEquityPct}%) vs current bet supports raising for value and protection.`;
    } else if (recommended === 'call') {
      note = `Facing ${effectiveToCall}bb requires ${reqEqPct}% equity (~${pf.estEquityPct}% est.); calling is profitable.`;
    } else {
      note = `Facing ${effectiveToCall}bb requires ${reqEqPct}% equity (~${pf.estEquityPct}% est.); folding preserves stack.`;
    }
  }

  let exploitTipKind: AuditExploitTipKind | undefined;
  if (!state.config.blindReadMode) {
    const tip = buildExploitativeTip(villain, recommended, strengthForTip);
    note += tip.text;
    exploitTipKind = tip.kind;
  }

  const chosenLabel =
    actionType === 'fold'
      ? 'Fold'
      : actionType === 'check'
        ? 'Check'
        : actionType === 'call'
          ? `Call ${effectiveToCall}bb`
          : `${state.currentBetBb === 0 ? 'Bet' : 'Raise'} ${chosenAmount}bb`;

  const chosenActionSpec: TableActionSpec =
    actionType === 'fold'
      ? { kind: 'fold' }
      : actionType === 'check'
        ? { kind: 'check' }
        : actionType === 'call'
          ? { kind: 'call', amountBb: effectiveToCall }
          : { kind: state.currentBetBb === 0 ? 'bet' : 'raise', amountBb: chosenAmount };

  const recLabel =
    recommended === 'fold'
      ? 'Fold'
      : recommended === 'check'
        ? 'Check'
        : recommended === 'call'
          ? `Call ${effectiveToCall}bb`
          : state.currentBetBb === 0
            ? 'Bet'
            : 'Raise';

  const recommendedActionSpec: TableActionSpec =
    recommended === 'fold'
      ? { kind: 'fold' }
      : recommended === 'check'
        ? { kind: 'check' }
        : recommended === 'call'
          ? { kind: 'call', amountBb: effectiveToCall }
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
      toCallBb: effectiveToCall,
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
      awaitingRunItTwiceChoice: false,
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

  const dealtFlopAtShowdown = board.length < 3;
  while (board.length < 5 && deck.length > 0) {
    board.push(deck.shift()!);
  }

  for (const c of contenders) {
    const seat = seats[c.seatIndex];
    if (dealtFlopAtShowdown && !seat.didSawFlopThisHand) {
      seat.didSawFlopThisHand = true;
      seat.stats.sawFlopHands += 1;
    }
    seat.stats.wtsdHands += 1;
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
  } else if (slices.length > 0 && Math.abs(totalFromSlices - state.potBb) >= 0.005) {
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
      awaitingRunItTwiceChoice: false,
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
    awaitingRunItTwiceChoice: false,
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

/**
 * Reveals the remaining undealt community cards after an early uncontested fold
 * without mutating stacks, pot, or live deck integrity.
 */
export function revealRabbitHunt(state: PokerTableState): PokerTableState {
  if (state.phase !== 'SHOWDOWN' || state.board.length >= 5 || state.rabbitHuntBoard) {
    return state;
  }
  const needed = 5 - state.board.length;
  const usedKeys = new Set<string>();
  for (const c of state.board) usedKeys.add(cardKey(c));
  for (const s of state.seats) {
    if (s.cards) {
      usedKeys.add(cardKey(s.cards[0]));
      usedKeys.add(cardKey(s.cards[1]));
    }
  }
  const extra = state.deck.filter((c) => !usedKeys.has(cardKey(c))).slice(0, needed);
  if (extra.length === 0) return state;

  return {
    ...state,
    rabbitHuntBoard: [...state.board, ...extra],
  };
}

/**
 * Allows Hero to voluntarily flash their winning hand after winning a pot uncontested.
 */
export function toggleHeroShowHand(state: PokerTableState): PokerTableState {
  if (
    state.phase !== 'SHOWDOWN' ||
    state.winnerSpec?.type !== 'uncontested' ||
    !state.winnerSpec.winners.some((w) => w.isHero) ||
    state.heroShowedUncontested
  ) {
    return state;
  }
  const hero = state.seats.find((s) => s.isHero);
  if (!hero) return state;

  const street: Street =
    state.board.length >= 5
      ? 'river'
      : state.board.length === 4
        ? 'turn'
        : state.board.length === 3
          ? 'flop'
          : 'preflop';
  const cardsSuffix = hero.cards
    ? ` (${hero.cards[0].rank}${hero.cards[0].suit} ${hero.cards[1].rank}${hero.cards[1].suit})`
    : '';

  return {
    ...state,
    heroShowedUncontested: true,
    actionLog: [
      ...state.actionLog,
      {
        street,
        seatName: hero.name,
        isHero: true,
        position: hero.position,
        text: `Shows hand${cardsSuffix}`,
        actionSpec: { kind: 'show_hand' },
      },
    ],
  };
}

/**
 * Resolves a paused all-in runout either once (normal showdown) or twice (two completely
 * disjoint 5-card runouts splitting every contested pot slice 50/50 with exact chip conservation).
 */
export function resolveRunItTwice(state: PokerTableState, runTwice: boolean): PokerTableState {
  if (state.phase === 'IDLE' || state.phase === 'SHOWDOWN') {
    return state;
  }
  if (!runTwice) {
    return resolveShowdown({
      ...state,
      awaitingRunItTwiceChoice: false,
      runItTwiceBoards: null,
    });
  }

  const contenders = activeSeats(state.seats);
  const remaining = 5 - state.board.length;
  if (contenders.length < 2 || remaining <= 0) {
    return resolveShowdown({
      ...state,
      awaitingRunItTwiceChoice: false,
      runItTwiceBoards: null,
    });
  }

  const usedKeys = new Set<string>();
  for (const c of state.board) usedKeys.add(cardKey(c));
  for (const s of state.seats) {
    if (s.cards) {
      usedKeys.add(cardKey(s.cards[0]));
      usedKeys.add(cardKey(s.cards[1]));
    }
  }
  const availableDeck = state.deck.filter((c) => !usedKeys.has(cardKey(c)));
  if (availableDeck.length < remaining * 2) {
    return resolveShowdown({
      ...state,
      awaitingRunItTwiceChoice: false,
      runItTwiceBoards: null,
    });
  }

  const deck = [...availableDeck];
  const runout1 = deck.splice(0, remaining);
  const runout2 = deck.splice(0, remaining);
  const board1: Card[] = [...state.board, ...runout1];
  const board2: Card[] = [...state.board, ...runout2];

  const seats = state.seats.map((s) => ({ ...s, stats: { ...s.stats } }));
  const dealtFlopHere = state.board.length < 3;
  for (const c of contenders) {
    const seat = seats[c.seatIndex];
    if (dealtFlopHere && !seat.didSawFlopThisHand) {
      seat.didSawFlopThisHand = true;
      seat.stats.sawFlopHands += 1;
    }
    seat.stats.wtsdHands += 1;
  }

  const evalBoard1 = new Map<number, ReturnType<typeof evaluateHand>>();
  const evalBoard2 = new Map<number, ReturnType<typeof evaluateHand>>();
  for (const c of contenders) {
    evalBoard1.set(c.seatIndex, evaluateHand([...c.cards!, ...board1]));
    evalBoard2.set(c.seatIndex, evaluateHand([...c.cards!, ...board2]));
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
  } else if (slices.length > 0 && Math.abs(totalFromSlices - state.potBb) >= 0.005) {
    slices[0].amountBb = roundBb(slices[0].amountBb + (state.potBb - totalFromSlices));
  }

  const potBreakdowns: PotPayoutBreakdown[] = [];
  const contestedWinnerSet = new Set<number>();
  let nextPotIndex = 0;

  const awardHalf = (
    halfAmount: number,
    eligibleSeatIndices: number[],
    evalMap: Map<number, ReturnType<typeof evaluateHand>>,
    runBoard: 1 | 2
  ) => {
    if (halfAmount <= 0) return;
    const evaluated = eligibleSeatIndices.map((seatIndex) => ({
      seatIndex,
      eval: evalMap.get(seatIndex)!,
    }));
    const bestScore = Math.max(...evaluated.map((e) => e.eval.score));
    const boardWinners = evaluated.filter((e) => e.eval.score === bestScore);
    const splitShare = roundBb(halfAmount / boardWinners.length);
    let distributed = 0;

    const winnerPayouts = boardWinners.map((w, i) => {
      const payoutBb =
        i === boardWinners.length - 1 ? roundBb(halfAmount - distributed) : splitShare;
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
      potIndex: nextPotIndex++,
      amountBb: halfAmount,
      winners: winnerPayouts,
      handLabel: boardWinners[0].eval.label,
      isSplit: boardWinners.length > 1,
      runBoard,
    });
  };

  for (const slice of slices) {
    if (slice.amountBb <= 0 || slice.eligibleSeatIndices.length === 0) continue;

    // Uncalled excess bet returns intact without splitting across runouts
    if (slice.eligibleSeatIndices.length === 1) {
      const onlyIdx = slice.eligibleSeatIndices[0];
      seats[onlyIdx].stackBb = roundBb(seats[onlyIdx].stackBb + slice.amountBb);
      potBreakdowns.push({
        potIndex: nextPotIndex++,
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

    // Split contested slice 50/50 across Board 1 and Board 2, assigning any odd remainder cleanly to Board 1
    const isTenthMultiple =
      Math.abs(slice.amountBb * 10 - Math.round(slice.amountBb * 10)) < 1e-6;
    const board2Amount = isTenthMultiple
      ? Math.floor(Math.round(slice.amountBb * 10) / 2) / 10
      : Math.floor(Math.round(slice.amountBb * 100) / 2) / 100;
    const board1Amount = roundBb(slice.amountBb - board2Amount);

    awardHalf(board1Amount, slice.eligibleSeatIndices, evalBoard1, 1);
    awardHalf(board2Amount, slice.eligibleSeatIndices, evalBoard2, 2);
  }

  for (const seatIdx of contestedWinnerSet) {
    seats[seatIdx].stats.handsWon += 1;
  }

  const contestedPots = potBreakdowns.filter((p) => !p.isUncalledReturn);
  const winnerSeatIndices = Array.from(contestedWinnerSet);
  const allWinnerEntries = winnerSeatIndices.map((idx) => ({
    name: seats[idx].name,
    isHero: seats[idx].isHero,
    position: seats[idx].position,
  }));

  const parts = contestedPots.map((p) => {
    const label = p.runBoard === 2 ? 'Board 2' : 'Board 1';
    const names = p.winners.map((w) => `${w.name} (${w.position})`).join(' & ');
    return p.isSplit
      ? `${label} (${p.amountBb}bb): ${names} split with ${p.handLabel}`
      : `${label} (${p.amountBb}bb): ${names} wins with ${p.handLabel}`;
  });

  const firstContested = contestedPots[0];
  return {
    ...state,
    phase: 'SHOWDOWN',
    actingSeatIndex: null,
    awaitingRunItTwiceChoice: false,
    runItTwiceBoards: [board1, board2],
    board: board1,
    deck,
    seats,
    winnerSeatIndices,
    winnerSummary: `Run It Twice — ${parts.join(' · ')}.`,
    winnerSpec: {
      type: 'showdown',
      winners: allWinnerEntries,
      potBb: state.potBb,
      handLabel: firstContested?.handLabel,
      isSplit: winnerSeatIndices.length > 1 || contestedPots.some((p) => p.isSplit),
      potBreakdowns,
    },
  };
}

function advanceStreet(state: PokerTableState): PokerTableState {
  const contenders = activeSeats(state.seats);
  if (contenders.length <= 1) {
    return resolveShowdown(state);
  }

  // Run It Twice pause: when all-in runout occurs with board < 5 and Hero contending
  const contendersWithChips = contenders.filter((s) => !s.allIn && s.stackBb > 0);
  const heroIsContender = contenders.some((s) => s.isHero);
  if (
    state.config.runItTwiceEnabled &&
    state.board.length < 5 &&
    !state.awaitingRunItTwiceChoice &&
    contenders.length >= 2 &&
    heroIsContender &&
    contendersWithChips.length <= 1
  ) {
    const pausedSeats = state.seats.map((s) => ({
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
    return {
      ...state,
      seats: pausedSeats,
      currentBetBb: 0,
      minRaiseBb: 1.0,
      lastFullRaiseIncrementBb: 1.0,
      callOnlySeatIndices: [],
      flopCbetActive: false,
      actingSeatIndex: null,
      awaitingRunItTwiceChoice: true,
    };
  }

  const deck = [...state.deck];
  const board = [...state.board];
  let nextPhase: TablePhase = state.phase;
  let dealingFlop = false;

  if (state.phase === 'PREFLOP') {
    board.push(deck.shift()!, deck.shift()!, deck.shift()!);
    nextPhase = 'FLOP';
    dealingFlop = true;
  } else if (state.phase === 'FLOP') {
    board.push(deck.shift()!);
    nextPhase = 'TURN';
  } else if (state.phase === 'TURN') {
    board.push(deck.shift()!);
    nextPhase = 'RIVER';
  } else {
    return resolveShowdown(state);
  }

  const seats = state.seats.map((s) => {
    const incrementSawFlop = dealingFlop && !s.folded && !s.didSawFlopThisHand;
    return {
      ...s,
      streetBetBb: 0,
      actedThisStreet: s.folded || s.allIn,
      didSawFlopThisHand: incrementSawFlop ? true : s.didSawFlopThisHand,
      stats: incrementSawFlop
        ? { ...s.stats, sawFlopHands: s.stats.sawFlopHands + 1 }
        : s.stats,
      lastActionText: s.folded ? 'Folded' : s.allIn ? 'All-In' : '',
      lastActionSpec: s.folded
        ? ({ kind: 'folded' } as TableActionSpec)
        : s.allIn
          ? ({ kind: 'all_in' } as TableActionSpec)
          : undefined,
    };
  });

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
      flopCbetActive: false,
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
    flopCbetActive: false,
    actingSeatIndex: firstActor,
  };
}

export function applyPlayerAction(
  state: PokerTableState,
  seatIndex: number,
  actionType: 'fold' | 'check' | 'call' | 'raise',
  raiseToBb?: number
): PokerTableState {
  if (state.phase === 'IDLE' || state.phase === 'SHOWDOWN' || state.awaitingRunItTwiceChoice) {
    return state;
  }
  if (state.actingSeatIndex !== seatIndex) return state;

  const seats = state.seats.map((s) => ({ ...s, stats: { ...s.stats } }));
  const actor = seats[seatIndex];
  const legal = getLegalActions(state, seatIndex);

  // Legality guard: never allow checking when facing a bet
  if (actionType === 'check' && !legal.canCheck) {
    return state;
  }

  // Enforce call-only restriction after an incomplete short all-in, and normalize 0bb calls to check
  let effectiveActionType: 'fold' | 'check' | 'call' | 'raise' = actionType;
  if (effectiveActionType === 'raise' && !legal.canBetOrRaise) {
    effectiveActionType = legal.canCheck ? 'check' : 'call';
  }
  if (effectiveActionType === 'call' && legal.callAmountBb === 0) {
    effectiveActionType = 'check';
  }

  let resolvedRaiseTarget: number | undefined;
  if (effectiveActionType === 'raise') {
    const requestedRaise =
      typeof raiseToBb === 'number' && Number.isFinite(raiseToBb)
        ? raiseToBb
        : legal.minTotalBetBb;
    const clamped = roundBb(
      Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, requestedRaise))
    );
    const putInCheck = roundBb(clamped - actor.streetBetBb);
    if (clamped <= state.currentBetBb || putInCheck <= 0) {
      return state;
    }
    resolvedRaiseTarget = clamped;
  }

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
    heroAudits.push(
      evaluateHeroActionForAudit(state, actor, effectiveActionType, resolvedRaiseTarget)
    );
  }

  let potBb = state.potBb;
  let currentBetBb = state.currentBetBb;
  let minRaiseBb = state.minRaiseBb;
  let lastFullRaiseIncrementBb = state.lastFullRaiseIncrementBb ?? 1.0;
  let callOnlySeatIndices = [...(state.callOnlySeatIndices ?? [])];
  let preflopAggressorSeatIndex = state.preflopAggressorSeatIndex;
  let preflopRaiseCount = state.preflopRaiseCount;
  let flopCbetActive = Boolean(state.flopCbetActive);
  let actionText = '';
  let actionSpec: TableActionSpec = { kind: 'check' };

  // Record 3-bet opportunity when facing a single open raise preflop (only if legally able to raise)
  if (
    currentStreet === 'preflop' &&
    preflopRaiseCount === 1 &&
    legal.canBetOrRaise &&
    !actor.hadThreeBetOppThisHand
  ) {
    actor.hadThreeBetOppThisHand = true;
    actor.stats.threeBetOpps += 1;
  }

  // Record Flop C-Bet opportunity (PFR acting first on flop facing no bet) for both Hero & bots
  if (
    currentStreet === 'flop' &&
    state.preflopAggressorSeatIndex === seatIndex &&
    state.currentBetBb === 0 &&
    legal.canBetOrRaise &&
    !actor.hadCbetOppThisHand
  ) {
    actor.hadCbetOppThisHand = true;
    actor.stats.cbetOpps += 1;
    if (effectiveActionType === 'raise') {
      actor.stats.cbetHands += 1;
      flopCbetActive = true;
    }
  } else if (
    // Record Fold-to-C-Bet opportunity (facing PFR's flop c-bet before any subsequent raise)
    currentStreet === 'flop' &&
    flopCbetActive &&
    seatIndex !== state.preflopAggressorSeatIndex &&
    legal.callAmountBb > 0 &&
    !actor.hadFoldToCbetOppThisHand
  ) {
    actor.hadFoldToCbetOppThisHand = true;
    actor.stats.foldToCbetOpps += 1;
    if (effectiveActionType === 'fold') {
      actor.stats.foldToCbetHands += 1;
    }
    if (effectiveActionType === 'raise') {
      flopCbetActive = false;
    }
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
    const clampedTarget = resolvedRaiseTarget!;
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
    currentBetBb = Math.max(currentBetBb, clampedTarget);

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
    flopCbetActive,
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
 * Multi-street position-, initiative-, texture-, SPR-, and draw-aware strategic bot policy
 * across all 6 distinct poker archetypes (delegates to src/poker/botAi.ts).
 */
export function chooseBotAction(
  state: PokerTableState,
  seatIndex: number,
  rng: () => number = Math.random
): { type: 'fold' | 'check' | 'call' | 'raise'; raiseToBb?: number } {
  const seat = state.seats[seatIndex];
  const legal = getLegalActions(state, seatIndex);
  const effPotOdds = computeEffectivePotOdds(state, seat);
  return decideBotAction(state, seatIndex, legal, effPotOdds, rng);
}
