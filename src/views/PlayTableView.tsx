import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Expand,
  Eye,
  EyeOff,
  History,
  Maximize2,
  Minimize2,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Play,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { Card, DrillAttemptRecord, UserPreferences } from '../poker/types';
import {
  applyPlayerAction,
  chooseBotAction,
  computeHudDisplay,
  createTableFromConfig,
  DEFAULT_ARENA_CONFIG,
  getLegalActions,
  rebuyHeroTo100,
  roundBb,
  settleAndStartNewHand,
  startNewHand,
  type ArenaConfig,
  type PokerTableState,
  type TableActionKind,
  type TableActionLogItem,
  type TablePhase,
  type TableSeat,
  type WinnerSummarySpec,
} from '../poker/tableEngine';
import { PokerTableOval, type TableSeatDisplay } from '../components/PokerTableOval';
import { Studio3DTable } from '../components/Studio3DTable';
import { ArenaSetupModal } from '../components/ArenaSetupModal';
import { GradeBadge } from '../components/GradeBadge';
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
    case 'post_sb':
    case 'post_bb':
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
  const [table, setTable] = useState<PokerTableState>(() =>
    startNewHand(createTableFromConfig(DEFAULT_ARENA_CONFIG))
  );
  const [raiseAmount, setRaiseAmount] = useState<number>(2.5);
  // 3D Table is the primary default experience for the Multi-Bot Arena
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [theaterHudOpen, setTheaterHudOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [setupOpen, setSetupOpen] = useState<boolean>(false);
  const [rightTab, setRightTab] = useState<'hud' | 'feed' | 'replay'>('hud');
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);
  const [replayHistory, setReplayHistory] = useState<HandReplayRecord[]>(loadReplayHistory);
  const [replayRecord, setReplayRecord] = useState<HandReplayRecord | null>(null);
  const [replayStep, setReplayStep] = useState<number>(0);
  const captureRef = useRef<{
    hand: number;
    frames: HandReplayFrame[];
    startStackBb: number;
    saved: boolean;
  }>({ hand: -1, frames: [], startStackBb: 0, saved: false });
  const arenaRootRef = useRef<HTMLDivElement | null>(null);
  const loggedHandRef = useRef<number>(0);

  // Track native Fullscreen API state and allow Escape to exit Theater Mode cleanly
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && theaterMode && !setupOpen) {
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
  }, [theaterMode, setupOpen]);

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

  const heroSeat = table.seats[0];
  const isHeroTurn =
    table.phase !== 'IDLE' &&
    table.phase !== 'SHOWDOWN' &&
    table.actingSeatIndex === 0;
  const legal = getLegalActions(table, 0);
  const isFastSpeed = table.config.speed === 'fast';
  const is3DActive = viewMode === '3d' || theaterMode;
  const prevStreetKeyRef = useRef<string>('');

  // Sync default raise sizing whenever it becomes Hero's turn
  useEffect(() => {
    if (isHeroTurn && legal.canBetOrRaise) {
      const defaultTarget =
        table.phase === 'PREFLOP' && table.currentBetBb <= 1.0
          ? table.config.tableSize === 2
            ? 2.2
            : 2.5
          : table.currentBetBb === 0
            ? roundBb(Math.max(legal.minTotalBetBb, table.potBb * 0.5))
            : roundBb(Math.max(legal.minTotalBetBb, table.currentBetBb * 2.5));
      setRaiseAmount(
        Math.min(legal.maxTotalBetBb, Math.max(legal.minTotalBetBb, defaultTarget))
      );
    }
  }, [
    isHeroTurn,
    table.phase,
    table.currentBetBb,
    table.potBb,
    table.config.tableSize,
    legal.canBetOrRaise,
    legal.minTotalBetBb,
    legal.maxTotalBetBb,
  ]);

  // Automatic strategic bot turn loop with realistic live-table pacing & street-deal breathing room
  useEffect(() => {
    const streetKey = `${table.handNumber}:${table.phase}`;
    const isFreshStreetOrDeal = prevStreetKeyRef.current !== streetKey;
    prevStreetKeyRef.current = streetKey;

    if (
      table.phase === 'IDLE' ||
      table.phase === 'SHOWDOWN' ||
      table.actingSeatIndex === null ||
      table.actingSeatIndex === 0
    ) {
      return;
    }

    // Fast-fold: if Hero folded and fastFold is enabled, pause briefly so fold registers then deal next
    if (heroSeat.folded && table.config.fastFold) {
      const fastTimer = window.setTimeout(() => {
        setTable((curr) => settleAndStartNewHand(curr));
      }, isFastSpeed ? 450 : 750);
      return () => window.clearTimeout(fastTimer);
    }

    // Human-like think time: natural variance + extra pause after fresh deal/flop/turn/river & big decisions
    const jitter = Math.random();
    const isLateStreet = table.phase === 'TURN' || table.phase === 'RIVER';
    const isBigSpot = table.currentBetBb >= 4 || table.potBb >= 16;
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

    const botIndex = table.actingSeatIndex;
    const timer = window.setTimeout(() => {
      setTable((curr) => {
        if (curr.actingSeatIndex !== botIndex || curr.phase === 'SHOWDOWN') return curr;
        const move = chooseBotAction(curr, botIndex);
        if (!is3DActive && (move.type === 'raise' || move.type === 'call')) {
          playPokerSound('chip', prefs.soundEnabled);
        }
        return applyPlayerAction(curr, botIndex, move.type, move.raiseToBb);
      });
    }, thinkDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    table.handNumber,
    table.actingSeatIndex,
    table.phase,
    table.currentBetBb,
    table.potBb,
    table.actionLog.length,
    table.config.fastFold,
    heroSeat.folded,
    isFastSpeed,
    is3DActive,
    prefs.soundEnabled,
  ]);

  // Record Hero's street decisions into Leak Tracker once per completed hand (or on fast-fold)
  useEffect(() => {
    const shouldLog =
      (table.phase === 'SHOWDOWN' || (heroSeat.folded && table.config.fastFold)) &&
      table.handNumber > loggedHandRef.current &&
      table.heroAudits.length > 0;

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
    table.phase,
    table.handNumber,
    table.heroAudits,
    table.config.tableSize,
    table.config.fastFold,
    heroSeat.folded,
    onRecordAttempt,
  ]);

  // Capture action-by-action snapshots for the current hand; save the record at showdown
  useEffect(() => {
    if (table.phase === 'IDLE') return;
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
      };
      setReplayHistory((prev) => [record, ...prev].slice(0, REPLAY_HISTORY_LIMIT));
    }
  }, [table]);

  useEffect(() => {
    saveReplayHistory(replayHistory);
  }, [replayHistory]);

  const handleHeroAction = (
    type: 'fold' | 'check' | 'call' | 'raise',
    customTarget?: number
  ) => {
    if (!isHeroTurn) return;
    if (!is3DActive) {
      playPokerSound(type === 'fold' ? 'card' : 'chip', prefs.soundEnabled);
    }
    setTable((curr) => applyPlayerAction(curr, 0, type, customTarget ?? raiseAmount));
  };

  const handleDealNext = () => {
    if (!is3DActive) {
      playPokerSound('card', prefs.soundEnabled);
    }
    setTable((curr) => settleAndStartNewHand(curr));
  };

  // Poker action hotkeys: F (Fold), C/Space (Check/Call), R (Bet/Raise), Enter (Deal Next on showdown)
  const hotkeyStateRef = useRef({
    replaying: replayRecord !== null,
    setupOpen,
    phase: table.phase,
    isHeroTurn,
    legal,
    raiseAmount,
    handleHeroAction,
    handleDealNext,
  });
  hotkeyStateRef.current = {
    replaying: replayRecord !== null,
    setupOpen,
    phase: table.phase,
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
      if (st.setupOpen || st.replaying) return;

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
    setTable((curr) => rebuyHeroTo100(curr));
  };

  const handleApplyArenaConfig = (nextConfig: ArenaConfig) => {
    if (!is3DActive) {
      playPokerSound('card', prefs.soundEnabled);
    }
    loggedHandRef.current = 0;
    captureRef.current.hand = -1;
    setReplayRecord(null);
    setTable(startNewHand(createTableFromConfig(nextConfig)));
  };

  const toggleBlindRead = () => {
    setTable((curr) => ({
      ...curr,
      config: { ...curr.config, blindReadMode: !curr.config.blindReadMode },
    }));
  };

  const toggleFastFold = () => {
    setTable((curr) => ({
      ...curr,
      config: { ...curr.config, fastFold: !curr.config.fastFold },
    }));
  };

  // Replay Mode drives the table from the selected frame; exiting restores the live table untouched
  const replayFrame: HandReplayFrame | null = replayRecord
    ? replayRecord.frames[Math.min(replayStep, replayRecord.frames.length - 1)]
    : null;
  const viewSeats: TableSeat[] = useMemo(() => {
    if (!replayFrame) return table.seats;
    const fallbackStats = table.seats[0].stats;
    return replayFrame.seats.map((rs) => ({
      ...rs,
      stats: table.seats.find((x) => x.seatIndex === rs.seatIndex)?.stats ?? fallbackStats,
    }));
  }, [replayFrame, table.seats]);
  const viewBoard = replayFrame ? replayFrame.board : table.board;
  const viewPotBb = replayFrame ? replayFrame.potBb : table.potBb;
  const viewPhase: TablePhase = replayFrame ? replayFrame.phase : table.phase;
  const viewButtonSeat = replayFrame ? replayFrame.buttonSeatIndex : table.buttonSeatIndex;
  const viewActingSeat = replayFrame ? null : table.actingSeatIndex;
  const viewWinners = replayFrame ? replayFrame.winnerSeatIndices : table.winnerSeatIndices;

  const startReplay = (record: HandReplayRecord) => {
    setReplayRecord(record);
    setReplayStep(0);
    if (theaterMode && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTheaterHudOpen(false);
    }
  };
  const exitReplay = () => {
    setReplayRecord(null);
    setReplayStep(0);
  };
  const replayTotal = replayRecord ? replayRecord.frames.length : 0;

  const displaySeats: TableSeatDisplay[] = useMemo(() => {
    const activeCount = viewSeats.filter((x) => !x.folded).length;
    return viewSeats.map((s) => {
      const hud = computeHudDisplay(s.stats);
      const botStyleLabel = table.config.blindReadMode
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
    table.config.blindReadMode,
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
        : table.config.blindReadMode
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
        isHero: s.isHero,
        isDealer: s.seatIndex === viewButtonSeat,
        isActiveTurn: viewActingSeat === s.seatIndex,
        folded: s.folded,
        isWinner: viewWinners.includes(s.seatIndex),
        winnerLabel,
        streetBetBb: s.streetBetBb,
        actionText:
          s.lastActionSpec || s.lastActionText
            ? formatArenaAction(locale, s.lastActionSpec, s.lastActionText)
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
    table.config.blindReadMode,
    viewButtonSeat,
    viewActingSeat,
    viewWinners,
    viewPhase,
    locale,
    t,
  ]);

  const activeSeat =
    table.actingSeatIndex !== null ? table.seats[table.actingSeatIndex] : null;
  const activeActorName = activeSeat
    ? formatSeatDisplayName(locale, activeSeat.name, activeSeat.isHero)
    : null;

  const presetLabel = t(`arena.preset.${table.config.poolPreset}` as TranslationKey);

  const handLabelText = (n: number) =>
    locale === 'zh-CN' ? `${t('table.hand')} ${n} 手` : `${t('table.hand')} #${n}`;

  const statusText = replayRecord
    ? `${t('arena.replayMode')} · ${handLabelText(replayRecord.handNumber)}`
    : table.phase === 'SHOWDOWN'
      ? t('table.handComplete')
      : isHeroTurn
        ? `${t('table.yourTurn')} (${heroSeat.position})`
        : activeActorName
          ? `${activeActorName} ${t('table.acting')}`
          : t('table.ready');

  const liveConsoleNode =
    table.phase === 'SHOWDOWN' ? (
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0C1814] border border-emerald-500/30 rounded-lg p-3.5">
        <div className="space-y-0.5">
          <p className="text-xs font-mono text-emerald-400">{t('table.showdownResult')}</p>
          <p className="text-sm font-semibold text-white">
            {formatWinnerSummary(locale, table.winnerSpec, table.winnerSummary)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDealNext}
          className="min-h-[42px] px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Play className="w-4 h-4" aria-hidden="true" />
          <span>{t('table.dealNext')}</span>
        </button>
      </div>
    ) : isHeroTurn ? (
      <div className={theaterMode ? 'flex flex-wrap items-center gap-3' : 'space-y-3.5'}>
        <div className={`flex flex-wrap items-center gap-2.5 ${theaterMode ? 'flex-1 min-w-[320px]' : ''}`}>
          {legal.canFold && (
            <button
              type="button"
              onClick={() => handleHeroAction('fold')}
              className="flex-1 min-w-[96px] min-h-[42px] px-4 py-2 rounded-lg bg-[#16211D] hover:bg-[#20302A] border border-[#2B3E37] text-sm font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
            >
              {t('common.fold')}
            </button>
          )}
          {legal.canCheck ? (
            <button
              type="button"
              onClick={() => handleHeroAction('check')}
              className="flex-1 min-w-[106px] min-h-[42px] px-4 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/45 text-sm font-semibold text-amber-200 cursor-pointer whitespace-nowrap"
            >
              {t('common.check')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleHeroAction('call')}
              className="flex-1 min-w-[118px] min-h-[42px] px-4 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sm font-semibold text-sky-200 font-mono tabular-nums cursor-pointer whitespace-nowrap"
            >
              {t('common.call')} {legal.callAmountBb.toFixed(1)}bb
            </button>
          )}
          {legal.canBetOrRaise && (
            <button
              type="button"
              onClick={() => handleHeroAction('raise', raiseAmount)}
              className="flex-1 min-w-[144px] min-h-[42px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 font-mono tabular-nums cursor-pointer whitespace-nowrap"
            >
              {legal.isBet ? t('common.bet') : t('common.raise')} {raiseAmount.toFixed(1)}bb
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
              {(table.phase === 'PREFLOP'
                ? (() => {
                    const preflopBase = Math.max(1, table.currentBetBb);
                    return [
                      { label: '2.2x', val: roundBb(preflopBase * 2.2) },
                      { label: '2.5x', val: roundBb(preflopBase * 2.5) },
                      { label: '3x', val: roundBb(preflopBase * 3) },
                      { label: '4x', val: roundBb(preflopBase * 4) },
                      { label: t('common.allIn'), val: legal.maxTotalBetBb },
                    ];
                  })()
                : [
                    { label: '33%', val: roundBb(table.potBb * 0.33) },
                    { label: '50%', val: roundBb(table.potBb * 0.5) },
                    { label: '75%', val: roundBb(table.potBb * 0.75) },
                    { label: t('common.pot'), val: roundBb(table.potBb) },
                    { label: t('common.allIn'), val: legal.maxTotalBetBb },
                  ]
              ).map((preset) => {
                const clamped = roundBb(
                  Math.max(legal.minTotalBetBb, Math.min(legal.maxTotalBetBb, preset.val))
                );
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setRaiseAmount(clamped);
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
                step={0.5}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-xs text-emerald-300 w-14 text-right shrink-0">
                {raiseAmount.toFixed(1)}bb
              </span>
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="flex items-center justify-between text-xs text-slate-400 py-1.5">
        <span>
          {heroSeat.folded
            ? t('table.foldedWait')
            : `${t('table.waitingFor')} ${activeActorName ?? '...'}`}
        </span>
        <button
          type="button"
          onClick={handleDealNext}
          className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#283B34] text-slate-200 cursor-pointer whitespace-nowrap"
        >
          {t('table.skipNext')}
        </button>
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
      return formatWinnerSummary(locale, replayFrame.winnerSpec, replayFrame.winnerSummary);
    }
    const log = replayFrame.latestLog;
    if (!log) return '';
    return `${log.position} ${formatSeatDisplayName(locale, log.seatName, log.isHero)} ${formatArenaAction(locale, log.actionSpec, log.text)}`;
  })();

  const replayConsoleNode =
    replayRecord && replayFrame ? (
      <div data-testid="replay-controls" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {t('arena.replayMode')} · {handLabelText(replayRecord.handNumber)}
            </span>
          </div>
          <button
            type="button"
            data-testid="replay-exit"
            onClick={exitReplay}
            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('arena.replayExit')}</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="replay-prev"
            onClick={() => setReplayStep((v) => Math.max(0, v - 1))}
            disabled={replayStep <= 0}
            className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#283B34] text-slate-200 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('arena.replayPrev')}</span>
          </button>
          <span
            data-testid="replay-step-counter"
            className="px-1.5 font-mono tabular-nums text-xs text-slate-200 whitespace-nowrap"
          >
            {t('arena.replayStep')} {replayStep + 1} / {replayTotal}
          </span>
          <button
            type="button"
            data-testid="replay-next"
            onClick={() => setReplayStep((v) => Math.min(replayTotal - 1, v + 1))}
            disabled={replayStep >= replayTotal - 1}
            className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#283B34] text-slate-200 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>{t('arena.replayNext')}</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <div
            role="group"
            aria-label={t('arena.replayJumpAria')}
            className="flex flex-wrap items-center gap-1.5 sm:ml-auto"
          >
            {REPLAY_STREETS.map((street) => {
              const idx = replayRecord.frames.findIndex((f) => f.phase === street);
              if (idx < 0) return null;
              const active = replayFrame.phase === street;
              return (
                <button
                  key={street}
                  type="button"
                  data-testid={`replay-jump-${street.toLowerCase()}`}
                  aria-pressed={active}
                  onClick={() => setReplayStep(idx)}
                  className={`px-2.5 py-1.5 text-xs font-mono rounded border cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                      : 'bg-[#141E1B] hover:bg-[#1F2F29] border-[#273A33] text-slate-300'
                  }`}
                >
                  {translateStreetLabel(locale, street)}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-slate-400 min-h-[16px] leading-relaxed">{replayLatestLine}</p>
      </div>
    ) : null;

  const actionConsoleNode = replayConsoleNode ?? liveConsoleNode;

  const analyticsPanelNode = (
    <div className="space-y-4">
      {/* Compact Tab Switcher */}
      <div
        role="tablist"
        aria-label={t('table.ariaAnalyticsTabs')}
        className="grid grid-cols-3 gap-1 p-1 bg-[#0A100E] border border-[#1B2823] rounded-lg"
      >
        <button
          id="arena-tab-hud"
          type="button"
          role="tab"
          aria-selected={rightTab === 'hud'}
          aria-controls="arena-panel-hud"
          onClick={() => setRightTab('hud')}
          className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            rightTab === 'hud' ? 'bg-[#192823] text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('arena.tabHud')}
        </button>
        <button
          id="arena-tab-feed"
          type="button"
          role="tab"
          aria-selected={rightTab === 'feed'}
          aria-controls="arena-panel-feed"
          onClick={() => setRightTab('feed')}
          className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            rightTab === 'feed' ? 'bg-[#192823] text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('arena.tabFeed')} ({table.actionLog.length})
        </button>
        <button
          id="arena-tab-replay"
          type="button"
          role="tab"
          data-testid="arena-tab-replay"
          aria-selected={rightTab === 'replay'}
          aria-controls="arena-panel-replay"
          onClick={() => setRightTab('replay')}
          className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            rightTab === 'replay' ? 'bg-[#192823] text-white' : 'text-slate-400 hover:text-slate-200'
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
              {table.config.blindReadMode && (
                <span className="text-[11px] font-mono text-amber-300">{t('arena.hudHidden')}</span>
              )}
            </div>

            <div className="overflow-x-auto border border-[#1B2823] rounded-lg bg-[#0A100E]">
              <table className="w-full text-left text-[11px] font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-[#1B2823] text-slate-400">
                    <th className="py-2 px-2.5 font-medium">{t('arena.hudColPlayer')}</th>
                    <th className="py-2 px-2 font-medium">{t('arena.hudColStyle')}</th>
                    <th className="py-2 px-1.5 text-right font-medium">{t('arena.hudColVpip')}</th>
                    <th className="py-2 px-1.5 text-right font-medium">{t('arena.hudColPfr')}</th>
                    <th className="py-2 px-1.5 text-right font-medium">{t('arena.hudCol3b')}</th>
                    <th className="py-2 px-2 text-right font-medium">{t('arena.hudColAf')}</th>
                  </tr>
                </thead>
                <tbody data-testid="opponent-hud-rows">
                  {table.seats
                    .filter((s) => !s.isHero)
                    .map((bot) => {
                      const hud = computeHudDisplay(bot.stats);
                      const isActing = table.actingSeatIndex === bot.seatIndex;
                      const styleLabel = table.config.blindReadMode
                        ? t('arena.hiddenTag')
                        : translateArchetype(locale, bot.archetype);
                      return (
                        <tr
                          key={bot.seatIndex}
                          className={`border-b border-[#141E1B] last:border-0 ${
                            isActing ? 'bg-emerald-500/10' : ''
                          } ${bot.folded ? 'opacity-50' : ''}`}
                        >
                          <td className="py-2 px-2.5 text-slate-200 whitespace-nowrap">
                            <span className="text-emerald-400 mr-1.5">{bot.position}</span>
                            <span>{bot.name.split(' ')[1] ?? bot.name}</span>
                          </td>
                          <td
                            className="py-2 px-2 text-slate-300 whitespace-nowrap"
                            title={styleLabel}
                          >
                            {table.config.blindReadMode ? (
                              <span className="text-amber-300">{styleLabel}</span>
                            ) : (
                              styleLabel
                            )}
                          </td>
                          <td className="py-2 px-1.5 text-right text-slate-200">{hud.vpipPct}%</td>
                          <td className="py-2 px-1.5 text-right text-slate-300">{hud.pfrPct}%</td>
                          <td className="py-2 px-1.5 text-right text-sky-300">
                            {hud.threeBetPct}%
                          </td>
                          <td className="py-2 px-2 text-right text-amber-300">{hud.af}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exploitative EV Audit */}
          <div className="border-t border-[#1C2A25] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{t('table.auditTitle')}</h2>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {table.heroAudits.length}{' '}
                {table.heroAudits.length === 1
                  ? t('table.actionSingular')
                  : t('table.actionPlural')}
              </span>
            </div>

            {table.heroAudits.length === 0 ? (
              <p className="text-xs text-slate-400 bg-[#0A100E] border border-[#1B2823] rounded-lg p-3.5 leading-relaxed">
                {t('table.auditEmpty')}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {table.heroAudits.map((audit, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0A100E] border border-[#1B2823] rounded-lg p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-300">
                        {translateStreetLabel(locale, audit.street)} ·{' '}
                        {formatArenaAction(locale, audit.chosenActionSpec, audit.chosenAction)}
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
                      {formatArenaAuditNote(locale, audit.noteSpec, audit.note)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : rightTab === 'feed' ? (
        /* Live Table Action Feed Tab */
        <div
          id="arena-panel-feed"
          role="tabpanel"
          aria-labelledby="arena-tab-feed"
          className="space-y-2.5"
        >
          <h3 className="text-sm font-semibold text-white">{t('table.actionFeedTitle')}</h3>
          <ol className="space-y-1 max-h-[480px] overflow-y-auto text-xs font-mono pr-1">
            {table.actionLog.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 py-1.5 border-b border-[#182130] last:border-0"
              >
                <span className="text-slate-300 truncate">
                  <span className="text-emerald-400 mr-1.5">{item.position}</span>
                  {formatSeatDisplayName(locale, item.seatName, item.isHero)}
                </span>
                <span className="text-slate-400 shrink-0">
                  {formatArenaAction(locale, item.actionSpec, item.text)}
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
                          {netLabel} {rec.netBb > 0 ? '+' : ''}
                          {rec.netBb.toFixed(1)}bb
                        </span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span className="font-mono tabular-nums">
                          {t('common.pot')} {rec.totalPotBb.toFixed(1)}bb
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
          <div className="flex flex-wrap items-center gap-3">
            <span
              data-testid="arena-config-badge"
              className="px-2.5 py-0.5 text-xs font-mono rounded-md bg-[#121D19] border border-[#253832] text-emerald-300"
            >
              {locale === 'zh-CN' ? `${table.config.tableSize}人桌` : `${table.config.tableSize}-Max`} · {presetLabel} · {table.config.startingStackBb}bb
            </span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">{statusText}</span>
            <span className="hidden md:inline text-xs font-mono tabular-nums text-slate-400">
              {t('table.heroStack')} {heroSeat.stackBb.toFixed(1)}bb · {t('table.currentBet')}{' '}
              {table.currentBetBb.toFixed(1)}bb
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              aria-pressed={table.config.blindReadMode}
              aria-label={
                table.config.blindReadMode ? t('arena.revealStyles') : t('arena.hideStyles')
              }
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                table.config.blindReadMode
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-300 hover:text-white'
              }`}
            >
              {table.config.blindReadMode ? (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="hidden md:inline">
                {table.config.blindReadMode ? t('arena.revealStyles') : t('arena.hideStyles')}
              </span>
            </button>

            <button
              type="button"
              data-testid="toggle-fast-fold"
              onClick={toggleFastFold}
              aria-pressed={table.config.fastFold}
              aria-label={t('arena.fastFoldShort')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                table.config.fastFold
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
                {locale === 'zh-CN' ? `${table.config.tableSize}人桌` : `${table.config.tableSize}-Max`} · {presetLabel} · {table.config.startingStackBb}bb
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-400">
              {locale === 'zh-CN'
                ? `${t('table.hand')} ${table.handNumber} 手`
                : `${t('table.hand')} #${table.handNumber}`}{' '}
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

            {/* Blind Read Quick Toggle */}
            <button
              type="button"
              data-testid="toggle-blind-read"
              onClick={toggleBlindRead}
              aria-pressed={table.config.blindReadMode}
              className={`px-3 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                table.config.blindReadMode
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-300 hover:text-white'
              }`}
            >
              {table.config.blindReadMode ? (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {table.config.blindReadMode ? t('arena.revealStyles') : t('arena.hideStyles')}
              </span>
            </button>

            {/* Fast-Fold Quick Toggle */}
            <button
              type="button"
              data-testid="toggle-fast-fold"
              onClick={toggleFastFold}
              aria-pressed={table.config.fastFold}
              className={`px-2.5 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                table.config.fastFold
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
              disabled={
                !((table.phase === 'IDLE' || table.phase === 'SHOWDOWN') &&
                  heroSeat.stackBb < table.config.startingStackBb)
              }
              className="px-2.5 py-2 text-xs font-medium rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-200 hover:bg-[#17231F] disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {t('table.topUp')} {table.config.startingStackBb} bb
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
              <span className="font-mono text-emerald-400 font-semibold">{statusText}</span>
              <span className="font-mono tabular-nums text-slate-400">
                {t('table.heroStack')} {heroSeat.stackBb.toFixed(1)}bb · {t('table.currentBet')}{' '}
                {table.currentBetBb.toFixed(1)}bb
              </span>
            </div>
          )}

          {/* Primary 3D Table (or optional 2D Classic) */}
          <div className={theaterMode ? 'flex-1 min-h-0' : ''}>
            {viewMode === '3d' || theaterMode ? (
              <Studio3DTable
                board={viewBoard}
                potBb={viewPotBb}
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
                fourColor={prefs.fourColorDeck}
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
        onClose={() => setSetupOpen(false)}
        onApply={handleApplyArenaConfig}
      />
    </div>
  );
}
