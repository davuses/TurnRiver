import type { Card, DecisionGrade } from './types';
import {
  analyzeDrawsAndOuts,
  bluffBreakEvenPct,
  callEvBb,
  computeHandVsHandEquity,
  minimumDefenseFrequencyPct,
  requiredEquityPct,
} from './math';
import { createSuitRotation, parseCards, rotateCards } from './evaluator';

export type MathDrillCategory = 'POT_ODDS' | 'OUTS_EQUITY' | 'CALL_EV' | 'MDF_BLUFF';

export type MathDrawScenarioId =
  | 'nut_fd_flop'
  | 'oesd_turn'
  | 'combo_draw_flop'
  | 'fd_overcard_turn';

export interface MathDrillQuestion {
  id: string;
  category: MathDrillCategory;
  categoryLabel: string;
  subType?: 'MDF' | 'BLUFF_BREAKEVEN';
  scenarioId?: MathDrawScenarioId;
  prompt: string;
  contextLine: string;
  unit: '%' | 'bb';
  minVal: number;
  maxVal: number;
  step: number;
  defaultVal: number;
  exactAnswer: number;
  toleranceExact: number;
  toleranceClose: number;
  heroCards?: [Card, Card];
  villainCards?: [Card, Card];
  board?: Card[];
  potBb: number;
  betBb: number;
  betPotPct?: number;
  potBeforeCallBb?: number;
  heroEquityPct?: number;
  breakEvenPct?: number;
  cleanOuts?: number;
  unknownCardsCount?: number;
  nextCardOutPct?: number;
  tiePct?: number;
  equityMethod?: 'exact_enum' | 'monte_carlo';
  equitySamples?: number;
  formulaSteps: string[];
  takeaway: string;
}

export interface MathDrillResult {
  userAnswer: number;
  exactAnswer: number;
  delta: number;
  grade: DecisionGrade;
  evLossBb: number;
  accuracyScore: number;
}

const DRAW_SCENARIOS: {
  id: MathDrawScenarioId;
  name: string;
  hero: [string, string];
  villain: [string, string];
  board: string[];
  potBb: number;
  betBb: number;
}[] = [
  {
    id: 'nut_fd_flop',
    name: 'Nut Flush Draw on Flop',
    hero: ['As', 'Qs'],
    villain: ['Kd', 'Qc'],
    board: ['Ks', '7s', '2d'],
    potBb: 12,
    betBb: 8,
  },
  {
    id: 'oesd_turn',
    name: 'Open-Ended Straight Draw on Turn',
    hero: ['Jh', 'Th'],
    villain: ['Ad', '9c'],
    board: ['9d', '8s', '2c', '4h'],
    potBb: 18,
    betBb: 9,
  },
  {
    id: 'combo_draw_flop',
    name: 'Monster Combo Draw (OESD + Flush) on Flop',
    hero: ['9d', '8d'],
    villain: ['As', 'Kc'],
    board: ['Kd', '7d', '6c'],
    potBb: 14,
    betBb: 10.5,
  },
  {
    id: 'fd_overcard_turn',
    name: 'Flush Draw + Overcard on Turn',
    hero: ['Ah', '5h'],
    villain: ['Qs', 'Js'],
    board: ['Qh', '9h', '4c', '2d'],
    potBb: 20,
    betBb: 15,
  },
];

