import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNDAMENTALS_LESSONS } from './fundamentalsLessons';
import { SHOWDOWN_PUZZLES } from './showdownPuzzles';
import { getDailyThreePlan } from './dailyChallenge';
import { encodeProgressBackupCode, restoreProgressBackup } from '../utils/progressBackup';
import {
  canonicalHandKey,
  cardKey,
  compareShowdownCards,
  createSuitRotation,
  describeHeroHand,
  evaluateHand,
  HandCategory,
  handStrengthScore,
  parseCards,
  rotateCards,
} from './evaluator';
import {
  analyzeBoardTexture,
  analyzeHeroDraws,
  classifyAndEstimatePostflop,
  decideBotAction,
  extractPostflopContext,
  getProBotGear,
  inferHeroTendencies,
} from './botAi';
import {
  analyzeDrawsAndOuts,
  bluffBreakEvenPct,
  callEvBb,
  computeHandVsHandEquity,
  minimumDefenseFrequencyPct,
  requiredEquityPct,
} from './math';
import {
  evaluatePreflopDecision,
  generatePreflopSpot,
  PREFLOP_TEMPLATES,
} from './preflopRanges';
import {
  evaluatePostflopDecision,
  generatePostflopSpot,
  generatePostflopSpotById,
  PAIRED_RIVER_OVERBET_ID,
  PAIRED_RIVER_SMALL_ID,
  POSTFLOP_BLUEPRINTS,
} from './postflopSpots';
import { evaluateHandReading, HAND_READING_SPOTS } from './handReadingSpots';
import { evaluateMathAnswer, generateMathQuestion } from './mathDrills';
import {
  ALL_BOT_ARCHETYPES,
  applyPlayerAction,
  getSngBlindLevel,
  buildPresetConfig,
  buildSidePots,
  chooseBotAction,
  computeEffectivePotOdds,
  computeHudDisplay,
  createEmptyHudStats,
  createInitialTable,
  createTableFromConfig,
  DEFAULT_ARENA_CONFIG,
  detectDrawBonus,
  getLegalActions,
  rebuyHeroTo100,
  resolveRunItTwice,
  resolveShowdown,
  revealRabbitHunt,
  roundBb,
  settleAndStartNewHand,
  startNewHand,
  toggleHeroShowHand,
  type ArenaSize,
  type BotArchetype,
  type PokerTableState,
  type TableSeat,
} from './tableEngine';
import {
  exportHandToPokerStarsText,
  exportSessionHandsText,
  type ExportableReplayRecord,
} from './handHistoryExport';
import {
  ARENA_CHALLENGES,
  evaluateChallengeProgress,
} from './arenaChallenges';

test('7-card hand evaluator ranks all hand categories accurately including wheel straight', () => {
  const royal = evaluateHand(parseCards(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c']));
  assert.equal(royal.category, HandCategory.StraightFlush);
  assert.equal(royal.label, 'Royal Flush');

  const quads = evaluateHand(parseCards(['9s', '9h', '9d', '9c', 'As', '2h', '3d']));
  assert.equal(quads.category, HandCategory.FourOfAKind);

  const boat = evaluateHand(parseCards(['Ks', 'Kh', 'Kd', '4c', '4s', '2d', '9h']));
  assert.equal(boat.category, HandCategory.FullHouse);

  const flush = evaluateHand(parseCards(['Ah', 'Jh', '8h', '5h', '2h', 'Ks', 'Qd']));
  assert.equal(flush.category, HandCategory.Flush);

  const wheel = evaluateHand(parseCards(['As', '2d', '3c', '4h', '5s', 'Kd', 'Qc']));
  assert.equal(wheel.category, HandCategory.Straight);
  assert.equal(wheel.tiebreakers[0], 5);

  const twoPair = evaluateHand(parseCards(['As', 'Ad', 'Kc', 'Kh', 'Qs', '2d', '7c']));
  assert.equal(twoPair.category, HandCategory.TwoPair);

  assert.ok(royal.score > quads.score);
  assert.ok(quads.score > boat.score);
  assert.ok(boat.score > flush.score);
  assert.ok(flush.score > wheel.score);
  assert.ok(wheel.score > twoPair.score);
});

test('canonicalHandKey and suit rotation preserve hand identity', () => {
  const [c1, c2] = parseCards(['Kh', 'Ah']);
  assert.equal(canonicalHandKey(c1, c2), 'AKs');
  const [o1, o2] = parseCards(['Td', 'Js']);
  assert.equal(canonicalHandKey(o1, o2), 'JTo');

  const rot = createSuitRotation(() => 0.37);
  const rotated = rotateCards([c1, c2], rot);
  assert.equal(canonicalHandKey(rotated[0], rotated[1]), 'AKs');
});

test('pot odds, MDF, bluff break-even, Call EV, and turn equity math are exact', () => {
  // Villain bets 50% pot (10 into 20 -> pot before call = 30, call = 10 -> 10/40 = 25%)
  assert.equal(requiredEquityPct(30, 10), 25);
  // Villain bets 100% pot (10 into 10 -> pot before call = 20, call = 10 -> 10/30 = 33.3%)
  assert.equal(requiredEquityPct(20, 10), 33.3);
  // MDF + Bluff Break-Even == 100%
  assert.equal(
    Number((minimumDefenseFrequencyPct(20, 15) + bluffBreakEvenPct(20, 15)).toFixed(1)),
    100
  );
  // EV of calling 10bb into 30bb pot with 25% equity == 0.00bb
  assert.equal(callEvBb(30, 10, 25), 0);
  // EV of calling 10bb into 30bb pot with 40% equity == 0.4*30 - 0.6*10 = +6.00bb
  assert.equal(callEvBb(30, 10, 40), 6);

  // Turn nut flush draw (As Qs vs Kd Qc on Ks 7s 2d 3h) -> 9 spades + 3 non-spade Aces = 12 outs / 44 = 27.3%
  const hero = parseCards(['As', 'Qs']) as [any, any];
  const villain = parseCards(['Kd', 'Qc']) as [any, any];
  const board = parseCards(['Ks', '7s', '2d', '3h']);
  const draw = analyzeDrawsAndOuts(hero, board, villain);
  assert.equal(draw.flushDraw, true);
  assert.equal(draw.cleanOuts, 12);
  const eq = computeHandVsHandEquity(hero, villain, board);
  assert.equal(eq.samples, 44);
  assert.equal(eq.heroEquityPct, 27.3);
});

test('all 6-max preflop matrices have 169 valid hands summing to 100% frequency with no synthetic EV claims', () => {
  assert.ok(PREFLOP_TEMPLATES.length >= 9);
  for (const tpl of PREFLOP_TEMPLATES) {
    const keys = Object.keys(tpl.matrix);
    assert.equal(keys.length, 169, `${tpl.id} must have 169 hands`);
    for (const cell of Object.values(tpl.matrix)) {
      assert.equal(
        cell.raise + cell.call + cell.fold,
        100,
        `${tpl.id} ${cell.hand} frequencies must sum to 100`
      );
    }
    assert.equal(tpl.matrix['AA'].raise, 100);
    assert.equal(tpl.matrix['72o'].fold, 100);
  }

  const spot = generatePreflopSpot('RFI', 'BTN', () => 0.25);
  const evalBest = evaluatePreflopDecision(spot, 'raise');
  assert.ok(
    evalBest.actions.every((a) => a.evBb === undefined),
    'Preflop chart actions must not expose synthetic evBb numbers'
  );
  assert.equal(evalBest.evLossBb, undefined);
  assert.ok(evalBest.accuracyScore >= 0 && evalBest.accuracyScore <= 100);
});

test('postflop spots, hand reading, and math drills report honest native metrics (no fabricated EV in bb)', () => {
  assert.ok(POSTFLOP_BLUEPRINTS.length >= 14);
  for (const bp of POSTFLOP_BLUEPRINTS) {
    const sum = bp.actions.reduce((acc, a) => acc + a.frequency, 0);
    assert.equal(sum, 100, `${bp.id} action frequencies must sum to 100`);
    assert.ok(
      bp.actions.every((a) => a.evBb === undefined),
      `${bp.id} must not expose hand-authored evBb values`
    );
  }
  const pfSpot = generatePostflopSpot('ALL', 'ALL', 'ALL', undefined, () => 0.1);
  const bestAct = [...pfSpot.actions].sort((a, b) => b.frequency - a.frequency)[0];
  const pfEval = evaluatePostflopDecision(pfSpot, bestAct.action);
  assert.equal(pfEval.evLossBb, undefined);
  assert.equal(pfEval.grade, 'Optimal');

  const hrSpot = HAND_READING_SPOTS[0];
  const hrPerfect = evaluateHandReading(hrSpot, new Set(hrSpot.targetHands));
  assert.equal(hrPerfect.overlapPct, 100);
  assert.equal(hrPerfect.grade, 'Optimal');
  assert.equal((hrPerfect as unknown as Record<string, unknown>).evLossBb, undefined);

  const potOddsQ = generateMathQuestion('POT_ODDS', () => 0.5);
  const potOddsRes = evaluateMathAnswer(potOddsQ, potOddsQ.exactAnswer);
  assert.equal(potOddsRes.grade, 'Optimal');
  assert.equal(potOddsRes.errorUnit, 'pp');
  assert.equal(potOddsRes.delta, 0);
  assert.equal((potOddsRes as unknown as Record<string, unknown>).evLossBb, undefined);

  const callEvQ = generateMathQuestion('CALL_EV', () => 0.5);
  const callEvRes = evaluateMathAnswer(callEvQ, callEvQ.exactAnswer);
  assert.equal(callEvRes.grade, 'Optimal');
  assert.equal(callEvRes.errorUnit, 'bb');
  assert.equal(callEvRes.delta, 0);
});

test('regression: pf-srp-co-bb-river-bluff-blockers is a true missed-draw bluff (High Card), never a made straight', () => {
  // Confirm why the old Kh Jc on Ts 9d 4c Qh 2d was a bug (it made the nut straight)
  const legacyEval = evaluateHand(parseCards(['Kh', 'Jc', 'Ts', '9d', '4c', 'Qh', '2d']));
  assert.equal(legacyEval.category, HandCategory.Straight);

  // Verify the revised scenario is genuinely King-high with zero showdown value
  const spot = generatePostflopSpotById('pf-srp-co-bb-river-bluff-blockers', { preserveSuits: true });
  assert.ok(spot, 'pf-srp-co-bb-river-bluff-blockers must exist');
  assert.deepEqual(
    spot.heroCards.map((c) => `${c.rank}${c.suit}`),
    ['Kc', '9c']
  );
  assert.deepEqual(
    spot.board.map((c) => `${c.rank}${c.suit}`),
    ['Js', 'Ts', '4c', '8h', '2d']
  );
  const revisedEval = evaluateHand([...spot.heroCards, ...spot.board]);
  assert.equal(
    revisedEval.category,
    HandCategory.HighCard,
    `Bluff candidate must be High Card, got ${revisedEval.label}`
  );
  assert.equal(revisedEval.label, 'King-high');
  assert.ok(!spot.title.includes('KJ') && !spot.numbersBreakdown.includes('KJ'));
});

test('all authored postflop scenarios have valid cards, matching board textures, and spoiler-free neutral titles', () => {
  const spoilerPatterns = [
    /\bc-bet\b/i,
    /\bcheck-back\b/i,
    /\bcheck-raise\b/i,
    /\brange bet\b/i,
    /\bthin value\b/i,
    /\bbluff-catch\b/i,
    /\bbluff\b/i,
    /\bpot control\b/i,
    /\bfold\b/i,
    /\bcall\b/i,
  ];
  const expectedBoardCount = { flop: 3, turn: 4, river: 5 } as const;

  for (const bp of POSTFLOP_BLUEPRINTS) {
    const spot = generatePostflopSpotById(bp.id, { preserveSuits: true })!;
    assert.equal(spot.board.length, expectedBoardCount[bp.street], `${bp.id} board length mismatch`);
    const allCards = [...spot.heroCards, ...spot.board].map((c) => `${c.rank}${c.suit}`);
    assert.equal(new Set(allCards).size, allCards.length, `${bp.id} contains duplicate cards`);
    assert.ok(spot.neutralTitle.trim().length > 0, `${bp.id} needs a neutralTitle`);
    assert.ok(spot.numbersBreakdown.trim().length > 0, `${bp.id} needs a numbersBreakdown`);

    for (const pat of spoilerPatterns) {
      assert.ok(
        !pat.test(spot.neutralTitle),
        `${bp.id} neutralTitle "${spot.neutralTitle}" leaks action spoiler matching ${pat}`
      );
    }
  }

  // Spot-check audited texture fixes:
  // 1. pf-3bp-btn-co-k94r must have a real backdoor flush draw (hero suit appears on flop)
  const k94 = generatePostflopSpotById('pf-3bp-btn-co-k94r', { preserveSuits: true })!;
  assert.equal(k94.heroCards[0].suit, k94.heroCards[1].suit);
  assert.ok(
    k94.board.some((c) => c.suit === k94.heroCards[0].suit),
    'pf-3bp-btn-co-k94r must share hero suit on flop for backdoor flush draw'
  );

  // 2. pf-srp-utg-bb-turn-overcard must have a two-tone flop flush draw (2 matching suits on flop)
  const utgTurn = generatePostflopSpotById('pf-srp-utg-bb-turn-overcard', { preserveSuits: true })!;
  const flopSuits = new Set(utgTurn.board.slice(0, 3).map((c) => c.suit));
  assert.equal(flopSuits.size, 2, 'pf-srp-utg-bb-turn-overcard flop must be two-tone');
});

test('paired river bet-size exercise changes only villain bet size and flips decision from Call to Fold', () => {
  const small = generatePostflopSpotById(PAIRED_RIVER_SMALL_ID, { preserveSuits: true })!;
  const overbet = generatePostflopSpotById(PAIRED_RIVER_OVERBET_ID, { preserveSuits: true })!;

  assert.equal(small.pairedSpotId, PAIRED_RIVER_OVERBET_ID);
  assert.equal(overbet.pairedSpotId, PAIRED_RIVER_SMALL_ID);
  assert.deepEqual(small.heroCards, overbet.heroCards);
  assert.deepEqual(small.board, overbet.board);
  assert.equal(small.heroPos, overbet.heroPos);
  assert.equal(small.villainPos, overbet.villainPos);
  assert.equal(small.effectiveStackBb, overbet.effectiveStackBb);

  // Same 20.0bb pot before river bet
  assert.equal(roundBb(small.potBb - small.toCallBb), 20);
  assert.equal(roundBb(overbet.potBb - overbet.toCallBb), 20);

  // Only bet size changes: 6.6bb (33% pot) vs 25.0bb (125% pot)
  assert.equal(small.toCallBb, 6.6);
  assert.equal(overbet.toCallBb, 25.0);
  assert.equal(requiredEquityPct(small.potBb, small.toCallBb), 19.9);
  assert.equal(requiredEquityPct(overbet.potBb, overbet.toCallBb), 35.7);

  const smallBest = [...small.actions].sort((a, b) => b.frequency - a.frequency)[0];
  const overbetBest = [...overbet.actions].sort((a, b) => b.frequency - a.frequency)[0];
  assert.equal(smallBest.action, 'call');
  assert.equal(overbetBest.action, 'fold');
});

test('multiway all-in side pots: 20/100/100 bb showdown where short stack holds best hand', () => {
  const makeSeat = (
    seatIndex: number,
    name: string,
    position: TableSeat['position'],
    cards: [string, string],
    totalInvestedBb: number,
    folded = false
  ): TableSeat => ({
    seatIndex,
    name,
    isHero: seatIndex === 0,
    archetype: 'Balanced Reg',
    position,
    stackBb: 0,
    streetBetBb: 0,
    totalInvestedBb,
    folded,
    allIn: !folded,
    actedThisStreet: true,
    cards: parseCards(cards) as [any, any],
    lastActionText: folded ? 'Folded' : `All-In ${totalInvestedBb}bb`,
    stats: {
      ...createEmptyHudStats(),
      handsDealt: 1,
      vpipHands: folded ? 0 : 1,
      postflopAggActs: 1,
    },
    didVpipThisHand: !folded,
    didPfrThisHand: false,
    didThreeBetThisHand: false,
    hadThreeBetOppThisHand: false,
  });

  // 1) Classic 20 / 100 / 100 bb all-in: short stack (AA) beats KK and QQ on dry 2c 7d 9s 4h Jc
  const seats = [
    makeSeat(0, 'Hero (You)', 'BTN', ['As', 'Ah'], 20),
    makeSeat(1, 'Bot Viktor', 'SB', ['Ks', 'Kh'], 100),
    makeSeat(2, 'Bot Luna', 'BB', ['Qs', 'Qh'], 100),
  ];

  const slices = buildSidePots(seats);
  assert.equal(slices.length, 2);
  assert.equal(slices[0].amountBb, 60);
  assert.deepEqual(slices[0].eligibleSeatIndices, [0, 1, 2]);
  assert.equal(slices[1].amountBb, 160);
  assert.deepEqual(slices[1].eligibleSeatIndices, [1, 2]);

  const tableBase: PokerTableState = {
    ...createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, tableSize: 3 }),
    phase: 'RIVER',
    board: parseCards(['2c', '7d', '9s', '4h', 'Jc']),
    potBb: 220,
    seats,
    actionLog: [],
  };

  const resolved = resolveShowdown(tableBase);
  assert.equal(resolved.phase, 'SHOWDOWN');
  assert.equal(resolved.seats[0].stackBb, 60, 'Short stack (20bb) must win exact 60bb main pot');
  assert.equal(resolved.seats[1].stackBb, 160, '2nd-best deep stack must win exact 160bb side pot');
  assert.equal(resolved.seats[2].stackBb, 0, '3rd-best deep stack must win 0bb');
  assert.equal(
    roundBb(resolved.seats.reduce((s, seat) => s + seat.stackBb, 0)),
    220,
    'Exact 220bb chip conservation'
  );
  assert.equal(resolved.winnerSpec?.potBreakdowns?.length, 2);
  assert.equal(resolved.winnerSpec?.potBreakdowns?.[0].amountBb, 60);
  assert.equal(resolved.winnerSpec?.potBreakdowns?.[1].amountBb, 160);

  // 2) Same 20/100/100 bb plus folded blinds dead money (0.5bb + 1.0bb = 1.5bb into main pot)
  const seatsWithDeadMoney = [
    makeSeat(0, 'Hero (You)', 'CO', ['As', 'Ah'], 20),
    makeSeat(1, 'Bot Viktor', 'BTN', ['Ks', 'Kh'], 100),
    makeSeat(2, 'Bot Luna', 'UTG', ['Qs', 'Qh'], 100),
    makeSeat(3, 'Bot Maya', 'SB', ['7c', '2h'], 0.5, true),
    makeSeat(4, 'Bot Kai', 'BB', ['8c', '3h'], 1.0, true),
  ];
  const resolvedDead = resolveShowdown({
    ...tableBase,
    potBb: 221.5,
    seats: seatsWithDeadMoney,
  });
  assert.equal(resolvedDead.seats[0].stackBb, 61.5, 'Main pot includes 1.5bb folded blinds');
  assert.equal(resolvedDead.seats[1].stackBb, 160, 'Side pot remains 160bb');
  assert.equal(resolvedDead.seats[2].stackBb, 0);
  assert.equal(
    roundBb(resolvedDead.seats.reduce((s, seat) => s + seat.stackBb, 0)),
    221.5
  );

  // 3) Short stack wins main pot (60bb); two deep stacks tie for side pot (80bb each)
  const seatsSplitSide = [
    makeSeat(0, 'Hero (You)', 'BTN', ['As', 'Ah'], 20),
    makeSeat(1, 'Bot Viktor', 'SB', ['Ks', 'Kd'], 100),
    makeSeat(2, 'Bot Luna', 'BB', ['Kc', 'Kh'], 100),
  ];
  const resolvedSplit = resolveShowdown({
    ...tableBase,
    potBb: 220,
    seats: seatsSplitSide,
  });
  assert.equal(resolvedSplit.seats[0].stackBb, 60);
  assert.equal(resolvedSplit.seats[1].stackBb, 80);
  assert.equal(resolvedSplit.seats[2].stackBb, 80);

  // 4) Uncalled excess bet (20bb vs 100bb): 80bb refunded to deep stack even if short stack wins main pot
  const seatsUncalled = [
    makeSeat(0, 'Hero (You)', 'BTN', ['As', 'Ah'], 20),
    makeSeat(1, 'Bot Viktor', 'BB', ['Ks', 'Kh'], 100),
  ];
  const resolvedUncalled = resolveShowdown({
    ...tableBase,
    potBb: 120,
    seats: seatsUncalled,
  });
  assert.equal(resolvedUncalled.seats[0].stackBb, 40, 'Short stack wins 40bb contested pot');
  assert.equal(resolvedUncalled.seats[1].stackBb, 80, 'Uncalled 80bb excess returns to deep stack');
});

