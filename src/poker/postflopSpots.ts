import type {
  Card,
  DecisionEvaluation,
  Position,
  SolverActionFreq,
  Street,
} from './types';
import { accuracyFromGrade, gradeFromFrequency } from './types';
import { createSuitRotation, parseCards, rotateCards } from './evaluator';

export type PotType = 'SRP' | '3BP';

export type DecisiveDetailKey =
  | 'bet_size_pot_odds'
  | 'board_range_advantage'
  | 'blockers_showdown'
  | 'draws_implied_odds';

export interface PostflopSpotBlueprint {
  id: string;
  /** Spoiler-free heading shown before the learner answers. */
  neutralTitle: string;
  /** Lesson title revealed only after the learner submits an answer. */
  title: string;
  street: Exclude<Street, 'preflop'>;
  potType: PotType;
  heroPos: Position;
  villainPos: Position;
  heroInPosition: boolean;
  potBb: number;
  effectiveStackBb: number;
  toCallBb: number;
  heroCards: [string, string];
  board: string[];
  actionLog: string[];
  actions: SolverActionFreq[];
  decisiveDetail: DecisiveDetailKey;
  /** Optional linked spot ID for side-by-side comparison (e.g., paired river bet-size drill). */
  pairedSpotId?: string;
  /** Concrete arithmetic/numbers explanation grounded strictly in this hand's pot, bet, and cards. */
  numbersBreakdown: string;
  takeaways: {
    boardTexture: string;
    rangeAdvantage: string;
    blockerNote: string;
    coreRule: string;
  };
}

export interface PostflopDrillSpot {
  id: string;
  neutralTitle: string;
  title: string;
  street: Exclude<Street, 'preflop'>;
  potType: PotType;
  heroPos: Position;
  villainPos: Position;
  heroInPosition: boolean;
  potBb: number;
  effectiveStackBb: number;
  toCallBb: number;
  heroCards: [Card, Card];
  board: Card[];
  actionLog: string[];
  actions: SolverActionFreq[];
  decisiveDetail: DecisiveDetailKey;
  pairedSpotId?: string;
  numbersBreakdown: string;
  takeaways: PostflopSpotBlueprint['takeaways'];
}

export const PAIRED_RIVER_SMALL_ID = 'pf-srp-bb-sb-river-size-small';
export const PAIRED_RIVER_OVERBET_ID = 'pf-srp-bb-sb-river-size-overbet';

