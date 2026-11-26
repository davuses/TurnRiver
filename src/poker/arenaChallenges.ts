import type { ArenaSize, PoolPresetId } from './tableEngine';

export type ArenaChallengeId =
  | 'microstakes_climb'
  | 'reg_wars_discipline'
  | 'blind_read_detective'
  | 'heads_up_boss';

export interface ArenaChallengeSpec {
  id: ArenaChallengeId;
  titleEn: string;
  titleZh: string;
  descEn: string;
  descZh: string;
  targetValue: number;
  recommendedPreset: PoolPresetId;
  recommendedSize: ArenaSize;
  recommendedBlindRead?: boolean;
}

export const ARENA_CHALLENGES: ArenaChallengeSpec[] = [
  {
    id: 'microstakes_climb',
    titleEn: 'Microstakes Climb',
    titleZh: '微额桌爬升',
    descEn: 'Book +20 bb profit in a Microstakes Arena session.',
    descZh: '在微额桌对抗中累计净盈利达到 +20 bb。',
    targetValue: 20,
    recommendedPreset: 'microstakes',
    recommendedSize: 6,
  },
  {
    id: 'reg_wars_discipline',
    titleEn: 'Reg Wars Discipline',
    titleZh: '常规高手纪律',
    descEn: 'Play 15 hands in Reg Wars while maintaining 80%+ decision accuracy.',
    descZh: '在常规高手桌打满 15 手牌，且平均决策准确度不低于 80%。',
    targetValue: 15,
    recommendedPreset: 'reg_wars',
    recommendedSize: 6,
  },
  {
    id: 'blind_read_detective',
    titleEn: 'Blind-Read Detective',
    titleZh: '盲读侦探',
    descEn: 'Correctly identify 3 opponent archetypes in Blind Read Mode.',
    descZh: '在盲读模式下正确识破 3 位对手的牌风类型。',
    targetValue: 3,
    recommendedPreset: 'mixed',
    recommendedSize: 6,
    recommendedBlindRead: true,
  },
  {
    id: 'heads_up_boss',
    titleEn: 'Heads-Up Boss',
    titleZh: '单挑霸主',
    descEn: 'Finish +15 bb ahead in a 2-max Heads-Up duel.',
    descZh: '在 2 人单挑桌对决中累计净盈利达到 +15 bb。',
    targetValue: 15,
    recommendedPreset: 'heads_up',
    recommendedSize: 2,
  },
];

export interface ChallengeInput {
  sessionNetBb: number;
  sessionHands: number;
  avgAccuracyPct: number;
  correctBlindReads: number;
  poolPreset: PoolPresetId;
  tableSize: ArenaSize;
  blindReadMode: boolean;
}

function roundTenth(v: number): number {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

export function evaluateChallengeProgress(
  challenge: ArenaChallengeSpec,
  input: ChallengeInput
): { current: number; target: number; completed: boolean } {
  const target = challenge.targetValue;

  switch (challenge.id) {
    case 'microstakes_climb': {
      const matchingPool = input.poolPreset === 'microstakes';
      const current = matchingPool ? Math.max(0, roundTenth(input.sessionNetBb)) : 0;
      return {
        current,
        target,
        completed: matchingPool && current >= target,
      };
    }

    case 'reg_wars_discipline': {
      const matchingPool = input.poolPreset === 'reg_wars';
      const current = matchingPool ? Math.max(0, Math.floor(input.sessionHands)) : 0;
      return {
        current,
        target,
        completed: matchingPool && current >= target && input.avgAccuracyPct >= 80,
      };
    }

    case 'blind_read_detective': {
      const current = input.blindReadMode ? Math.max(0, Math.floor(input.correctBlindReads)) : 0;
      return {
        current,
        target,
        completed: input.blindReadMode && current >= target,
      };
    }

    case 'heads_up_boss': {
      const isHeadsUp = input.tableSize === 2 || input.poolPreset === 'heads_up';
      const current = isHeadsUp ? Math.max(0, roundTenth(input.sessionNetBb)) : 0;
      return {
        current,
        target,
        completed: isHeadsUp && current >= target,
      };
    }
  }
}
