import { useCallback, useEffect, useState } from 'react';
import type { BotArchetype } from '../poker/tableEngine';
import type { ArenaChallengeId } from '../poker/arenaChallenges';

export type PlayerColorTag = 'none' | 'red' | 'green' | 'blue' | 'gold' | 'purple';

export const COLOR_TAG_DOT: Record<PlayerColorTag, string> = {
  none: 'bg-transparent border border-slate-500/60',
  red: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.55)]',
  green: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]',
  blue: 'bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.55)]',
  gold: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.55)]',
  purple: 'bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.55)]',
};

export interface OpponentScoutingNote {
  colorTag: PlayerColorTag;
  note: string;
  blindReadGuess?: BotArchetype;
  blindReadCorrect?: boolean;
}

export interface SessionPoint {
  handNumber: number;
  handNetBb: number;
  cumNetBb: number;
}

export interface HeroArenaLifetime {
  hands: number;
  vpipHands: number;
  pfrHands: number;
  threeBetHands: number;
  threeBetOpps: number;
  cbetHands: number;
  cbetOpps: number;
  sawFlopHands: number;
  wtsdHands: number;
  postflopAggActs: number;
  postflopCalls: number;
  biggestWinBb: number;
  biggestLossBb: number;
}

export interface RecordHandOutcomeInput {
  handNumber: number;
  netBb: number;
  heroSeatDelta?: Partial<HeroArenaLifetime>;
  skipBankroll?: boolean;
}

const SESSION_STORAGE_KEY = 'turnriver_arena_session_v1';
const NOTES_STORAGE_KEY = 'turnriver_opponent_notes_v1';
const DEFAULT_BANKROLL_BB = 1000;
const MAX_SESSION_POINTS = 150;

export const EMPTY_HERO_LIFETIME: HeroArenaLifetime = {
  hands: 0,
  vpipHands: 0,
  pfrHands: 0,
  threeBetHands: 0,
  threeBetOpps: 0,
  cbetHands: 0,
  cbetOpps: 0,
  sawFlopHands: 0,
  wtsdHands: 0,
  postflopAggActs: 0,
  postflopCalls: 0,
  biggestWinBb: 0,
  biggestLossBb: 0,
};

export const EMPTY_OPPONENT_NOTE: OpponentScoutingNote = {
  colorTag: 'none',
  note: '',
};

export type ShowdownHandStamp =
  | 'high_card'
  | 'one_pair'
  | 'two_pair'
  | 'trips'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'quads'
  | 'straight_flush'
  | 'royal_flush';

export const ALL_SHOWDOWN_STAMPS: ShowdownHandStamp[] = [
  'high_card',
  'one_pair',
  'two_pair',
  'trips',
  'straight',
  'flush',
  'full_house',
  'quads',
  'straight_flush',
  'royal_flush',
];

interface PersistedArenaSession {
  bankrollBb: number;
  sessionPoints: SessionPoint[];
  sessionNetBb: number;
  sessionHands: number;
  heroLifetime: HeroArenaLifetime;
  completedChallengeIds: ArenaChallengeId[];
  handStamps: ShowdownHandStamp[];
  sngWins: number;
  sngPlayed: number;
}

const DEFAULT_PERSISTED_SESSION: PersistedArenaSession = {
  bankrollBb: DEFAULT_BANKROLL_BB,
  sessionPoints: [],
  sessionNetBb: 0,
  sessionHands: 0,
  heroLifetime: EMPTY_HERO_LIFETIME,
  completedChallengeIds: [],
  handStamps: [],
  sngWins: 0,
  sngPlayed: 0,
};

