import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Dices,
  Download,
  Expand,
  Eye,
  EyeOff,
  GitBranch,
  History,
  Maximize2,
  Minimize2,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Play,
  RefreshCw,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Split,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { Card, CoachMode, DrillAttemptRecord, UserPreferences } from '../poker/types';
import {
  applyPlayerAction,
  buildPresetConfig,
  chooseBotAction,
  computeEffectivePotOdds,
  computeHudDisplay,
  createEmptyHudStats,
  createTableFromConfig,
  DEFAULT_ARENA_CONFIG,
  getLegalActions,
  rebuyHeroTo100,
  resolveRunItTwice,
  revealRabbitHunt,
  roundBb,
  settleAndStartNewHand,
  startNewHand,
  toggleHeroShowHand,
  type ArenaConfig,
  type ArenaSize,
  type HeroStreetAudit,
  type PokerTableState,
  type SeatHudStats,
  type TableActionKind,
  type TableActionLogItem,
  type TablePhase,
  type TableSeat,
  type WinnerSummarySpec,
} from '../poker/tableEngine';
import { cardKey, createDeck, describeHeroHand, shuffleDeck } from '../poker/evaluator';
import {
  ARENA_CHALLENGES,
  evaluateChallengeProgress,
  type ArenaChallengeSpec,
} from '../poker/arenaChallenges';
import {
  exportHandToPokerStarsText,
  exportSessionHandsText,
} from '../poker/handHistoryExport';
import {
  formatChips,
  formatSignedChips,
  getCashStakes,
  getSliderStepBb,
  snapRaiseBb,
  type ChipDisplayConfig,
  type ChipDisplayUnit,
} from '../poker/currency';
import {
  COLOR_TAG_DOT,
  EMPTY_OPPONENT_NOTE,
  useArenaSessionStore,
  type HeroArenaLifetime,
} from '../store/useArenaSessionStore';
import { PokerTableOval, type TableSeatDisplay } from '../components/PokerTableOval';
import { Studio3DTable } from '../components/Studio3DTable';
import { ArenaSetupModal } from '../components/ArenaSetupModal';
import { GradeBadge } from '../components/GradeBadge';
import { PlayingCard } from '../components/PlayingCard';
import {
  SessionGraphSvg,
  type SessionChallengeItem,
} from '../components/arena/SessionGraphSvg';
import { PlayerNotePopover } from '../components/arena/PlayerNotePopover';
import { ReplayConsole } from '../components/arena/ReplayConsole';
import { playPokerSound } from '../utils/sound';
import { sharedCasinoSoundEngine } from '../three/soundEngine';
import { useLocale } from '../i18n/LocaleContext';
import {
  translateArchetype,
  translateStreetLabel,
  type TranslationKey,
} from '../i18n/translations';
import {
  formatArenaAction,
  formatArenaAuditNote,
  formatSeatDisplayName,
  formatWinnerSummary,
} from '../i18n/drillContentZh';
import type { Seat3DSpec } from '../three/models';

interface PlayTableViewProps {
  prefs: UserPreferences;
  onUpdatePrefs: (patch: Partial<UserPreferences>) => void;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
}

const ARCHETYPE_SHORT: Record<string, string> = {
  'Balanced Reg': 'REG',
  'Tight-Aggressive': 'TAG',
  'Loose-Aggressive': 'LAG',
  'Calling Station': 'CS',
  'Tight Nit': 'NIT',
  Maniac: 'MANIAC',
};

const ARCHETYPE_SHORT_ZH: Record<string, string> = {
  'Balanced Reg': '均衡',
  'Tight-Aggressive': '紧凶',
  'Loose-Aggressive': '松凶',
  'Calling Station': '跟注站',
  'Tight Nit': '紧弱',
  Maniac: '激进',
};

