import type { Card, DecisionGrade, Position } from './types';
import { expandHandCombos, parseCards, RANKS } from './evaluator';

export interface HandReadingSpot {
  id: string;
  title: string;
  villainPos: Position;
  heroPos: Position;
  streetLabel: string;
  potBb: number;
  board: Card[];
  timeline: {
    street: string;
    detail: string;
    narrowingHint: string;
  }[];
  promptQuestion: string;
  targetHands: string[]; // Canonical 169 keys in Villain's surviving range
  explanation: string;
  keyCombosNote: string;
}

function expandTokens(tokens: string[]): string[] {
  const set = new Set<string>();
  for (const token of tokens) {
    if (token.endsWith('+')) {
      const base = token.slice(0, -1);
      if (base.length === 2) {
        const idx = RANKS.indexOf(base[0] as (typeof RANKS)[number]);
        for (let i = 0; i <= idx; i++) set.add(`${RANKS[i]}${RANKS[i]}`);
      } else {
        const r1 = base[0] as (typeof RANKS)[number];
        const r2 = base[1] as (typeof RANKS)[number];
        const kind = base[2];
        const i1 = RANKS.indexOf(r1);
        const i2 = RANKS.indexOf(r2);
        for (let i = i1 + 1; i <= i2; i++) set.add(`${r1}${RANKS[i]}${kind}`);
      }
    } else if (token.includes('-')) {
      const [s, e] = token.split('-');
      if (s.length === 2) {
        const i1 = RANKS.indexOf(s[0] as (typeof RANKS)[number]);
        const i2 = RANKS.indexOf(e[0] as (typeof RANKS)[number]);
        for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
          set.add(`${RANKS[i]}${RANKS[i]}`);
        }
      } else {
        const r1 = s[0];
        const kind = s[2];
        const i1 = RANKS.indexOf(s[1] as (typeof RANKS)[number]);
        const i2 = RANKS.indexOf(e[1] as (typeof RANKS)[number]);
        for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
          set.add(`${r1}${RANKS[i]}${kind}`);
        }
      }
    } else {
      set.add(token);
    }
  }
  return Array.from(set);
}