export const POSTFLOP_BLUEPRINTS: PostflopSpotBlueprint[] = [
  {
    id: 'pf-srp-btn-bb-a72r',
    neutralTitle: 'Flop · BTN vs BB · A-high rainbow',
    title: 'Small C-Bet on Dry Ace-High Rainbow',
    street: 'flop',
    potType: 'SRP',
    heroPos: 'BTN',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 5.5,
    effectiveStackBb: 97.5,
    toCallBb: 0,
    heroCards: ['Ks', 'Qd'],
    board: ['Ac', '7h', '2d'],
    actionLog: ['BTN opens 2.5bb', 'BB calls', 'Flop: BB checks'],
    actions: [
      { action: 'bet_33', label: 'Bet 33% (1.8bb)', frequency: 82, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 16, kind: 'check' },
      { action: 'bet_75', label: 'Bet 75% (4.1bb)', frequency: 2, kind: 'bet' },
    ],
    decisiveDetail: 'board_range_advantage',
    numbersBreakdown:
      'Pot is 5.5bb with 97.5bb behind (SPR 17.7). A 1.8bb bet (33% pot) only needs BB to fold 1.8 ÷ (5.5 + 1.8) = 24.7% of the time to break even on air, while pressuring unpaired hands that have live equity against KQ.',
    takeaways: {
      boardTexture: 'Dry, disconnected A-high rainbow texture with almost no straight or flush draws.',
      rangeAdvantage:
        'BTN holds a clear range and nut advantage (AA, AK, AQ, AJ) over BB’s preflop flatting range.',
      blockerNote:
        'KQo holds two live broadway cards and benefits from folding out weak pairs and 6x–5x equity cheaply.',
      coreRule:
        'When you hold a wide range advantage on a dry Ace-high board, small bets (25%–33% pot) work well across most of your range.',
    },
  },
  {
    id: 'pf-srp-co-bb-765tt',
    neutralTitle: 'Flop · CO vs BB · Low connected two-tone',
    title: 'Check Back on Low Connected Board',
    street: 'flop',
    potType: 'SRP',
    heroPos: 'CO',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 5.5,
    effectiveStackBb: 97.5,
    toCallBb: 0,
    heroCards: ['As', 'Kc'],
    board: ['7s', '6s', '5d'],
    actionLog: ['CO opens 2.5bb', 'BB calls', 'Flop: BB checks'],
    actions: [
      { action: 'check', label: 'Check', frequency: 78, kind: 'check' },
      { action: 'bet_33', label: 'Bet 33% (1.8bb)', frequency: 18, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (4.1bb)', frequency: 4, kind: 'bet' },
    ],
    decisiveDetail: 'board_range_advantage',
    numbersBreakdown:
      'Pot is 5.5bb (SPR 17.7). On 7-6-5, BB’s preflop call contains far more straights (98s, 84s), two pairs (76s, 75s, 65s), and sets (77–55) than CO’s open. Betting 1.8bb invites frequent check-raises that force AK off its overcard equity.',
    takeaways: {
      boardTexture: 'Tightly connected low two-tone flop loaded with straights, two pairs, sets, and combo draws.',
      rangeAdvantage:
        'BB connects heavily with 7-6-5 (98s, 84s, 76s, 75s, 65s, 55–77), erasing CO’s preflop nut advantage.',
      blockerNote:
        'Holding the Ace matching the flop’s two-tone suit adds backdoor nut-flush equity; checking back realizes two overcards safely.',
      coreRule:
        'Slow down and check back more often on low connected flops where the Big Blind holds the nut advantage.',
    },
  },
  {
    id: 'pf-srp-bb-btn-xr-984',
    neutralTitle: 'Flop · BB vs BTN · 9-high facing 33% bet',
    title: 'Check-Raise Semi-Bluff vs Small C-Bet',
    street: 'flop',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 7.3,
    effectiveStackBb: 95.7,
    toCallBb: 1.8,
    heroCards: ['Jh', 'Th'],
    board: ['9s', '8d', '4h'],
    actionLog: ['BTN opens 2.5bb', 'BB calls', 'Flop: BB checks, BTN bets 1.8bb (33%)'],
    actions: [
      { action: 'raise_xr', label: 'Check-Raise 6.5bb', frequency: 66, kind: 'raise' },
      { action: 'call', label: 'Call 1.8bb', frequency: 34, kind: 'call' },
      { action: 'fold', label: 'Fold', frequency: 0, kind: 'fold' },
    ],
    decisiveDetail: 'draws_implied_odds',
    numbersBreakdown:
      'Calling 1.8bb into 7.3bb requires only 1.8 ÷ (7.3 + 1.8) = 19.8% equity, so folding is never right. With 8 clean straight outs (any Q or 7), two overcards, and a backdoor flush draw, raising to 6.5bb builds the pot and folds out BTN’s wide 33% air.',
    takeaways: {
      boardTexture: 'Dynamic 9-high rainbow board where BTN’s wide 33% c-bet range is vulnerable to pressure.',
      rangeAdvantage:
        'BB holds 98s, 94s, 84s, 88, and 44 at high weight, supporting a polarized check-raise range.',
      blockerNote:
        'Suited JT has 8 clean open-ended straight outs, two overcards, and a backdoor flush draw—an ideal semi-bluff.',
      coreRule:
        'Check-raise high-equity open-ended straight draws with overcards to apply pressure and build pots when you hit.',
    },
  },
  {
    id: 'pf-3bp-btn-co-k94r',
    neutralTitle: 'Flop · 3-Bet Pot · BTN vs CO · K-high rainbow',
    title: 'Small Range Bet IP in 3-Bet Pot',
    street: 'flop',
    potType: '3BP',
    heroPos: 'BTN',
    villainPos: 'CO',
    heroInPosition: true,
    potBb: 16.5,
    effectiveStackBb: 92.5,
    toCallBb: 0,
    heroCards: ['Qd', 'Jd'],
    board: ['Kd', '9c', '4s'],
    actionLog: ['CO opens 2.5bb', 'BTN 3-bets 7.5bb', 'CO calls', 'Flop: CO checks'],
    actions: [
      { action: 'bet_33', label: 'Bet 33% (5.5bb)', frequency: 88, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 12, kind: 'check' },
      { action: 'bet_75', label: 'Bet 75% (12.4bb)', frequency: 0, kind: 'bet' },
    ],
    decisiveDetail: 'board_range_advantage',
    numbersBreakdown:
      'Pot is 16.5bb with 92.5bb behind (SPR 5.6). A 5.5bb bet (33% pot) needs CO to fold only 5.5 ÷ (16.5 + 5.5) = 25.0% of hands for an immediate bluff profit, while QJs also carries 4 Ten outs to a gutshot straight plus a backdoor flush draw.',
    takeaways: {
      boardTexture: 'Dry K-high rainbow flop in a low-SPR (5.6) 3-bet pot.',
      rangeAdvantage:
        'BTN holds AA, KK, AK, and KQs at full weight while CO’s preflop call caps their strongest Kx.',
      blockerNote:
        'Suited QJ matching the King’s suit holds a gutshot (any T) plus a backdoor flush draw and pressures AQo, AJo, and 66–88.',
      coreRule:
        'In 3-bet pots in position on dry A- or K-high flops, small 25%–33% bets perform well across most of your range.',
    },
  },
  {
    id: 'pf-3bp-sb-btn-qjt-oop',
    neutralTitle: 'Flop · 3-Bet Pot · SB vs BTN · Monotone broadway',
    title: 'Check Vulnerable Overpair on Monotone Flop',
    street: 'flop',
    potType: '3BP',
    heroPos: 'SB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 21.0,
    effectiveStackBb: 90.0,
    toCallBb: 0,
    heroCards: ['Ah', 'Ad'],
    board: ['Qs', 'Js', 'Ts'],
    actionLog: ['BTN opens 2.5bb', 'SB 3-bets 10bb', 'BTN calls', 'Flop: Action on SB'],
    actions: [
      { action: 'check', label: 'Check', frequency: 74, kind: 'check' },
      { action: 'bet_33', label: 'Bet 33% (7.0bb)', frequency: 24, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (15.8bb)', frequency: 2, kind: 'bet' },
    ],
    decisiveDetail: 'blockers_showdown',
    numbersBreakdown:
      'Pot is already 21.0bb with 90.0bb left (SPR 4.3) out of position. Neither Ace matches the monotone flop suit, so you have zero redraw to the nut flush and do not block BTN’s made flushes, straights (AK, K9s, 98s), or two pairs.',
    takeaways: {
      boardTexture: 'Monotone Q-J-T broadway flop where made flushes, straights, and two pairs are already live.',
      rangeAdvantage:
        'Without the Ace of the flush suit, AA plays closer to a medium bluff-catcher than a clean three-street value hand.',
      blockerNote:
        'Holding neither card of the flop suit fails to block made flushes or K9s/98s straights; checking protects your OOP check range.',
      coreRule:
        'Check vulnerable overpairs without a flush blocker more often on monotone connected flops out of position.',
    },
  },
  {
    id: 'pf-srp-utg-bb-turn-overcard',
    neutralTitle: 'Turn · UTG vs BB · King turn card',
    title: 'Size Up Turn Barrel on Favorable Overcard',
    street: 'turn',
    potType: 'SRP',
    heroPos: 'UTG',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 10.5,
    effectiveStackBb: 95.0,
    toCallBb: 0,
    heroCards: ['As', 'Ks'],
    board: ['Td', '6d', '2s', 'Kh'],
    actionLog: [
      'UTG opens 2.5bb, BB calls',
      'Flop Td 6d 2s: BB checks, UTG bets 2.5bb, BB calls',
      'Turn Kh: BB checks',
    ],
    actions: [
      { action: 'bet_75', label: 'Bet 75% (7.9bb)', frequency: 62, kind: 'bet' },
      { action: 'bet_125', label: 'Overbet 125% (13.1bb)', frequency: 34, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 4, kind: 'check' },
    ],
    decisiveDetail: 'board_range_advantage',
    numbersBreakdown:
      'Pot is 10.5bb with 95.0bb behind (SPR 9.0). Betting 7.9bb (75% pot) forces BB’s flop flush draws and Tx/6x pairs to pay 7.9 ÷ (10.5 + 7.9 + 7.9) = 30.0% required equity on one card instead of realizing cheaply.',
    takeaways: {
      boardTexture:
        'The turn King heavily favors UTG’s preflop range while the flop two-tone flush draw stays incomplete.',
      rangeAdvantage:
        'UTG concentrates KK, AK, KQ, and KT; BB’s flop call is weighted toward Tx, 6x, and flush draws.',
      blockerNote:
        'Top pair top kicker wants a larger turn size to extract value from Tx, weaker Kx, and draws.',
      coreRule:
        'Use larger turn sizes (75%–125% pot) on overcard turns that strongly improve the preflop aggressor’s range.',
    },
  },
  {
    id: 'pf-srp-bb-co-turn-call-fd',
    neutralTitle: 'Turn · BB vs CO · Facing 75% turn bet',
    title: 'Continue with High-Equity Combo Draw',
    street: 'turn',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'CO',
    heroInPosition: false,
    potBb: 19.3,
    effectiveStackBb: 86.5,
    toCallBb: 8.2,
    heroCards: ['9d', '8d'],
    board: ['Kd', '7d', '3c', '6h'],
    actionLog: [
      'CO opens 2.5bb, BB calls',
      'Flop Kd 7d 3c: BB checks, CO bets 2.8bb, BB calls',
      'Turn 6h: BB checks, CO bets 8.2bb (74%)',
    ],
    actions: [
      { action: 'call', label: 'Call 8.2bb', frequency: 74, kind: 'call' },
      { action: 'raise_allin', label: 'Check-Raise 24bb', frequency: 26, kind: 'raise' },
      { action: 'fold', label: 'Fold', frequency: 0, kind: 'fold' },
    ],
    decisiveDetail: 'draws_implied_odds',
    numbersBreakdown:
      'Facing 8.2bb into a 19.3bb pot before your call (27.5bb final pot), you need 8.2 ÷ 27.5 = 29.8% equity to break even directly. Your 9 flush outs + 6 non-flush straight outs = 15 live outs (15 ÷ 46 = 32.6% against the deck, ~34% against a specific one-pair hand), clearing direct pot odds even before implied odds.',
    takeaways: {
      boardTexture:
        'Turn 6 completes an open-ended straight + flush combo draw (15 live outs, ~33%–34% to improve on the river).',
      rangeAdvantage:
        'CO’s 74% turn bet is polarized around strong Kx+ and bluffs; calling requires 29.8% equity.',
      blockerNote:
        'Your raw draw outs already beat direct pot odds, and non-flush straight rivers carry strong implied odds.',
      coreRule:
        'Before folding a turn draw, count your clean outs and compare river hit odds directly against required pot odds.',
    },
  },
  {
    id: 'pf-3bp-btn-bb-turn-checkback',
    neutralTitle: 'Turn · 3-Bet Pot · BTN vs BB · Blank turn check',
    title: 'Turn Pot Control IP with Medium Showdown Value',
    street: 'turn',
    potType: '3BP',
    heroPos: 'BTN',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 34.5,
    effectiveStackBb: 83.0,
    toCallBb: 0,
    heroCards: ['Jc', 'Jd'],
    board: ['Qh', '8s', '3d', '2c'],
    actionLog: [
      'BTN opens 2.5bb, BB 3-bets 10bb, BTN calls',
      'Flop Qh 8s 3d: BB bets 7.0bb, BTN calls',
      'Turn 2c: BB checks',
    ],
    actions: [
      { action: 'check', label: 'Check', frequency: 84, kind: 'check' },
      { action: 'bet_33', label: 'Bet 33% (11.4bb)', frequency: 14, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (25.9bb)', frequency: 2, kind: 'bet' },
    ],
    decisiveDetail: 'blockers_showdown',
    numbersBreakdown:
      'Pot is already 34.5bb with 83.0bb remaining (SPR 2.4). Betting 11.4bb–25.9bb folds out hands JJ beats (AK, AJ, TT, 99) while building a huge pot against BB’s slowplayed Qx, KK, or AA.',
    takeaways: {
      boardTexture: 'Dry low blank turn after BB slows down following a flop c-bet.',
      rangeAdvantage:
        'JJ sits in the middle of BTN’s range—ahead of missed broadways and TT/99, but behind Qx and slowplayed AA/KK.',
      blockerNote:
        'Checking back keeps BB’s bluffs in for the river and avoids getting check-raised off solid showdown value.',
      coreRule:
        'In position with medium showdown value in a bloated pot, check back turns to control pot size and evaluate rivers.',
    },
  },
  {
    id: 'pf-srp-btn-bb-river-thin-value',
    neutralTitle: 'River · BTN vs BB · Checked to you on low river',
    title: 'Medium Thin Value Bet on Low River',
    street: 'river',
    potType: 'SRP',
    heroPos: 'BTN',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 22.5,
    effectiveStackBb: 89.0,
    toCallBb: 0,
    heroCards: ['Ac', 'Jc'],
    board: ['Js', '8h', '3d', '2s', '5c'],
    actionLog: [
      'BTN opens 2.5bb, BB calls',
      'Flop Js 8h 3d: BB checks, BTN bets 3.5bb, BB calls',
      'Turn 2s: BB checks, BTN bets 5.0bb, BB calls',
      'River 5c: BB checks',
    ],
    actions: [
      { action: 'bet_50', label: 'Bet 50% (11.3bb)', frequency: 68, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (16.9bb)', frequency: 24, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 8, kind: 'check' },
    ],
    decisiveDetail: 'board_range_advantage',
    numbersBreakdown:
      'Pot is 22.5bb with 89.0bb behind. A 50% bet (11.3bb) gives BB 11.3 ÷ (22.5 + 11.3 + 11.3) = 25.1% pot odds, encouraging calls from worse Jx (KJ, QJ, JT, J9) and 8x that would fold against a huge overbet.',
    takeaways: {
      boardTexture:
        'Low river where the primary flop/turn draws (backdoor spades, T9, 97) missed, leaving BB heavy on one-pair Jx and 8x.',
      rangeAdvantage:
        'BTN remains uncapped with overpairs and sets; AJ top pair top kicker is comfortably ahead of BB’s check-call range.',
      blockerNote:
        'A medium 50% bet targets calls from weaker Jx and 8x rather than folding them out with an overbet.',
      coreRule:
        'When your opponent’s line looks capped at one pair and main draws miss, look for medium-sized thin value bets on the river.',
    },
  },
  {
    id: 'pf-srp-bb-btn-river-bluffcatch-blockers',
    neutralTitle: 'River · BB vs BTN · Flush completes, facing 71% bet',
    title: 'River Bluff-Catch with Nut Flush Blocker',
    street: 'river',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 50.5,
    effectiveStackBb: 64.5,
    toCallBb: 21.0,
    heroCards: ['As', 'Qh'],
    board: ['Qd', '9s', '5s', '2c', '4s'],
    actionLog: [
      'BTN opens 2.5bb, BB calls',
      'Flop Qd 9s 5s: BB checks, BTN bets 3.0bb, BB calls',
      'Turn 2c: BB checks, BTN bets 9.0bb, BB calls',
      'River 4s: BB checks, BTN bets 21.0bb (71% pot)',
    ],
    actions: [
      { action: 'call', label: 'Call 21.0bb', frequency: 82, kind: 'call' },
      { action: 'fold', label: 'Fold', frequency: 18, kind: 'fold' },
      { action: 'raise_allin', label: 'Raise All-In 64.5bb', frequency: 0, kind: 'raise' },
    ],
    decisiveDetail: 'blockers_showdown',
    numbersBreakdown:
      'Pot before BTN’s bet was 29.5bb; facing 21.0bb (71% pot), calling costs 21.0bb into a 71.5bb final pot, requiring 21.0 ÷ 71.5 = 29.4% equity. MDF is 29.5 ÷ 50.5 = 58.4%, so BB needs top bluff-catchers with flush blockers to defend.',
    takeaways: {
      boardTexture:
        'Front-door flush completes on the river; BTN bets 21.0bb (71% pot) into 29.5bb.',
      rangeAdvantage:
        'You need 29.4% equity to call; BB defends its strongest top-pair bluff-catchers that block BTN’s nut flushes.',
      blockerNote:
        'Holding the Ace of the flush suit removes BTN’s strongest value flushes (nut flushes) while unblocking missed offsuit straight draws (JT, T8, 87).',
      coreRule:
        'When facing a polarized river bet on a flush board, prioritize calling with hands that hold the nut-flush blocker.',
    },
  },
  {
    id: 'pf-srp-co-bb-river-bluff-blockers',
    neutralTitle: 'River · CO vs BB · Missed draw checked to you',
    title: 'River Bluff Selection with Straight Blocker',
    street: 'river',
    potType: 'SRP',
    heroPos: 'CO',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 24.5,
    effectiveStackBb: 88.0,
    toCallBb: 0,
    heroCards: ['Kc', '9c'],
    board: ['Js', 'Ts', '4c', '8h', '2d'],
    actionLog: [
      'CO opens 2.5bb, BB calls',
      'Flop Js Ts 4c: BB checks, CO bets 3.5bb, BB calls',
      'Turn 8h: BB checks, CO bets 6.0bb, BB calls',
      'River 2d: BB checks',
    ],
    actions: [
      { action: 'bet_100', label: 'Bet 100% (24.5bb)', frequency: 71, kind: 'bet' },
      { action: 'bet_50', label: 'Bet 50% (12.3bb)', frequency: 15, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 14, kind: 'check' },
    ],
    decisiveDetail: 'blockers_showdown',
    numbersBreakdown:
      'Pot is 24.5bb with 88.0bb behind. A full-pot 24.5bb bluff needs BB to fold 24.5 ÷ (24.5 + 24.5) = 50.0% of the time to break even with King-high. Because your 9 blocks both straights (Q9 and 97) and you hold no card of the missed flush suit, your bluff targets BB’s capped one-pair hands.',
    takeaways: {
      boardTexture:
        'Your flop gutshot and turn open-ended straight draw bricked on the river 2; K9 is only King-high with almost no showdown value.',
      rangeAdvantage:
        'CO can credibly represent Q9/97 straights, JJ, TT, and JT; BB’s check-call, check-call, check line is weighted toward one-pair Jx/Tx/8x and missed flush draws.',
      blockerNote:
        'Holding a 9 blocks both made straights (Q9 and 97) that would snap-call, while holding neither card of the flop’s flush suit unblocks BB’s missed flush draws that must fold.',
      coreRule:
        'Pick river bluffs that cannot win at showdown, block your opponent’s strongest calling hands, and unblock their missed draws.',
    },
  },
  {
    id: 'pf-3bp-bb-btn-river-fold-overbet',
    neutralTitle: 'River · 3-Bet Pot · BB vs BTN · Facing river all-in',
    title: 'River Fold vs Polarized All-In on Bad Runout',
    street: 'river',
    potType: '3BP',
    heroPos: 'BB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 131.5,
    effectiveStackBb: 69.0,
    toCallBb: 69.0,
    heroCards: ['Td', 'Tc'],
    board: ['Ks', '8d', '5s', '3h', 'As'],
    actionLog: [
      'BTN opens 2.5bb, BB 3-bets 10bb, BTN calls',
      'Flop Ks 8d 5s: BB bets 7.0bb, BTN calls',
      'Turn 3h: BB checks, BTN bets 14.0bb, BB calls',
      'River As: BB checks, BTN shoves 69.0bb (110% pot)',
    ],
    actions: [
      { action: 'fold', label: 'Fold', frequency: 94, kind: 'fold' },
      { action: 'call', label: 'Call 69.0bb', frequency: 6, kind: 'call' },
    ],
    decisiveDetail: 'bet_size_pot_odds',
    numbersBreakdown:
      'Pot before BTN’s shove was 62.5bb. Calling 69.0bb into a 200.5bb final pot requires 69.0 ÷ 200.5 = 34.4% equity, while MDF drops to 62.5 ÷ 131.5 = 47.5%. With two overcards (A, K) and a completed flush on board, pocket Tens without a flush blocker sits far below your calling threshold.',
    takeaways: {
      boardTexture:
        'An Ace of the flop’s flush suit completes both flushes and improves BTN’s Ax floats to top pair.',
      rangeAdvantage:
        'BTN’s turn bet plus 110% pot river jam polarizes heavily around flushes, AK, A8, and sets.',
      blockerNote:
        'TT holds no card of the flush suit, loses to every value hand BTN represents, and falls well below the top 47.5% of BB’s range.',
      coreRule:
        'Against large river overbets on flush-and-overcard runouts, fold weak pairs without key blockers and defend with stronger hands.',
    },
  },
  {
    id: 'pf-srp-bb-btn-turn-xr-semibluff',
    neutralTitle: 'Turn · BB vs BTN · Facing 50% turn bet',
    title: 'Turn Check-Raise Semi-Bluff with Nut Flush Draw + Gutshot',
    street: 'turn',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'BTN',
    heroInPosition: false,
    potBb: 13.6,
    effectiveStackBb: 91.2,
    toCallBb: 4.5,
    heroCards: ['Ah', 'Kh'],
    board: ['Jh', '6h', '3c', 'Ts'],
    actionLog: [
      'BTN opens 2.5bb, BB calls',
      'Flop Jh 6h 3c: BB checks, BTN bets 1.8bb, BB calls',
      'Turn Ts: BB checks, BTN bets 4.5bb (50%)',
    ],
    actions: [
      { action: 'raise_xr', label: 'Check-Raise 14.0bb', frequency: 62, kind: 'raise' },
      { action: 'call', label: 'Call 4.5bb', frequency: 38, kind: 'call' },
      { action: 'fold', label: 'Fold', frequency: 0, kind: 'fold' },
    ],
    decisiveDetail: 'draws_implied_odds',
    numbersBreakdown:
      'Calling 4.5bb into 13.6bb needs only 4.5 ÷ (13.6 + 4.5) = 24.9% equity. You hold 9 nut flush outs plus 3 non-flush Queens for Broadway = 12 live outs (12 ÷ 46 = 26.1%). A raise to 14.0bb works as a pure bluff if BTN folds 14.0 ÷ (13.6 + 14.0) = 50.7% of the time, and your 12 outs cushion every call.',
    takeaways: {
      boardTexture:
        'Two-tone connected turn where BTN’s wide, small flop bet range contains many weak pairs and floats that cannot continue against a raise.',
      rangeAdvantage:
        'BB’s flop check-call range includes sets, two pairs, and strong draws, so a turn check-raise is credible and keeps BTN’s medium pairs under pressure.',
      blockerNote:
        'The nut flush draw blocks the strongest flush draws BTN could continue with, and the extra gutshot adds clean outs when called.',
      coreRule:
        'Turn check-raise your strongest combo draws: fold equity plus a dozen outs makes the semi-bluff profitable even when called.',
    },
  },
  {
    id: 'pf-3bp-btn-bb-flop-low-connected',
    neutralTitle: 'Flop · 3-Bet Pot · BTN vs BB · Low connected rainbow',
    title: 'Check Back Overcards in 3-Bet Pot on Low Connected Flop',
    street: 'flop',
    potType: '3BP',
    heroPos: 'BTN',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 20.5,
    effectiveStackBb: 90.0,
    toCallBb: 0,
    heroCards: ['As', 'Ks'],
    board: ['7s', '6d', '5c'],
    actionLog: ['BTN opens 2.5bb', 'BB 3-bets 10bb', 'BTN calls', 'Flop: BB checks'],
    actions: [
      { action: 'check', label: 'Check', frequency: 71, kind: 'check' },
      { action: 'bet_33', label: 'Bet 33% (6.8bb)', frequency: 25, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (15.4bb)', frequency: 4, kind: 'bet' },
    ],
    decisiveDetail: 'board_range_advantage',
    numbersBreakdown:
      'Pot is 20.5bb with 90.0bb behind (SPR 4.4). A 6.8bb bet needs BB to fold 6.8 ÷ (20.5 + 6.8) = 24.9% just to break even, yet BB’s 3-bet range is full of overpairs (AA–88) that never fold and would happily raise, leaving AK with only overcards and a backdoor flush draw.',
    takeaways: {
      boardTexture:
        'Low connected rainbow flop where overpairs, straights, and combo draws dominate the strong end of both ranges.',
      rangeAdvantage:
        'BB’s 3-bet range keeps all the overpairs, while BTN’s calling range holds more connected hands; neither side owns a clear edge, so checking back is common.',
      blockerNote:
        'Ace-King has two overcards and a backdoor flush draw, but folds out nothing it beats and plays better when it realizes equity for free.',
      coreRule:
        'With unpaired overcards on a low connected flop in a 3-bet pot, check back in position and let your equity run instead of building a pot you cannot defend.',
    },
  },
  {
    id: 'pf-srp-co-bb-river-thin-value',
    neutralTitle: 'River · CO vs BB · Checked to you on dry river',
    title: 'Thin Value Bet with Strong Top Pair vs Capped Range',
    street: 'river',
    potType: 'SRP',
    heroPos: 'CO',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 22.1,
    effectiveStackBb: 89.2,
    toCallBb: 0,
    heroCards: ['Ad', 'Kc'],
    board: ['Ks', '7d', '4c', '2h', '9c'],
    actionLog: [
      'CO opens 2.5bb, BB calls',
      'Flop Ks 7d 4c: BB checks, CO bets 2.8bb, BB calls',
      'Turn 2h: BB checks, CO bets 5.5bb, BB calls',
      'River 9c: BB checks',
    ],
    actions: [
      { action: 'bet_50', label: 'Bet 50% (11.1bb)', frequency: 58, kind: 'bet' },
      { action: 'bet_33', label: 'Bet 33% (7.3bb)', frequency: 34, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 8, kind: 'check' },
    ],
    decisiveDetail: 'board_range_advantage',
    numbersBreakdown:
      'Pot is 22.1bb with 89.2bb behind. A 50% bet (11.1bb) gives BB 11.1 ÷ (22.1 + 11.1 + 11.1) = 25.1% pot odds, so Kx with weaker kickers and pocket pairs like TT or 88 keep calling, while the hands BB would have raised earlier are mostly absent from its checking range.',
    takeaways: {
      boardTexture:
        'Dry, mostly rainbow river where no flush or straight is likely and the board barely changed from the flop.',
      rangeAdvantage:
        'BB check-called two streets and checks again, so the strongest hands (sets, two pairs) usually raised earlier; the checking range is capped around one pair.',
      blockerNote:
        'Holding the top pair with the Ace kicker dominates every other King and blocks AK-type value that BB could use to trap.',
      coreRule:
        'When an opponent’s range is capped at one pair and you hold top pair with a strong kicker, bet about half pot on the river to get paid by worse pairs.',
    },
  },
  {
    id: 'pf-srp-btn-bb-turn-overbet-barrel',
    neutralTitle: 'Turn · BTN vs BB · Checked to you on A-high rainbow board',
    title: 'Polarized 125% Turn Overbet Barrel with a Set',
    street: 'turn',
    potType: 'SRP',
    heroPos: 'BTN',
    villainPos: 'BB',
    heroInPosition: true,
    potBb: 9.1,
    effectiveStackBb: 95.7,
    toCallBb: 0,
    heroCards: ['7h', '7d'],
    board: ['Ac', '7s', '2d', '9h'],
    actionLog: [
      'BTN opens 2.5bb, BB calls',
      'Flop Ac 7s 2d: BB checks, BTN bets 1.8bb, BB calls',
      'Turn 9h: BB checks',
    ],
    actions: [
      { action: 'bet_125', label: 'Overbet 125% (11.4bb)', frequency: 52, kind: 'bet' },
      { action: 'bet_75', label: 'Bet 75% (6.8bb)', frequency: 38, kind: 'bet' },
      { action: 'check', label: 'Check', frequency: 10, kind: 'check' },
    ],
    decisiveDetail: 'bet_size_pot_odds',
    numbersBreakdown:
      'Pot is 9.1bb with 95.7bb behind (SPR 10.5). An 11.4bb overbet (125% pot) gives BB 11.4 ÷ (9.1 + 11.4 + 11.4) = 35.7% pot odds and cuts its defense (MDF) to 9.1 ÷ (9.1 + 11.4) = 44.4%, forcing out Ax and pocket pairs that would call a small bet while still leaving 84.3bb for a river shove.',
    takeaways: {
      boardTexture:
        'Ace-high rainbow board where the brick turn changes little, so BB’s Ax one-pair hands remain stuck calling one more bet.',
      rangeAdvantage:
        'BTN holds the nut sets and two pairs plus many air bluffs, while BB’s flop check-call range is capped at one pair and weak draws, which supports a polarized overbet.',
      blockerNote:
        'A set blocks the pairs BB could use to continue and leaves BTN with the strongest hands in the polarized range.',
      coreRule:
        'When your range is polarized and your opponent is capped, size up to 125% pot on a brick turn with your nutted hands and balance with bluffs.',
    },
  },
  // --- PAIRED RIVER BET-SIZE EXERCISE (Identical cards, board, pot; ONLY bet size changes!) ---
  {
    id: PAIRED_RIVER_SMALL_ID,
    neutralTitle: 'Paired River (A) · BB vs SB · Facing 33% river bet',
    title: 'Call vs Small 33% River Bet (Pot Odds & Merged Range)',
    street: 'river',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'SB',
    heroInPosition: true,
    potBb: 26.6,
    effectiveStackBb: 90.0,
    toCallBb: 6.6,
    heroCards: ['Qh', 'Tc'],
    board: ['Qd', '8s', '5c', '2h', '3d'],
    actionLog: [
      'SB opens 3.0bb, BB calls (Pot 6.0bb)',
      'Flop Qd 8s 5c: SB bets 2.0bb, BB calls (Pot 10.0bb)',
      'Turn 2h: SB bets 5.0bb, BB calls (Pot 20.0bb)',
      'River 3d: SB bets 6.6bb (33% pot)',
    ],
    actions: [
      { action: 'call', label: 'Call 6.6bb', frequency: 88, kind: 'call' },
      { action: 'fold', label: 'Fold', frequency: 10, kind: 'fold' },
      { action: 'raise_value', label: 'Raise 20.0bb', frequency: 2, kind: 'raise' },
    ],
    decisiveDetail: 'bet_size_pot_odds',
    pairedSpotId: PAIRED_RIVER_OVERBET_ID,
    numbersBreakdown:
      'Pot before SB’s river bet was 20.0bb. Facing 6.6bb (33% pot), calling 6.6bb to win a 33.2bb final pot requires only 6.6 ÷ 33.2 = 19.9% equity, and MDF is 20.0 ÷ 26.6 = 75.2%. Top pair (QT) easily clears a 19.9% price against a small, wider river bet.',
    takeaways: {
      boardTexture:
        'Clean Q-8-5-2-3 runout with no possible flush; top pair QT is a classic river bluff-catcher and thin call.',
      rangeAdvantage:
        'At 33% pot (6.6bb), SB can bet a wider merged value range (including Q9, Q7, strong 8x) alongside bluffs, and you only need 19.9% equity.',
      blockerNote:
        'Raising 20.0bb isolates yourself against better Qx and sets; calling captures value from both bluffs and thinner worse Qx.',
      coreRule:
        'Against a small 33% river bet (19.9% required equity, 75.2% MDF), defend top pair reliably rather than over-folding.',
    },
  },
  {
    id: PAIRED_RIVER_OVERBET_ID,
    neutralTitle: 'Paired River (B) · BB vs SB · Facing 125% river overbet',
    title: 'Fold vs 125% River Overbet (Same Hand, Higher Price)',
    street: 'river',
    potType: 'SRP',
    heroPos: 'BB',
    villainPos: 'SB',
    heroInPosition: true,
    potBb: 45.0,
    effectiveStackBb: 90.0,
    toCallBb: 25.0,
    heroCards: ['Qh', 'Tc'],
    board: ['Qd', '8s', '5c', '2h', '3d'],
    actionLog: [
      'SB opens 3.0bb, BB calls (Pot 6.0bb)',
      'Flop Qd 8s 5c: SB bets 2.0bb, BB calls (Pot 10.0bb)',
      'Turn 2h: SB bets 5.0bb, BB calls (Pot 20.0bb)',
      'River 3d: SB bets 25.0bb (125% pot)',
    ],
    actions: [
      { action: 'fold', label: 'Fold', frequency: 86, kind: 'fold' },
      { action: 'call', label: 'Call 25.0bb', frequency: 14, kind: 'call' },
      { action: 'raise_allin', label: 'Raise All-In 90.0bb', frequency: 0, kind: 'raise' },
    ],
    decisiveDetail: 'bet_size_pot_odds',
    pairedSpotId: PAIRED_RIVER_SMALL_ID,
    numbersBreakdown:
      'Exact same hand and 20.0bb pot—only SB’s bet size changed from 6.6bb to 25.0bb (125% pot). Required equity jumps from 19.9% to 25.0 ÷ 70.0 = 35.7%, and MDF drops from 75.2% to 20.0 ÷ 45.0 = 44.4%. Worse Qx checks back instead of overbetting, pushing QT into a fold.',
    takeaways: {
      boardTexture:
        'Same Q-8-5-2-3 board, but the 125% overbet completely changes the price and SB’s range shape.',
      rangeAdvantage:
        'An overbet polarizes SB to strong value (AQ, KQ, two pair, sets) plus bluffs. With MDF down to 44.4%, BB defends stronger hands (AQ, KQ, Q8, sets) instead of QT.',
      blockerNote:
        'Your Ten also blocks missed JT and T9 straight-draw bluffs while losing to almost every hand SB overbets for value.',
      coreRule:
        'When bet size jumps from 33% to 125% pot, required equity climbs from 19.9% to 35.7% and defense shrinks from 75.2% to 44.4%—let medium kickers go.',
    },
  },
];

function materializeBlueprint(
  bp: PostflopSpotBlueprint,
  preserveSuits: boolean,
  rng: () => number
): PostflopDrillSpot {
  const suitMap = preserveSuits
    ? ({ s: 's', h: 'h', d: 'd', c: 'c' } as const)
    : createSuitRotation(rng);
  const rotatedHero = rotateCards(parseCards(bp.heroCards), suitMap) as [Card, Card];
  const rotatedBoard = rotateCards(parseCards(bp.board), suitMap);
  const suitGlyph: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const rotatedLog = bp.actionLog.map((line) =>
    line.replace(/\b([AKQJT98765432])([shdc])\b/g, (_, r: string, s: 's' | 'h' | 'd' | 'c') => {
      const mapped = suitMap[s];
      return `${r}${suitGlyph[mapped]}`;
    })
  );

  return {
    id: bp.id,
    neutralTitle: bp.neutralTitle,
    title: bp.title,
    street: bp.street,
    potType: bp.potType,
    heroPos: bp.heroPos,
    villainPos: bp.villainPos,
    heroInPosition: bp.heroInPosition,
    potBb: bp.potBb,
    effectiveStackBb: bp.effectiveStackBb,
    toCallBb: bp.toCallBb,
    heroCards: rotatedHero,
    board: rotatedBoard,
    actionLog: rotatedLog,
    actions: bp.actions,
    decisiveDetail: bp.decisiveDetail,
    pairedSpotId: bp.pairedSpotId,
    numbersBreakdown: bp.numbersBreakdown,
    takeaways: bp.takeaways,
  };
}

export function generatePostflopSpotById(
  id: string,
  options: { preserveSuits?: boolean; rng?: () => number } = {}
): PostflopDrillSpot {
  const bp = POSTFLOP_BLUEPRINTS.find((s) => s.id === id) ?? POSTFLOP_BLUEPRINTS[0];
  return materializeBlueprint(bp, options.preserveSuits ?? false, options.rng ?? Math.random);
}

export function generatePostflopSpot(
  streetFilter: Exclude<Street, 'preflop'> | 'ALL',
  potTypeFilter: PotType | 'ALL',
  positionRoleFilter: 'ALL' | 'IP' | 'OOP',
  previousId?: string,
  rng: () => number = Math.random
): PostflopDrillSpot {
  let pool = POSTFLOP_BLUEPRINTS;
  if (streetFilter !== 'ALL') {
    pool = pool.filter((s) => s.street === streetFilter);
  }
  if (potTypeFilter !== 'ALL') {
    pool = pool.filter((s) => s.potType === potTypeFilter);
  }
  if (positionRoleFilter !== 'ALL') {
    pool = pool.filter((s) =>
      positionRoleFilter === 'IP' ? s.heroInPosition : !s.heroInPosition
    );
  }
  if (pool.length === 0) pool = POSTFLOP_BLUEPRINTS;
  if (pool.length > 1 && previousId) {
    pool = pool.filter((s) => s.id !== previousId);
  }

  const bp = pool[Math.floor(rng() * pool.length)];
  const preserveSuits = Boolean(bp.pairedSpotId);
  return materializeBlueprint(bp, preserveSuits, rng);
}

export function evaluatePostflopDecision(
  spot: PostflopDrillSpot,
  chosenActionKey: string
): DecisionEvaluation {
  const bestObj = [...spot.actions].sort((a, b) => b.frequency - a.frequency)[0];
  const chosenObj =
    spot.actions.find((a) => a.action === chosenActionKey) ?? spot.actions[0];

  const grade = gradeFromFrequency(chosenObj.frequency, bestObj.frequency);
  const freqGap = Math.max(0, (bestObj.frequency - chosenObj.frequency) / 100);
  const accuracyScore = accuracyFromGrade(grade, freqGap);

  return {
    chosenAction: chosenObj.label,
    bestAction: bestObj.label,
    chosenFreq: chosenObj.frequency,
    grade,
    accuracyScore,
    actions: spot.actions,
  };
}