function roundTenth(val: number): number {
  const rounded = Math.round(val * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function safeFinite(val: unknown, fallback = 0): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

function loadPersistedSession(): PersistedArenaSession {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return DEFAULT_PERSISTED_SESSION;
    const parsed = JSON.parse(raw) as Partial<PersistedArenaSession> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PERSISTED_SESSION;

    const rawPoints = Array.isArray(parsed.sessionPoints) ? parsed.sessionPoints : [];
    const sessionPoints: SessionPoint[] = rawPoints
      .filter(
        (p): p is SessionPoint =>
          Boolean(p) &&
          typeof p.handNumber === 'number' &&
          typeof p.handNetBb === 'number' &&
          typeof p.cumNetBb === 'number'
      )
      .slice(-MAX_SESSION_POINTS);

    const hl = (parsed.heroLifetime ?? {}) as Partial<HeroArenaLifetime>;
    const heroLifetime: HeroArenaLifetime = {
      hands: safeFinite(hl.hands),
      vpipHands: safeFinite(hl.vpipHands),
      pfrHands: safeFinite(hl.pfrHands),
      threeBetHands: safeFinite(hl.threeBetHands),
      threeBetOpps: safeFinite(hl.threeBetOpps),
      cbetHands: safeFinite(hl.cbetHands),
      cbetOpps: safeFinite(hl.cbetOpps),
      sawFlopHands: safeFinite(hl.sawFlopHands),
      wtsdHands: safeFinite(hl.wtsdHands),
      postflopAggActs: safeFinite(hl.postflopAggActs),
      postflopCalls: safeFinite(hl.postflopCalls),
      biggestWinBb: roundTenth(safeFinite(hl.biggestWinBb)),
      biggestLossBb: roundTenth(safeFinite(hl.biggestLossBb)),
    };

    const completedChallengeIds = Array.isArray(parsed.completedChallengeIds)
      ? (parsed.completedChallengeIds.filter((id) => typeof id === 'string') as ArenaChallengeId[])
      : [];
    const validStampSet = new Set<string>(ALL_SHOWDOWN_STAMPS);
    const handStamps = Array.isArray(parsed.handStamps)
      ? (parsed.handStamps.filter(
          (s): s is ShowdownHandStamp => typeof s === 'string' && validStampSet.has(s)
        ))
      : [];

    return {
      bankrollBb: roundTenth(safeFinite(parsed.bankrollBb, DEFAULT_BANKROLL_BB)),
      sessionPoints,
      sessionNetBb: roundTenth(safeFinite(parsed.sessionNetBb, 0)),
      sessionHands: safeFinite(parsed.sessionHands, 0),
      heroLifetime,
      completedChallengeIds,
      handStamps,
      sngWins: safeFinite(parsed.sngWins, 0),
      sngPlayed: safeFinite(parsed.sngPlayed, 0),
    };
  } catch {
    return DEFAULT_PERSISTED_SESSION;
  }
}

function loadOpponentNotes(): Record<string, OpponentScoutingNote> {
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<OpponentScoutingNote>> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: Record<string, OpponentScoutingNote> = {};
    for (const [name, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') continue;
      const tag = entry.colorTag;
      const validTag: PlayerColorTag =
        tag === 'red' ||
        tag === 'green' ||
        tag === 'blue' ||
        tag === 'gold' ||
        tag === 'purple' ||
        tag === 'none'
          ? tag
          : 'none';
      clean[name] = {
        colorTag: validTag,
        note: typeof entry.note === 'string' ? entry.note : '',
        blindReadGuess: entry.blindReadGuess,
        blindReadCorrect:
          typeof entry.blindReadCorrect === 'boolean' ? entry.blindReadCorrect : undefined,
      };
    }
    return clean;
  } catch {
    return {};
  }
}

export function useArenaSessionStore() {
  const [session, setSession] = useState<PersistedArenaSession>(() => loadPersistedSession());
  const [opponentNotes, setOpponentNotes] = useState<Record<string, OpponentScoutingNote>>(() =>
    loadOpponentNotes()
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage quota errors
    }
  }, [session]);

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(opponentNotes));
    } catch {
      // Ignore storage quota errors
    }
  }, [opponentNotes]);

  const recordHandOutcome = useCallback(
    ({ handNumber, netBb, heroSeatDelta, skipBankroll }: RecordHandOutcomeInput) => {
      const cleanNetBb = roundTenth(Number.isFinite(netBb) ? netBb : 0);
      setSession((prev) => {
        const nextSessionNetBb = roundTenth(prev.sessionNetBb + cleanNetBb);
        const nextPoint: SessionPoint = {
          handNumber,
          handNetBb: cleanNetBb,
          cumNetBb: nextSessionNetBb,
        };
        const nextPoints = [...prev.sessionPoints, nextPoint].slice(-MAX_SESSION_POINTS);
        const nextBankrollBb = skipBankroll
          ? prev.bankrollBb
          : roundTenth(prev.bankrollBb + cleanNetBb);

        const d = heroSeatDelta;
        const prevHl = prev.heroLifetime;
        const nextHeroLifetime: HeroArenaLifetime = {
          hands: prevHl.hands + (d?.hands ?? 1),
          vpipHands: prevHl.vpipHands + (d?.vpipHands ?? 0),
          pfrHands: prevHl.pfrHands + (d?.pfrHands ?? 0),
          threeBetHands: prevHl.threeBetHands + (d?.threeBetHands ?? 0),
          threeBetOpps: prevHl.threeBetOpps + (d?.threeBetOpps ?? 0),
          cbetHands: prevHl.cbetHands + (d?.cbetHands ?? 0),
          cbetOpps: prevHl.cbetOpps + (d?.cbetOpps ?? 0),
          sawFlopHands: prevHl.sawFlopHands + (d?.sawFlopHands ?? 0),
          wtsdHands: prevHl.wtsdHands + (d?.wtsdHands ?? 0),
          postflopAggActs: prevHl.postflopAggActs + (d?.postflopAggActs ?? 0),
          postflopCalls: prevHl.postflopCalls + (d?.postflopCalls ?? 0),
          biggestWinBb: roundTenth(
            Math.max(prevHl.biggestWinBb, cleanNetBb > 0 ? cleanNetBb : 0, d?.biggestWinBb ?? 0)
          ),
          biggestLossBb: roundTenth(
            Math.min(prevHl.biggestLossBb, cleanNetBb < 0 ? cleanNetBb : 0, d?.biggestLossBb ?? 0)
          ),
        };

        return {
          ...prev,
          bankrollBb: nextBankrollBb,
          sessionPoints: nextPoints,
          sessionNetBb: nextSessionNetBb,
          sessionHands: prev.sessionHands + 1,
          heroLifetime: nextHeroLifetime,
        };
      });
    },
    []
  );

  const resetSession = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      sessionPoints: [],
      sessionNetBb: 0,
      sessionHands: 0,
    }));
  }, []);

  const resetBankroll = useCallback((amountBb: number = DEFAULT_BANKROLL_BB) => {
    const cleanAmount = roundTenth(Number.isFinite(amountBb) ? amountBb : DEFAULT_BANKROLL_BB);
    setSession((prev) => ({
      ...prev,
      bankrollBb: cleanAmount,
    }));
  }, []);

  const updateOpponentNote = useCallback(
    (name: string, patch: Partial<OpponentScoutingNote>) => {
      if (!name) return;
      setOpponentNotes((prev) => {
        const current = prev[name] ?? EMPTY_OPPONENT_NOTE;
        return {
          ...prev,
          [name]: {
            ...current,
            ...patch,
          },
        };
      });
    },
    []
  );

  const markChallengeCompleted = useCallback((id: ArenaChallengeId) => {
    setSession((prev) => {
      if (prev.completedChallengeIds.includes(id)) return prev;
      return {
        ...prev,
        completedChallengeIds: [...prev.completedChallengeIds, id],
      };
    });
  }, []);

  const recordHandStamp = useCallback((stamp: ShowdownHandStamp) => {
    setSession((prev) => {
      if (prev.handStamps.includes(stamp)) return prev;
      return {
        ...prev,
        handStamps: [...prev.handStamps, stamp],
      };
    });
  }, []);

  const recordSngResult = useCallback((won: boolean) => {
    setSession((prev) => ({
      ...prev,
      sngPlayed: prev.sngPlayed + 1,
      sngWins: prev.sngWins + (won ? 1 : 0),
    }));
  }, []);

  return {
    bankrollBb: session.bankrollBb,
    sessionPoints: session.sessionPoints,
    sessionNetBb: session.sessionNetBb,
    sessionHands: session.sessionHands,
    heroLifetime: session.heroLifetime,
    opponentNotes,
    completedChallengeIds: session.completedChallengeIds,
    handStamps: session.handStamps,
    sngWins: session.sngWins,
    sngPlayed: session.sngPlayed,
    recordHandOutcome,
    resetSession,
    resetBankroll,
    updateOpponentNote,
    markChallengeCompleted,
    recordHandStamp,
    recordSngResult,
  };
}
