import { useCallback, useEffect, useState } from 'react';
import type {
  DrillAttemptRecord,
  MasterySummary,
  UserPreferences,
} from '../poker/types';

const STORAGE_KEY_ATTEMPTS = 'feltlab_attempts_v1';
const STORAGE_KEY_SUMMARY = 'feltlab_summary_v1';
const STORAGE_KEY_PREFS = 'feltlab_prefs_v1';

const DEFAULT_SUMMARY: MasterySummary = {
  totalDecisions: 0,
  optimalCount: 0,
  totalAccuracyScore: 0,
  currentStreak: 0,
  bestStreak: 0,
};

const DEFAULT_PREFS: UserPreferences = {
  fourColorDeck: true,
  soundEnabled: true,
  chipDisplayUnit: 'bb',
  cashStakesId: 'nl200',
  autoTopUp: false,
};

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readSummary(): MasterySummary {
  const stored = readLocal<Partial<MasterySummary>>(STORAGE_KEY_SUMMARY, DEFAULT_SUMMARY);
  const totalDecisions = stored.totalDecisions ?? 0;
  const optimalCount = stored.optimalCount ?? 0;
  const totalAccuracyScore =
    typeof stored.totalAccuracyScore === 'number'
      ? stored.totalAccuracyScore
      : Math.round(optimalCount * 100);
  return {
    totalDecisions,
    optimalCount,
    totalAccuracyScore,
    totalEvLossBb: stored.totalEvLossBb,
    currentStreak: stored.currentStreak ?? 0,
    bestStreak: stored.bestStreak ?? 0,
  };
}

export function useMasteryStore() {
  const [attempts, setAttempts] = useState<DrillAttemptRecord[]>(() =>
    readLocal(STORAGE_KEY_ATTEMPTS, [])
  );
  const [summary, setSummary] = useState<MasterySummary>(() => readSummary());
  const [prefs, setPrefs] = useState<UserPreferences>(() => ({
    ...DEFAULT_PREFS,
    ...readLocal<Partial<UserPreferences>>(STORAGE_KEY_PREFS, {}),
  }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(attempts.slice(0, 200)));
    } catch {
      // Ignore storage quota errors
    }
  }, [attempts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SUMMARY, JSON.stringify(summary));
    } catch {
      // Ignore storage quota errors
    }
  }, [summary]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  const recordAttempt = useCallback(
    (entry: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => {
      const attempt: DrillAttemptRecord = {
        ...entry,
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
      };

      const isGood = attempt.grade === 'Optimal' || attempt.grade === 'Acceptable';

      setSummary((prev) => {
        const nextStreak = isGood ? prev.currentStreak + 1 : 0;
        const nextEvLoss =
          typeof attempt.evLossBb === 'number'
            ? Number(((prev.totalEvLossBb ?? 0) + attempt.evLossBb).toFixed(2))
            : prev.totalEvLossBb;
        return {
          totalDecisions: prev.totalDecisions + 1,
          optimalCount: prev.optimalCount + (isGood ? 1 : 0),
          totalAccuracyScore: Math.round((prev.totalAccuracyScore ?? 0) + attempt.accuracyScore),
          totalEvLossBb: nextEvLoss,
          currentStreak: nextStreak,
          bestStreak: Math.max(prev.bestStreak, nextStreak),
        };
      });

      setAttempts((prev) => [attempt, ...prev].slice(0, 200));
    },
    []
  );

  const updatePrefs = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetProgress = useCallback(() => {
    setAttempts([]);
    setSummary(DEFAULT_SUMMARY);
  }, []);

  return {
    attempts,
    summary,
    prefs,
    recordAttempt,
    updatePrefs,
    resetProgress,
  };
}