test('6-max cash table preserves 600bb chip conservation invariant through a full hand', () => {
  let seed = 42;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  let table = createInitialTable();
  table = startNewHand(table, seededRng);
  assert.equal(table.phase, 'PREFLOP');
  assert.equal(table.potBb, 1.5);

  const totalChips = (t: typeof table) =>
    roundBb(
      t.seats.reduce((sum, s) => sum + s.stackBb, 0) +
        (t.phase === 'SHOWDOWN' ? 0 : t.potBb)
    );

  assert.equal(totalChips(table), 600);

  let steps = 0;
  while (table.phase !== 'SHOWDOWN' && table.actingSeatIndex !== null && steps < 120) {
    const actor = table.actingSeatIndex;
    const move = chooseBotAction(table, actor, seededRng);
    table = applyPlayerAction(table, actor, move.type, move.raiseToBb);
    steps++;
  }

  assert.equal(table.phase, 'SHOWDOWN');
  assert.ok(table.winnerSummary && table.winnerSummary.length > 0);
  assert.equal(totalChips(table), 600, 'Total chips across all 6 seats must remain exactly 600bb');
});

test('Multi-Bot Arena preserves chip conservation across 2-max (HU), 3-max, 4-max, and custom stacks', () => {
  const sizes: ArenaSize[] = [2, 3, 4, 6];
  for (const size of sizes) {
    let seed = 100 + size * 17;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const startingStackBb = size === 2 ? 200 : 100;
    const expectedTotal = size * startingStackBb;
    let table = createTableFromConfig({
      ...DEFAULT_ARENA_CONFIG,
      tableSize: size,
      startingStackBb,
    });
    table = startNewHand(table, rng);

    // Verify Heads-Up blind & preflop acting order: BTN posts SB 0.5bb and acts first preflop
    if (size === 2) {
      const btn = table.seats.find((s) => s.position === 'BTN')!;
      const bb = table.seats.find((s) => s.position === 'BB')!;
      assert.equal(btn.streetBetBb, 0.5);
      assert.equal(bb.streetBetBb, 1.0);
      assert.equal(table.actingSeatIndex, btn.seatIndex);
    }

    let steps = 0;
    while (table.phase !== 'SHOWDOWN' && table.actingSeatIndex !== null && steps < 120) {
      const actor = table.actingSeatIndex;
      const move = chooseBotAction(table, actor, rng);
      table = applyPlayerAction(table, actor, move.type, move.raiseToBb);
      steps++;
    }

    const total = roundBb(
      table.seats.reduce((sum, s) => sum + s.stackBb, 0) +
        (table.phase === 'SHOWDOWN' ? 0 : table.potBb)
    );
    assert.equal(table.phase, 'SHOWDOWN', `${size}-max hand must reach SHOWDOWN`);
    assert.equal(total, expectedTotal, `${size}-max chip conservation must equal ${expectedTotal}bb`);
  }
});

test('Multi-Bot Arena pool presets, Hero position lock, and live HUD stats track accurately', () => {
  const regConfig = buildPresetConfig('reg_wars');
  assert.equal(regConfig.tableSize, 6);
  assert.equal(regConfig.botArchetypes.length, 5);

  const lockedBtnConfig = {
    ...buildPresetConfig('lag_chaos'),
    heroPositionLock: 'BTN' as const,
  };
  let table = createTableFromConfig(lockedBtnConfig);
  let seed = 77;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let h = 0; h < 3; h++) {
    table = startNewHand(table, rng);
    assert.equal(table.seats[0].position, 'BTN', 'Hero must stay locked on BTN every hand');
    let steps = 0;
    while (table.phase !== 'SHOWDOWN' && table.actingSeatIndex !== null && steps < 100) {
      const actor = table.actingSeatIndex;
      const move = chooseBotAction(table, actor, rng);
      table = applyPlayerAction(table, actor, move.type, move.raiseToBb);
      steps++;
    }
  }

  for (const s of table.seats) {
    assert.equal(s.stats.handsDealt, 3);
    const hud = computeHudDisplay(s.stats);
    assert.ok(hud.vpipPct >= 0 && hud.vpipPct <= 100);
    assert.ok(hud.pfrPct <= hud.vpipPct, 'PFR% can never exceed VPIP%');
  }
});

test('settleAndStartNewHand and guarded rebuyHeroTo100 preserve exact chip conservation', () => {
  let seed = 101;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  let table = startNewHand(createTableFromConfig(DEFAULT_ARENA_CONFIG), rng);
  const expectedTotal = 600;

  // Mid-hand Top-Up must be a no-op (never mint chips mid-hand)
  const actor = table.actingSeatIndex!;
  if (actor === 0) {
    table = applyPlayerAction(table, 0, 'raise', 3.0);
  }
  const afterMidHandRebuy = rebuyHeroTo100(table);
  const totalAfterMidHandRebuy = roundBb(
    afterMidHandRebuy.seats.reduce((s, x) => s + x.stackBb, 0) + afterMidHandRebuy.potBb
  );
  assert.equal(totalAfterMidHandRebuy, expectedTotal, 'Mid-hand rebuy must not create chips');

  // Fast-Fold / Skip mid-hand settles pot before dealing next hand
  const nextHand = settleAndStartNewHand(table, rng);
  const totalAfterFastFold = roundBb(
    nextHand.seats.reduce((s, x) => s + x.stackBb, 0) + nextHand.potBb
  );
  assert.equal(totalAfterFastFold, expectedTotal, 'settleAndStartNewHand must conserve all 600bb');

  // At SHOWDOWN, rebuyHeroTo100 must never wipe a stack > startingStackBb back down to 100bb
  const winningShowdown: PokerTableState = {
    ...nextHand,
    phase: 'SHOWDOWN',
    potBb: 0,
    seats: nextHand.seats.map((s) => (s.isHero ? { ...s, stackBb: 145.5 } : s)),
  };
  const afterShowdownRebuy = rebuyHeroTo100(winningShowdown);
  assert.equal(afterShowdownRebuy.seats[0].stackBb, 145.5, 'Top-Up must never reduce a >100bb stack');
});