export function generateMathQuestion(
  categoryFilter: MathDrillCategory | 'ALL',
  rng: () => number = Math.random
): MathDrillQuestion {
  const categories: MathDrillCategory[] = ['POT_ODDS', 'OUTS_EQUITY', 'CALL_EV', 'MDF_BLUFF'];
  const category =
    categoryFilter === 'ALL'
      ? categories[Math.floor(rng() * categories.length)]
      : categoryFilter;

  if (category === 'POT_ODDS') {
    const potChoices = [6, 10, 12, 16, 20, 24, 30];
    const betMultipliers = [0.33, 0.5, 0.66, 0.75, 1.0, 1.25];
    const potBeforeBet = potChoices[Math.floor(rng() * potChoices.length)];
    const mult = betMultipliers[Math.floor(rng() * betMultipliers.length)];
    const betPotPct = Math.round(mult * 100);
    const betBb = Number((potBeforeBet * mult).toFixed(1));
    const potBeforeCall = Number((potBeforeBet + betBb).toFixed(1));
    const ans = requiredEquityPct(potBeforeCall, betBb);

    return {
      id: `po-${potBeforeBet}-${betBb}-${Math.floor(rng() * 10000)}`,
      category,
      categoryLabel: 'Pot Odds & Required Equity',
      prompt: `Villain bets ${betBb}bb into a ${potBeforeBet}bb pot (${betPotPct}% pot). What minimum showdown equity (%) do you need to break even (0 EV) on a call?`,
      contextLine: `6-Max · 100bb · Pot before bet: ${potBeforeBet}bb · Facing ${betBb}bb`,
      unit: '%',
      minVal: 5,
      maxVal: 55,
      step: 0.5,
      defaultVal: 25,
      exactAnswer: ans,
      toleranceExact: 1.5,
      toleranceClose: 3.5,
      potBb: potBeforeBet,
      betBb,
      betPotPct,
      potBeforeCallBb: potBeforeCall,
      breakEvenPct: ans,
      formulaSteps: [
        `Final pot after calling = ${potBeforeBet} + ${betBb} + ${betBb} = ${(potBeforeCall + betBb).toFixed(1)}bb`,
        `Break-even required equity = Call / Final Pot = ${betBb} / ${(potBeforeCall + betBb).toFixed(1)} = ${ans}%`,
      ],
      takeaway: `Memorize key benchmarks: 33% pot needs 20%, 50% pot needs 25%, 75% pot needs 30%, 100% pot needs 33.3%.`,
    };
  }

  if (category === 'OUTS_EQUITY') {
    const base = DRAW_SCENARIOS[Math.floor(rng() * DRAW_SCENARIOS.length)];
    const rot = createSuitRotation(rng);
    const hero = rotateCards(parseCards(base.hero), rot) as [Card, Card];
    const villain = rotateCards(parseCards(base.villain), rot) as [Card, Card];
    const board = rotateCards(parseCards(base.board), rot);

    const draw = analyzeDrawsAndOuts(hero, board, villain);
    const eq = computeHandVsHandEquity(hero, villain, board, 1400, rng);
    const isFlop = board.length === 3;
    const streetName = isFlop ? 'Flop' : 'Turn';
    const unknownCardsCount = 52 - hero.length - villain.length - board.length;
    const equityMethod: 'exact_enum' | 'monte_carlo' = isFlop ? 'monte_carlo' : 'exact_enum';
    const potBeforeCall = Number((base.potBb + base.betBb).toFixed(1));
    const reqEq = requiredEquityPct(potBeforeCall, base.betBb);
    const betPotPct = Math.round((base.betBb / Math.max(0.1, base.potBb)) * 100);

    const compareNote =
      eq.heroEquityPct > reqEq
        ? `Above break-even threshold (+EV on direct pot odds)`
        : eq.heroEquityPct === reqEq
          ? `Right at break-even (0 EV on direct pot odds)`
          : `Below break-even threshold (-EV on direct pot odds alone; requires implied odds)`;

    const tieDetail = eq.tiePct > 0 ? ` (includes ${eq.tiePct}% split pots)` : '';

    return {
      id: `oe-${base.id}-${Math.floor(rng() * 10000)}`,
      category,
      categoryLabel: 'Outs & Hand Equity',
      scenarioId: base.id,
      prompt: isFlop
        ? `On the ${streetName} (${base.name}), estimate your showdown equity (%) against Villain's revealed hand (evaluated via ${eq.samples}-run Monte Carlo simulation, including ties).`
        : `On the ${streetName} (${base.name}), calculate your showdown equity (%) against Villain's revealed hand (evaluated via exact enumeration of all ${unknownCardsCount} unknown river cards, including ties).`,
      contextLine: `6-Max · ${streetName} · ${draw.cleanOuts} direct outs (${unknownCardsCount} unknown cards) · Break-even equity vs ${base.betBb}bb bet: ${reqEq}%`,
      unit: '%',
      minVal: 5,
      maxVal: 80,
      step: 1,
      defaultVal: 32,
      exactAnswer: eq.heroEquityPct,
      toleranceExact: 3.0,
      toleranceClose: 6.0,
      heroCards: hero,
      villainCards: villain,
      board,
      potBb: base.potBb,
      betBb: base.betBb,
      betPotPct,
      potBeforeCallBb: potBeforeCall,
      heroEquityPct: eq.heroEquityPct,
      breakEvenPct: reqEq,
      cleanOuts: draw.cleanOuts,
      unknownCardsCount,
      nextCardOutPct: draw.nextCardEquityPct,
      tiePct: eq.tiePct,
      equityMethod,
      equitySamples: eq.samples,
      formulaSteps: [
        `Direct improving outs on next card: ${draw.cleanOuts} / ${unknownCardsCount} = ${draw.nextCardEquityPct}% chance to take the lead on the next card`,
        isFlop
          ? `Rule of 4 shortcut: ${draw.cleanOuts} × 4 ≈ ${Math.min(72, draw.cleanOuts * 4)}% · Showdown equity (${eq.samples}-run Monte Carlo simulation): ${eq.heroEquityPct}%${tieDetail}`
          : `Showdown equity via exact enumeration of all ${eq.samples} river cards: ${eq.heroEquityPct}%${tieDetail}`,
        `Compare vs break-even pot odds (${reqEq}%): ${compareNote}`,
      ],
      takeaway: `Separate next-card out hit probability (outs / unknown cards) from full showdown equity (which includes split pots and multi-card runouts). Rule of 4 (flop) and Rule of 2 (turn) are fast mental estimates.`,
    };
  }

  if (category === 'CALL_EV') {
    const potBeforeBet = [10, 14, 18, 24][Math.floor(rng() * 4)];
    const betBb = [6, 8, 12, 16][Math.floor(rng() * 4)];
    const equityPct = [22, 28, 34, 40, 45][Math.floor(rng() * 5)];
    const potBeforeCall = Number((potBeforeBet + betBb).toFixed(1));
    const betPotPct = Math.round((betBb / Math.max(0.1, potBeforeBet)) * 100);
    const ans = callEvBb(potBeforeCall, betBb, equityPct);
    const reqEq = requiredEquityPct(potBeforeCall, betBb);

    return {
      id: `ev-${potBeforeBet}-${betBb}-${equityPct}-${Math.floor(rng() * 10000)}`,
      category,
      categoryLabel: 'Expected Value (EV in bb)',
      prompt: `Pot is ${potBeforeBet}bb. Villain bets ${betBb}bb on the river. Your bluff-catcher has ${equityPct}% showdown equity against Villain's range. What is the EV of calling (in bb)?`,
      contextLine: `6-Max · River · Pot before call: ${potBeforeCall}bb · Call: ${betBb}bb · Equity: ${equityPct}%`,
      unit: 'bb',
      minVal: -12,
      maxVal: 20,
      step: 0.2,
      defaultVal: 0,
      exactAnswer: ans,
      toleranceExact: 0.6,
      toleranceClose: 1.5,
      potBb: potBeforeBet,
      betBb,
      betPotPct,
      potBeforeCallBb: potBeforeCall,
      heroEquityPct: equityPct,
      breakEvenPct: reqEq,
      formulaSteps: [
        `EV(Call) = (Equity × PotBeforeCall) − ((1 − Equity) × CallCost)`,
        `EV(Call) = (${(equityPct / 100).toFixed(2)} × ${potBeforeCall}bb) − (${((100 - equityPct) / 100).toFixed(2)} × ${betBb}bb)`,
        `EV(Call) = ${((equityPct / 100) * potBeforeCall).toFixed(2)}bb − ${(((100 - equityPct) / 100) * betBb).toFixed(2)}bb = ${ans > 0 ? '+' : ''}${ans}bb`,
      ],
      takeaway: `Whenever your equity exceeds required pot odds (${reqEq}%), calling is +EV relative to folding (0.00bb); at exactly ${reqEq}%, calling is 0 EV (break-even).`,
    };
  }

  // MDF_BLUFF
  const potBeforeBet = [10, 15, 20, 30][Math.floor(rng() * 4)];
  const mults = [0.33, 0.5, 0.75, 1.0, 1.5];
  const mult = mults[Math.floor(rng() * mults.length)];
  const betPotPct = Math.round(mult * 100);
  const betBb = Number((potBeforeBet * mult).toFixed(1));
  const askMdf = rng() > 0.5;
  const ans = askMdf
    ? minimumDefenseFrequencyPct(potBeforeBet, betBb)
    : bluffBreakEvenPct(potBeforeBet, betBb);

  return {
    id: `mdf-${potBeforeBet}-${betBb}-${askMdf ? 'm' : 'b'}-${Math.floor(rng() * 10000)}`,
    category,
    categoryLabel: askMdf ? 'Minimum Defense Frequency (MDF)' : 'Bluff Break-Even Frequency',
    subType: askMdf ? 'MDF' : 'BLUFF_BREAKEVEN',
    prompt: askMdf
      ? `Villain bets ${betBb}bb into a ${potBeforeBet}bb pot (${betPotPct}% pot) on the river. What Minimum Defense Frequency (%) prevents Villain from auto-profiting with any two bluffs?`
      : `You bluff ${betBb}bb into a ${potBeforeBet}bb pot (${betPotPct}% pot) on the river with 0% equity when called. How often (%) must Villain fold for your bluff to break even (0 EV)?`,
    contextLine: `6-Max · River Theory · Pot: ${potBeforeBet}bb · Bet: ${betBb}bb (${betPotPct}%)`,
    unit: '%',
    minVal: 15,
    maxVal: 85,
    step: 0.5,
    defaultVal: 50,
    exactAnswer: ans,
    toleranceExact: 1.5,
    toleranceClose: 3.5,
    potBb: potBeforeBet,
    betBb,
    betPotPct,
    breakEvenPct: ans,
    formulaSteps: askMdf
      ? [
          `MDF = Pot / (Pot + Bet)`,
          `MDF = ${potBeforeBet} / (${potBeforeBet} + ${betBb}) = ${ans}%`,
        ]
      : [
          `Break-Even Fold % (α) = Bet / (Pot + Bet)`,
          `α = ${betBb} / (${potBeforeBet} + ${betBb}) = ${ans}%`,
        ],
    takeaway: `MDF and bluff break-even α always sum to 100%. Larger bets lower your required defense frequency and raise the fold % a bluff needs.`,
  };
}

export function evaluateMathAnswer(
  q: MathDrillQuestion,
  userAnswer: number
): MathDrillResult {
  const delta = Number(Math.abs(userAnswer - q.exactAnswer).toFixed(2));
  let grade: DecisionGrade;
  let evLossBb: number;
  let accuracyScore: number;

  if (delta <= q.toleranceExact) {
    grade = 'Optimal';
    evLossBb = 0;
    accuracyScore = 100;
  } else if (delta <= q.toleranceClose) {
    grade = 'Acceptable';
    evLossBb = 0.08;
    accuracyScore = 88;
  } else if (delta <= q.toleranceClose * 2) {
    grade = 'Inaccuracy';
    evLossBb = 0.25;
    accuracyScore = 68;
  } else if (delta <= q.toleranceClose * 3.5) {
    grade = 'Mistake';
    evLossBb = 0.55;
    accuracyScore = 40;
  } else {
    grade = 'Blunder';
    evLossBb = 1.05;
    accuracyScore = 12;
  }

  return {
    userAnswer,
    exactAnswer: q.exactAnswer,
    delta,
    grade,
    evLossBb,
    accuracyScore,
  };
}
