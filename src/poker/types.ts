import type { CashStakesId, ChipDisplayUnit } from './currency';

export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank =
  | 'A'
  | 'K'
  | 'Q'
  | 'J'
  | 'T'
  | '9'
  | '8'
  | '7'
  | '6'
  | '5'
  | '4'
  | '3'
  | '2';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type DrillModule = 'preflop' | 'postflop' | 'math' | 'reading' | 'table';

export type DecisionGrade =
  | 'Optimal'
  | 'Acceptable'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder';

export interface SolverActionFreq {
  action: string;
  label: string;
  frequency: number; // 0-100
  /** Populated only when backed by an explicit EV calculation. */
  evBb?: number;
  kind: 'fold' | 'check' | 'call' | 'bet' | 'raise';
}

export type DecisionMetricKind =
  | 'freq_pct'
  | 'overlap_pct'
  | 'error_pp'
  | 'error_bb'
  | 'ev_bb'
  | 'pot_odds_pct';

export interface DecisionEvaluation {
  chosenAction: string;
  bestAction: string;
  chosenFreq: number;
  /** Defined only when backed by an explicit EV-in-bb calculation. */
  evLossBb?: number;
  grade: DecisionGrade;
  accuracyScore: number; // 0-100
  actions: SolverActionFreq[];
}

export interface DrillAttemptRecord {
  id: string;
  module: DrillModule;
  position: Position | 'ALL';
  street: Street | 'math';
  spotLabel: string;
  chosenAction: string;
  bestAction: string;
  /** Optional: only present when an attempt has a genuine EV-in-bb metric (or legacy localStorage records). */
  evLossBb?: number;
  /** Honest module-specific metric label (e.g. "78% overlap", "±1.5 pp", "Freq 82%"). */
  metricValue?: number;
  metricKind?: DecisionMetricKind;
  grade: DecisionGrade;
  accuracyScore: number;
  timestamp: number;
}

export type CoachMode = 'off' | 'after_hand' | 'live';

export interface UserPreferences {
  fourColorDeck: boolean;
  soundEnabled: boolean;
  chipDisplayUnit?: ChipDisplayUnit;
  cashStakesId?: CashStakesId;
  autoTopUp?: boolean;
  coachMode?: CoachMode;
  rngEnabled?: boolean;
}

export interface MasterySummary {
  totalDecisions: number;
  optimalCount: number;
  totalAccuracyScore: number;
  /** Legacy field kept optional for backward compatibility with existing localStorage snapshots. */
  totalEvLossBb?: number;
  currentStreak: number;
  bestStreak: number;
}

export function gradeFromFrequency(chosenFreq: number, bestFreq: number): DecisionGrade {
  if (chosenFreq >= 35 || (bestFreq > 0 && chosenFreq >= bestFreq - 10)) return 'Optimal';
  if (chosenFreq >= 12) return 'Acceptable';
  if (chosenFreq >= 4) return 'Inaccuracy';
  if (chosenFreq >= 1) return 'Mistake';
  return 'Blunder';
}

export function gradeFromEvLoss(evLossBb: number, chosenFreq = 0): DecisionGrade {
  if (evLossBb <= 0.03 || chosenFreq >= 35) return 'Optimal';
  if (evLossBb <= 0.14 || chosenFreq >= 12) return 'Acceptable';
  if (evLossBb <= 0.35) return 'Inaccuracy';
  if (evLossBb <= 0.85) return 'Mistake';
  return 'Blunder';
}

export function accuracyFromGrade(grade: DecisionGrade, penalty = 0): number {
  if (grade === 'Optimal') return 100;
  if (grade === 'Acceptable') return Math.max(82, Math.round(92 - penalty * 20));
  if (grade === 'Inaccuracy') return Math.max(60, Math.round(74 - penalty * 15));
  if (grade === 'Mistake') return Math.max(30, Math.round(48 - penalty * 12));
  return Math.max(0, Math.round(18 - Math.min(penalty, 1.5) * 10));
}