test('Short all-in does not reopen betting for already-acted players or shrink minRaiseBb', () => {
  let table = startNewHand(
    createTableFromConfig({
      ...DEFAULT_ARENA_CONFIG,
      tableSize: 3,
      botArchetypes: ['Balanced Reg', 'Tight-Aggressive'],
    })
  );
  // Set deterministic stacks on flop: Seat 0 (100bb), Seat 1 (100bb), Seat 2 (12bb short stack)
  table = {
    ...table,
    phase: 'FLOP',
    board: parseCards(['Ks', '8d', '3c']),
    potBb: 6.0,
    currentBetBb: 0,
    minRaiseBb: 1.0,
    lastFullRaiseIncrementBb: 1.0,
    callOnlySeatIndices: [],
    actingSeatIndex: 0,
    seats: table.seats.map((s, idx) => ({
      ...s,
      cards: (
        idx === 0
          ? parseCards(['As', 'Qh'])
          : idx === 1
            ? parseCards(['Jd', 'Ts'])
            : parseCards(['7h', '6d'])
      ) as NonNullable<typeof s.cards>,
      stackBb: idx === 2 ? 12.0 : 100.0,
      streetBetBb: 0,
      totalInvestedBb: 2.0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
    })),
  };

  // Seat 0 bets 10bb (full bet -> minRaiseBb = 20bb, lastFullRaiseIncrementBb = 10bb)
  table = applyPlayerAction(table, 0, 'raise', 10.0);
  assert.equal(table.minRaiseBb, 20.0);
  // Seat 1 calls 10bb
  table = applyPlayerAction(table, 1, 'call');
  // Seat 2 jams short to 12bb (raiseDelta = 2bb < 10bb full raise increment)
  table = applyPlayerAction(table, 2, 'raise', 12.0);
  assert.equal(table.currentBetBb, 12.0);
  assert.equal(table.minRaiseBb, 22.0, 'Short all-in must not shrink minRaiseBb');
  assert.equal(table.actingSeatIndex, 0);

  const seat0Legal = getLegalActions(table, 0);
  assert.equal(seat0Legal.canBetOrRaise, false, 'Prior actor must be call/fold only after short all-in');
  assert.equal(seat0Legal.callAmountBb, 2.0);
});

test('Calibrated handStrengthScore ranks AKs properly, avoids paired-board inflation, and audits preflop accurately', () => {
  const aks = handStrengthScore(parseCards(['As', 'Ks']) as [any, any], []);
  const sixes = handStrengthScore(parseCards(['6h', '6d']) as [any, any], []);
  assert.ok(aks > sixes, `Expected AKs (${aks}) > 66 (${sixes})`);

  // Playing a paired board with weak hole cards must not score as Top Pair / Two Pair
  const weakOnPaired = handStrengthScore(
    parseCards(['3c', '4s']) as [any, any],
    parseCards(['As', 'Ah', 'Qd', '8c', '2s'])
  );
  const weakOnDoublePaired = handStrengthScore(
    parseCards(['4s', '3d']) as [any, any],
    parseCards(['Ks', 'Kh', '8d', '8c', '2s'])
  );
  assert.ok(weakOnPaired < 0.3, `Expected weak hand on paired board < 0.30, got ${weakOnPaired}`);
  assert.ok(weakOnDoublePaired < 0.3, `Expected weak hand on double-paired board < 0.30, got ${weakOnDoublePaired}`);

  // BTN Hero opening AKs to 2.5bb should be Optimal; 72o 100bb preflop shove should be Blunder
  const base = startNewHand(
    createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, heroPositionLock: 'BTN' })
  );
  const heroBtnBase: PokerTableState = {
    ...base,
    phase: 'PREFLOP',
    preflopRaiseCount: 0,
    potBb: 1.5,
    currentBetBb: 1.0,
    minRaiseBb: 2.0,
    actingSeatIndex: 0,
    seats: base.seats.map((s) =>
      s.isHero
        ? { ...s, position: 'BTN', streetBetBb: 0, stackBb: 100, folded: false, allIn: false }
        : s
    ),
  };

  const aksOpen = applyPlayerAction(
    {
      ...heroBtnBase,
      seats: heroBtnBase.seats.map((s) =>
        s.isHero ? { ...s, cards: parseCards(['As', 'Ks']) as [any, any] } : s
      ),
    },
    0,
    'raise',
    2.5
  );
  assert.equal(aksOpen.heroAudits[0]?.grade, 'Optimal', 'BTN AKs 2.5bb open must be Optimal');

  const trashShove = applyPlayerAction(
    {
      ...heroBtnBase,
      seats: heroBtnBase.seats.map((s) =>
        s.isHero ? { ...s, cards: parseCards(['7c', '2d']) as [any, any] } : s
      ),
    },
    0,
    'raise',
    100
  );
  assert.equal(trashShove.heroAudits[0]?.grade, 'Blunder', '72o 100bb preflop open-shove must be Blunder');
});

test('Hand Reading counts exact board-blocked combos across all 4 spots', () => {
  const expectedBlocked: Record<string, number> = {
    'hr-utg-cbet-check-turn': 90,
    'hr-bb-xr-low-board': 58,
    'hr-btn-3bet-double-barrel': 67,
    'hr-co-river-overbet': 63,
    'hr-3bp-btn-turn-delayed-cbet': 43,
    'hr-sb-bb-river-xr-value-polar': 39,
  };
  for (const spot of HAND_READING_SPOTS) {
    const res = evaluateHandReading(spot, new Set(spot.targetHands));
    assert.equal(
      res.targetCombos,
      expectedBlocked[spot.id],
      `Expected blocked target combos for ${spot.id} to be ${expectedBlocked[spot.id]}, got ${res.targetCombos}`
    );
    assert.equal(res.overlapPct, 100);
  }
});

test('P2-3: Flop equity uses exact 990-pair enumeration (deterministic) and preflop keeps Monte Carlo', () => {
  // combo_draw_flop: 9d 8d vs As Kc on Kd 7d 6c -> exact 562/990 = 56.77% (56.8% at 1dp)
  const hero = parseCards(['9d', '8d']) as [any, any];
  const villain = parseCards(['As', 'Kc']) as [any, any];
  const flop = parseCards(['Kd', '7d', '6c']);

  const eqA = computeHandVsHandEquity(hero, villain, flop, 1400, () => 0.01);
  const eqB = computeHandVsHandEquity(hero, villain, flop, 1400, () => 0.99);
  assert.equal(eqA.method, 'exact');
  assert.equal(eqA.samples, 990);
  assert.equal(eqA.heroEquityPct, 56.8);
  assert.deepEqual(eqA, eqB, 'Exact flop enumeration must be 100% deterministic regardless of RNG');

  // Preflop (cardsNeeded = 5) falls back to Monte Carlo
  let preSeed = 42;
  const preRng = () => {
    preSeed = (preSeed * 1664525 + 1013904223) % 4294967296;
    return preSeed / 4294967296;
  };
  const preEq = computeHandVsHandEquity(hero, villain, [], 250, preRng);
  assert.equal(preEq.method, 'monte_carlo');
  assert.equal(preEq.samples, 250);

  // Math drill flop question reports exact_enum with 990 samples (no Monte Carlo wording)
  const flopDrill = generateMathQuestion('OUTS_EQUITY', () => 0.51); // combo_draw_flop
  assert.equal(flopDrill.scenarioId, 'combo_draw_flop');
  assert.equal(flopDrill.equityMethod, 'exact_enum');
  assert.equal(flopDrill.equitySamples, 990);
  assert.equal(flopDrill.exactAnswer, 56.8);
  assert.ok(!flopDrill.prompt.includes('Monte Carlo'));
});

test('P3-15: fd_overcard_turn has exact 12 clean outs (9 flush + 3 Ace overcards, 27.3%) with no hidden wheel gutshot', () => {
  const q = generateMathQuestion('OUTS_EQUITY', () => 0.76); // fd_overcard_turn (index 3 of 4)
  assert.equal(q.scenarioId, 'fd_overcard_turn');
  assert.equal(q.cleanOuts, 12);
  assert.equal(q.exactAnswer, 27.3);
  assert.equal(q.equityMethod, 'exact_enum');
  assert.equal(q.equitySamples, 44);

  const draw = analyzeDrawsAndOuts(q.heroCards!, q.board!, q.villainCards!);
  assert.equal(draw.flushDraw, true);
  assert.equal(draw.openEndedStraightDraw, false);
  assert.equal(draw.gutshotStraightDraw, false);
  assert.equal(draw.overcards, 1);
  assert.equal(draw.cleanOuts, 12);
});

test('P2-1: Uncontested fold awards pot immediately without dealing unused community cards', () => {
  // Preflop uncontested fold in Heads-Up keeps board.length === 0
  let hu = createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, tableSize: 2, botArchetypes: ['Balanced Reg'] });
  hu = startNewHand(hu, () => 0.3);
  assert.equal(hu.phase, 'PREFLOP');
  assert.equal(hu.board.length, 0);
  const firstActor = hu.actingSeatIndex!;
  const afterFold = applyPlayerAction(hu, firstActor, 'fold');
  assert.equal(afterFold.phase, 'SHOWDOWN');
  assert.equal(afterFold.board.length, 0, 'Preflop uncontested fold must not deal community cards');
  assert.equal(afterFold.winnerSpec?.type, 'uncontested');

  // Flop uncontested fold keeps board.length === 3
  let flopTable = startNewHand(
    createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, tableSize: 2, botArchetypes: ['Balanced Reg'] }),
    () => 0.4
  );
  flopTable = {
    ...flopTable,
    phase: 'FLOP',
    board: parseCards(['As', 'Kd', '7c']),
    potBb: 10,
    currentBetBb: 5,
    minRaiseBb: 10,
    actingSeatIndex: 0,
    seats: flopTable.seats.map((s, idx) => ({
      ...s,
      cards: (idx === 0 ? parseCards(['Qh', 'Jc']) : parseCards(['Ts', '9s'])) as [any, any],
      streetBetBb: idx === 1 ? 5 : 0,
      folded: false,
      allIn: false,
      actedThisStreet: idx === 1,
    })),
  };
  const afterFlopFold = applyPlayerAction(flopTable, 0, 'fold');
  assert.equal(afterFlopFold.phase, 'SHOWDOWN');
  assert.equal(afterFlopFold.board.length, 3, 'Flop uncontested fold must not deal turn/river');
});

test('P2-2: applyPlayerAction enforces legality guards for check, 0bb call normalization, and raise floor', () => {
  let table = startNewHand(
    createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, tableSize: 2, botArchetypes: ['Balanced Reg'] }),
    () => 0.5
  );
  // Facing a 10bb bet on flop: checking must be rejected (state returned unchanged)
  const facingBet: PokerTableState = {
    ...table,
    phase: 'FLOP',
    board: parseCards(['Kh', '9c', '4d']),
    potBb: 16,
    currentBetBb: 10,
    minRaiseBb: 20,
    actingSeatIndex: 0,
    seats: table.seats.map((s, idx) => ({
      ...s,
      stackBb: idx === 0 ? 50 : 90,
      streetBetBb: idx === 1 ? 10 : 0,
      folded: false,
      allIn: false,
      actedThisStreet: idx === 1,
      stats: { ...s.stats, vpipHands: 0, postflopCalls: 0 },
      didVpipThisHand: false,
    })),
  };

  const illegalCheck = applyPlayerAction(facingBet, 0, 'check');
  assert.equal(illegalCheck, facingBet, 'Check facing a bet must return state unchanged');

  // Calling 0bb when checked to must normalize to check (no Calls 0bb, no postflopCalls / VPIP inflation)
  const checkedTo: PokerTableState = {
    ...facingBet,
    currentBetBb: 0,
    minRaiseBb: 1,
    seats: facingBet.seats.map((s) => ({ ...s, streetBetBb: 0, actedThisStreet: false })),
  };
  const zeroCall = applyPlayerAction(checkedTo, 0, 'call');
  const lastLog = zeroCall.actionLog[zeroCall.actionLog.length - 1];
  assert.equal(lastLog.text, 'Checks', '0bb call must normalize to Checks');
  assert.equal(lastLog.actionSpec?.kind, 'check');
  assert.equal(zeroCall.seats[0].stats.postflopCalls, 0, '0bb call must not inflate postflopCalls');

  // Invalid raise amounts (below currentBetBb, NaN, or short-stack raise) must never reduce currentBetBb
  const lowRaise = applyPlayerAction(facingBet, 0, 'raise', 3);
  assert.ok(lowRaise.currentBetBb >= facingBet.currentBetBb, 'Low raise must never reduce currentBetBb');

  const nanRaise = applyPlayerAction(facingBet, 0, 'raise', Number.NaN);
  assert.ok(
    Number.isFinite(nanRaise.currentBetBb) && nanRaise.currentBetBb >= facingBet.currentBetBb,
    'NaN raise must never corrupt or reduce currentBetBb'
  );

  const shortStackFacingBet: PokerTableState = {
    ...facingBet,
    currentBetBb: 50,
    minRaiseBb: 100,
    seats: facingBet.seats.map((s, idx) => ({
      ...s,
      cards: (idx === 0 ? parseCards(['Qh', 'Jc']) : parseCards(['Ts', '9s'])) as [any, any],
      stackBb: idx === 0 ? 20 : 50,
      streetBetBb: idx === 1 ? 50 : 0,
    })),
  };
  const shortRaise = applyPlayerAction(shortStackFacingBet, 0, 'raise', 20);
  // Short-stack 'raise' normalizes to an all-in call (completing the street to SHOWDOWN) without lowering currentBetBb mid-street
  assert.equal(shortRaise.seats[0].allIn, true, 'Short-stack raise below currentBetBb must normalize to all-in call');
  assert.equal(shortRaise.phase, 'SHOWDOWN', 'All-in call against acted opponent advances cleanly to SHOWDOWN');
});