export const HAND_READING_SPOTS: HandReadingSpot[] = [
  {
    id: 'hr-utg-cbet-check-turn',
    title: 'Capped UTG Range After Turn Check-Back',
    villainPos: 'UTG',
    heroPos: 'BB',
    streetLabel: 'Turn · SRP · 100bb',
    potBb: 12.5,
    board: parseCards(['Ks', '8d', '3c', '2h']),
    timeline: [
      {
        street: 'Preflop',
        detail: 'UTG opens 2.5bb, BB calls.',
        narrowingHint: 'UTG starts tight (~17%): 66+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo.',
      },
      {
        street: 'Flop K♠ 8♦ 3♣',
        detail: 'BB checks, UTG c-bets 3.5bb, BB calls.',
        narrowingHint: 'UTG c-bets nearly range on dry K-high; keeps pairs, Kx, and broadway overcards.',
      },
      {
        street: 'Turn 2♥',
        detail: 'BB checks, UTG checks back.',
        narrowingHint: 'AA, KK, AK, KQ, 88 keep barrelling for value. Checking back caps UTG to medium pairs, weaker Kx, and Ax showdown value.',
      },
    ],
    promptQuestion: 'Construct UTG’s surviving Turn check-back range on K♠ 8♦ 3♣ 2♥.',
    targetHands: expandTokens([
      'QQ-99',
      '77-66',
      'KJs',
      'KTs',
      'AQs',
      'AJs',
      'ATs',
      'A9s',
      'AQo',
      'AJo',
      'QJs',
      'JTs',
    ]),
    explanation:
      'When UTG checks back a blank 2♥ turn after c-betting K-8-3, their strongest value (AA, KK, 88, AK, KQ) almost always continues betting. Their check-back range is heavily capped at medium pocket pairs (QQ–99, 77–66), weaker Kx (KJs, KTs), and Ace-high showdown hands.',
    keyCombosNote: 'Key takeaway: On blank rivers, UTG faces severe pressure against big polar probes because AA/KK/AK are largely absent.',
  },
  {
    id: 'hr-bb-xr-low-board',
    title: 'BB Polarized Check-Raise Range on 8♠ 7♠ 3♦',
    villainPos: 'BB',
    heroPos: 'CO',
    streetLabel: 'Flop · SRP · 100bb',
    potBb: 14.5,
    board: parseCards(['8s', '7s', '3d']),
    timeline: [
      {
        street: 'Preflop',
        detail: 'CO opens 2.5bb, BB defends.',
        narrowingHint: 'BB flatting range removes JJ+, AK, AQs (3-bet preflop) and keeps low/medium pairs, suited connectors, and suited gappers.',
      },
      {
        street: 'Flop 8♠ 7♠ 3♦',
        detail: 'BB checks, CO c-bets 2.0bb (33%), BB check-raises to 7.0bb.',
        narrowingHint: 'Check-raising polarizes BB to two-pair+, sets, plus high-equity straight/flush semi-bluffs.',
      },
    ],
    promptQuestion: 'Select BB’s polarized Flop check-raise range (value + semi-bluffs).',
    targetHands: expandTokens([
      '88',
      '77',
      '33',
      '87s',
      '87o',
      'T9s',
      '96s',
      '65s',
      '64s',
      '54s',
      'J9s',
      'A5s',
      'A4s',
      'K9s',
      'Q9s',
    ]),
    explanation:
      'BB’s flop check-raise on 8♠ 7♠ 3♦ is built around nutted value (88, 77, 33, 87) balanced by strong open-ended straight draws (T9s, 65s, 96s), gutshots with backdoors (J9s, 64s, 54s), and suited nut-flush draws (A5s, A4s). Medium one-pair hands like A8 or K7 prefer calling.',
    keyCombosNote: 'Notice that AA–JJ are absent because BB would have 3-bet them preflop.',
  },
  {
    id: 'hr-btn-3bet-double-barrel',
    title: 'BTN 3-Bet Double Barrel Range on Q♦ 9♣ 4♦ 2♠',
    villainPos: 'BTN',
    heroPos: 'CO',
    streetLabel: 'Turn · 3-Bet Pot · 100bb',
    potBb: 42.0,
    board: parseCards(['Qd', '9c', '4d', '2s']),
    timeline: [
      {
        street: 'Preflop',
        detail: 'CO opens 2.5bb, BTN 3-bets 7.5bb, CO calls.',
        narrowingHint: 'BTN 3-bet range is strong linear value (JJ+, AK, AQs, KQs) plus suited wheel/broadway bluffs (A5s–A4s, KJs, QJs, JTs).',
      },
      {
        street: 'Flop Q♦ 9♣ 4♦',
        detail: 'CO checks, BTN c-bets 5.5bb, CO calls.',
        narrowingHint: 'BTN range-bets small; weak missed hands still present on flop.',
      },
      {
        street: 'Turn 2♠',
        detail: 'CO checks, BTN fires 14.5bb (53% pot).',
        narrowingHint: 'On a brick turn, BTN drops medium showdown pairs (JJ/TT) to check-back and barrels strong Qx+, overpairs, sets, and diamond/straight draws.',
      },
    ],
    promptQuestion: 'Identify BTN’s Turn double-barrel range on Q♦ 9♣ 4♦ 2♠.',
    targetHands: expandTokens([
      'AA',
      'KK',
      'QQ',
      '99',
      'AQs',
      'AQo',
      'KQs',
      'QJs',
      'AKs',
      'AJs',
      'ATs',
      'A5s',
      'A4s',
      'KJs',
      'KTs',
      'JTs',
    ]),
    explanation:
      'On a blank 2♠ turn in a 3-bet pot, BTN polarizes its second barrel: thick value (AA, KK, QQ, 99, AQ, KQ, QJs) paired with high-equity diamond draws and straight draws (AKs, AJs, A5s, A4s, KJs, JTs). Hands like JJ or TT check back to control the pot.',
    keyCombosNote: 'With ~55% value and ~45% semi-bluffs, CO must continue with strong Qx and flush draws.',
  },
  {
    id: 'hr-co-river-overbet',
    title: 'Polarized CO River Jam on A♥ J♠ 6♣ 3♠ 2♦',
    villainPos: 'CO',
    heroPos: 'BB',
    streetLabel: 'River · SRP · 100bb',
    potBb: 58.0,
    board: parseCards(['Ah', 'Js', '6c', '3s', '2d']),
    timeline: [
      {
        street: 'Preflop',
        detail: 'CO opens 2.5bb, BB calls.',
        narrowingHint: 'Standard ~29% CO opening range.',
      },
      {
        street: 'Flop A♥ J♠ 6♣ → Turn 3♠',
        detail: 'CO bets 33% flop, bets 75% turn; BB calls both.',
        narrowingHint: 'Turn 75% sheds weak Jx and small pairs; CO continues with strong Ax+, sets, two-pair, and spade/straight draws.',
      },
      {
        street: 'River 2♦',
        detail: 'BB checks, CO bets 120% pot overbet.',
        narrowingHint: 'Missed spades and KQ/KT gutshots become bluffs; thin one-pair AT–A8 checks back. Only two-pair+, sets, AK, and missed draws jam.',
      },
    ],
    promptQuestion: 'Map CO’s polarized River overbet range (nutted value + missed draws).',
    targetHands: expandTokens([
      'AA',
      'JJ',
      '66',
      '33',
      'AJs',
      'AJo',
      'A6s',
      'AKs',
      'AKo',
      'KQs',
      'KTs',
      'QTs',
      'T9s',
      '98s',
      '87s',
      '75s',
    ]),
    explanation:
      'A 120% pot river overbet requires true polarity. CO checks back medium top pairs (AT, A9, A8) for showdown and overbets two-pair+ / sets / AK for value, balanced by bricked KQ/KT/QT straight draws and missed spade draws (T9s, 98s, 87s, 75s).',
    keyCombosNote: 'Notice how completely empty the middle of the matrix (QQ, KK, Jx, weak Ax) becomes on a polarized river overbet.',
  },
  {
    id: 'hr-3bp-btn-turn-delayed-cbet',
    title: 'BTN Delayed Turn Barrel Range After Flop Check-Back on 9♠ 6♦ 2♣ K♥',
    villainPos: 'BTN',
    heroPos: 'CO',
    streetLabel: 'Turn · 3-Bet Pot · 100bb',
    potBb: 28.9,
    board: parseCards(['9s', '6d', '2c', 'Kh']),
    timeline: [
      {
        street: 'Preflop',
        detail: 'CO opens 2.5bb, BTN 3-bets 7.5bb, CO calls.',
        narrowingHint: 'BTN 3-bets for value (JJ+, AK, AQs, KQs) and with suited blockers (A5s–A3s, KJs, QJs, JTs).',
      },
      {
        street: 'Flop 9♠ 6♦ 2♣',
        detail: 'CO checks, BTN checks back.',
        narrowingHint: 'Checking back a dry low flop removes most one-pair value and sets; BTN keeps unpaired overcards, slowplayed overpairs, and missed draws.',
      },
      {
        street: 'Turn K♥',
        detail: 'CO checks, BTN bets 12.4bb (75% pot).',
        narrowingHint: 'The King improves BTN’s overcards: AK, KQs, and KJs now bet for value, KK and slowplayed AA bet big, and QJs/JTs bet as gutshot bluffs with A5s–A4s blockers.',
      },
    ],
    promptQuestion: 'Select BTN’s delayed Turn barrel range on 9♠ 6♦ 2♣ K♥.',
    targetHands: expandTokens([
      'AA',
      'KK',
      'AKs',
      'AKo',
      'KQs',
      'KJs',
      'QJs',
      'JTs',
      'A5s',
      'A4s',
    ]),
    explanation:
      'After BTN checks back the flop, the turn King is a perfect card to bet big: it improves overcards (AK, KQs, KJs) to top pair, turns slowplayed KK/AA into obvious value, and gives gutshot bluffs (QJs, JTs) and wheel-Ace blockers (A5s, A4s) a credible story. Medium pairs like TT–JJ prefer to keep checking for showdown.',
    keyCombosNote: 'Key takeaway: A delayed turn bet after a flop check is polar. CO should call with strong Kx and the better pairs while releasing pure bluff-catchers against big sizes.',
  },
  {
    id: 'hr-sb-bb-river-xr-value-polar',
    title: 'BB River Check-Raise Range on Paired Flush Board 9♥ 9♣ 4♥ 6♦ 2♥',
    villainPos: 'BB',
    heroPos: 'SB',
    streetLabel: 'River · SRP · 100bb',
    potBb: 62.0,
    board: parseCards(['9h', '9c', '4h', '6d', '2h']),
    timeline: [
      {
        street: 'Preflop',
        detail: 'SB opens 3.0bb, BB calls.',
        narrowingHint: 'BB defends wide against the SB open, keeping pairs, suited connectors, suited Aces, and suited Kings.',
      },
      {
        street: 'Flop 9♥ 9♣ 4♥ → Turn 6♦',
        detail: 'BB checks, SB bets 2.0bb, BB calls; turn: BB checks, SB bets 5.0bb, BB calls.',
        narrowingHint: 'BB check-calls twice with pocket pairs, flush draws, trips, and straight draws, keeping its range wide.',
      },
      {
        street: 'River 2♥',
        detail: 'BB checks, SB bets 10.0bb, BB check-raises to 32.0bb.',
        narrowingHint: 'The River 2♥ completes the flush and pairs the board; BB check-raises with flushes, full houses, and trips for value plus missed straight draws as bluffs.',
      },
    ],
    promptQuestion: 'Map BB’s polar River check-raise range on 9♥ 9♣ 4♥ 6♦ 2♥.',
    targetHands: expandTokens([
      '66',
      '44',
      '22',
      'A9s',
      'AKs',
      'AQs',
      'AJs',
      'KQs',
      '87s',
      '75s',
      'T8s',
    ]),
    explanation:
      'On a paired board that also completes the flush, BB’s check-raise is built from full houses (66, 44, 22), trips (A9s), and made flushes (AKs, AQs, AJs, KQs), balanced by missed straight draws (87s, 75s, T8s) that cannot win at showdown. Hands like KK or AA stay in the middle and prefer to call.',
    keyCombosNote: 'Notice how the middle of the range (overpairs, weak Ax, one pair) is empty: a river check-raise is a polar line, so SB should fold weak one-pair hands and call with strong trips or better.',
  },
];