const REPLAY_HISTORY_KEY = 'turnriver_arena_history_v1';
const REPLAY_HISTORY_LIMIT = 15;
const REPLAY_STREETS: TablePhase[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

type ReplaySeat = Omit<TableSeat, 'stats'>;

export interface HandReplayFrame {
  phase: TablePhase;
  board: Card[];
  potBb: number;
  seats: ReplaySeat[];
  buttonSeatIndex: number;
  actingSeatIndex?: number | null;
  currentBetBb?: number;
  minRaiseBb?: number;
  lastFullRaiseIncrementBb?: number;
  preflopAggressorSeatIndex?: number | null;
  preflopRaiseCount?: number;
  flopCbetActive?: boolean;
  actionLogLength: number;
  latestLog: TableActionLogItem | null;
  winnerSummary: string | null;
  winnerSpec: WinnerSummarySpec | null;
  winnerSeatIndices: number[];
}

export interface HandReplayRecord {
  id: string;
  handNumber: number;
  tableSize: number;
  heroCards: [Card, Card] | null;
  netBb: number;
  won: boolean;
  totalPotBb: number;
  frames: HandReplayFrame[];
  actionLog?: TableActionLogItem[];
}

function applyAutoTopUp(state: PokerTableState, enabled: boolean): PokerTableState {
  if (!enabled) return state;
  const hero = state.seats[0];
  if (!hero) return state;
  const startTotal = roundBb(hero.stackBb + hero.totalInvestedBb);
  const target = state.config.startingStackBb;
  if (startTotal >= target) return state;
  const addBb = roundBb(target - startTotal);
  return {
    ...state,
    seats: state.seats.map((s) =>
      s.isHero
        ? {
            ...s,
            stackBb: roundBb(s.stackBb + addBb),
            allIn: false,
          }
        : s
    ),
  };
}

function snapshotSeat(seat: TableSeat): ReplaySeat {
  const copy: Partial<TableSeat> = { ...seat };
  delete copy.stats;
  return copy as ReplaySeat;
}

function loadReplayHistory(): HandReplayRecord[] {
  try {
    const raw = window.localStorage.getItem(REPLAY_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as HandReplayRecord[])
      .filter(
        (r) =>
          r &&
          typeof r.handNumber === 'number' &&
          Array.isArray(r.frames) &&
          r.frames.length > 0 &&
          r.frames.every((f) => f && Array.isArray(f.seats) && Array.isArray(f.board))
      )
      .slice(0, REPLAY_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveReplayHistory(history: HandReplayRecord[]) {
  try {
    window.localStorage.setItem(REPLAY_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage may be full or unavailable; replay history is a best-effort convenience.
  }
}

const AGGRESSIVE_ACTION_KINDS = new Set([
  'bet',
  'raise',
  'three_bet',
  'four_bet',
  'all_in',
]);

function mapActionKindTo3D(kind?: TableActionKind): Seat3DSpec['actionKind'] {
  if (!kind) return undefined;
  switch (kind) {
    case 'fold':
    case 'folded':
      return 'fold';
    case 'check':
      return 'check';
    case 'call':
      return 'call';
    case 'call_allin':
    case 'all_in':
      return 'all_in';
    case 'bet':
      return 'bet';
    case 'raise':
    case 'three_bet':
    case 'four_bet':
      return 'raise';
    case 'post_ante':
    case 'post_sb':
    case 'post_bb':
    case 'post_straddle':
    case 'blind':
      return 'post_blind';
    default:
      return undefined;
  }
}

export function PlayTableView({
  prefs,
  onUpdatePrefs,
  onRecordAttempt,
}: PlayTableViewProps) {
  const { locale, t } = useLocale();
  const chipDisplay: ChipDisplayConfig = useMemo(
    () => ({
      unit: prefs.chipDisplayUnit ?? 'bb',
      stakesId: prefs.cashStakesId ?? 'nl200',
    }),
    [prefs.chipDisplayUnit, prefs.cashStakesId]
  );
  const activeStakes = getCashStakes(chipDisplay.stakesId);
  const autoTopUp = Boolean(prefs.autoTopUp);

  const [table, setTable] = useState<PokerTableState>(() => {
    const initialUnit = prefs.chipDisplayUnit ?? 'bb';
    const initialSbBb =
      initialUnit === 'usd' ? getCashStakes(prefs.cashStakesId).sbBb : 0.5;
    return startNewHand(createTableFromConfig({ ...DEFAULT_ARENA_CONFIG, sbBb: initialSbBb }));
  });
  const arenaStore = useArenaSessionStore();
  const coachMode: CoachMode = prefs.coachMode ?? 'after_hand';
  const rngEnabled = Boolean(prefs.rngEnabled);

  const [flashbackTable, setFlashbackTable] = useState<PokerTableState | null>(null);
  const [raiseAmount, setRaiseAmount] = useState<number>(2.5);
  // 3D Table is the primary default experience for the Multi-Bot Arena
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [theaterHudOpen, setTheaterHudOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [setupOpen, setSetupOpen] = useState<boolean>(false);
  const [rightTab, setRightTab] = useState<'hud' | 'session' | 'feed' | 'replay'>('hud');
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);
  const [replayHistory, setReplayHistory] = useState<HandReplayRecord[]>(loadReplayHistory);
  const [replayRecord, setReplayRecord] = useState<HandReplayRecord | null>(null);
  const [replayStep, setReplayStep] = useState<number>(0);
  const [preAction, setPreAction] = useState<'none' | 'check_fold' | 'auto_check'>('none');
  const [rngRoll, setRngRoll] = useState<number>(() => Math.floor(Math.random() * 100) + 1);
  const [preHeroState, setPreHeroState] = useState<PokerTableState | null>(null);
  const [liveCoachAlert, setLiveCoachAlert] = useState<HeroStreetAudit | null>(null);
  const [inspectedSeatIndex, setInspectedSeatIndex] = useState<number | null>(null);
  const [sessionAuditStats, setSessionAuditStats] = useState<{ sum: number; count: number }>({
    sum: 0,
    count: 0,
  });

  const isFlashback = flashbackTable !== null;
  const activeTable = flashbackTable ?? table;

  const captureRef = useRef<{
    hand: number;
    frames: HandReplayFrame[];
    startStackBb: number;
    saved: boolean;
  }>({ hand: -1, frames: [], startStackBb: 0, saved: false });
  const handAccountingRef = useRef<{
    handNumber: number;
    startStackBb: number;
    startHeroStats: SeatHudStats;
    settledHandNumber: number;
  }>({
    handNumber: -1,
    startStackBb: 0,
    startHeroStats: createEmptyHudStats(),
    settledHandNumber: 0,
  });
  const tableRef = useRef<PokerTableState>(table);
  tableRef.current = table;
  const flashbackTableRef = useRef<PokerTableState | null>(flashbackTable);
  flashbackTableRef.current = flashbackTable;
  const activeTableRef = useRef<PokerTableState>(activeTable);
  activeTableRef.current = activeTable;
  const autoTopUpRef = useRef<boolean>(autoTopUp);
  autoTopUpRef.current = autoTopUp;
  const arenaRootRef = useRef<HTMLDivElement | null>(null);
  const loggedHandRef = useRef<number>(0);

  const updateActiveTable = useCallback(
    (updater: (curr: PokerTableState) => PokerTableState) => {
      if (flashbackTableRef.current !== null) {
        setFlashbackTable((curr) => (curr ? updater(curr) : curr));
      } else {
        setTable(updater);
      }
    },
    []
  );

  const recordLiveHandSettlement = useCallback(
    (curr: PokerTableState, startStackBb: number, startStats: SeatHudStats) => {
      const hero = curr.seats[0];
      if (!hero) return;
      const deltaBb = roundBb(hero.stackBb - startStackBb);
      const endStats = hero.stats;
      const heroSeatDelta: Partial<HeroArenaLifetime> = {
        hands: 1,
        vpipHands: Math.max(0, endStats.vpipHands - startStats.vpipHands),
        pfrHands: Math.max(0, endStats.pfrHands - startStats.pfrHands),
        threeBetHands: Math.max(0, endStats.threeBetHands - startStats.threeBetHands),
        threeBetOpps: Math.max(0, endStats.threeBetOpps - startStats.threeBetOpps),
        cbetHands: Math.max(0, endStats.cbetHands - startStats.cbetHands),
        cbetOpps: Math.max(0, endStats.cbetOpps - startStats.cbetOpps),
        sawFlopHands: Math.max(0, endStats.sawFlopHands - startStats.sawFlopHands),
        wtsdHands: Math.max(0, endStats.wtsdHands - startStats.wtsdHands),
        postflopAggActs: Math.max(0, endStats.postflopAggActs - startStats.postflopAggActs),
        postflopCalls: Math.max(0, endStats.postflopCalls - startStats.postflopCalls),
      };
      arenaStore.recordHandOutcome({
        handNumber: curr.handNumber,
        netBb: deltaBb,
        heroSeatDelta,
      });
      if (curr.heroAudits.length > 0) {
        const addedSum = curr.heroAudits.reduce((s, a) => s + a.accuracyScore, 0);
        setSessionAuditStats((prev) => ({
          sum: prev.sum + addedSum,
          count: prev.count + curr.heroAudits.length,
        }));
      }
    },
    [arenaStore]
  );

  // Track native Fullscreen API state and allow Escape to exit Theater Mode cleanly
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && theaterMode && !setupOpen && inspectedSeatIndex === null) {
        setTheaterMode(false);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [theaterMode, setupOpen, inspectedSeatIndex]);

  const handleToggleTheater = () => {
    setTheaterMode((prev) => {
      const next = !prev;
      if (next) setViewMode('3d');
      if (!next && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      return next;
    });
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        setTheaterMode(true);
        setViewMode('3d');
        const targetEl = arenaRootRef.current ?? document.documentElement;
        if (targetEl.requestFullscreen) {
          await targetEl.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Iframe environments may block native Fullscreen API; Theater Mode still expands to 100% viewport cleanly
      setTheaterMode(true);
    }
  };

  const heroSeat = activeTable.seats[0];
  const isHeroTurn =
    replayRecord === null &&
    !activeTable.awaitingRunItTwiceChoice &&
    activeTable.phase !== 'IDLE' &&
    activeTable.phase !== 'SHOWDOWN' &&
    activeTable.actingSeatIndex === 0;
  const legal = getLegalActions(activeTable, 0);
  const isFastSpeed = activeTable.config.speed === 'fast';
  const is3DActive = viewMode === '3d' || theaterMode;
  const prevStreetKeyRef = useRef<string>('');

  // Evaluate Arena Challenges continuously and persist newly completed challenges
  const correctBlindReads = useMemo(
    () => Object.values(arenaStore.opponentNotes).filter((n) => n.blindReadCorrect).length,
    [arenaStore.opponentNotes]
  );

  const sessionChallenges: SessionChallengeItem[] = useMemo(() => {
    const avgAccuracyPct =
      sessionAuditStats.count > 0
        ? Math.round(sessionAuditStats.sum / sessionAuditStats.count)
        : 0;
    const input = {
      sessionNetBb: arenaStore.sessionNetBb,
      sessionHands: arenaStore.sessionHands,
      avgAccuracyPct,
      correctBlindReads,
      poolPreset: table.config.poolPreset,
      tableSize: table.config.tableSize,
      blindReadMode: table.config.blindReadMode,
    };
    return ARENA_CHALLENGES.map((spec) => {
      const progress = evaluateChallengeProgress(spec, input);
      const alreadyDone = arenaStore.completedChallengeIds.includes(spec.id);
      return {
        spec,
        current: alreadyDone ? Math.max(progress.current, progress.target) : progress.current,
        target: progress.target,
        completed: alreadyDone || progress.completed,
      };
    });
  }, [
    arenaStore.sessionNetBb,
    arenaStore.sessionHands,
    arenaStore.completedChallengeIds,
    sessionAuditStats,
    correctBlindReads,
    table.config.poolPreset,
    table.config.tableSize,
    table.config.blindReadMode,
  ]);

  useEffect(() => {
    for (const item of sessionChallenges) {
      if (item.completed && !arenaStore.completedChallengeIds.includes(item.spec.id)) {
        arenaStore.markChallengeCompleted(item.spec.id);
      }
    }
  }, [sessionChallenges, arenaStore]);

  // Honest session P&L & Hero HUD accounting on live table (skipped during Flashback)
  useEffect(() => {
    if (isFlashback || table.phase === 'IDLE') return;
    const acc = handAccountingRef.current;
    if (acc.handNumber !== table.handNumber) {
      acc.handNumber = table.handNumber;
      acc.startStackBb = roundBb(table.seats[0].stackBb + table.seats[0].totalInvestedBb);
      acc.startHeroStats = { ...table.seats[0].stats };
    }
    if (
      table.phase === 'SHOWDOWN' &&
      acc.settledHandNumber < table.handNumber &&
      liveCoachAlert === null
    ) {
      acc.settledHandNumber = table.handNumber;
      recordLiveHandSettlement(table, acc.startStackBb, acc.startHeroStats);
    }
  }, [
    isFlashback,
    table,
    liveCoachAlert,
    recordLiveHandSettlement,
  ]);

  const advanceToNextHand = () => {
    setPreAction('none');
    setLiveCoachAlert(null);
    setPreHeroState(null);

    if (flashbackTableRef.current !== null) {
      setFlashbackTable((prev) =>
        prev ? applyAutoTopUp(settleAndStartNewHand(prev), autoTopUpRef.current) : prev
      );
      return;
    }

    const curr = tableRef.current;
    const acc = handAccountingRef.current;
    if (curr.phase !== 'IDLE' && acc.settledHandNumber < curr.handNumber) {
      acc.settledHandNumber = curr.handNumber;
      const startStack =
        acc.handNumber === curr.handNumber
          ? acc.startStackBb
          : roundBb(curr.seats[0].stackBb + curr.seats[0].totalInvestedBb);
      const startStats =
        acc.handNumber === curr.handNumber ? acc.startHeroStats : createEmptyHudStats();
      recordLiveHandSettlement(curr, startStack, startStats);
    }
    setTable((prev) => applyAutoTopUp(settleAndStartNewHand(prev), autoTopUpRef.current));
  };

  // Reset queued Pre-Action on every new hand, street transition, or branch switch
  useEffect(() => {
    setPreAction('none');
  }, [activeTable.handNumber, activeTable.phase, isFlashback]);

  // Roll a fresh 1..100 RNG value whenever Hero's turn begins with RNG enabled
  useEffect(() => {
    if (rngEnabled && isHeroTurn) {
      setRngRoll(Math.floor(Math.random() * 100) + 1);
    }
  }, [
    rngEnabled,
    isHeroTurn,
    activeTable.handNumber,
    activeTable.phase,
    activeTable.actionLog.length,
    isFlashback,
  ]);

  // Sync default raise sizing whenever it becomes Hero's turn
  useEffect(() => {
    if (isHeroTurn && legal.canBetOrRaise) {
      const defaultTarget =
        activeTable.phase === 'PREFLOP' && activeTable.currentBetBb <= 1.0
          ? activeTable.config.tableSize === 2
            ? 2.2
            : 2.5
          : activeTable.currentBetBb === 0
            ? roundBb(Math.max(legal.minTotalBetBb, activeTable.potBb * 0.5))
            : roundBb(Math.max(legal.minTotalBetBb, activeTable.currentBetBb * 2.5));
      setRaiseAmount(
        snapRaiseBb(defaultTarget, chipDisplay, legal.minTotalBetBb, legal.maxTotalBetBb)
      );
    }
  }, [
    isHeroTurn,
    activeTable.phase,
    activeTable.currentBetBb,
    activeTable.potBb,
    activeTable.config.tableSize,
    legal.canBetOrRaise,
    legal.minTotalBetBb,
    legal.maxTotalBetBb,
    chipDisplay,
  ]);

  // Automatic strategic bot turn loop with realistic live-table pacing & street-deal breathing room
  useEffect(() => {
    const streetKey = `${isFlashback ? 'fb' : 'live'}:${activeTable.handNumber}:${activeTable.phase}`;
    const isFreshStreetOrDeal = prevStreetKeyRef.current !== streetKey;
    prevStreetKeyRef.current = streetKey;

    if (
      replayRecord !== null ||
      activeTable.awaitingRunItTwiceChoice ||
      activeTable.phase === 'IDLE' ||
      activeTable.phase === 'SHOWDOWN' ||
      activeTable.actingSeatIndex === null ||
      activeTable.actingSeatIndex === 0
    ) {
      return;
    }

    // Fast-fold: if Hero folded and fastFold is enabled, pause briefly so fold registers then deal next
    if (heroSeat.folded && activeTable.config.fastFold && liveCoachAlert === null) {
      const fastTimer = window.setTimeout(() => {
        advanceToNextHand();
      }, isFastSpeed ? 450 : 750);
      return () => window.clearTimeout(fastTimer);
    }

    // Human-like think time: natural variance + extra pause after fresh deal/flop/turn/river & big decisions
    const jitter = Math.random();
    const isLateStreet = activeTable.phase === 'TURN' || activeTable.phase === 'RIVER';
    const isBigSpot = activeTable.currentBetBb >= 4 || activeTable.potBb >= 16;
    const baseMs = isFastSpeed
      ? 480 + Math.round(jitter * 240)
      : 1050 + Math.round(jitter * 550);
    const dealBeatMs = isFreshStreetOrDeal ? (isFastSpeed ? 360 : 820) : 0;
    const decisionBeatMs =
      isBigSpot || isLateStreet
        ? isFastSpeed
          ? 140
          : 320 + Math.round(Math.random() * 360)
        : 0;
    const thinkDelayMs = baseMs + dealBeatMs + decisionBeatMs;

    const botIndex = activeTable.actingSeatIndex;
    const timer = window.setTimeout(() => {
      updateActiveTable((curr) => {
        if (
          curr.actingSeatIndex !== botIndex ||
          curr.phase === 'SHOWDOWN' ||
          curr.awaitingRunItTwiceChoice
        ) {
          return curr;
        }
        const move = chooseBotAction(curr, botIndex);
        if (!is3DActive && (move.type === 'raise' || move.type === 'call')) {
          playPokerSound('chip', prefs.soundEnabled);
        }
        return applyPlayerAction(curr, botIndex, move.type, move.raiseToBb);
      });
    }, thinkDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    isFlashback,
    replayRecord,
    liveCoachAlert,
    activeTable.handNumber,
    activeTable.actingSeatIndex,
    activeTable.phase,
    activeTable.awaitingRunItTwiceChoice,
    activeTable.currentBetBb,
    activeTable.potBb,
    activeTable.actionLog.length,
    activeTable.config.fastFold,
    heroSeat.folded,
    isFastSpeed,
    is3DActive,
    prefs.soundEnabled,
    updateActiveTable,
  ]);

  // Record Hero's street decisions into Leak Tracker once per completed live hand (never during Flashback)
  useEffect(() => {
    if (isFlashback) return;
    const liveHero = table.seats[0];
    const shouldLog =
      (table.phase === 'SHOWDOWN' || (liveHero.folded && table.config.fastFold)) &&
      table.handNumber > loggedHandRef.current &&
      table.heroAudits.length > 0 &&
      liveCoachAlert === null;

    if (shouldLog) {
      loggedHandRef.current = table.handNumber;
      for (const audit of table.heroAudits) {
        const hasBet = Boolean(audit.noteSpec?.toCallBb && audit.noteSpec.toCallBb > 0);
        onRecordAttempt({
          module: 'table',
          position: audit.position,
          street: audit.street,
          spotLabel: `${table.config.tableSize}-Max Hand #${table.handNumber} (${audit.street})`,
          chosenAction: audit.chosenAction,
          bestAction: audit.recommendedAction,
          metricValue: hasBet ? audit.noteSpec?.reqEqPct : undefined,
          metricKind: hasBet ? 'pot_odds_pct' : undefined,
          grade: audit.grade,
          accuracyScore: audit.accuracyScore,
        });
      }
    }
  }, [
    isFlashback,
    liveCoachAlert,
    table.phase,
    table.handNumber,
    table.heroAudits,
    table.config.tableSize,
    table.config.fastFold,
    table.seats,
    onRecordAttempt,
  ]);

  // Capture action-by-action snapshots for the current live hand; save the record at showdown (skipped in Flashback)
  useEffect(() => {
    if (isFlashback || table.phase === 'IDLE') return;
    const cap = captureRef.current;
    if (cap.hand !== table.handNumber) {
      cap.hand = table.handNumber;
      cap.frames = [];
      cap.saved = false;
      cap.startStackBb = table.seats[0].stackBb + table.seats[0].totalInvestedBb;
    }
    const frame: HandReplayFrame = {
      phase: table.phase,
      board: [...table.board],
      potBb: table.potBb,
      seats: table.seats.map(snapshotSeat),
      buttonSeatIndex: table.buttonSeatIndex,
      actingSeatIndex: table.actingSeatIndex,
      currentBetBb: table.currentBetBb,
      minRaiseBb: table.minRaiseBb,
      lastFullRaiseIncrementBb: table.lastFullRaiseIncrementBb,
      preflopAggressorSeatIndex: table.preflopAggressorSeatIndex,
      preflopRaiseCount: table.preflopRaiseCount,
      flopCbetActive: table.flopCbetActive,
      actionLogLength: table.actionLog.length,
      latestLog: table.actionLog.length > 0 ? table.actionLog[table.actionLog.length - 1] : null,
      winnerSummary: table.winnerSummary,
      winnerSpec: table.winnerSpec ?? null,
      winnerSeatIndices: [...table.winnerSeatIndices],
    };
    const last = cap.frames[cap.frames.length - 1];
    const isDuplicate =
      last &&
      last.phase === frame.phase &&
      last.actionLogLength === frame.actionLogLength &&
      last.board.length === frame.board.length &&
      last.winnerSummary === frame.winnerSummary;
    if (!isDuplicate) {
      if (table.phase === 'SHOWDOWN' && last) {
        // Runouts jump straight to showdown: synthesize street-by-street frames
        for (const len of [3, 4, 5]) {
          if (len > last.board.length && len < table.board.length) {
            cap.frames.push({
              ...last,
              phase: len === 3 ? 'FLOP' : len === 4 ? 'TURN' : 'RIVER',
              board: table.board.slice(0, len),
              potBb: table.potBb,
            });
          }
        }
      }
      cap.frames.push(frame);
    }
    if (table.phase === 'SHOWDOWN' && !cap.saved && cap.frames.length > 0) {
      cap.saved = true;
      const hero = table.seats[0];
      const netBb = roundBb(hero.stackBb - cap.startStackBb);
      const record: HandReplayRecord = {
        id: `${Date.now()}-${table.handNumber}`,
        handNumber: table.handNumber,
        tableSize: table.config.tableSize,
        heroCards: hero.cards,
        netBb,
        won: netBb > 0,
        totalPotBb: Math.max(...cap.frames.map((f) => f.potBb)),
        frames: [...cap.frames],
        actionLog: [...table.actionLog],
      };
      setReplayHistory((prev) => [record, ...prev].slice(0, REPLAY_HISTORY_LIMIT));
    }
  }, [isFlashback, table]);

  useEffect(() => {
    saveReplayHistory(replayHistory);
  }, [replayHistory]);

  const handleHeroAction = (
    type: 'fold' | 'check' | 'call' | 'raise',
    customTarget?: number
  ) => {
    const curr = activeTableRef.current;
    if (
      replayRecord !== null ||
      curr.awaitingRunItTwiceChoice ||
      curr.phase === 'IDLE' ||
      curr.phase === 'SHOWDOWN' ||
      curr.actingSeatIndex !== 0
    ) {
      return;
    }
    const next = applyPlayerAction(curr, 0, type, customTarget ?? raiseAmount);
    if (next === curr) return;

    if (!is3DActive) {
      playPokerSound(type === 'fold' ? 'card' : 'chip', prefs.soundEnabled);
    }

    setPreHeroState(curr);
    const newAudit =
      next.heroAudits.length > curr.heroAudits.length
        ? next.heroAudits[next.heroAudits.length - 1]
        : null;
    if (
      coachMode === 'live' &&
      newAudit &&
      (newAudit.grade === 'Mistake' || newAudit.grade === 'Blunder')
    ) {
      setLiveCoachAlert(newAudit);
    } else {
      setLiveCoachAlert(null);
    }

    if (flashbackTableRef.current !== null) {
      setFlashbackTable(next);
    } else {
      setTable(next);
    }
  };

  const handleHeroActionRef = useRef(handleHeroAction);
  handleHeroActionRef.current = handleHeroAction;

  // Auto-fire queued Pre-Action as soon as it becomes Hero's turn
  useEffect(() => {
    if (
      !isHeroTurn ||
      preAction === 'none' ||
      replayRecord !== null ||
      activeTable.awaitingRunItTwiceChoice ||
      liveCoachAlert !== null
    ) {
      return;
    }
    const queued = preAction;
    setPreAction('none');
    if (queued === 'check_fold') {
      handleHeroActionRef.current(legal.canCheck ? 'check' : 'fold');
    } else if (queued === 'auto_check' && legal.canCheck) {
      handleHeroActionRef.current('check');
    }
  }, [
    isHeroTurn,
    preAction,
    replayRecord,
    activeTable.awaitingRunItTwiceChoice,
    liveCoachAlert,
    legal.canCheck,
  ]);

  const handleUndoRetry = () => {
    if (!preHeroState) return;
    if (flashbackTableRef.current !== null) {
      setFlashbackTable(preHeroState);
    } else {
      setTable(preHeroState);
    }
    setLiveCoachAlert(null);
    setPreHeroState(null);
    setPreAction('none');
  };

  const handleDealNext = () => {
    if (!is3DActive) {
      playPokerSound('card', prefs.soundEnabled);
    }
    advanceToNextHand();
  };

  // Poker action hotkeys: F (Fold), C/Space (Check/Call), R (Bet/Raise), Enter (Deal Next on showdown)
  const hotkeyStateRef = useRef({
    replaying: replayRecord !== null,
    setupOpen,
    popoverOpen: inspectedSeatIndex !== null,
    awaitingRit: Boolean(activeTable.awaitingRunItTwiceChoice),
    phase: activeTable.phase,
    isHeroTurn,
    legal,
    raiseAmount,
    handleHeroAction,
    handleDealNext,
  });
  hotkeyStateRef.current = {
    replaying: replayRecord !== null,
    setupOpen,
    popoverOpen: inspectedSeatIndex !== null,
    awaitingRit: Boolean(activeTable.awaitingRunItTwiceChoice),
    phase: activeTable.phase,
    isHeroTurn,
    legal,
    raiseAmount,
    handleHeroAction,
    handleDealNext,
  };

  useEffect(() => {
    const onActionHotkey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        tag === 'button' ||
        target?.isContentEditable
      ) {
        return;
      }

      const st = hotkeyStateRef.current;
      if (st.setupOpen || st.replaying || st.popoverOpen || st.awaitingRit) return;

      const key = e.key.toLowerCase();
      if (st.phase === 'SHOWDOWN' && e.key === 'Enter') {
        e.preventDefault();
        st.handleDealNext();
        return;
      }

      if (!st.isHeroTurn) return;

      if (key === 'f' && st.legal.canFold) {
        e.preventDefault();
        st.handleHeroAction('fold');
      } else if (key === 'c' || e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        st.handleHeroAction(st.legal.canCheck ? 'check' : 'call');
      } else if (key === 'r' && st.legal.canBetOrRaise) {
        e.preventDefault();
        st.handleHeroAction('raise', st.raiseAmount);
      }
    };

    window.addEventListener('keydown', onActionHotkey);
    return () => window.removeEventListener('keydown', onActionHotkey);
  }, []);

  const handleRebuy = () => {
    if (!is3DActive) {
      playPokerSound('chip', prefs.soundEnabled);
    }
    updateActiveTable((curr) => rebuyHeroTo100(curr));
  };

  const handleApplyArenaConfig = (
    nextConfig: ArenaConfig,
    prefsPatch?: Partial<UserPreferences>
  ) => {
    if (!is3DActive) {
      playPokerSound('card', prefs.soundEnabled);
    }
    if (prefsPatch) {
      onUpdatePrefs(prefsPatch);
    }
    loggedHandRef.current = 0;
    captureRef.current.hand = -1;
    handAccountingRef.current = {
      handNumber: -1,
      startStackBb: 0,
      startHeroStats: createEmptyHudStats(),
      settledHandNumber: 0,
    };
    setReplayRecord(null);
    setReplayStep(0);
    setFlashbackTable(null);
    setPreAction('none');
    setLiveCoachAlert(null);
    setPreHeroState(null);
    setInspectedSeatIndex(null);
    setTable(startNewHand(createTableFromConfig(nextConfig)));
  };

  const handleLaunchChallenge = (spec: ArenaChallengeSpec) => {
    const preset = spec.recommendedPreset === 'custom' ? 'mixed' : spec.recommendedPreset;
    const base = buildPresetConfig(preset, table.config);
    const nextConfig: ArenaConfig = {
      ...base,
      tableSize: spec.recommendedSize,
      blindReadMode: spec.recommendedBlindRead ?? base.blindReadMode,
    };
    arenaStore.resetSession();
    setSessionAuditStats({ sum: 0, count: 0 });
    handleApplyArenaConfig(nextConfig);
  };

  const handleChangeChipUnit = (nextUnit: ChipDisplayUnit) => {
    if (nextUnit === chipDisplay.unit) return;
    onUpdatePrefs({ chipDisplayUnit: nextUnit });
    if (isHeroTurn && legal.canBetOrRaise) {
      setRaiseAmount((prev) =>
        snapRaiseBb(
          prev,
          { unit: nextUnit, stakesId: chipDisplay.stakesId },
          legal.minTotalBetBb,
          legal.maxTotalBetBb
        )
      );
    }
  };

  const toggleBlindRead = () => {
    updateActiveTable((curr) => ({
      ...curr,
      config: { ...curr.config, blindReadMode: !curr.config.blindReadMode },
    }));
  };

  const toggleFastFold = () => {
    updateActiveTable((curr) => ({
      ...curr,
      config: { ...curr.config, fastFold: !curr.config.fastFold },
    }));
  };

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Replay Mode drives the table from the selected frame; exiting restores the active table untouched
  const replayFrame: HandReplayFrame | null = replayRecord
    ? replayRecord.frames[Math.min(replayStep, replayRecord.frames.length - 1)]
    : null;
  const viewSeats: TableSeat[] = useMemo(() => {
    if (!replayFrame) return activeTable.seats;
    const fallbackStats = activeTable.seats[0].stats;
    return replayFrame.seats.map((rs) => ({
      ...rs,
      stats: activeTable.seats.find((x) => x.seatIndex === rs.seatIndex)?.stats ?? fallbackStats,
    }));
  }, [replayFrame, activeTable.seats]);
  const viewBoard = replayFrame ? replayFrame.board : activeTable.board;
  const viewPotBb = replayFrame ? replayFrame.potBb : activeTable.potBb;
  const viewPhase: TablePhase = replayFrame ? replayFrame.phase : activeTable.phase;
  const viewButtonSeat = replayFrame ? replayFrame.buttonSeatIndex : activeTable.buttonSeatIndex;
  const viewActingSeat = replayFrame ? null : activeTable.actingSeatIndex;
  const viewWinners = replayFrame ? replayFrame.winnerSeatIndices : activeTable.winnerSeatIndices;

  const startReplay = (record: HandReplayRecord) => {
    setReplayRecord(record);
    setReplayStep(0);
    setLiveCoachAlert(null);
    setPreAction('none');
    if (theaterMode && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTheaterHudOpen(false);
    }
  };
  const exitReplay = () => {
    setReplayRecord(null);
    setReplayStep(0);
  };
  const replayTotal = replayRecord ? replayRecord.frames.length : 0;

  const handleStartFlashback = () => {
    if (!replayRecord || !replayFrame) return;
    // If on final SHOWDOWN frame, step back to the last playable frame so Hero can try a different line
    const targetFrame =
      replayFrame.phase === 'SHOWDOWN'
        ? ([...replayRecord.frames].reverse().find((f) => f.phase !== 'SHOWDOWN') ?? replayFrame)
        : replayFrame;

    const usedKeys = new Set<string>();
    for (const c of targetFrame.board) usedKeys.add(cardKey(c));
    for (const s of targetFrame.seats) {
      if (s.cards) {
        usedKeys.add(cardKey(s.cards[0]));
        usedKeys.add(cardKey(s.cards[1]));
      }
    }
    const deck = shuffleDeck(createDeck().filter((c) => !usedKeys.has(cardKey(c))));
    const clonedSeats: TableSeat[] = targetFrame.seats.map((rs) => {
      const liveMatch = table.seats.find(
        (s) => s.seatIndex === rs.seatIndex && s.name === rs.name
      );
      return {
        ...rs,
        cards: rs.cards ? [{ ...rs.cards[0] }, { ...rs.cards[1] }] : null,
        stats: liveMatch ? { ...liveMatch.stats } : createEmptyHudStats(),
      };
    });

    const derivedCurrentBet =
      targetFrame.currentBetBb ?? Math.max(0, ...clonedSeats.map((s) => s.streetBetBb));
    const derivedIncrement = targetFrame.lastFullRaiseIncrementBb ?? 1;
    const derivedMinRaise =
      targetFrame.minRaiseBb ?? roundBb(derivedCurrentBet + Math.max(1, derivedIncrement));

    let actingIdx: number | null =
      targetFrame.phase === 'SHOWDOWN'
        ? null
        : targetFrame.actingSeatIndex !== undefined
          ? targetFrame.actingSeatIndex
          : null;
    if (targetFrame.phase !== 'SHOWDOWN' && actingIdx === null) {
      const heroCandidate = clonedSeats[0];
      if (
        heroCandidate &&
        !heroCandidate.folded &&
        !heroCandidate.allIn &&
        !heroCandidate.actedThisStreet
      ) {
        actingIdx = 0;
      } else {
        const firstUnacted = clonedSeats.find(
          (s) => !s.folded && !s.allIn && !s.actedThisStreet
        );
        const firstLive = clonedSeats.find((s) => !s.folded && !s.allIn);
        actingIdx = firstUnacted?.seatIndex ?? firstLive?.seatIndex ?? null;
      }
    }

    const rawSize = clonedSeats.length;
    const flashbackSize: ArenaSize =
      rawSize === 2 || rawSize === 3 || rawSize === 4 || rawSize === 6
        ? rawSize
        : table.config.tableSize;
    const botArchetypes = clonedSeats
      .filter((s) => !s.isHero)
      .map((s) => (s.archetype === 'Hero' ? 'Balanced Reg' : s.archetype));

    const actionLogSlice = replayRecord.actionLog
      ? replayRecord.actionLog.slice(0, targetFrame.actionLogLength)
      : [];

    const clonedState: PokerTableState = {
      config: {
        ...table.config,
        tableSize: flashbackSize,
        botArchetypes,
      },
      handNumber: replayRecord.handNumber,
      phase: targetFrame.phase,
      buttonSeatIndex: targetFrame.buttonSeatIndex,
      actingSeatIndex: actingIdx,
      preflopAggressorSeatIndex: targetFrame.preflopAggressorSeatIndex ?? null,
      preflopRaiseCount: targetFrame.preflopRaiseCount ?? 0,
      flopCbetActive: targetFrame.flopCbetActive ?? false,
      potBb: targetFrame.potBb,
      currentBetBb: derivedCurrentBet,
      minRaiseBb: derivedMinRaise,
      lastFullRaiseIncrementBb: derivedIncrement,
      board: targetFrame.board.map((c) => ({ ...c })),
      deck,
      seats: clonedSeats,
      actionLog: actionLogSlice,
      heroAudits: [],
      winnerSummary: targetFrame.phase === 'SHOWDOWN' ? targetFrame.winnerSummary : null,
      winnerSpec: targetFrame.phase === 'SHOWDOWN' ? targetFrame.winnerSpec : null,
      winnerSeatIndices: targetFrame.phase === 'SHOWDOWN' ? [...targetFrame.winnerSeatIndices] : [],
      rabbitHuntBoard: undefined,
      heroShowedUncontested: false,
      runItTwiceBoards: null,
      awaitingRunItTwiceChoice: false,
    };

    setFlashbackTable(clonedState);
    setReplayRecord(null);
    setReplayStep(0);
    setPreAction('none');
    setLiveCoachAlert(null);
    setPreHeroState(null);
  };

  const handleExitFlashback = () => {
    setFlashbackTable(null);
    setPreAction('none');
    setLiveCoachAlert(null);
    setPreHeroState(null);
  };

  const displaySeats: TableSeatDisplay[] = useMemo(() => {
    const activeCount = viewSeats.filter((x) => !x.folded).length;
    return viewSeats.map((s) => {
      const hud = computeHudDisplay(s.stats);
      const botStyleLabel = activeTable.config.blindReadMode
        ? `${t('arena.hiddenTag')} · ${hud.vpipPct}/${hud.pfrPct}`
        : translateArchetype(locale, s.archetype);

      return {
        seatIndex: s.seatIndex,
        position: s.position,
        label: s.isHero ? t('common.hero') : s.name,
        sublabel: s.isHero ? undefined : botStyleLabel,
        stackBb: s.stackBb,
        isHero: s.isHero,
        isDealer: s.seatIndex === viewButtonSeat,
        isActiveTurn: viewActingSeat === s.seatIndex,
        isWinner: viewWinners.includes(s.seatIndex),
        folded: s.folded,
        streetBetBb: s.streetBetBb,
        actionText: s.lastActionText,
        actionSpec: s.lastActionSpec,
        cards: s.cards,
        revealCards:
          s.isHero || (viewPhase === 'SHOWDOWN' && !s.folded && activeCount > 1),
      };
    });
  }, [
    viewSeats,
    activeTable.config.blindReadMode,
    viewButtonSeat,
    viewActingSeat,
    viewWinners,
    viewPhase,
    locale,
    t,
  ]);

  const seats3D: Seat3DSpec[] = useMemo(() => {
    const activeCount = viewSeats.filter((x) => !x.folded).length;
    const winnerLabel = locale === 'zh-CN' ? '赢家' : 'WINNER';
    return viewSeats.map((s) => {
      const hud = computeHudDisplay(s.stats);
      const shortStyle =
        locale === 'zh-CN'
          ? (ARCHETYPE_SHORT_ZH[s.archetype] ?? translateArchetype(locale, s.archetype))
          : (ARCHETYPE_SHORT[s.archetype] ?? s.archetype);
      const styleTag = s.isHero
        ? undefined
        : activeTable.config.blindReadMode
          ? `${locale === 'zh-CN' ? '未知' : '???'} ${hud.vpipPct}/${hud.pfrPct}`
          : `${shortStyle} ${hud.vpipPct}/${hud.pfrPct}`;
      const isAggressiveAction = s.lastActionSpec
        ? AGGRESSIVE_ACTION_KINDS.has(s.lastActionSpec.kind)
        : undefined;

      return {
        seatIndex: s.seatIndex,
        position: s.position,
        label: s.isHero ? t('common.heroShort') : s.name,
        stackBb: s.stackBb,
        stackText: formatChips(s.stackBb, chipDisplay),
        isHero: s.isHero,
        isDealer: s.seatIndex === viewButtonSeat,
        isActiveTurn: viewActingSeat === s.seatIndex,
        folded: s.folded,
        isWinner: viewWinners.includes(s.seatIndex),
        winnerLabel,
        streetBetBb: s.streetBetBb,
        betText:
          s.streetBetBb > 0 ? formatChips(s.streetBetBb, chipDisplay, { compact: true }) : undefined,
        actionText:
          s.lastActionSpec || s.lastActionText
            ? formatArenaAction(locale, s.lastActionSpec, s.lastActionText, chipDisplay)
            : undefined,
        actionKind: mapActionKindTo3D(s.lastActionSpec?.kind),
        isAllIn: s.allIn,
        isAggressiveAction,
        styleTag,
        cards: s.cards,
        revealCards:
          s.isHero || (viewPhase === 'SHOWDOWN' && !s.folded && activeCount > 1),
      };
    });
  }, [
    viewSeats,
    activeTable.config.blindReadMode,
    viewButtonSeat,
    viewActingSeat,
    viewWinners,
    viewPhase,
    locale,
    t,
    chipDisplay,
  ]);

  const viewHeroSeat = viewSeats[0];
  const heroHandDescription = useMemo(() => {
    if (!viewHeroSeat || !viewHeroSeat.cards || viewHeroSeat.folded || viewPhase === 'IDLE') {
      return '';
    }
    return describeHeroHand(viewHeroSeat.cards, viewBoard, locale);
  }, [viewHeroSeat, viewBoard, viewPhase, locale]);

  const liveSprVal = useMemo(() => {
    if (viewPhase === 'PREFLOP' || viewPhase === 'IDLE' || viewPotBb <= 0 || !viewHeroSeat) {
      return null;
    }
    const activeOppStacks = viewSeats
      .filter((s) => !s.isHero && !s.folded)
      .map((s) => s.stackBb);
    if (activeOppStacks.length === 0) return null;
    const effStackBb = Math.min(viewHeroSeat.stackBb, Math.max(...activeOppStacks));
    return effStackBb / viewPotBb;
  }, [viewPhase, viewPotBb, viewHeroSeat, viewSeats]);

  const liveSprLabel =
    liveSprVal !== null ? `${t('arena.spr')} ${liveSprVal.toFixed(1)}` : undefined;

  const livePotOdds = useMemo(() => {
    if (replayRecord || !isHeroTurn || legal.canCheck) return null;
    const po = computeEffectivePotOdds(activeTable, heroSeat);
    if (po.effectiveToCall <= 0) return null;
    const oddsRatio = po.effectivePotBb / po.effectiveToCall;
    return {
      ...po,
      oddsRatio,
    };
  }, [replayRecord, isHeroTurn, legal.canCheck, activeTable, heroSeat]);

  const displayedActionLog: TableActionLogItem[] = useMemo(() => {
    if (!replayRecord || !replayFrame) return activeTable.actionLog;
    if (replayRecord.actionLog) {
      return replayRecord.actionLog.slice(0, replayFrame.actionLogLength);
    }
    const seen = new Set<number>();
    const reconstructed: TableActionLogItem[] = [];
    for (let i = 0; i <= Math.min(replayStep, replayRecord.frames.length - 1); i++) {
      const f = replayRecord.frames[i];
      if (f.latestLog && !seen.has(f.actionLogLength)) {
        seen.add(f.actionLogLength);
        reconstructed.push(f.latestLog);
      }
    }
    return reconstructed;
  }, [replayRecord, replayFrame, replayStep, activeTable.actionLog]);

  const presetLabel = t(`arena.preset.${activeTable.config.poolPreset}` as TranslationKey);

  const canManualTopUp =
    (activeTable.phase === 'IDLE' || activeTable.phase === 'SHOWDOWN') &&
    heroSeat.stackBb < activeTable.config.startingStackBb;

  const configBadgeText = (() => {
    const sizeText =
      locale === 'zh-CN'
        ? `${activeTable.config.tableSize}人桌`
        : `${activeTable.config.tableSize}-Max`;
    if (chipDisplay.unit === 'usd') {
      return `${sizeText} · ${activeStakes.label} · ${formatChips(activeTable.config.startingStackBb, chipDisplay)}`;
    }
    return `${sizeText} · ${presetLabel} · ${activeTable.config.startingStackBb}bb`;
  })();

  const chipUnitToggleNode = (
    <div
      role="group"
      data-testid="toggle-chip-unit"
      aria-label={t('arena.ariaChipUnit')}
      className="flex items-center gap-0.5 p-0.5 bg-[#0E1513] border border-[#1F2D28] rounded-lg shrink-0"
    >
      <button
        type="button"
        data-testid="unit-bb"
        aria-pressed={chipDisplay.unit === 'bb'}
        onClick={() => handleChangeChipUnit('bb')}
        className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
          chipDisplay.unit === 'bb'
            ? 'bg-emerald-500 text-slate-950'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        BB
      </button>
      <button
        type="button"
        data-testid="unit-usd"
        aria-pressed={chipDisplay.unit === 'usd'}
        onClick={() => handleChangeChipUnit('usd')}
        className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
          chipDisplay.unit === 'usd'
            ? 'bg-emerald-500 text-slate-950'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        $
      </button>
    </div>
  );

  const sessionPnlNode = (
    <span
      data-testid="session-pnl-badge"
      className={`px-2 py-0.5 rounded-md border font-mono tabular-nums text-[11px] whitespace-nowrap ${
        arenaStore.sessionNetBb > 0
          ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
          : arenaStore.sessionNetBb < 0
            ? 'bg-rose-500/10 border-rose-500/35 text-rose-300'
            : 'bg-[#121D19] border-[#253832] text-slate-300'
      }`}
    >
      {t('arena.sessionPnl')} {formatSignedChips(arenaStore.sessionNetBb, chipDisplay)}
      {arenaStore.sessionHands > 0 ? ` (${arenaStore.sessionHands}H)` : ''}
    </span>
  );

  const heroStrengthPillNode = heroHandDescription ? (
    <span
      data-testid="hero-hand-strength"
      className="px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/35 text-amber-200 font-mono text-[11px] truncate max-w-[260px]"
      title={heroHandDescription}
    >
      {heroHandDescription}
    </span>
  ) : null;

  const activeSeat =
    activeTable.actingSeatIndex !== null ? activeTable.seats[activeTable.actingSeatIndex] : null;
  const activeActorName = activeSeat
    ? formatSeatDisplayName(locale, activeSeat.name, activeSeat.isHero)
    : null;

  const handLabelText = (n: number) =>
    locale === 'zh-CN' ? `${t('table.hand')} ${n} 手` : `${t('table.hand')} #${n}`;

  const statusText = replayRecord
    ? `${t('arena.replayMode')} · ${handLabelText(replayRecord.handNumber)}`
    : activeTable.awaitingRunItTwiceChoice
      ? t('arena.runItTwice')
      : activeTable.phase === 'SHOWDOWN'
        ? t('table.handComplete')
        : isHeroTurn
          ? `${t('table.yourTurn')} (${heroSeat.position})`
          : activeActorName
            ? `${activeActorName} ${t('table.acting')}`
            : t('table.ready');

  const isRaiseAllIn = legal.canBetOrRaise && raiseAmount >= legal.maxTotalBetBb - 1e-6;

  const canRabbitHunt =
    activeTable.phase === 'SHOWDOWN' &&
    !activeTable.rabbitHuntBoard &&
    activeTable.board.length < 5 &&
    activeTable.deck.length >= 5 - activeTable.board.length;

  const canShowUncontestedHand =
    activeTable.phase === 'SHOWDOWN' &&
    activeTable.winnerSpec?.type === 'uncontested' &&
    activeTable.winnerSpec.winners.some((w) => w.isHero);

  const canShowPreActions =
    !isHeroTurn &&
    !heroSeat.folded &&
    activeTable.phase !== 'SHOWDOWN' &&
    !activeTable.awaitingRunItTwiceChoice &&
    replayRecord === null;

  const rngChipClass =
    rngRoll <= 33
      ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-200 hover:bg-emerald-500/25'
      : rngRoll <= 66
        ? 'bg-amber-400/15 border-amber-400/45 text-amber-200 hover:bg-amber-400/25'
        : 'bg-violet-500/15 border-violet-400/45 text-violet-200 hover:bg-violet-500/25';

  const liveCoachAlertNode = liveCoachAlert ? (
    <div
      data-testid="live-coach-alert"
      role="status"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs ${
        liveCoachAlert.grade === 'Blunder'
          ? 'bg-rose-500/12 border-rose-400/45 text-rose-100'
          : 'bg-amber-400/12 border-amber-400/45 text-amber-100'
      }`}
    >
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <AlertTriangle
          className={`w-4 h-4 mt-0.5 shrink-0 ${
            liveCoachAlert.grade === 'Blunder' ? 'text-rose-300' : 'text-amber-300'
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{t('arena.coachAlertTitle')}</span>
            <GradeBadge grade={liveCoachAlert.grade} size="sm" />
          </div>
          <p className="text-slate-200 leading-relaxed">
            {formatArenaAuditNote(locale, liveCoachAlert.noteSpec, liveCoachAlert.note, chipDisplay)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {preHeroState && (
          <button
            type="button"
            data-testid="coach-undo-retry-btn"
            onClick={handleUndoRetry}
            className="min-h-[34px] px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-slate-950 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('arena.undoRetry')}</span>
          </button>
        )}
        <button
          type="button"
          data-testid="coach-alert-dismiss"
          onClick={() => setLiveCoachAlert(null)}
          aria-label={t('common.close')}
          className="p-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-slate-300 hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  ) : null;

  const liveConsoleNode = activeTable.awaitingRunItTwiceChoice ? (
    <div
      data-testid="run-it-twice-prompt"
      className="flex flex-wrap items-center justify-between gap-3 bg-[#0C1814] border border-amber-400/45 rounded-lg p-3.5"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Split className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="text-xs font-mono font-semibold text-amber-300">
            {t('arena.runItTwice')}
          </p>
          <p className="text-sm font-medium text-white">{t('arena.runItTwicePrompt')}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="run-it-once-btn"
          onClick={() => updateActiveTable((curr) => resolveRunItTwice(curr, false))}
          className="min-h-[40px] px-4 py-2 rounded-lg bg-[#16211D] hover:bg-[#20302A] border border-[#2B3E37] text-xs font-semibold text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          {t('arena.runOnce')}
        </button>
        <button
          type="button"
          data-testid="run-it-twice-btn"
          onClick={() => updateActiveTable((curr) => resolveRunItTwice(curr, true))}
          className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
        >
          {t('arena.runTwice')}
        </button>
      </div>
    </div>
  ) : activeTable.phase === 'SHOWDOWN' ? (
    <div className="space-y-2.5">
      {liveCoachAlertNode}
      <div className="bg-[#0C1814] border border-emerald-500/30 rounded-lg p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-xs font-mono text-emerald-400">{t('table.showdownResult')}</p>
            <p className="text-sm font-semibold text-white">
              {formatWinnerSummary(
                locale,
                activeTable.winnerSpec,
                activeTable.winnerSummary,
                chipDisplay
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canRabbitHunt && (
              <button
                type="button"
                data-testid="rabbit-hunt-btn"
                onClick={() => updateActiveTable((curr) => revealRabbitHunt(curr))}
                className="min-h-[40px] px-3 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/45 text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('arena.rabbitHunt')}</span>
              </button>
            )}
            {canShowUncontestedHand && (
              <button
                type="button"
                data-testid="show-hand-btn"
                disabled={Boolean(activeTable.heroShowedUncontested)}
                onClick={() => updateActiveTable((curr) => toggleHeroShowHand(curr))}
                className={`min-h-[40px] px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  activeTable.heroShowedUncontested
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300 cursor-default'
                    : 'bg-[#141E1B] hover:bg-[#1F2F29] border-[#283B34] text-slate-200 cursor-pointer'
                }`}
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {activeTable.heroShowedUncontested
                    ? t('arena.handShown')
                    : t('arena.showHand')}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDealNext}
              className="min-h-[42px] px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>{t('table.dealNext')}</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-950/20 text-slate-950/80">
                Enter
              </kbd>
            </button>
          </div>
        </div>

        {/* Run It Twice dual-board display */}
        {activeTable.runItTwiceBoards && (
          <div
            data-testid="run-it-twice-boards"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 border-t border-emerald-500/20"
          >
            {activeTable.runItTwiceBoards.map((boardCards, boardIdx) => (
              <div
                key={boardIdx}
                className="flex items-center justify-between gap-2 bg-[#09120F] border border-[#1E312B] rounded-lg px-3 py-2"
              >
                <span className="text-[11px] font-mono font-semibold text-emerald-300 whitespace-nowrap">
                  {boardIdx === 0 ? t('arena.board1') : t('arena.board2')}
                </span>
                <div className="flex items-center gap-1">
                  {boardCards.map((c, idx) => (
                    <PlayingCard
                      key={`${boardIdx}-${idx}`}
                      card={c}
                      fourColor={prefs.fourColorDeck}
                      size="xs"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rabbit Hunt revealed community cards */}
        {activeTable.rabbitHuntBoard && activeTable.rabbitHuntBoard.length > 0 && (
          <div
            data-testid="rabbit-hunt-board"
            className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-amber-400/20"
          >
            <span className="text-[11px] font-mono font-semibold text-amber-300 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('arena.rabbitBoard')}</span>
            </span>
            <div className="flex items-center gap-1">
              {activeTable.rabbitHuntBoard.map((c, idx) => (
                <PlayingCard
                  key={`rabbit-${idx}`}
                  card={c}
                  fourColor={prefs.fourColorDeck}
                  size="xs"
                  highlighted={idx >= activeTable.board.length}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : isHeroTurn ? (
    <div className={theaterMode ? 'space-y-2' : 'space-y-3'}>
      {liveCoachAlertNode}
      {/* Live Pot-Odds, Postflop SPR & RNG Randomizer strip */}
      {(livePotOdds || (activeTable.phase !== 'PREFLOP' && liveSprLabel) || rngEnabled) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
          {livePotOdds && (
            <span
              data-testid="live-pot-odds-pill"
              className="px-2 py-0.5 rounded-md bg-sky-500/12 border border-sky-400/35 text-sky-200"
            >
              {t('arena.potOddsNeed')} {livePotOdds.reqEqPct.toFixed(1)}% ·{' '}
              {livePotOdds.oddsRatio.toFixed(1)}:1
            </span>
          )}
          {activeTable.phase !== 'PREFLOP' && liveSprLabel && (
            <span
              data-testid="live-spr-pill"
              className="px-2 py-0.5 rounded-md bg-[#121D19] border border-[#253832] text-slate-300"
            >
              {liveSprLabel}
            </span>
          )}
          {rngEnabled && (
            <button
              type="button"
              data-testid="rng-roll-chip"
              onClick={() => setRngRoll(Math.floor(Math.random() * 100) + 1)}
              className={`px-2 py-0.5 rounded-md border inline-flex items-center gap-1 font-semibold transition-colors cursor-pointer whitespace-nowrap ${rngChipClass}`}
              title={t('arena.rngDesc')}
            >
              <Dices className="w-3 h-3" aria-hidden="true" />
              <span>
                {t('arena.rngRoll')} {rngRoll}
              </span>
            </button>
          )}
        </div>
      )}

      <div className={theaterMode ? 'flex flex-wrap items-center gap-3' : 'space-y-3'}>
        <div
          className={`flex flex-wrap items-center gap-2.5 ${theaterMode ? 'flex-1 min-w-[320px]' : ''}`}
        >
          {legal.canFold && (
            <button
              type="button"
              onClick={() => handleHeroAction('fold')}
              className="flex-1 min-w-[96px] min-h-[42px] px-4 py-2 rounded-lg bg-[#16211D] hover:bg-[#20302A] border border-[#2B3E37] text-sm font-semibold text-slate-200 inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span>{t('common.fold')}</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/35 text-slate-400 border border-white/10">
                F
              </kbd>
            </button>
          )}
          {legal.canCheck ? (
            <button
              type="button"
              onClick={() => handleHeroAction('check')}
              className="flex-1 min-w-[106px] min-h-[42px] px-4 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/45 text-sm font-semibold text-amber-200 inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span>{t('common.check')}</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-amber-950/50 text-amber-300/80 border border-amber-400/25">
                C
              </kbd>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleHeroAction('call')}
              className="flex-1 min-w-[118px] min-h-[42px] px-4 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sm font-semibold text-sky-200 font-mono tabular-nums inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span>
                {t('common.call')} {formatChips(legal.callAmountBb, chipDisplay, { compact: true })}
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-sky-950/60 text-sky-300/80 border border-sky-400/25">
                C
              </kbd>
            </button>
          )}
          {legal.canBetOrRaise && (
            <button
              type="button"
              data-testid="hero-raise-btn"
              onClick={() => handleHeroAction('raise', raiseAmount)}
              className="flex-1 min-w-[144px] min-h-[42px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 font-mono tabular-nums inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span>
                {isRaiseAllIn
                  ? t('common.allIn')
                  : legal.isBet
                    ? t('common.bet')
                    : t('common.raise')}{' '}
                {formatChips(raiseAmount, chipDisplay, { compact: true })}
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-950/20 text-slate-950/80">
                R
              </kbd>
            </button>
          )}
        </div>

        {legal.canBetOrRaise && (
          <div
            className={`flex flex-wrap items-center gap-3 bg-[#0A100E] border border-[#1B2823] rounded-lg px-3.5 py-2 ${
              theaterMode ? 'flex-1 min-w-[340px]' : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {(activeTable.phase === 'PREFLOP'
                ? (() => {
                    const preflopBase = Math.max(1, activeTable.currentBetBb);
                    return [
                      { label: '2.2x', val: roundBb(preflopBase * 2.2) },
                      { label: '2.5x', val: roundBb(preflopBase * 2.5) },
                      { label: '3x', val: roundBb(preflopBase * 3) },
                      { label: '4x', val: roundBb(preflopBase * 4) },
                      { label: t('common.allIn'), val: legal.maxTotalBetBb },
                    ];
                  })()
                : activeTable.currentBetBb > 0
                  ? [
                      { label: '2.2x', val: roundBb(activeTable.currentBetBb * 2.2) },
                      { label: '2.5x', val: roundBb(activeTable.currentBetBb * 2.5) },
                      { label: '3x', val: roundBb(activeTable.currentBetBb * 3) },
                      {
                        label: t('common.pot'),
                        val: roundBb(
                          activeTable.currentBetBb + activeTable.potBb + legal.callAmountBb
                        ),
                      },
                      { label: t('common.allIn'), val: legal.maxTotalBetBb },
                    ]
                  : [
                      { label: '33%', val: roundBb(activeTable.potBb * 0.33) },
                      { label: '50%', val: roundBb(activeTable.potBb * 0.5) },
                      { label: '75%', val: roundBb(activeTable.potBb * 0.75) },
                      { label: t('common.pot'), val: roundBb(activeTable.potBb) },
                      { label: t('common.allIn'), val: legal.maxTotalBetBb },
                    ]
              ).map((preset) => {
                const snapped = snapRaiseBb(
                  preset.val,
                  chipDisplay,
                  legal.minTotalBetBb,
                  legal.maxTotalBetBb
                );
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setRaiseAmount(snapped);
                      if (prefs.soundEnabled) {
                        sharedCasinoSoundEngine.enabled = true;
                        sharedCasinoSoundEngine.playUiTick();
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-mono rounded bg-[#141E1B] hover:bg-[#1F2F29] border border-[#273A33] text-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-w-[140px] flex items-center gap-3">
              <label htmlFor="table-raise-slider" className="sr-only">
                {t('table.ariaRaiseSlider')}
              </label>
              <input
                id="table-raise-slider"
                type="range"
                min={legal.minTotalBetBb}
                max={legal.maxTotalBetBb}
                step={getSliderStepBb(chipDisplay)}
                value={raiseAmount}
                onChange={(e) =>
                  setRaiseAmount(
                    snapRaiseBb(
                      Number(e.target.value),
                      chipDisplay,
                      legal.minTotalBetBb,
                      legal.maxTotalBetBb
                    )
                  )
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-xs text-emerald-300 min-w-[4.75rem] text-right shrink-0">
                {formatChips(raiseAmount, chipDisplay, { compact: true })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="space-y-2.5">
      {liveCoachAlertNode}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-400 py-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span>
            {heroSeat.folded
              ? t('table.foldedWait')
              : `${t('table.waitingFor')} ${activeActorName ?? '...'}`}
          </span>
          {canShowPreActions && (
            <div className="flex flex-wrap items-center gap-1.5" role="group">
              <button
                type="button"
                data-testid="pre-action-check-fold"
                aria-pressed={preAction === 'check_fold'}
                onClick={() =>
                  setPreAction((prev) => (prev === 'check_fold' ? 'none' : 'check_fold'))
                }
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  preAction === 'check_fold'
                    ? 'bg-rose-500/15 border-rose-400/50 text-rose-200 font-semibold'
                    : 'bg-[#121D19] hover:bg-[#1B2B25] border-[#253832] text-slate-300'
                }`}
              >
                {t('arena.preCheckFold')}
              </button>
              <button
                type="button"
                data-testid="pre-action-auto-check"
                aria-pressed={preAction === 'auto_check'}
                onClick={() =>
                  setPreAction((prev) => (prev === 'auto_check' ? 'none' : 'auto_check'))
                }
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  preAction === 'auto_check'
                    ? 'bg-amber-400/15 border-amber-400/50 text-amber-200 font-semibold'
                    : 'bg-[#121D19] hover:bg-[#1B2B25] border-[#253832] text-slate-300'
                }`}
              >
                {t('arena.preAutoCheck')}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleDealNext}
          className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#283B34] text-slate-200 cursor-pointer whitespace-nowrap"
        >
          {t('table.skipNext')}
        </button>
      </div>
    </div>
  );

  const renderCardsText = (cards: Card[] | null) =>
    cards ? (
      <span className="inline-flex items-center gap-1 font-mono">
        {cards.map((c, i) => (
          <span
            key={i}
            className={c.suit === 'h' || c.suit === 'd' ? 'text-rose-300' : 'text-slate-100'}
          >
            {c.rank}
            {SUIT_GLYPH[c.suit]}
          </span>
        ))}
      </span>
    ) : (
      <span className="text-slate-500">--</span>
    );

  const replayLatestLine = (() => {
    if (!replayFrame) return '';
    if (replayFrame.phase === 'SHOWDOWN' && replayFrame.winnerSummary) {
      return formatWinnerSummary(
        locale,
        replayFrame.winnerSpec,
        replayFrame.winnerSummary,
        chipDisplay
      );
    }
    const log = replayFrame.latestLog;
    if (!log) return '';
    return `${log.position} ${formatSeatDisplayName(locale, log.seatName, log.isHero)} ${formatArenaAction(locale, log.actionSpec, log.text, chipDisplay)}`;
  })();

  const replayAvailableStreets = useMemo(() => {
    if (!replayRecord) return [];
    return REPLAY_STREETS.map((phase) => ({
      phase,
      index: replayRecord.frames.findIndex((f) => f.phase === phase),
    })).filter((s) => s.index >= 0);
  }, [replayRecord]);

  const replayConsoleNode =
    replayRecord && replayFrame ? (
      <ReplayConsole
        handNumber={replayRecord.handNumber}
        stepIndex={replayStep}
        totalSteps={replayTotal}
        latestLine={replayLatestLine}
        currentPhase={replayFrame.phase}
        availableStreets={replayAvailableStreets}
        onPrev={() => setReplayStep((v) => Math.max(0, v - 1))}
        onNext={() => setReplayStep((v) => Math.min(replayTotal - 1, v + 1))}
        onJumpTo={(idx) => setReplayStep(idx)}
        onFlashback={handleStartFlashback}
        onCopyHand={() => {
          const text = exportHandToPokerStarsText(replayRecord, chipDisplay);
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
          }
        }}
        onDownloadHand={() => {
          const text = exportHandToPokerStarsText(replayRecord, chipDisplay);
          downloadTextFile(`turnriver-hand-${replayRecord.handNumber}.txt`, text);
        }}
        onExit={exitReplay}
      />
    ) : null;

  const actionConsoleNode = replayConsoleNode ?? liveConsoleNode;

  const analyticsPanelNode = (
    <div className="space-y-4">
      {/* Compact 4-Tab Switcher: HUD | Session | Log | Replay */}
      <div
        role="tablist"
        aria-label={t('table.ariaAnalyticsTabs')}
        className="grid grid-cols-4 gap-1 p-1 bg-[#0A100E] border border-[#1B2823] rounded-lg"
      >
        <button
          id="arena-tab-hud"
          type="button"
          role="tab"
          aria-selected={rightTab === 'hud'}
          aria-controls="arena-panel-hud"
          onClick={() => setRightTab('hud')}
          className={`py-1.5 px-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
            rightTab === 'hud' ? 'bg-[#192823] text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('arena.tabHud')}
        </button>
        <button
          id="arena-tab-session"
          type="button"
          role="tab"
          data-testid="arena-tab-session"
          aria-selected={rightTab === 'session'}
          aria-controls="arena-panel-session"
          onClick={() => setRightTab('session')}
          className={`py-1.5 px-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
            rightTab === 'session'
              ? 'bg-[#192823] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('arena.tabSession')}
        </button>
        <button
          id="arena-tab-feed"
          type="button"
          role="tab"
          aria-selected={rightTab === 'feed'}
          aria-controls="arena-panel-feed"
          onClick={() => setRightTab('feed')}
          className={`py-1.5 px-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
            rightTab === 'feed' ? 'bg-[#192823] text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('arena.tabFeed')} ({displayedActionLog.length})
        </button>
        <button
          id="arena-tab-replay"
          type="button"
          role="tab"
          data-testid="arena-tab-replay"
          aria-selected={rightTab === 'replay'}
          aria-controls="arena-panel-replay"
          onClick={() => setRightTab('replay')}
          className={`py-1.5 px-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
            rightTab === 'replay'
              ? 'bg-[#192823] text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('arena.tabReplay')} ({replayHistory.length})
        </button>
      </div>

      {rightTab === 'hud' ? (
        <div
          id="arena-panel-hud"
          role="tabpanel"
          aria-labelledby="arena-tab-hud"
          className="space-y-5"
        >
          {/* Live Opponent HUD Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">{t('arena.hudTitle')}</h2>
              {activeTable.config.blindReadMode && (
                <span className="text-[11px] font-mono text-amber-300">{t('arena.hudHidden')}</span>
              )}
            </div>

            <div className="overflow-x-auto border border-[#1B2823] rounded-lg bg-[#0A100E]">
              <table className="w-full text-left text-[11px] font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-[#1B2823] text-slate-400">
                    <th className="py-2 px-2 font-medium">{t('arena.hudColPlayer')}</th>
                    <th className="py-2 px-1.5 font-medium">{t('arena.hudColStyle')}</th>
                    <th className="py-2 px-1 text-right font-medium">{t('arena.hudColHands')}</th>
                    <th className="py-2 px-1 text-right font-medium">{t('arena.hudColVpip')}</th>
                    <th className="py-2 px-1 text-right font-medium">{t('arena.hudColPfr')}</th>
                    <th className="py-2 px-1 text-right font-medium">{t('arena.hudCol3b')}</th>
                    <th className="py-2 px-1.5 text-right font-medium">{t('arena.hudColAf')}</th>
                  </tr>
                </thead>
                <tbody data-testid="opponent-hud-rows">
                  {activeTable.seats
                    .filter((s) => !s.isHero)
                    .map((bot) => {
                      const hud = computeHudDisplay(bot.stats);
                      const note = arenaStore.opponentNotes[bot.name] ?? EMPTY_OPPONENT_NOTE;
                      const isActing = activeTable.actingSeatIndex === bot.seatIndex;
                      const styleLabel = activeTable.config.blindReadMode
                        ? t('arena.hiddenTag')
                        : translateArchetype(locale, bot.archetype);
                      return (
                        <tr
                          key={bot.seatIndex}
                          data-testid={`opponent-hud-row-${bot.seatIndex}`}
                          onClick={() => setInspectedSeatIndex(bot.seatIndex)}
                          className={`border-b border-[#141E1B] last:border-0 hover:bg-[#14201C] transition-colors cursor-pointer ${
                            isActing ? 'bg-emerald-500/10' : ''
                          } ${bot.folded ? 'opacity-50' : ''}`}
                        >
                          <td className="py-2 px-2 text-slate-200 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedSeatIndex(bot.seatIndex);
                              }}
                              className="inline-flex items-center gap-1.5 text-left hover:text-emerald-300 cursor-pointer"
                            >
                              <span
                                className={`inline-block w-2 h-2 rounded-full shrink-0 ${COLOR_TAG_DOT[note.colorTag]}`}
                                aria-hidden="true"
                              />
                              <span className="text-emerald-400">{bot.position}</span>
                              <span>{bot.name.split(' ')[1] ?? bot.name}</span>
                            </button>
                          </td>
                          <td
                            className="py-2 px-1.5 text-slate-300 whitespace-nowrap"
                            title={styleLabel}
                          >
                            {activeTable.config.blindReadMode ? (
                              <span className="text-amber-300">{styleLabel}</span>
                            ) : (
                              styleLabel
                            )}
                          </td>
                          <td className="py-2 px-1 text-right text-slate-400">
                            {bot.stats.handsDealt}
                          </td>
                          <td className="py-2 px-1 text-right text-slate-200">{hud.vpipPct}%</td>
                          <td className="py-2 px-1 text-right text-slate-300">{hud.pfrPct}%</td>
                          <td className="py-2 px-1 text-right text-sky-300">
                            {hud.threeBetPct}%
                          </td>
                          <td className="py-2 px-1.5 text-right text-amber-300">{hud.af}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exploitative EV Audit (hidden when Coach Mode is Off) */}
          {coachMode !== 'off' && (
            <div className="border-t border-[#1C2A25] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">{t('table.auditTitle')}</h2>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {activeTable.heroAudits.length}{' '}
                  {activeTable.heroAudits.length === 1
                    ? t('table.actionSingular')
                    : t('table.actionPlural')}
                </span>
              </div>

              {activeTable.heroAudits.length === 0 ? (
                <p className="text-xs text-slate-400 bg-[#0A100E] border border-[#1B2823] rounded-lg p-3.5 leading-relaxed">
                  {t('table.auditEmpty')}
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {activeTable.heroAudits.map((audit, idx) => (
                    <div
                      key={idx}
                      className="bg-[#0A100E] border border-[#1B2823] rounded-lg p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-300">
                          {translateStreetLabel(locale, audit.street)} ·{' '}
                          {formatArenaAction(
                            locale,
                            audit.chosenActionSpec,
                            audit.chosenAction,
                            chipDisplay
                          )}
                        </span>
                        <GradeBadge
                          grade={audit.grade}
                          metricLabel={
                            audit.noteSpec?.toCallBb && audit.noteSpec.toCallBb > 0
                              ? `${t('metric.potOddsPrefix')} ${audit.noteSpec.reqEqPct}%`
                              : undefined
                          }
                          size="sm"
                        />
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        {formatArenaAuditNote(locale, audit.noteSpec, audit.note, chipDisplay)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : rightTab === 'session' ? (
        /* Persistent Bankroll, Session P&L Graph, Hero HUD & Challenges Tab */
        <div
          id="arena-panel-session"
          role="tabpanel"
          aria-labelledby="arena-tab-session"
          data-testid="arena-panel-session"
        >
          <SessionGraphSvg
            points={arenaStore.sessionPoints}
            bankrollBb={arenaStore.bankrollBb}
            sessionNetBb={arenaStore.sessionNetBb}
            sessionHands={arenaStore.sessionHands}
            heroLifetime={arenaStore.heroLifetime}
            chipDisplay={chipDisplay}
            challenges={sessionChallenges}
            onResetBankroll={() => arenaStore.resetBankroll()}
            onLaunchChallenge={handleLaunchChallenge}
          />
        </div>
      ) : rightTab === 'feed' ? (
        /* Live or Replayed Table Action Feed Tab */
        <div
          id="arena-panel-feed"
          role="tabpanel"
          aria-labelledby="arena-tab-feed"
          className="space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              {replayRecord ? t('arena.replayFeedLabel') : t('table.actionFeedTitle')}
            </h3>
            {replayRecord && (
              <span className="text-[11px] font-mono text-amber-300">
                {handLabelText(replayRecord.handNumber)}
              </span>
            )}
          </div>
          <ol className="space-y-1 max-h-[480px] overflow-y-auto text-xs font-mono pr-1">
            {displayedActionLog.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 py-1.5 border-b border-[#182130] last:border-0"
              >
                <span className="text-slate-300 truncate">
                  <span className="text-emerald-400 mr-1.5">{item.position}</span>
                  {formatSeatDisplayName(locale, item.seatName, item.isHero)}
                </span>
                <span className="text-slate-400 shrink-0">
                  {formatArenaAction(locale, item.actionSpec, item.text, chipDisplay)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        /* Hand History Replay Tab */
        <div
          id="arena-panel-replay"
          role="tabpanel"
          aria-labelledby="arena-tab-replay"
          data-testid="arena-panel-replay"
          className="space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{t('arena.replayTitle')}</h3>
            {replayHistory.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="export-session-btn"
                  onClick={() => {
                    const text = exportSessionHandsText(replayHistory, chipDisplay);
                    downloadTextFile('turnriver-session-hands.txt', text);
                  }}
                  className="px-2 py-1 text-[11px] font-medium rounded-md bg-[#141E1B] hover:bg-[#1F2F29] border border-[#273A33] text-emerald-300 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3 h-3" aria-hidden="true" />
                  <span>{t('arena.exportSession')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplayHistory([]);
                    exitReplay();
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 cursor-pointer"
                >
                  {t('arena.replayClear')}
                </button>
              </div>
            )}
          </div>
          {replayHistory.length === 0 ? (
            <p className="text-xs text-slate-400 bg-[#0A100E] border border-[#1B2823] rounded-lg p-3.5 leading-relaxed">
              {t('arena.replayEmpty')}
            </p>
          ) : (
            <ol className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {replayHistory.map((rec) => {
                const selected = replayRecord?.id === rec.id;
                const netLabel =
                  rec.netBb > 0
                    ? t('arena.replayWon')
                    : rec.netBb < 0
                      ? t('arena.replayLost')
                      : t('arena.replayEven');
                return (
                  <li key={rec.id}>
                    <button
                      type="button"
                      data-testid="replay-hand-item"
                      onClick={() => startReplay(rec)}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'bg-emerald-500/10 border-emerald-400/50'
                          : 'bg-[#0A100E] border-[#1B2823] hover:border-emerald-500/40'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-300">
                          {handLabelText(rec.handNumber)}
                        </span>
                        {renderCardsText(rec.heroCards)}
                        <span
                          className={`font-mono tabular-nums ${
                            rec.netBb > 0
                              ? 'text-emerald-300'
                              : rec.netBb < 0
                                ? 'text-rose-300'
                                : 'text-slate-300'
                          }`}
                        >
                          {netLabel} {formatSignedChips(rec.netBb, chipDisplay, { compact: true })}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span className="font-mono tabular-nums">
                          {t('common.pot')} {formatChips(rec.totalPotBb, chipDisplay, { compact: true })}
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <History className="w-3 h-3" aria-hidden="true" />
                          {t('arena.replayWatch')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );

  const inspectedSeat =
    inspectedSeatIndex !== null
      ? activeTable.seats.find((s) => s.seatIndex === inspectedSeatIndex && !s.isHero) ?? null
      : null;

  const flashbackBannerNode = isFlashback ? (
    <div
      data-testid="flashback-banner"
      className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-lg bg-amber-400/12 border border-amber-400/45 text-xs"
    >
      <div className="flex items-center gap-2 text-amber-200 font-medium">
        <GitBranch className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
        <span>{t('arena.flashbackBanner')}</span>
      </div>
      <button
        type="button"
        data-testid="exit-flashback-btn"
        onClick={handleExitFlashback}
        className="px-3 py-1 text-xs font-semibold rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{t('arena.exitFlashback')}</span>
      </button>
    </div>
  ) : null;

  return (
    <div
      ref={arenaRootRef}
      data-testid={theaterMode ? 'arena-theater-container' : 'arena-standard-container'}
      className={
        theaterMode
          ? 'fixed inset-0 z-40 bg-[#080B11] flex flex-col overflow-hidden'
          : 'space-y-3 sm:space-y-5 pb-10'
      }
    >
      {/* Header Bar: Compact Cinema Bar in Theater Mode, Full Config Toolbar in Standard Mode */}
      {theaterMode ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 border-b border-[#1B2823] bg-[#0A100E] shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              data-testid="arena-config-badge"
              className="px-2.5 py-0.5 text-xs font-mono rounded-md bg-[#121D19] border border-[#253832] text-emerald-300"
            >
              {configBadgeText}
            </span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">{statusText}</span>
            {heroStrengthPillNode}
            {sessionPnlNode}
            <span className="hidden lg:inline text-xs font-mono tabular-nums text-slate-400">
              {t('table.heroStack')} {formatChips(heroSeat.stackBb, chipDisplay, { compact: true })} ·{' '}
              {t('table.currentBet')}{' '}
              {formatChips(activeTable.currentBetBb, chipDisplay, { compact: true })}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isFlashback && (
              <button
                type="button"
                data-testid="theater-exit-flashback-btn"
                onClick={handleExitFlashback}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-400/20 border border-amber-400/50 text-amber-200 hover:bg-amber-400/30 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('arena.exitFlashback')}</span>
              </button>
            )}
            {chipUnitToggleNode}

            <button
              type="button"
              data-testid="theater-top-up"
              onClick={handleRebuy}
              disabled={!canManualTopUp}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-200 hover:bg-[#17231F] disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden md:inline">
                {t('table.topUp')} {formatChips(activeTable.config.startingStackBb, chipDisplay)}
              </span>
            </button>

            <button
              type="button"
              data-testid="theater-toggle-hud"
              aria-expanded={theaterHudOpen}
              aria-controls="theater-hud-drawer"
              onClick={() => setTheaterHudOpen((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                theaterHudOpen
                  ? 'bg-[#192823] border-emerald-500/50 text-white'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-300 hover:text-white'
              }`}
            >
              {theaterHudOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{t('arena.toggleHudDrawer')}</span>
            </button>

            <button
              type="button"
              data-testid="open-arena-setup"
              onClick={() => setSetupOpen(true)}
              aria-label={t('arena.configure')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('arena.configure')}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-blind-read"
              onClick={toggleBlindRead}
              aria-pressed={activeTable.config.blindReadMode}
              aria-label={
                activeTable.config.blindReadMode ? t('arena.revealStyles') : t('arena.hideStyles')
              }
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTable.config.blindReadMode
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-300 hover:text-white'
              }`}
            >
              {activeTable.config.blindReadMode ? (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="hidden md:inline">
                {activeTable.config.blindReadMode ? t('arena.revealStyles') : t('arena.hideStyles')}
              </span>
            </button>

            <button
              type="button"
              data-testid="toggle-fast-fold"
              onClick={toggleFastFold}
              aria-pressed={activeTable.config.fastFold}
              aria-label={t('arena.fastFoldShort')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTable.config.fastFold
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden md:inline">{t('arena.fastFoldShort')}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-fullscreen-btn"
              onClick={handleToggleFullscreen}
              aria-label={isFullscreen ? t('arena.exitFullscreen') : t('arena.fullscreen')}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-200 hover:border-emerald-500/50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Expand className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isFullscreen ? t('arena.exitFullscreen') : t('arena.fullscreen')}
              </span>
            </button>

            <button
              type="button"
              data-testid="exit-theater-btn"
              onClick={handleToggleTheater}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#17231F] border border-[#293C35] text-slate-100 hover:bg-[#21332C] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('arena.exitTheater')}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5 sm:gap-3 border-b border-[#1F2D28] pb-3 sm:pb-4">
          <div className="space-y-1 min-w-0 flex-1 sm:flex-none">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg sm:text-2xl font-semibold text-white truncate">{t('table.title')}</h1>
              <span
                data-testid="arena-config-badge"
                className="hidden sm:inline-block px-2.5 py-0.5 text-xs font-mono rounded-md bg-[#121D19] border border-[#253832] text-emerald-300"
              >
                {configBadgeText}
              </span>
              {sessionPnlNode}
            </div>
            <p className="hidden sm:block text-xs text-slate-400">
              {locale === 'zh-CN'
                ? `${t('table.hand')} ${activeTable.handNumber} 手`
                : `${t('table.hand')} #${activeTable.handNumber}`}{' '}
              · {t('table.subtitleSuffix')}
            </p>
          </div>

          {/* <640px: primary buttons join the title row and secondary controls collapse into a strip */}
          <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            {/* Open Configure Arena Modal */}
            <button
              type="button"
              data-testid="open-arena-setup"
              onClick={() => setSetupOpen(true)}
              aria-label={t('arena.configure')}
              className="px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('arena.configure')}</span>
            </button>

            {/* Theater / Fullscreen Mode Button */}
            <button
              type="button"
              data-testid="enter-theater-btn"
              onClick={handleToggleTheater}
              aria-label={t('arena.theaterMode')}
              className="px-2.5 sm:px-3 py-2 text-xs font-medium rounded-lg bg-[#121D19] hover:bg-[#1D2D44] border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('arena.theaterMode')}</span>
            </button>

            {/* Compact Options toggle (hidden on sm+, where the strip is always visible) */}
            <button
              type="button"
              data-testid="toggle-arena-options"
              onClick={() => setOptionsOpen((v) => !v)}
              aria-expanded={optionsOpen}
              aria-controls="arena-options-strip"
              aria-label={t('arena.optionsAria')}
              className={`sm:hidden px-2.5 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                optionsOpen
                  ? 'bg-[#192823] border-emerald-500/50 text-white'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-300'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('arena.optionsToggle')}</span>
            </button>

            <div
              id="arena-options-strip"
              className={`${optionsOpen ? 'flex' : 'hidden'} w-full basis-full flex-wrap items-center gap-2 sm:contents`}
            >

            {/* Quick Live BB / $ Chip Unit Toggle */}
            {chipUnitToggleNode}

            {/* Blind Read Quick Toggle */}
            <button
              type="button"
              data-testid="toggle-blind-read"
              onClick={toggleBlindRead}
              aria-pressed={activeTable.config.blindReadMode}
              className={`px-3 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTable.config.blindReadMode
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-300 hover:text-white'
              }`}
            >
              {activeTable.config.blindReadMode ? (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {activeTable.config.blindReadMode ? t('arena.revealStyles') : t('arena.hideStyles')}
              </span>
            </button>

            {/* Fast-Fold Quick Toggle */}
            <button
              type="button"
              data-testid="toggle-fast-fold"
              onClick={toggleFastFold}
              aria-pressed={activeTable.config.fastFold}
              className={`px-2.5 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                activeTable.config.fastFold
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('arena.fastFoldShort')}</span>
            </button>

            {/* 3D / 2D Switcher */}
            <div
              role="group"
              aria-label={t('table.ariaVisualMode')}
              className="flex items-center gap-1 p-1 bg-[#0E1513] border border-[#1F2D28] rounded-lg"
            >
              <button
                type="button"
                data-testid="play-view-3d"
                onClick={() => setViewMode('3d')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === '3d'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('table.view3D')}</span>
              </button>
              <button
                type="button"
                data-testid="play-view-2d"
                onClick={() => setViewMode('2d')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === '2d'
                    ? 'bg-[#1E2E28] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('table.view2D')}
              </button>
            </div>

            <button
              type="button"
              onClick={handleRebuy}
              disabled={!canManualTopUp}
              className="px-2.5 py-2 text-xs font-medium rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-200 hover:bg-[#17231F] disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {t('table.topUp')} {formatChips(activeTable.config.startingStackBb, chipDisplay)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
              aria-label={prefs.fourColorDeck ? t('common.fourColor') : t('common.twoColor')}
              className={`p-2 rounded-lg border cursor-pointer ${
                prefs.fourColorDeck
                  ? 'bg-[#172634] border-sky-500/40 text-sky-300'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-400'
              }`}
            >
              <Palette className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
              aria-label={prefs.soundEnabled ? t('common.muteSound') : t('common.enableSound')}
              className="p-2 rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-300 hover:text-white cursor-pointer"
            >
              {prefs.soundEnabled ? (
                <Volume2 className="w-4 h-4" aria-hidden="true" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" aria-hidden="true" />
              )}
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Stage Layout: preserves a single WebGL canvas seamlessly across Standard & Theater modes */}
      <div
        className={
          theaterMode
            ? 'flex-1 min-h-0 flex overflow-hidden'
            : 'grid grid-cols-1 xl:grid-cols-12 gap-5 items-start'
        }
      >
        <div
          className={
            theaterMode
              ? 'flex-1 min-w-0 h-full flex flex-col'
              : 'xl:col-span-8 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-4 sm:p-5 space-y-5'
          }
        >
          {/* Status Strip (standard mode; Theater shows status in its top bar) */}
          {!theaterMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="font-mono text-emerald-400 font-semibold">{statusText}</span>
                {heroStrengthPillNode}
              </div>
              <span className="font-mono tabular-nums text-slate-400">
                {t('table.heroStack')}{' '}
                {formatChips(heroSeat.stackBb, chipDisplay, { compact: true })} ·{' '}
                {t('table.currentBet')}{' '}
                {formatChips(activeTable.currentBetBb, chipDisplay, { compact: true })}
              </span>
            </div>
          )}

          {/* Flashback Practice Branch Banner */}
          {!theaterMode && flashbackBannerNode}

          {/* Primary 3D Table (or optional 2D Classic) */}
          <div className={theaterMode ? 'flex-1 min-h-0' : ''}>
            {viewMode === '3d' || theaterMode ? (
              <Studio3DTable
                board={viewBoard}
                potBb={viewPotBb}
                potText={formatChips(viewPotBb, chipDisplay)}
                streetLabel={translateStreetLabel(locale, viewPhase)}
                seats={seats3D}
                fourColorDeck={prefs.fourColorDeck}
                onToggleFourColor={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
                soundEnabled={prefs.soundEnabled}
                onToggleSound={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
                fillParent={theaterMode}
                isTheater={theaterMode}
                onToggleTheater={theaterMode ? undefined : handleToggleTheater}
              />
            ) : (
              <PokerTableOval
                seats={displaySeats}
                board={viewBoard}
                potBb={viewPotBb}
                streetLabel={translateStreetLabel(locale, viewPhase)}
                sprLabel={liveSprLabel}
                fourColor={prefs.fourColorDeck}
                chipDisplay={chipDisplay}
              />
            )}
          </div>

          {/* Showdown Banner or Live Action Console */}
          <div
            className={
              theaterMode
                ? 'px-4 py-3 border-t border-[#1B2823] bg-[#0A100E] shrink-0 min-h-[84px] flex flex-col justify-center'
                : 'pt-4 border-t border-[#1B2823] min-h-[118px] flex flex-col justify-center'
            }
          >
            {actionConsoleNode}
          </div>
        </div>

        {/* Analytics Column (Always visible in Standard Mode; Full-screen overlay on <lg, side drawer on lg+ in Theater Mode) */}
        {(!theaterMode || theaterHudOpen) && (
          <aside
            id={theaterMode ? 'theater-hud-drawer' : undefined}
            data-testid={theaterMode ? 'theater-hud-drawer' : 'arena-analytics-panel'}
            className={
              theaterMode
                ? 'fixed inset-0 z-50 lg:static lg:inset-auto lg:z-auto lg:w-[370px] shrink-0 border-l border-[#1F2D28] bg-[#0B1210] p-4 overflow-y-auto flex flex-col'
                : 'xl:col-span-4 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-5'
            }
          >
            {theaterMode && (
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1B2823] lg:hidden shrink-0">
                <span className="text-sm font-semibold text-white">
                  {t('arena.toggleHudDrawer')}
                </span>
                <button
                  type="button"
                  data-testid="close-theater-hud"
                  onClick={() => setTheaterHudOpen(false)}
                  aria-label={t('common.close')}
                  className="p-1.5 rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#283B34] text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
            {analyticsPanelNode}
          </aside>
        )}
      </div>

      {/* Arena Configuration Modal */}
      <ArenaSetupModal
        open={setupOpen}
        config={table.config}
        chipDisplay={chipDisplay}
        autoTopUp={autoTopUp}
        coachMode={coachMode}
        rngEnabled={rngEnabled}
        onChangeCoachMode={(m) => onUpdatePrefs({ coachMode: m })}
        onChangeRngEnabled={(v) => onUpdatePrefs({ rngEnabled: v })}
        onSelectChallenge={handleLaunchChallenge}
        onClose={() => setSetupOpen(false)}
        onApply={handleApplyArenaConfig}
      />

      {/* Opponent Scouting & Blind-Read Popover */}
      {inspectedSeat && (
        <PlayerNotePopover
          seat={inspectedSeat}
          note={arenaStore.opponentNotes[inspectedSeat.name] ?? EMPTY_OPPONENT_NOTE}
          blindReadMode={activeTable.config.blindReadMode}
          onSaveNote={(patch) => arenaStore.updateOpponentNote(inspectedSeat.name, patch)}
          onClose={() => setInspectedSeatIndex(null)}
        />
      )}
    </div>
  );
}