test('P2-4: Effective pot-odds capping excludes uncallable overbet excess for Hero audits and bots', () => {
  const base = startNewHand(
    createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, tableSize: 2, botArchetypes: ['Balanced Reg'] }),
    () => 0.25
  );
  // Prior pot = 10bb; Villain shoves 100bb -> state.potBb = 110bb; Hero has 20bb stack (0 streetBet)
  // Callable portion is 20bb -> effectivePotBb = 10 + 20 = 30bb, effectiveToCall = 20bb -> reqEq = 20/50 = 40.0%
  const shortStackSpot: PokerTableState = {
    ...base,
    phase: 'FLOP',
    board: parseCards(['As', 'Kd', 'Qh']),
    potBb: 110,
    currentBetBb: 100,
    minRaiseBb: 200,
    actingSeatIndex: 0,
    seats: base.seats.map((s, idx) => ({
      ...s,
      cards: (idx === 0 ? parseCards(['7c', '2d']) : parseCards(['Ac', 'Ks'])) as [any, any],
      stackBb: idx === 0 ? 20 : 0,
      streetBetBb: idx === 1 ? 100 : 0,
      totalInvestedBb: idx === 1 ? 105 : 5,
      folded: false,
      allIn: idx === 1,
      actedThisStreet: idx === 1,
    })),
  };

  const eff = computeEffectivePotOdds(shortStackSpot, shortStackSpot.seats[0]);
  assert.equal(eff.effectiveToCall, 20);
  assert.equal(eff.effectivePotBb, 30);
  assert.equal(eff.reqEqPct, 40);

  // Hero calling logs Call 20bb (NOT Call 100bb) and 40% required equity
  const afterHeroCall = applyPlayerAction(shortStackSpot, 0, 'call');
  const audit = afterHeroCall.heroAudits[0];
  assert.equal(audit.chosenAction, 'Call 20bb');
  assert.equal(audit.noteSpec?.toCallBb, 20);
  assert.equal(audit.noteSpec?.reqEqPct, 40);

  // Bot holding 72o on As Kd Qh with 20bb facing 100bb shove must fold (not call thinking pot odds are 15.4%)
  const botShortSpot: PokerTableState = {
    ...shortStackSpot,
    actingSeatIndex: 1,
    seats: shortStackSpot.seats.map((s, idx) => ({
      ...s,
      cards: (idx === 1 ? parseCards(['7c', '2d']) : parseCards(['Ac', 'Ks'])) as [any, any],
      stackBb: idx === 1 ? 20 : 0,
      streetBetBb: idx === 0 ? 100 : 0,
      allIn: idx === 0,
      actedThisStreet: idx === 0,
    })),
  };
  const botMove = chooseBotAction(botShortSpot, 1, () => 0.5);
  assert.equal(botMove.type, 'fold', 'Short-stack bot with 72o must fold facing 100bb shove (40% effective pot odds)');
});

test('P2-7: Duplicate-card guards throw clear errors in evaluateHand, computeHandVsHandEquity, and analyzeDrawsAndOuts', () => {
  assert.throws(
    () => evaluateHand(parseCards(['As', 'As', 'Kd', 'Qh', 'Jc'])),
    /Duplicate card As/
  );
  assert.throws(
    () =>
      computeHandVsHandEquity(
        parseCards(['As', 'Kh']) as [any, any],
        parseCards(['As', 'Qd']) as [any, any],
        parseCards(['7c', '8d', '9s'])
      ),
    /Duplicate card As/
  );
  assert.throws(
    () =>
      analyzeDrawsAndOuts(
        parseCards(['As', 'Kh']) as [any, any],
        parseCards(['Kh', '8d', '9s'])
      ),
    /Duplicate card Kh/
  );
});

test('P3-16: Board-only 4-straight and already-made straight are not counted as Hero straight draws', () => {
  // 4-straight on board (5-6-7-8) with unrelated Hero hole cards Kh 2c -> NOT a Hero straight draw
  const heroBlank = parseCards(['Kh', '2c']) as [any, any];
  const boardFourStraight = parseCards(['5s', '6d', '7c', '8h']);
  const drawBlank = analyzeDrawsAndOuts(heroBlank, boardFourStraight);
  assert.equal(drawBlank.openEndedStraightDraw, false);
  assert.equal(drawBlank.gutshotStraightDraw, false);
  assert.equal(detectDrawBonus(heroBlank, boardFourStraight).straightDraw, false);

  // Hero holds Ts 2c on 5s 6d 7c 8h -> 9 makes a Ten-high straight beating board's 9-high (genuine gutshot)
  const heroHigherGutshot = parseCards(['Ts', '2c']) as [any, any];
  const drawHigher = analyzeDrawsAndOuts(heroHigherGutshot, boardFourStraight);
  assert.equal(drawHigher.gutshotStraightDraw, true);
  assert.equal(drawHigher.openEndedStraightDraw, false);
  assert.equal(detectDrawBonus(heroHigherGutshot, boardFourStraight).straightDraw, true);

  // Already-made straight (Jh Th on 9d 8s 7c) must NOT be tagged as a straight draw
  const heroMade = parseCards(['Jh', 'Th']) as [any, any];
  const flopStraight = parseCards(['9d', '8s', '7c']);
  const drawMade = analyzeDrawsAndOuts(heroMade, flopStraight);
  assert.equal(drawMade.openEndedStraightDraw, false);
  assert.equal(drawMade.gutshotStraightDraw, false);
  assert.equal(detectDrawBonus(heroMade, flopStraight).straightDraw, false);

  // Board-only 4-flush (Ks 7s 4s 2s) when Hero holds no spades must NOT be a Hero flush draw
  const heroNoSpade = parseCards(['Ah', 'Qd']) as [any, any];
  const fourFlushBoard = parseCards(['Ks', '7s', '4s', '2s']);
  assert.equal(analyzeDrawsAndOuts(heroNoSpade, fourFlushBoard).flushDraw, false);
  assert.equal(detectDrawBonus(heroNoSpade, fourFlushBoard).flushDraw, false);
});

test('P2-6: FACING_3BET drills only sample hands from Hero plausible RFI opening range (never trash like 72o/83o)', () => {
  let seed = 2026;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const rfiByPos = new Map(
    PREFLOP_TEMPLATES.filter((t) => t.scenarioType === 'RFI').map((t) => [t.heroPos, t])
  );
  const trashHands = new Set(['72o', '83o', '92o', 'J3o', 'T2o', '42o', '82o']);
  let foldSamples = 0;
  let continueSamples = 0;

  for (let i = 0; i < 400; i++) {
    const spot = generatePreflopSpot('FACING_3BET', 'ALL', rng);
    assert.ok(
      !trashHands.has(spot.handKey),
      `FACING_3BET (${spot.template.id}) sampled impossible trash hand ${spot.handKey}`
    );
    const rfi = rfiByPos.get(spot.template.heroPos)!;
    const rfiCell = rfi.matrix[spot.handKey];
    const cell = spot.template.matrix[spot.handKey];
    assert.ok(
      (rfiCell?.raise ?? 0) > 0 || cell.raise > 0 || cell.call > 0,
      `FACING_3BET (${spot.template.id}) sampled ${spot.handKey} outside ${spot.template.heroPos} RFI range`
    );
    if (cell.fold === 100) foldSamples++;
    else continueSamples++;
  }

  assert.ok(foldSamples > 0, 'FACING_3BET should still sample realistic fold-to-3bet hands from RFI range');
  assert.ok(continueSamples > 0, 'FACING_3BET should sample continuing hands');
});

test('describeHeroHand returns concise EN and zh-CN live hand strength and active draws without banned terms', () => {
  // Preflop
  assert.equal(describeHeroHand(parseCards(['As', 'Ah']) as [any, any], [], 'en'), 'Pocket Aces');
  assert.equal(describeHeroHand(parseCards(['As', 'Ah']) as [any, any], [], 'zh-CN'), '口袋对 A');
  assert.equal(describeHeroHand(parseCards(['As', 'Ks']) as [any, any], [], 'en'), 'Ace-King Suited');
  assert.equal(describeHeroHand(parseCards(['As', 'Ks']) as [any, any], [], 'zh-CN'), 'AK 同花');
  assert.equal(describeHeroHand(parseCards(['Qh', 'Jc']) as [any, any], [], 'en'), 'Queen-Jack Offsuit');
  assert.equal(describeHeroHand(parseCards(['Qh', 'Jc']) as [any, any], [], 'zh-CN'), 'QJ 杂色');

  // Top Pair + Flush Draw on Flop
  assert.equal(
    describeHeroHand(parseCards(['As', 'Ts']) as [any, any], parseCards(['Td', '7s', '2s']), 'en'),
    'Top Pair, Ace Kicker · Nut Flush Draw'
  );
  assert.equal(
    describeHeroHand(parseCards(['As', 'Ts']) as [any, any], parseCards(['Td', '7s', '2s']), 'zh-CN'),
    '顶对（A 踢脚）· 坚果同花听牌'
  );

  // Overpair, Set, Two Pair, Combo Draw
  assert.equal(
    describeHeroHand(parseCards(['Qd', 'Qc']) as [any, any], parseCards(['Js', '8h', '3d']), 'en'),
    'Overpair'
  );
  assert.equal(
    describeHeroHand(parseCards(['Qd', 'Qc']) as [any, any], parseCards(['Js', '8h', '3d']), 'zh-CN'),
    '超对'
  );
  assert.equal(
    describeHeroHand(parseCards(['Ks', 'Kh']) as [any, any], parseCards(['Kd', '9c', '4s']), 'en'),
    'Set of Kings'
  );
  assert.equal(
    describeHeroHand(parseCards(['Ks', 'Kh']) as [any, any], parseCards(['Kd', '9c', '4s']), 'zh-CN'),
    '暗三条 K'
  );
  assert.equal(
    describeHeroHand(parseCards(['As', 'Ts']) as [any, any], parseCards(['8s', '7s', '6d']), 'en'),
    'Nut Flush Draw + Gutshot'
  );
  assert.equal(
    describeHeroHand(parseCards(['As', 'Js']) as [any, any], parseCards(['Ts', '9s', '8d']), 'en'),
    'Nut Flush Draw + OESD'
  );
  assert.equal(
    describeHeroHand(parseCards(['As', 'Js']) as [any, any], parseCards(['Ts', '9s', '8d']), 'zh-CN'),
    '坚果同花+两头顺听牌'
  );

  // River never appends draws
  const riverDesc = describeHeroHand(
    parseCards(['As', 'Js']) as [any, any],
    parseCards(['Ts', '9s', '2d', '4c', '3h']),
    'en'
  );
  assert.equal(riverDesc, 'Ace-High');
});

test('ArenaConfig optional sbBb supports $2/$5 (0.4bb SB) while defaulting to 0.5bb', () => {
  const defaultTable = startNewHand(createTableFromConfig(DEFAULT_ARENA_CONFIG), () => 0.5);
  assert.equal(defaultTable.potBb, 1.5);

  const twoFiveTable = startNewHand(
    createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, sbBb: 0.4 }),
    () => 0.5
  );
  assert.equal(twoFiveTable.potBb, 1.4, 'sbBb=0.4 + 1.0 BB must post 1.4bb initial pot');
  const sbSeat = twoFiveTable.seats.find((s) => s.position === 'SB')!;
  assert.equal(sbSeat.streetBetBb, 0.4);
  assert.equal(sbSeat.stackBb, 99.6);
  const totalChips = roundBb(
    twoFiveTable.seats.reduce((sum, s) => sum + s.stackBb, 0) + twoFiveTable.potBb
  );
  assert.equal(totalChips, 600);
});

test('handStrengthScore, analyzeBoardTexture, and analyzeHeroDraws handle scare boards and draw equity accurately', () => {
  // 4-flush board: baby flush (3s4d) must score MUCH lower than nut flush (Qs4d), and top set must be discounted
  const fourFlushBoard = parseCards(['As', 'Ks', '7s', '2s', '9h']);
  const babyFlush = handStrengthScore(parseCards(['3s', '4d']) as [any, any], fourFlushBoard);
  const nutFlush = handStrengthScore(parseCards(['Qs', '4d']) as [any, any], fourFlushBoard);
  const topSetNoSpade = handStrengthScore(parseCards(['Ah', 'Ac']) as [any, any], fourFlushBoard);
  assert.ok(nutFlush > babyFlush + 0.25, `Nut flush (${nutFlush}) must greatly exceed baby flush (${babyFlush})`);
  assert.ok(topSetNoSpade < 0.65, `Top set with no spade on 4-flush must be discounted (<0.65), got ${topSetNoSpade}`);

  // Board trips: KKKAA must greatly exceed KKK77
  const boardTrips = parseCards(['Ks', 'Kh', 'Kd', '7c', '2s']);
  const kkk77 = handStrengthScore(parseCards(['7d', '3h']) as [any, any], boardTrips);
  const kkkaa = handStrengthScore(parseCards(['As', 'Ah']) as [any, any], boardTrips);
  assert.ok(kkkaa > kkk77 + 0.12, `KKKAA (${kkkaa}) must beat KKK77 (${kkk77})`);

  // Board texture: rainbow straight (JT9) and monotone (A83s) are WET; K72r is DRY with PFR range advantage
  const rainbowStraightTex = analyzeBoardTexture(parseCards(['Js', 'Td', '9c']));
  const monotoneTex = analyzeBoardTexture(parseCards(['As', '8s', '3s']));
  const dryK72Tex = analyzeBoardTexture(parseCards(['Ks', '7d', '2c']));
  const lowConnectedTex = analyzeBoardTexture(parseCards(['7s', '6s', '5d']));
  assert.ok(rainbowStraightTex.wetness >= 0.55, `JT9r must be wet, got ${rainbowStraightTex.wetness}`);
  assert.ok(monotoneTex.wetness >= 0.55 && monotoneTex.isMonotone, `A83 monotone must be wet, got ${monotoneTex.wetness}`);
  assert.ok(dryK72Tex.wetness < 0.25 && dryK72Tex.rangeAdvForPfr >= 0.3, `K72r must be dry & favor PFR`);
  assert.ok(lowConnectedTex.rangeAdvForPfr < -0.3, `765ss must favor BB/caller`);

  // Draws: OESD > Gutshot; Flop draw boost > Turn draw boost
  const oesdFlop = analyzeHeroDraws(parseCards(['Jh', 'Th']) as [any, any], parseCards(['9d', '8c', '2s']));
  const gutshotFlop = analyzeHeroDraws(parseCards(['Qh', 'Jh']) as [any, any], parseCards(['9d', '8c', '2s']));
  const oesdTurn = analyzeHeroDraws(parseCards(['Jh', 'Th']) as [any, any], parseCards(['9d', '8c', '2s', '3h']));
  assert.equal(oesdFlop.oesd, true);
  assert.equal(gutshotFlop.gutshot, true);
  assert.equal(gutshotFlop.oesd, false);
  assert.ok(oesdFlop.drawEquityBoost > gutshotFlop.drawEquityBoost + 0.06);
  assert.ok(oesdFlop.drawEquityBoost > oesdTurn.drawEquityBoost + 0.05);
});