export interface HandReadingResult {
  overlapPct: number;
  precisionPct: number;
  recallPct: number;
  selectedCombos: number;
  targetCombos: number;
  matchedCombos: number;
  missedHands: string[];
  extraHands: string[];
  grade: DecisionGrade;
  accuracyScore: number;
}

export function evaluateHandReading(
  spot: HandReadingSpot,
  selectedHands: Set<string>
): HandReadingResult {
  const targetSet = new Set(spot.targetHands);
  let matchedCombos = 0;
  let selectedCombos = 0;
  let targetCombos = 0;

  const missedHands: string[] = [];
  const extraHands: string[] = [];

  for (const h of targetSet) {
    const c = expandHandCombos(h, spot.board).length;
    targetCombos += c;
    if (selectedHands.has(h)) {
      matchedCombos += c;
    } else {
      missedHands.push(h);
    }
  }

  for (const h of selectedHands) {
    const c = expandHandCombos(h, spot.board).length;
    selectedCombos += c;
    if (!targetSet.has(h)) {
      extraHands.push(h);
    }
  }

  const unionCombos = selectedCombos + targetCombos - matchedCombos;
  const overlapPct = unionCombos > 0 ? Math.round((matchedCombos / unionCombos) * 100) : 0;
  const precisionPct = selectedCombos > 0 ? Math.round((matchedCombos / selectedCombos) * 100) : 0;
  const recallPct = targetCombos > 0 ? Math.round((matchedCombos / targetCombos) * 100) : 0;

  let grade: DecisionGrade;
  if (overlapPct >= 75) {
    grade = 'Optimal';
  } else if (overlapPct >= 58) {
    grade = 'Acceptable';
  } else if (overlapPct >= 42) {
    grade = 'Inaccuracy';
  } else if (overlapPct >= 25) {
    grade = 'Mistake';
  } else {
    grade = 'Blunder';
  }

  return {
    overlapPct,
    precisionPct,
    recallPct,
    selectedCombos,
    targetCombos,
    matchedCombos,
    missedHands,
    extraHands,
    grade,
    accuracyScore: overlapPct,
  };
}

export const QUICK_RANGE_PRESETS: Record<string, string[]> = {
  'Pocket Pairs 66+': expandTokens(['66+']),
  'Medium Pairs (QQ–66)': expandTokens(['QQ-66']),
  'Strong Ax (ATs+, AJo+)': expandTokens(['ATs+', 'AJo+']),
  'Suited Broadways': expandTokens(['AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs']),
  'Suited Connectors (T9s–54s)': ['T9s', '98s', '87s', '76s', '65s', '54s'],
  'Nut Wheel Bluffs (A5s–A4s)': ['A5s', 'A4s'],
};
