import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalHandKey,
  createSuitRotation,
  evaluateHand,
  HandCategory,
  handStrengthScore,
  parseCards,
  rotateCards,
} from './evaluator';
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
  applyPlayerAction,
  buildPresetConfig,
  buildSidePots,
  chooseBotAction,
  computeHudDisplay,
  createInitialTable,
  createTableFromConfig,
  DEFAULT_ARENA_CONFIG,
  getLegalActions,
  rebuyHeroTo100,
  resolveShowdown,
  roundBb,
  settleAndStartNewHand,
  startNewHand,
  type ArenaSize,
  type PokerTableState,
  type TableSeat,
} from './tableEngine';

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
      handsDealt: 1,
      vpipHands: folded ? 0 : 1,
      pfrHands: 0,
      threeBetHands: 0,
      threeBetOpps: 0,
      postflopAggActs: 1,
      postflopCalls: 0,
      handsWon: 0,
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