test('Hero EV Audit aligns with PREFLOP_TEMPLATES, folds 7-high river air, recognizes OESD/dry c-bets, and tracks street aggressor', () => {
  // 1. Preflop alignment: UTG pure-raise hands (66, A5s, T9s) from PREFLOP_TEMPLATES must audit as Optimal
  const baseUtg = startNewHand(createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, heroPositionLock: 'ROTATE' }), () => 0.42);
  const makeUtgState = (cards: [string, string]): PokerTableState => ({
    ...baseUtg,
    phase: 'PREFLOP',
    preflopRaiseCount: 0,
    potBb: 1.5,
    currentBetBb: 1.0,
    minRaiseBb: 2.0,
    actingSeatIndex: 0,
    actionLog: [],
    seats: baseUtg.seats.map((s) =>
      s.isHero
        ? { ...s, position: 'UTG', cards: parseCards(cards) as [any, any], stackBb: 100, streetBetBb: 0, folded: false, allIn: false }
        : s
    ),
  });
  for (const hand of [['6s', '6h'], ['As', '5s'], ['Ts', '9s']] as [string, string][]) {
    const res = applyPlayerAction(makeUtgState(hand), 0, 'raise', 2.5);
    assert.equal(res.heroAudits[0]?.grade, 'Optimal', `UTG ${hand.join('')} open must be Optimal`);
  }

  // 2. River 7-high air facing 2bb into 12bb pot -> Fold is Optimal, Call is Blunder!
  const riverAirBase: PokerTableState = {
    ...baseUtg,
    phase: 'RIVER',
    board: parseCards(['As', 'Kd', 'Qh', '9c', '5s']),
    potBb: 14,
    currentBetBb: 2,
    minRaiseBb: 4,
    preflopAggressorSeatIndex: 1,
    actingSeatIndex: 0,
    actionLog: [
      { street: 'river', seatName: baseUtg.seats[2].name, position: baseUtg.seats[2].position, text: 'Bets 2bb', actionSpec: { kind: 'bet', amountBb: 2 } },
    ],
    seats: baseUtg.seats.map((s, idx) => ({
      ...s,
      cards: (idx === 0 ? parseCards(['7c', '2d']) : parseCards(['Ac', 'Js'])) as [any, any],
      stackBb: 80,
      streetBetBb: idx === 2 ? 2 : 0,
      folded: idx > 2,
      allIn: false,
      actedThisStreet: idx === 2,
    })),
  };
  const foldAudit = applyPlayerAction(riverAirBase, 0, 'fold').heroAudits[0];
  assert.equal(foldAudit?.grade, 'Optimal', 'Folding 7-high river air facing 2bb into 12bb must be Optimal');
  assert.equal(foldAudit?.recommendedAction, 'Fold');
  assert.equal(foldAudit?.villainName, baseUtg.seats[2].name, 'Primary villain must be actual river aggressor (seat 2), not stale PFR (seat 1)');

  const callAudit = applyPlayerAction(riverAirBase, 0, 'call').heroAudits[0];
  assert.equal(callAudit?.grade, 'Blunder', 'Calling river bet with 7-high air must be Blunder');

  // 3. Flop OESD semi-bluff & dry-board PFR c-bet -> Optimal/Acceptable
  const flopOesd: PokerTableState = {
    ...baseUtg,
    phase: 'FLOP',
    board: parseCards(['9d', '8c', '2h']),
    potBb: 6.5,
    currentBetBb: 0,
    minRaiseBb: 1,
    preflopAggressorSeatIndex: 0,
    actingSeatIndex: 0,
    actionLog: [],
    seats: baseUtg.seats.map((s, idx) => ({
      ...s,
      cards: (idx === 0 ? parseCards(['Js', 'Ts']) : parseCards(['Ad', 'Qc'])) as [any, any],
      stackBb: 96,
      streetBetBb: 0,
      folded: idx > 1,
      allIn: false,
      actedThisStreet: false,
    })),
  };
  const oesdBet = applyPlayerAction(flopOesd, 0, 'raise', 4.0).heroAudits[0];
  assert.equal(oesdBet?.grade, 'Optimal', 'Flop OESD semi-bluff c-bet must be Optimal');
  const oesdCheck = applyPlayerAction(flopOesd, 0, 'check').heroAudits[0];
  assert.equal(oesdCheck?.grade, 'Acceptable', 'Checking back flop OESD should be Acceptable (not punished)');
});

test('Bot AI respects SPR commitment, has no artificial stack cap, and folds 7-high river air even for Calling Station', () => {
  const base = startNewHand(createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, tableSize: 2, botArchetypes: ['Calling Station'] }), () => 0.33);

  // 1. Calling Station holding 7c 2d on River facing 10bb into 15bb pot MUST FOLD
  const csRiverAir: PokerTableState = {
    ...base,
    phase: 'RIVER',
    board: parseCards(['As', 'Kd', 'Qh', '9c', '5s']),
    potBb: 25,
    currentBetBb: 10,
    minRaiseBb: 20,
    actingSeatIndex: 1,
    seats: base.seats.map((s, idx) => ({
      ...s,
      cards: (idx === 1 ? parseCards(['7c', '2d']) : parseCards(['Ac', 'Js'])) as [any, any],
      stackBb: 75,
      streetBetBb: idx === 0 ? 10 : 0,
      folded: false,
      allIn: false,
      actedThisStreet: idx === 0,
    })),
  };
  assert.equal(chooseBotAction(csRiverAir, 1, () => 0.5).type, 'fold', 'Calling Station must fold 7-high pure air to river bet');

  // 2. Low-SPR Top Pair+ getting > 3:1 MUST NEVER FOLD
  const lowSprTp: PokerTableState = {
    ...base,
    phase: 'TURN',
    board: parseCards(['Kd', '8c', '4s', '2h']),
    potBb: 55,
    currentBetBb: 15,
    minRaiseBb: 30,
    actingSeatIndex: 1,
    seats: base.seats.map((s, idx) => ({
      ...s,
      archetype: idx === 1 ? 'Tight Nit' : 'Hero',
      cards: (idx === 1 ? parseCards(['As', 'Kh']) : parseCards(['Qd', 'Jd'])) as [any, any],
      stackBb: idx === 1 ? 15 : 40,
      streetBetBb: idx === 0 ? 15 : 0,
      folded: false,
      allIn: false,
      actedThisStreet: idx === 0,
    })),
  };
  const lowSprMove = chooseBotAction(lowSprTp, 1, () => 0.5);
  assert.notEqual(lowSprMove.type, 'fold', 'Top Pair Top Kicker at low SPR getting > 3:1 must never fold');

  // 3. No hardcoded 35% preflop stack cap: AA facing 40bb 4-bet CAN 5-bet jam all-in!
  const preflop5Bet: PokerTableState = {
    ...base,
    phase: 'PREFLOP',
    preflopRaiseCount: 3,
    potBb: 55,
    currentBetBb: 40,
    minRaiseBb: 65,
    actingSeatIndex: 1,
    seats: base.seats.map((s, idx) => ({
      ...s,
      archetype: idx === 1 ? 'Balanced Reg' : 'Hero',
      cards: (idx === 1 ? parseCards(['As', 'Ah']) : parseCards(['Ks', 'Kh'])) as [any, any],
      stackBb: idx === 1 ? 85 : 60,
      streetBetBb: idx === 1 ? 15 : 40,
      folded: false,
      allIn: false,
      actedThisStreet: idx === 0,
    })),
  };
  const aaMove = chooseBotAction(preflop5Bet, 1, () => 0.25);
  assert.equal(aaMove.type, 'raise', 'AA facing 40bb 4-bet must be able to 5-bet jam (no 35% cap)');
  assert.equal(aaMove.raiseToBb, 100, 'AA 5-bet should commit full 100bb stack');
});

test('Seeded 6-max calibration simulation verifies realistic poker envelopes across all 6 bot archetypes', () => {
  const makeRng = (seedInit: number) => {
    let s = seedInit >>> 0;
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  };

  const runSim = (arch: BotArchetype, hands: number) => {
    const rng = makeRng(2026 + arch.length * 73 + arch.charCodeAt(0) * 19);
    let table = createTableFromConfig({
      ...DEFAULT_ARENA_CONFIG,
      tableSize: 6,
      startingStackBb: 100,
      botArchetypes: ['Balanced Reg', 'Balanced Reg', 'Balanced Reg', 'Balanced Reg', 'Balanced Reg'],
    });
    table = {
      ...table,
      seats: table.seats.map((s, i) => (i === 0 ? { ...s, isHero: false, archetype: arch, name: arch } : s)),
    };

    let vpip = 0, pfr = 0, threeBet = 0, threeBetOpp = 0;
    let limp = 0, openLimp = 0, openOpp = 0;
    let cbet = 0, cbetOpp = 0;
    let oopDonk = 0, oopDonkOpp = 0;
    let foldToBet = 0, faceBetOpp = 0;
    let rivAirCall = 0, rivAirFace = 0;

    for (let h = 0; h < hands; h++) {
      table = {
        ...table,
        seats: table.seats.map((s) => ({ ...s, stackBb: 100, allIn: false })),
      };
      table = startNewHand(table, rng);
      let didLimp = false;
      let countedCbetOpp = false;
      let countedDonkOpp = false;
      let steps = 0;

      while (table.phase !== 'SHOWDOWN' && table.actingSeatIndex !== null && steps < 140) {
        const idx = table.actingSeatIndex;
        const move = chooseBotAction(table, idx, rng);

        if (idx === 0) {
          const s0 = table.seats[0];
          if (table.phase === 'PREFLOP') {
            if (table.preflopRaiseCount === 0 && table.potBb <= 1.5 && s0.position !== 'BB') {
              openOpp++;
              if (move.type === 'call') openLimp++;
            }
            if (table.preflopRaiseCount === 0 && move.type === 'call' && !didLimp) {
              limp++;
              didLimp = true;
            }
          } else {
            const ctx = extractPostflopContext(table, 0);
            if (table.phase === 'FLOP' && table.currentBetBb === 0) {
              if (ctx.wasPfr && !countedCbetOpp) {
                cbetOpp++;
                countedCbetOpp = true;
                if (move.type === 'raise') cbet++;
              } else if (!ctx.wasPfr && !ctx.isInPosition && table.preflopAggressorSeatIndex !== null && !countedDonkOpp) {
                oopDonkOpp++;
                countedDonkOpp = true;
                if (move.type === 'raise') oopDonk++;
              }
            }
            if (table.currentBetBb > s0.streetBetBb) {
              faceBetOpp++;
              if (move.type === 'fold') foldToBet++;
              if (table.phase === 'RIVER' && s0.cards) {
                const tex = analyzeBoardTexture(table.board);
                const dr = analyzeHeroDraws(s0.cards, table.board);
                const cl = classifyAndEstimatePostflop(s0.cards, table.board, tex, dr, ctx);
                if (cl.bucket === 'pure_air') {
                  rivAirFace++;
                  if (move.type === 'call') rivAirCall++;
                }
              }
            }
          }
        }

        table = applyPlayerAction(table, idx, move.type, move.raiseToBb);
        steps++;
      }

      // Chip conservation invariant on every simulated hand
      const totalChips = roundBb(table.seats.reduce((sum, s) => sum + s.stackBb, 0));
      assert.equal(totalChips, 600, `${arch} hand #${h + 1} violated 600bb chip conservation`);

      const s0 = table.seats[0];
      if (s0.didVpipThisHand) vpip++;
      if (s0.didPfrThisHand) pfr++;
      if (s0.hadThreeBetOppThisHand) threeBetOpp++;
      if (s0.didThreeBetThisHand) threeBet++;
    }

    const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
    return {
      vpipPct: pct(vpip, hands),
      pfrPct: pct(pfr, hands),
      threeBetPct: pct(threeBet, threeBetOpp),
      limpPct: pct(limp, hands),
      openLimpPct: pct(openLimp, openOpp),
      cbetPct: pct(cbet, cbetOpp),
      oopDonkPct: pct(oopDonk, oopDonkOpp),
      foldToBetPct: pct(foldToBet, faceBetOpp),
      rivAirCallPct: pct(rivAirCall, rivAirFace),
    };
  };

  const results = Object.fromEntries(
    ALL_BOT_ARCHETYPES.map((arch) => [arch, runSim(arch, 400)])
  ) as Record<BotArchetype, ReturnType<typeof runSim>>;

  // Balanced Reg: disciplined 6-max TAG/GTO baseline
  const reg = results['Balanced Reg'];
  assert.ok(reg.vpipPct >= 19 && reg.vpipPct <= 29, `Balanced Reg VPIP out of envelope: ${reg.vpipPct.toFixed(1)}%`);
  assert.ok(reg.pfrPct >= 15 && reg.pfrPct <= 25, `Balanced Reg PFR out of envelope: ${reg.pfrPct.toFixed(1)}%`);
  assert.ok(reg.openLimpPct <= 2, `Balanced Reg OpenLimp must be <= 2%, got ${reg.openLimpPct.toFixed(1)}%`);
  assert.ok(reg.cbetPct >= 45, `Balanced Reg CBet must be >= 45%, got ${reg.cbetPct.toFixed(1)}%`);
  assert.ok(reg.oopDonkPct <= 15, `Balanced Reg OOP Donk must be <= 15%, got ${reg.oopDonkPct.toFixed(1)}%`);
  assert.ok(reg.rivAirCallPct <= 3, `Balanced Reg RivAirCall must be <= 3%, got ${reg.rivAirCallPct.toFixed(1)}%`);

  // Tight-Aggressive
  const tag = results['Tight-Aggressive'];
  assert.ok(tag.vpipPct >= 14 && tag.vpipPct <= 24, `TAG VPIP out of envelope: ${tag.vpipPct.toFixed(1)}%`);
  assert.ok(tag.openLimpPct <= 2, `TAG OpenLimp must be <= 2%, got ${tag.openLimpPct.toFixed(1)}%`);
  assert.ok(tag.cbetPct >= 50, `TAG CBet must be >= 50%, got ${tag.cbetPct.toFixed(1)}%`);

  // Loose-Aggressive
  const lag = results['Loose-Aggressive'];
  assert.ok(lag.vpipPct >= 26 && lag.vpipPct <= 40, `LAG VPIP out of envelope: ${lag.vpipPct.toFixed(1)}%`);
  assert.ok(lag.openLimpPct <= 2, `LAG OpenLimp must be <= 2%, got ${lag.openLimpPct.toFixed(1)}%`);
  assert.ok(lag.cbetPct >= 55, `LAG CBet must be >= 55%, got ${lag.cbetPct.toFixed(1)}%`);

  // Calling Station: limps heavily, folds >= 12% postflop (was 0%), no 7-high river air calls
  const cs = results['Calling Station'];
  assert.ok(cs.vpipPct >= 38 && cs.vpipPct <= 58, `Calling Station VPIP out of envelope: ${cs.vpipPct.toFixed(1)}%`);
  assert.ok(cs.limpPct >= 15, `Calling Station Limp must be >= 15%, got ${cs.limpPct.toFixed(1)}%`);
  assert.ok(cs.foldToBetPct >= 12, `Calling Station FoldToBet must be >= 12% (was 0%), got ${cs.foldToBetPct.toFixed(1)}%`);
  assert.ok(cs.rivAirCallPct <= 5, `Calling Station RivAirCall must be <= 5%, got ${cs.rivAirCallPct.toFixed(1)}%`);

  // Tight Nit: tight VPIP with real PFR >= 8% (was 3.0%), 0% open-limp
  const nit = results['Tight Nit'];
  assert.ok(nit.vpipPct >= 9 && nit.vpipPct <= 19, `Tight Nit VPIP out of envelope: ${nit.vpipPct.toFixed(1)}%`);
  assert.ok(nit.pfrPct >= 8, `Tight Nit PFR must be >= 8% (was 3%), got ${nit.pfrPct.toFixed(1)}%`);
  assert.ok(nit.openLimpPct <= 2, `Tight Nit OpenLimp must be <= 2%, got ${nit.openLimpPct.toFixed(1)}%`);

  // Maniac: hyper-aggressive yet folds worst pure air
  const maniac = results['Maniac'];
  assert.ok(maniac.vpipPct >= 42 && maniac.vpipPct <= 64, `Maniac VPIP out of envelope: ${maniac.vpipPct.toFixed(1)}%`);
  assert.ok(maniac.pfrPct >= 30, `Maniac PFR must be >= 30%, got ${maniac.pfrPct.toFixed(1)}%`);
  assert.ok(maniac.threeBetPct >= 14, `Maniac 3Bet must be >= 14%, got ${maniac.threeBetPct.toFixed(1)}%`);
  assert.ok(maniac.foldToBetPct >= 15, `Maniac FoldToBet must be >= 15% (was 0%), got ${maniac.foldToBetPct.toFixed(1)}%`);
  assert.ok(maniac.rivAirCallPct <= 5, `Maniac RivAirCall must be <= 5%, got ${maniac.rivAirCallPct.toFixed(1)}%`);
});

