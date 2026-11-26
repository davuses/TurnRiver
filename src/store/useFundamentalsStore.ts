import { useCallback, useEffect, useState } from 'react';
import type { FundamentalsLessonId } from '../poker/fundamentalsLessons';

const STORAGE_KEY_FUNDAMENTALS = 'turnriver_fundamentals_v1';

interface FundamentalsState {
  completedIds: FundamentalsLessonId[];
  bestScores: Partial<Record<FundamentalsLessonId, number>>;
}

const DEFAULT_STATE: FundamentalsState = {
  completedIds: [],
  bestScores: {},
};

function readFundamentals(): FundamentalsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FUNDAMENTALS);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<FundamentalsState>;
    return {
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [],
      bestScores: parsed.bestScores && typeof parsed.bestScores === 'object' ? parsed.bestScores : {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useFundamentalsStore() {
  const [state, setState] = useState<FundamentalsState>(readFundamentals);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FUNDAMENTALS, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const markLessonCompleted = useCallback((id: FundamentalsLessonId, score: number) => {
    setState((prev) => {
      const completedIds = prev.completedIds.includes(id)
        ? prev.completedIds
        : [...prev.completedIds, id];
      const prevBest = prev.bestScores[id] ?? 0;
      return {
        completedIds,
        bestScores: {
          ...prev.bestScores,
          [id]: Math.max(prevBest, score),
        },
      };
    });
  }, []);

  const resetFundamentalsProgress = useCallback(() => {
    setState(DEFAULT_STATE);
    try {
      localStorage.removeItem(STORAGE_KEY_FUNDAMENTALS);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    completedIds: state.completedIds,
    bestScores: state.bestScores,
    completedCount: state.completedIds.length,
    markLessonCompleted,
    resetFundamentalsProgress,
  };
}
