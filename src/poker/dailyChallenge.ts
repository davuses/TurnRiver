import { useCallback, useEffect, useState } from 'react';
import { PREFLOP_TEMPLATES } from './preflopRanges';
import { generatePostflopSpotById, POSTFLOP_BLUEPRINTS } from './postflopSpots';
import { SHOWDOWN_PUZZLES, type ShowdownPuzzleSlug } from './showdownPuzzles';
import type { Locale } from '../i18n/translations';
import { localizePostflopSpot, localizePreflopTemplate } from '../i18n/drillContentZh';

export type DailySlotKind = 'preflop' | 'postflop' | 'showdown';

export interface DailyThreePlan {
  dateKey: string; // UTC YYYY-MM-DD
  preflopTemplateId: string;
  preflopTitle: string;
  postflopSpotId: string;
  postflopTitle: string;
  showdownSlug: ShowdownPuzzleSlug;
}

export interface LocalizedDailyTitles {
  preflopTitle: string;
  postflopTitle: string;
  showdownTitle: string;
}

export function getLocalizedDailyTitles(
  locale: Locale,
  plan: DailyThreePlan
): LocalizedDailyTitles {
  const preTpl = PREFLOP_TEMPLATES.find((t) => t.id === plan.preflopTemplateId);
  const preflopTitle = preTpl
    ? localizePreflopTemplate(locale, preTpl).title
    : plan.preflopTitle;

  const postSpot = generatePostflopSpotById(plan.postflopSpotId, { preserveSuits: true });
  const postflopTitle = postSpot
    ? localizePostflopSpot(locale, postSpot).title
    : plan.postflopTitle;

  const showdownPuzzle = SHOWDOWN_PUZZLES.find((p) => p.slug === plan.showdownSlug);
  const showdownTitle = showdownPuzzle
    ? showdownPuzzle.title[locale]
    : plan.showdownSlug.replace(/-/g, ' ');

  return { preflopTitle, postflopTitle, showdownTitle };
}

const DAILY_STORAGE_KEY = 'turnriver_daily_v1';

interface PersistedDailyState {
  dateKey: string;
  completed: DailySlotKind[];
}

export function getUtcDateKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDailyThreePlan(dateKey: string = getUtcDateKey()): DailyThreePlan {
  const preIdx = hashString(`pre:${dateKey}`) % PREFLOP_TEMPLATES.length;
  const postIdx = hashString(`post:${dateKey}`) % POSTFLOP_BLUEPRINTS.length;
  const showIdx = hashString(`show:${dateKey}`) % SHOWDOWN_PUZZLES.length;

  const pre = PREFLOP_TEMPLATES[preIdx];
  const post = POSTFLOP_BLUEPRINTS[postIdx];
  const show = SHOWDOWN_PUZZLES[showIdx];

  return {
    dateKey,
    preflopTemplateId: pre.id,
    preflopTitle: pre.title,
    postflopSpotId: post.id,
    postflopTitle: post.title,
    showdownSlug: show.slug,
  };
}

function readDailyState(dateKey: string): PersistedDailyState {
  try {
    const raw = window.localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return { dateKey, completed: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedDailyState>;
    if (parsed.dateKey !== dateKey || !Array.isArray(parsed.completed)) {
      return { dateKey, completed: [] };
    }
    const valid = parsed.completed.filter(
      (k): k is DailySlotKind => k === 'preflop' || k === 'postflop' || k === 'showdown'
    );
    return { dateKey, completed: Array.from(new Set(valid)) };
  } catch {
    return { dateKey, completed: [] };
  }
}

export function useDailyChallengeStore() {
  const dateKey = getUtcDateKey();
  const plan = getDailyThreePlan(dateKey);
  const [state, setState] = useState<PersistedDailyState>(() => readDailyState(dateKey));

  useEffect(() => {
    try {
      window.localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const markDailyDone = useCallback(
    (slot: DailySlotKind) => {
      setState((prev) => {
        const base = prev.dateKey === dateKey ? prev.completed : [];
        if (base.includes(slot)) return prev;
        return { dateKey, completed: [...base, slot] };
      });
    },
    [dateKey]
  );

  return {
    plan,
    completed: state.dateKey === dateKey ? state.completed : [],
    completedCount: state.dateKey === dateKey ? state.completed.length : 0,
    markDailyDone,
  };
}