test('Antes (0.1bb & 0.25bb) and UTG Straddle (2bb) preserve exact chip conservation and live UTG option', () => {
  // 1. 6-max with 0.25bb ante + UTG straddle
  let seed = 808;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  let table = createTableFromConfig({
    ...DEFAULT_ARENA_CONFIG,
    tableSize: 6,
    startingStackBb: 100,
    anteBb: 0.25,
    straddleEnabled: true,
  });
  table = startNewHand(table, rng);

  // 6 * 0.25 ante = 1.5bb + 0.5 SB + 1.0 BB + 2.0 UTG straddle = 5.0bb pot
  assert.equal(table.potBb, 5.0, 'Ante 0.25x6 + SB 0.5 + BB 1.0 + Straddle 2.0 must equal 5.0bb');
  assert.equal(table.currentBetBb, 2.0, 'Straddle must raise currentBetBb to 2.0bb');
  assert.equal(table.minRaiseBb, 3.0, 'Min raise over 2.0bb straddle must be 3.0bb');
  assert.equal(table.lastFullRaiseIncrementBb, 1.0);

  const bbSeat = table.seats.find((s) => s.position === 'BB')!;
  const utgIdx = (bbSeat.seatIndex + 1) % 6;
  const utgSeat = table.seats[utgIdx];
  assert.equal(utgSeat.position, 'UTG');
  assert.equal(utgSeat.streetBetBb, 2.0, 'UTG streetBetBb must reflect 2.0bb straddle only (not ante)');
  assert.equal(utgSeat.totalInvestedBb, 2.25, 'UTG totalInvestedBb must include 0.25 ante + 2.0 straddle');
  assert.equal(utgSeat.actedThisStreet, false, 'UTG must retain live option preflop');
  assert.equal(table.actingSeatIndex, (utgIdx + 1) % 6, 'Preflop action must start left of UTG straddle');

  // Non-blind seat has 0 streetBetBb, 0.25 totalInvestedBb, 99.75 stack
  const hjSeat = table.seats.find((s) => s.position === 'HJ')!;
  assert.equal(hjSeat.streetBetBb, 0);
  assert.equal(hjSeat.totalInvestedBb, 0.25);
  assert.equal(hjSeat.stackBb, 99.75);

  const anteLogs = table.actionLog.filter((l) => l.actionSpec?.kind === 'post_ante');
  const straddleLogs = table.actionLog.filter((l) => l.actionSpec?.kind === 'post_straddle');
  assert.equal(anteLogs.length, 6);
  assert.equal(straddleLogs.length, 1);

  // Verify UTG gets live option when everyone calls/folds around to UTG
  let limpState = table;
  while (limpState.phase === 'PREFLOP' && limpState.actingSeatIndex !== utgIdx) {
    limpState = applyPlayerAction(limpState, limpState.actingSeatIndex!, 'call');
  }
  assert.equal(limpState.phase, 'PREFLOP', 'Hand must pause on UTG for live straddle option');
  assert.equal(limpState.actingSeatIndex, utgIdx);
  assert.equal(getLegalActions(limpState, utgIdx).canCheck, true);
  assert.equal(getLegalActions(limpState, utgIdx).canBetOrRaise, true);

  // Play 12 full hands with 0.25bb ante + straddle and verify exact 600bb chip conservation every hand
  let simTable = createTableFromConfig({
    ...DEFAULT_ARENA_CONFIG,
    tableSize: 6,
    startingStackBb: 100,
    anteBb: 0.25,
    straddleEnabled: true,
  });
  for (let h = 0; h < 12; h++) {
    simTable = {
      ...simTable,
      seats: simTable.seats.map((s) => ({ ...s, stackBb: 100, allIn: false })),
    };
    simTable = startNewHand(simTable, rng);
    let steps = 0;
    while (simTable.phase !== 'SHOWDOWN' && simTable.actingSeatIndex !== null && steps < 140) {
      const actor = simTable.actingSeatIndex;
      const move = chooseBotAction(simTable, actor, rng);
      simTable = applyPlayerAction(simTable, actor, move.type, move.raiseToBb);
      steps++;
    }
    assert.equal(simTable.phase, 'SHOWDOWN');
    const total = roundBb(simTable.seats.reduce((s, seat) => s + seat.stackBb, 0));
    assert.equal(total, 600, `Ante 0.25 + straddle hand #${h + 1} must conserve exact 600bb`);
  }

  // 2. 0.1bb ante + straddle ignored on 3-max (tableSize < 4)
  const threeMax = startNewHand(
    createTableFromConfig({
      ...DEFAULT_ARENA_CONFIG,
      tableSize: 3,
      startingStackBb: 100,
      anteBb: 0.1,
      straddleEnabled: true,
      botArchetypes: ['Balanced Reg', 'Tight-Aggressive'],
    }),
    rng
  );
  assert.equal(threeMax.potBb, 1.8, '3-max 0.1 ante (0.3) + 0.5 SB + 1.0 BB = 1.8bb (no straddle)');
  assert.equal(threeMax.currentBetBb, 1.0, 'Straddle must not activate when tableSize < 4');
  assert.equal(
    roundBb(threeMax.seats.reduce((s, seat) => s + seat.stackBb, 0) + threeMax.potBb),
    300
  );
});

test('Run It Twice pauses on all-in, deals disjoint boards, splits 50/50 with odd 0.1bb to board 1, and conserves chips', () => {
  const base = startNewHand(
    createTableFromConfig({
      ...DEFAULT_ARENA_CONFIG,
      tableSize: 2,
      botArchetypes: ['Balanced Reg'],
      runItTwiceEnabled: true,
    }),
    () => 0.41
  );

  // Set up flop all-in with odd 0.1bb total pot (20.1bb: Hero invests 10.1, Bot invests 10.0? Wait: equal contested pot 20.1 via dead money)
  const flopBoard = parseCards(['9s', '7d', '2c']);
  const heroCards = parseCards(['As', 'Kh']) as [any, any];
  const botCards = parseCards(['Qd', 'Qc']) as [any, any];
  // Construct deterministic deck:
  // Runout 1: Ah 3c (Hero wins Board 1 with Pair of Aces)
  // Runout 2: 4s 5h (Bot wins Board 2 with Pair of Queens)
  const fixedDeck = parseCards(['Ah', '3c', '4s', '5h', 'Js', 'Tc', '8d', '6h']);

  const allInCallState: PokerTableState = {
    ...base,
    phase: 'FLOP',
    board: flopBoard,
    deck: fixedDeck,
    potBb: 15.1, // 5.1bb prior pot + 10.0bb bot shove; Hero calls 5.0bb all-in -> 20.1bb contested!
    currentBetBb: 10.0,
    minRaiseBb: 20.0,
    actingSeatIndex: 0,
    seats: base.seats.map((s, idx) => ({
      ...s,
      cards: idx === 0 ? heroCards : botCards,
      stackBb: idx === 0 ? 5.0 : 0,
      streetBetBb: idx === 1 ? 10.0 : 5.0,
      totalInvestedBb: idx === 0 ? 7.5 : 12.6, // Wait: use equal contested totalInvestedBb=10.05 via 3-way dead money below
      folded: false,
      allIn: idx === 1,
      actedThisStreet: idx === 1,
      didSawFlopThisHand: true,
    })),
  };

  // Better: 3-max with 0.1bb folded dead money + two 10bb all-in stacks => exact 20.1bb single contested pot!
  const threeBase = startNewHand(
    createTableFromConfig({
      ...DEFAULT_ARENA_CONFIG,
      tableSize: 3,
      botArchetypes: ['Balanced Reg', 'Tight-Aggressive'],
      runItTwiceEnabled: true,
    }),
    () => 0.25
  );
  const ritSpot: PokerTableState = {
    ...threeBase,
    phase: 'FLOP',
    board: flopBoard,
    deck: fixedDeck,
    potBb: 15.1, // 0.1 folded dead money + 5.0 Hero prior + 10.0 Bot1 total -> Hero calls last 5.0 => 20.1bb
    currentBetBb: 10.0,
    minRaiseBb: 20.0,
    actingSeatIndex: 0,
    seats: [
      {
        ...threeBase.seats[0],
        cards: heroCards,
        stackBb: 5.0,
        streetBetBb: 5.0,
        totalInvestedBb: 5.0,
        folded: false,
        allIn: false,
        actedThisStreet: false,
        didSawFlopThisHand: true,
      },
      {
        ...threeBase.seats[1],
        cards: botCards,
        stackBb: 0,
        streetBetBb: 10.0,
        totalInvestedBb: 10.0,
        folded: false,
        allIn: true,
        actedThisStreet: true,
        didSawFlopThisHand: true,
      },
      {
        ...threeBase.seats[2],
        cards: parseCards(['2s', '3d']) as [any, any],
        stackBb: 99.9,
        streetBetBb: 0,
        totalInvestedBb: 0.1,
        folded: true,
        allIn: false,
        actedThisStreet: true,
      },
    ],
  };
  const startingChips = roundBb(
    ritSpot.seats.reduce((sum, s) => sum + s.stackBb, 0) + ritSpot.potBb
  );
  assert.equal(startingChips, 120.0);

  // Hero calls 5bb all-in -> pauses awaiting Run It Twice choice!
  const paused = applyPlayerAction(ritSpot, 0, 'call');
  assert.equal(paused.awaitingRunItTwiceChoice, true, 'All-in runout with RIT enabled must pause');
  assert.equal(paused.phase, 'FLOP', 'Must not advance phase or deal turn/river before choice');
  assert.equal(paused.board.length, 3, 'Board must remain at 3 cards while awaiting choice');
  assert.equal(paused.actingSeatIndex, null);
  assert.equal(paused.potBb, 20.1);

  // Branch A: Run It Once -> normal single showdown (Board 1 Ah 3c => Hero wins full 20.1bb)
  const runOnce = resolveRunItTwice(paused, false);
  assert.equal(runOnce.phase, 'SHOWDOWN');
  assert.equal(runOnce.awaitingRunItTwiceChoice, false);
  assert.equal(runOnce.runItTwiceBoards, null);
  assert.equal(runOnce.seats[0].stackBb, 20.1);
  assert.equal(runOnce.seats[1].stackBb, 0);
  assert.equal(
    roundBb(runOnce.seats.reduce((sum, s) => sum + s.stackBb, 0)),
    startingChips
  );

  // Branch B: Run It Twice -> 20.1bb splits 10.1bb (Board 1 -> Hero) and 10.0bb (Board 2 -> Bot 1)
  const runTwice = resolveRunItTwice(paused, true);
  assert.equal(runTwice.phase, 'SHOWDOWN');
  assert.equal(runTwice.awaitingRunItTwiceChoice, false);
  assert.ok(runTwice.runItTwiceBoards, 'runItTwiceBoards must be populated');
  const [b1, b2] = runTwice.runItTwiceBoards!;
  assert.equal(b1.length, 5);
  assert.equal(b2.length, 5);
  assert.deepEqual(b1.slice(0, 3), flopBoard);
  assert.deepEqual(b2.slice(0, 3), flopBoard);

  // Zero duplicate cards across shared flop + runout 1 + runout 2 + all hole cards
  const allDealtCards = [
    ...flopBoard,
    ...b1.slice(3),
    ...b2.slice(3),
    ...heroCards,
    ...botCards,
  ].map((c) => `${c.rank}${c.suit}`);
  assert.equal(new Set(allDealtCards).size, allDealtCards.length, 'Run It Twice must deal zero duplicate cards');

  assert.equal(runTwice.seats[0].stackBb, 10.1, 'Board 1 winner (Hero) must receive 10.1bb including 0.1bb odd remainder');
  assert.equal(runTwice.seats[1].stackBb, 10.0, 'Board 2 winner (Bot) must receive 10.0bb');
  assert.equal(
    roundBb(runTwice.seats.reduce((sum, s) => sum + s.stackBb, 0)),
    startingChips,
    'Exact 100% chip conservation in Run It Twice'
  );
  assert.ok(runTwice.winnerSpec?.potBreakdowns?.length === 2);

  // Guard: ignore unused variable warning
  assert.equal(allInCallState.phase, 'FLOP');
});

test('Rabbit Hunt reveals 5 disjoint cards without mutating stacks/pot/board/deck, and toggleHeroShowHand logs show_hand', () => {
  let hu = createTableFromConfig({
    ...DEFAULT_ARENA_CONFIG,
    tableSize: 2,
    botArchetypes: ['Balanced Reg'],
  });
  hu = startNewHand(hu, () => 0.35);

  // Make Hero win uncontested preflop (board.length === 0)
  const firstActor = hu.actingSeatIndex!;
  let uncontested: PokerTableState;
  if (firstActor === 0) {
    const raised = applyPlayerAction(hu, 0, 'raise', 3.0);
    uncontested = applyPlayerAction(raised, 1, 'fold');
  } else {
    uncontested = applyPlayerAction(hu, firstActor, 'fold');
  }
  assert.equal(uncontested.phase, 'SHOWDOWN');
  assert.equal(uncontested.board.length, 0);
  assert.equal(uncontested.winnerSpec?.type, 'uncontested');
  assert.equal(uncontested.winnerSpec?.winners.some((w) => w.isHero), true);

  const stacksBefore = uncontested.seats.map((s) => s.stackBb);
  const potBefore = uncontested.potBb;
  const deckBefore = uncontested.deck.map((c) => `${c.rank}${c.suit}`);

  const hunted = revealRabbitHunt(uncontested);
  assert.ok(hunted.rabbitHuntBoard, 'revealRabbitHunt must populate rabbitHuntBoard');
  assert.equal(hunted.rabbitHuntBoard!.length, 5);
  assert.equal(hunted.board.length, 0, 'Real board must remain untouched');
  assert.deepEqual(
    hunted.seats.map((s) => s.stackBb),
    stacksBefore,
    'Stacks must not mutate'
  );
  assert.equal(hunted.potBb, potBefore, 'Pot must not mutate');
  assert.deepEqual(
    hunted.deck.map((c) => `${c.rank}${c.suit}`),
    deckBefore,
    'Deck integrity must not mutate'
  );

  // Disjoint from all hole cards
  const allCards = [
    ...hunted.rabbitHuntBoard!,
    ...hunted.seats.flatMap((s) => s.cards ?? []),
  ].map((c) => `${c.rank}${c.suit}`);
  assert.equal(new Set(allCards).size, allCards.length, 'Rabbit hunt cards must be disjoint from hole cards');

  // Idempotent on second call
  assert.equal(revealRabbitHunt(hunted), hunted);

  // toggleHeroShowHand sets heroShowedUncontested and logs show_hand
  const shown = toggleHeroShowHand(hunted);
  assert.equal(shown.heroShowedUncontested, true);
  const lastLog = shown.actionLog[shown.actionLog.length - 1];
  assert.equal(lastLog.actionSpec?.kind, 'show_hand');
  assert.equal(lastLog.isHero, true);

  // Idempotent on second call
  assert.equal(toggleHeroShowHand(shown), shown);
});

test('Extended HUD stats track cbetPct, foldToCbetPct, sawFlopHands, and wtsdPct for both Hero and bots', () => {
  // Hand 1: Hero is PFR, bets flop (c-bet), Bot folds to c-bet
  let hu = createTableFromConfig({
    ...DEFAULT_ARENA_CONFIG,
    tableSize: 2,
    heroPositionLock: 'BTN',
    botArchetypes: ['Balanced Reg'],
  });
  hu = startNewHand(hu, () => 0.22);
  // Hero is BTN/SB and acts first preflop
  assert.equal(hu.actingSeatIndex, 0);
  hu = applyPlayerAction(hu, 0, 'raise', 2.5);
  hu = applyPlayerAction(hu, 1, 'call');
  assert.equal(hu.phase, 'FLOP');
  assert.equal(hu.seats[0].stats.sawFlopHands, 1);
  assert.equal(hu.seats[1].stats.sawFlopHands, 1);
  // Postflop HU: BB (seat 1) acts first -> checks -> Hero (PFR) c-bets -> Bot folds
  hu = applyPlayerAction(hu, 1, 'check');
  hu = applyPlayerAction(hu, 0, 'raise', 2.0);
  hu = applyPlayerAction(hu, 1, 'fold');
  assert.equal(hu.phase, 'SHOWDOWN');

  const heroHud1 = computeHudDisplay(hu.seats[0].stats);
  const botHud1 = computeHudDisplay(hu.seats[1].stats);
  assert.equal(hu.seats[0].stats.cbetOpps, 1);
  assert.equal(hu.seats[0].stats.cbetHands, 1);
  assert.equal(heroHud1.cbetPct, 100);
  assert.equal(hu.seats[1].stats.foldToCbetOpps, 1);
  assert.equal(hu.seats[1].stats.foldToCbetHands, 1);
  assert.equal(botHud1.foldToCbetPct, 100);
  assert.equal(hu.seats[0].stats.wtsdHands, 0, 'Uncontested fold must not increment wtsdHands');
  assert.equal(heroHud1.wtsdPct, 0);

  // Hand 2: Hero is PFR, checks back flop (0/1 c-bet), checks down to contested showdown
  hu = startNewHand(hu, () => 0.44);
  hu = applyPlayerAction(hu, 0, 'raise', 2.5);
  hu = applyPlayerAction(hu, 1, 'call');
  hu = applyPlayerAction(hu, 1, 'check'); // BB checks flop
  hu = applyPlayerAction(hu, 0, 'check'); // Hero (PFR) checks back -> cbetOpps=2, cbetHands=1
  hu = applyPlayerAction(hu, 1, 'check'); // Turn
  hu = applyPlayerAction(hu, 0, 'check');
  hu = applyPlayerAction(hu, 1, 'check'); // River
  hu = applyPlayerAction(hu, 0, 'check');
  assert.equal(hu.phase, 'SHOWDOWN');

  const heroHud2 = computeHudDisplay(hu.seats[0].stats);
  const botHud2 = computeHudDisplay(hu.seats[1].stats);
  assert.equal(hu.seats[0].stats.cbetOpps, 2);
  assert.equal(hu.seats[0].stats.cbetHands, 1);
  assert.equal(heroHud2.cbetPct, 50);
  assert.equal(hu.seats[0].stats.sawFlopHands, 2);
  assert.equal(hu.seats[0].stats.wtsdHands, 1);
  assert.equal(heroHud2.wtsdPct, 50);
  assert.equal(hu.seats[1].stats.sawFlopHands, 2);
  assert.equal(hu.seats[1].stats.wtsdHands, 1);
  assert.equal(botHud2.wtsdPct, 50);
});

test('exportHandToPokerStarsText and exportSessionHandsText format BB and USD PokerStars hand histories', () => {
  const heroCards = parseCards(['As', 'Kd']) as [any, any];
  const botCards = parseCards(['Qh', 'Qd']) as [any, any];
  const board = parseCards(['Ac', '7s', '2d', '9h', '3c']);

  const record: ExportableReplayRecord = {
    handNumber: 12,
    tableSize: 2,
    heroCards,
    netBb: 12.5,
    totalPotBb: 25,
    frames: [
      {
        phase: 'PREFLOP',
        board: [],
        potBb: 1.5,
        buttonSeatIndex: 0,
        winnerSummary: null,
        seats: [
          { seatIndex: 0, name: 'Hero (You)', isHero: true, position: 'BTN', stackBb: 99.5, cards: heroCards, folded: false },
          { seatIndex: 1, name: 'V. Mercer', isHero: false, position: 'BB', stackBb: 99, cards: botCards, folded: false },
        ],
      },
      {
        phase: 'SHOWDOWN',
        board,
        potBb: 25,
        buttonSeatIndex: 0,
        winnerSummary: 'Hero (You) (BTN) wins 25bb with Pair of Aces.',
        seats: [
          { seatIndex: 0, name: 'Hero (You)', isHero: true, position: 'BTN', stackBb: 112.5, cards: heroCards, folded: false },
          { seatIndex: 1, name: 'V. Mercer', isHero: false, position: 'BB', stackBb: 87.5, cards: botCards, folded: false },
        ],
      },
    ],
    actionLog: [
      { street: 'preflop', seatName: 'Hero (You)', isHero: true, position: 'BTN', text: 'Posts SB 0.5bb', actionSpec: { kind: 'post_sb', amountBb: 0.5 } },
      { street: 'preflop', seatName: 'V. Mercer', isHero: false, position: 'BB', text: 'Posts BB 1bb', actionSpec: { kind: 'post_bb', amountBb: 1 } },
      { street: 'preflop', seatName: 'Hero (You)', isHero: true, position: 'BTN', text: 'Raises to 2.5bb', actionSpec: { kind: 'raise', amountBb: 2.5 } },
      { street: 'preflop', seatName: 'V. Mercer', isHero: false, position: 'BB', text: 'Calls 1.5bb', actionSpec: { kind: 'call', amountBb: 1.5 } },
      { street: 'flop', seatName: 'V. Mercer', isHero: false, position: 'BB', text: 'Checks', actionSpec: { kind: 'check' } },
      { street: 'flop', seatName: 'Hero (You)', isHero: true, position: 'BTN', text: 'Bets 10bb', actionSpec: { kind: 'bet', amountBb: 10 } },
      { street: 'flop', seatName: 'V. Mercer', isHero: false, position: 'BB', text: 'Calls 10bb', actionSpec: { kind: 'call', amountBb: 10 } },
    ],
  };

  const bbText = exportHandToPokerStarsText(record, { unit: 'bb', stakesId: 'nl200' });
  assert.ok(bbText.includes("PokerStars Hand #12: Hold'em No Limit (0.5bb/1bb)"));
  assert.ok(bbText.includes('Seat 1: Hero (You) (99.5bb in chips)'));
  assert.ok(bbText.includes('*** HOLE CARDS ***'));
  assert.ok(bbText.includes('Dealt to Hero (You) [As Kd]'));
  assert.ok(bbText.includes('*** FLOP *** [Ac 7s 2d]'));
  assert.ok(bbText.includes('*** TURN *** [Ac 7s 2d] [9h]'));
  assert.ok(bbText.includes('*** RIVER *** [Ac 7s 2d 9h] [3c]'));
  assert.ok(bbText.includes('*** SHOW DOWN ***'));
  assert.ok(bbText.includes('Total pot 25bb'));

  const usdText = exportHandToPokerStarsText(record, { unit: 'usd', stakesId: 'nl200' });
  assert.ok(usdText.includes("PokerStars Hand #12: Hold'em No Limit ($1/$2 USD)"));
  assert.ok(usdText.includes('Seat 1: Hero (You) ($199 in chips)'));
  assert.ok(usdText.includes('Hero (You): raises to $5'));
  assert.ok(usdText.includes('Total pot $50 | Rake $0'));
  assert.ok(usdText.includes('+$25'));

  const sessionText = exportSessionHandsText([record, { ...record, handNumber: 13 }], { unit: 'usd', stakesId: 'nl200' });
  assert.ok(sessionText.includes('PokerStars Hand #12'));
  assert.ok(sessionText.includes('PokerStars Hand #13'));
  assert.equal(exportSessionHandsText([], { unit: 'bb', stakesId: 'nl200' }), '');
});

test('ARENA_CHALLENGES and evaluateChallengeProgress evaluate all 4 Arena challenges accurately', () => {
  assert.equal(ARENA_CHALLENGES.length, 4);
  const byId = Object.fromEntries(ARENA_CHALLENGES.map((c) => [c.id, c]));

  // 1. microstakes_climb
  assert.deepEqual(
    evaluateChallengeProgress(byId.microstakes_climb, {
      sessionNetBb: 22.5,
      sessionHands: 12,
      avgAccuracyPct: 85,
      correctBlindReads: 0,
      poolPreset: 'microstakes',
      tableSize: 6,
      blindReadMode: false,
    }),
    { current: 22.5, target: 20, completed: true }
  );
  assert.equal(
    evaluateChallengeProgress(byId.microstakes_climb, {
      sessionNetBb: 25,
      sessionHands: 12,
      avgAccuracyPct: 85,
      correctBlindReads: 0,
      poolPreset: 'reg_wars',
      tableSize: 6,
      blindReadMode: false,
    }).completed,
    false
  );

  // 2. reg_wars_discipline (requires >= 15 hands AND >= 80% accuracy in reg_wars)
  assert.deepEqual(
    evaluateChallengeProgress(byId.reg_wars_discipline, {
      sessionNetBb: -2,
      sessionHands: 15,
      avgAccuracyPct: 79,
      correctBlindReads: 0,
      poolPreset: 'reg_wars',
      tableSize: 6,
      blindReadMode: false,
    }),
    { current: 15, target: 15, completed: false }
  );
  assert.deepEqual(
    evaluateChallengeProgress(byId.reg_wars_discipline, {
      sessionNetBb: 4,
      sessionHands: 16,
      avgAccuracyPct: 84,
      correctBlindReads: 0,
      poolPreset: 'reg_wars',
      tableSize: 6,
      blindReadMode: false,
    }),
    { current: 16, target: 15, completed: true }
  );

  // 3. blind_read_detective
  assert.deepEqual(
    evaluateChallengeProgress(byId.blind_read_detective, {
      sessionNetBb: 0,
      sessionHands: 20,
      avgAccuracyPct: 90,
      correctBlindReads: 3,
      poolPreset: 'mixed',
      tableSize: 6,
      blindReadMode: true,
    }),
    { current: 3, target: 3, completed: true }
  );
  assert.equal(
    evaluateChallengeProgress(byId.blind_read_detective, {
      sessionNetBb: 0,
      sessionHands: 20,
      avgAccuracyPct: 90,
      correctBlindReads: 2,
      poolPreset: 'mixed',
      tableSize: 6,
      blindReadMode: true,
    }).completed,
    false
  );

  // 4. heads_up_boss
  assert.deepEqual(
    evaluateChallengeProgress(byId.heads_up_boss, {
      sessionNetBb: 18,
      sessionHands: 10,
      avgAccuracyPct: 82,
      correctBlindReads: 0,
      poolPreset: 'heads_up',
      tableSize: 2,
      blindReadMode: false,
    }),
    { current: 18, target: 15, completed: true }
  );
  assert.equal(
    evaluateChallengeProgress(byId.heads_up_boss, {
      sessionNetBb: 30,
      sessionHands: 10,
      avgAccuracyPct: 82,
      correctBlindReads: 0,
      poolPreset: 'mixed',
      tableSize: 6,
      blindReadMode: false,
    }).completed,
    false
  );
});

test('FUNDAMENTALS_LESSONS have 9 bilingual lessons, valid options, zero duplicate cards, and accurate hand-ranking showdowns', () => {
  assert.equal(FUNDAMENTALS_LESSONS.length, 9);
  const seenIds = new Set<string>();
  for (const lesson of FUNDAMENTALS_LESSONS) {
    assert.ok(!seenIds.has(lesson.id), `Duplicate lesson id ${lesson.id}`);
    seenIds.add(lesson.id);
    assert.ok(lesson.title.en.trim().length > 0 && lesson.title['zh-CN'].trim().length > 0);
    assert.ok(lesson.summary.en.trim().length > 0 && lesson.summary['zh-CN'].trim().length > 0);
    assert.equal(lesson.questions.length, 2, `${lesson.id} must have 2 interactive questions`);
    for (const q of lesson.questions) {
      assert.ok(
        q.options.some((o) => o.id === q.correctOptionId),
        `Missing correctOptionId ${q.correctOptionId} in ${q.id}`
      );
      const cards = [...(q.board ?? []), ...(q.heroCards ?? []), ...(q.villainCards ?? [])];
      const keys = cards.map((c) => `${c.rank}${c.suit}`);
      assert.equal(new Set(keys).size, keys.length, `Duplicate card in lesson question ${q.id}`);
      if (q.board && q.board.length === 5 && q.heroCards && q.villainCards) {
        const heroEval = evaluateHand([...q.heroCards, ...q.board]);
        const villainEval = evaluateHand([...q.villainCards, ...q.board]);
        const expectedWinner =
          heroEval.score > villainEval.score
            ? 'hero'
            : villainEval.score > heroEval.score
              ? 'villain'
              : 'split';
        assert.equal(
          q.correctOptionId,
          expectedWinner,
          `Showdown winner mismatch in ${q.id}: expected ${expectedWinner}`
        );
      }
    }
  }
});

test('SHOWDOWN_PUZZLES have 10 unique bilingual puzzles with exact bestFive, accurate winners, and valid deciding cards', () => {
  assert.equal(SHOWDOWN_PUZZLES.length, 10);
  const slugs = new Set<string>();
  for (const p of SHOWDOWN_PUZZLES) {
    assert.ok(!slugs.has(p.slug), `Duplicate puzzle slug ${p.slug}`);
    slugs.add(p.slug);
    const allCards = [...p.board, ...p.hero, ...p.villain];
    assert.equal(new Set(allCards.map(cardKey)).size, 9, `Duplicate card in puzzle ${p.slug}`);
    const cmp = compareShowdownCards(p.hero, p.villain, p.board);
    assert.equal(cmp.heroEval.bestFive.length, 5, `Hero bestFive length in ${p.slug}`);
    assert.equal(cmp.villainEval.bestFive.length, 5, `Villain bestFive length in ${p.slug}`);
    assert.equal(cmp.winner, p.winner, `Winner mismatch in puzzle ${p.slug}`);
    if (p.winner !== 'split') {
      assert.ok(cmp.decidingCardKeys.length > 0, `Expected decidingCardKeys in ${p.slug}`);
    }
    if (p.tapDeciderTarget && p.tapDeciderCardKey) {
      const targetCards = p.tapDeciderTarget === 'hero' ? p.hero : p.villain;
      assert.ok(
        targetCards.some((c) => cardKey(c) === p.tapDeciderCardKey),
        `tapDeciderCardKey ${p.tapDeciderCardKey} not in ${p.tapDeciderTarget} hole cards for ${p.slug}`
      );
    }
  }
});

test('getDailyThreePlan is deterministic per UTC date and backup code round-trips cleanly', () => {
  const a = getDailyThreePlan('2026-11-27');
  const b = getDailyThreePlan('2026-11-27');
  assert.deepEqual(a, b);
  assert.ok(a.preflopTemplateId.length > 0 && a.postflopSpotId.length > 0 && a.showdownSlug.length > 0);

  const mockStore = new Map<string, string>([
    ['feltlab_summary_v1', JSON.stringify({ totalDecisions: 12, optimalCount: 10 })],
    ['turnriver_daily_v1', JSON.stringify({ dateKey: '2026-11-27', completed: ['preflop'] })],
  ]);
  const code = encodeProgressBackupCode({ getItem: (k) => mockStore.get(k) ?? null });
  assert.ok(code.startsWith('TR1:'));

  const restored = new Map<string, string>();
  const { restoredKeys } = restoreProgressBackup(code, {
    setItem: (k, v) => {
      restored.set(k, v);
    },
  });
  assert.equal(restoredKeys.length, 2);
  assert.equal(restored.get('feltlab_summary_v1'), mockStore.get('feltlab_summary_v1'));
});

test('SNG tournament mode escalates blinds by hand count and eliminates busted seats without rebuys', () => {
  assert.equal(getSngBlindLevel(1, 'sng_turbo_3').multiplier, 1);
  assert.equal(getSngBlindLevel(4, 'sng_turbo_3').multiplier, 1.5);
  assert.equal(getSngBlindLevel(6, 'sng_6max').multiplier, 1.5);

  const base = createTableFromConfig({
    ...DEFAULT_ARENA_CONFIG,
    arenaFormat: 'sng_turbo_3',
    tableSize: 3,
    startingStackBb: 50,
    botArchetypes: ['Balanced Reg', 'Loose-Aggressive'],
  });
  const withBust: PokerTableState = {
    ...base,
    handNumber: 3, // Next hand is #4 -> Level 2 (1.5x blinds)
    seats: base.seats.map((s, idx) => (idx === 2 ? { ...s, stackBb: 0 } : s)),
  };
  const next = startNewHand(withBust, () => 0.42);
  assert.equal(next.seats[2].stackBb, 0, 'Busted SNG seat must not be auto topped up');
  assert.equal(next.seats[2].folded, true, 'Busted SNG seat must start folded');
  assert.equal(next.seats[2].cards, null, 'Busted SNG seat must not be dealt hole cards');
  // Level 2 blinds: SB 0.75 (rounded 0.8), BB 1.5 -> potBb = 2.3
  assert.ok(next.potBb >= 2.2, `Expected escalated SNG blinds pot >= 2.2bb, got ${next.potBb}`);
});

test('Bot AI Difficulty tiers: Casual softens river bluffs, Pro profiles Hero leaks & switches gears', () => {
  const base = createTableFromConfig({
    ...DEFAULT_ARENA_CONFIG,
    tableSize: 2,
    botArchetypes: ['Balanced Reg'],
    botDifficulty: 'pro',
  });

  // 1. Small sample (< 6 hands) must stay 'unknown' with 0 confidence
  const earlyRead = inferHeroTendencies(base);
  assert.equal(earlyRead.tag, 'unknown');
  assert.equal(earlyRead.sampleConfidence, 0);

  // 2. Calling Station Hero profile (40 hands, high WTSD, low fold-to-CB)
  const stationHeroState: PokerTableState = {
    ...base,
    seats: base.seats.map((s) =>
      s.isHero
        ? {
            ...s,
            stats: {
              ...s.stats,
              handsDealt: 40,
              vpipHands: 20,
              pfrHands: 5,
              sawFlopHands: 24,
              wtsdHands: 15,
              foldToCbetOpps: 14,
              foldToCbetHands: 2,
              postflopAggActs: 6,
              postflopCalls: 24,
            },
          }
        : s
    ),
  };
  const stationRead = inferHeroTendencies(stationHeroState);
  assert.equal(stationRead.tag, 'calling_station');
  assert.equal(stationRead.sampleConfidence, 1);

  // 3. Over-Folder Hero profile
  const overFolderState: PokerTableState = {
    ...base,
    seats: base.seats.map((s) =>
      s.isHero
        ? {
            ...s,
            stats: {
              ...s.stats,
              handsDealt: 40,
              vpipHands: 10,
              pfrHands: 8,
              sawFlopHands: 16,
              wtsdHands: 4,
              foldToCbetOpps: 15,
              foldToCbetHands: 12,
              postflopAggActs: 10,
              postflopCalls: 8,
            },
          }
        : s
    ),
  };
  assert.equal(inferHeroTendencies(overFolderState).tag, 'over_folder');

  // 4. Hyper-Aggro Hero profile
  const aggroHeroState: PokerTableState = {
    ...base,
    seats: base.seats.map((s) =>
      s.isHero
        ? {
            ...s,
            stats: {
              ...s.stats,
              handsDealt: 40,
              vpipHands: 18,
              pfrHands: 15,
              threeBetOpps: 14,
              threeBetHands: 5,
              postflopAggActs: 32,
              postflopCalls: 6,
            },
          }
        : s
    ),
  };
  assert.equal(inferHeroTendencies(aggroHeroState).tag, 'maniac_aggro');

  // 5. Dynamic gear-switching for skilled archetypes only
  const regGears = new Set<string>();
  for (let h = 1; h <= 80; h += 5) {
    regGears.add(getProBotGear(h, 1, 'Balanced Reg'));
  }
  assert.ok(regGears.has('balanced') && regGears.has('pressure') && regGears.has('trap'));
  assert.equal(getProBotGear(25, 1, 'Calling Station'), 'balanced');

  // 6. Behavioral check: Pro Reg slashes pure-air river bluffs vs Calling Station Hero,
  // and Casual Reg bluffs less than Standard Reg on the exact same river spot.
  const riverSpotBase: PokerTableState = {
    ...stationHeroState,
    phase: 'RIVER',
    handNumber: 1, // Balanced gear for seat 1
    potBb: 18,
    currentBetBb: 0,
    minRaiseBb: 1,
    preflopRaiseCount: 1,
    preflopAggressorSeatIndex: 1,
    board: parseCards(['Ks', '9d', '4c', '2h', '7s']),
    seats: stationHeroState.seats.map((s, idx) => {
      const hole = parseCards(idx === 1 ? ['Ah', '6h'] : ['Kd', 'Qc']);
      return {
        ...s,
        folded: false,
        cards: [hole[0], hole[1]],
        stackBb: 80,
        streetBetBb: 0,
      };
    }),
  };
  const legal = {
    canFold: false,
    canCheck: true,
    canCall: false,
    callAmountBb: 0,
    canBetOrRaise: true,
    isBet: true,
    minTotalBetBb: 1,
    maxTotalBetBb: 80,
    isAllInCall: false,
  };
  const effOdds = { effectiveToCall: 0, effectivePotBb: 18, reqEq: 0 };

  let stdBluffs = 0;
  let casualBluffs = 0;
  let proBluffs = 0;
  for (let i = 0; i < 100; i++) {
    const r = (i + 0.5) / 100;
    const rng = () => r;
    if (decideBotAction({ ...riverSpotBase, config: { ...riverSpotBase.config, botDifficulty: 'standard' } }, 1, legal, effOdds, rng).type === 'raise') stdBluffs++;
    if (decideBotAction({ ...riverSpotBase, config: { ...riverSpotBase.config, botDifficulty: 'casual' } }, 1, legal, effOdds, rng).type === 'raise') casualBluffs++;
    if (decideBotAction({ ...riverSpotBase, config: { ...riverSpotBase.config, botDifficulty: 'pro' } }, 1, legal, effOdds, rng).type === 'raise') proBluffs++;
  }
  assert.ok(casualBluffs < stdBluffs, `Casual bluffs (${casualBluffs}) must be < Standard (${stdBluffs})`);
  assert.ok(proBluffs < stdBluffs, `Pro bluffs vs Station Hero (${proBluffs}) must be < Standard (${stdBluffs})`);
});
