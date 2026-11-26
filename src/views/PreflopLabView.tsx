import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Palette, RotateCcw, Timer, Volume2, VolumeX, Zap } from 'lucide-react';
import type {
  DecisionEvaluation,
  DrillAttemptRecord,
  Position,
  UserPreferences,
} from '../poker/types';
import {
  evaluatePreflopDecision,
  generatePreflopSpot,
  type PreflopDrillSpot,
  type PreflopScenarioType,
} from '../poker/preflopRanges';
import { PokerTableOval, type TableSeatDisplay } from '../components/PokerTableOval';
import { RangeMatrix13x13 } from '../components/RangeMatrix13x13';
import { GradeBadge } from '../components/GradeBadge';
import { SolverBars } from '../components/SolverBars';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import {
  translateActionText,
  translatePositionLabel,
  type TranslationKey,
} from '../i18n/translations';
import { localizePreflopTemplate } from '../i18n/drillContentZh';

interface PreflopLabViewProps {
  prefs: UserPreferences;
  onUpdatePrefs: (patch: Partial<UserPreferences>) => void;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
  onPreflopAnswered?: () => void;
}

interface BlitzRoundEntry {
  spot: PreflopDrillSpot;
  chosen: 'raise' | 'call' | 'fold' | 'timeout';
  correct: boolean;
  reactionMs: number;
  bestAction: string;
}

const BLITZ_TOTAL_HANDS = 10;
const BLITZ_SECONDS_PER_HAND = 6;

const SCENARIO_OPTIONS: { value: PreflopScenarioType | 'ALL'; labelKey: TranslationKey }[] = [
  { value: 'ALL', labelKey: 'preflop.filterAll' },
  { value: 'RFI', labelKey: 'preflop.filterRfi' },
  { value: 'FACING_OPEN', labelKey: 'preflop.filterFacingOpen' },
  { value: 'FACING_3BET', labelKey: 'preflop.filterFacing3Bet' },
];

const POSITION_OPTIONS: (Position | 'ALL')[] = ['ALL', 'UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SEAT_ORDER: Position[] = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];

export function PreflopLabView({
  prefs,
  onUpdatePrefs,
  onRecordAttempt,
  onPreflopAnswered,
}: PreflopLabViewProps) {
  const { locale, t } = useLocale();
  const [scenarioFilter, setScenarioFilter] = useState<PreflopScenarioType | 'ALL'>('ALL');
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL');
  const [spot, setSpot] = useState<PreflopDrillSpot>(() =>
    generatePreflopSpot('ALL', 'ALL')
  );
  const [evaluation, setEvaluation] = useState<DecisionEvaluation | null>(null);
  const [inspectedHand, setInspectedHand] = useState<string | null>(null);

  // 10-Hand Speed Blitz (Hot-or-Fold inspired 6s shot-clock mode)
  const [blitzActive, setBlitzActive] = useState(false);
  const [blitzEntries, setBlitzEntries] = useState<BlitzRoundEntry[]>([]);
  const [blitzTimeLeftMs, setBlitzTimeLeftMs] = useState(BLITZ_SECONDS_PER_HAND * 1000);
  const blitzSpotStartRef = useRef<number>(Date.now());
  const blitzFinished = blitzActive && blitzEntries.length >= BLITZ_TOTAL_HANDS;

  const startBlitz = useCallback(() => {
    const next = generatePreflopSpot(scenarioFilter, positionFilter);
    setSpot(next);
    setEvaluation(null);
    setInspectedHand(null);
    setBlitzEntries([]);
    setBlitzActive(true);
    setBlitzTimeLeftMs(BLITZ_SECONDS_PER_HAND * 1000);
    blitzSpotStartRef.current = Date.now();
    playPokerSound('card', prefs.soundEnabled);
  }, [scenarioFilter, positionFilter, prefs.soundEnabled]);

  const stopBlitz = useCallback(() => {
    setBlitzActive(false);
    setBlitzEntries([]);
    setEvaluation(null);
  }, []);

  const dealNext = useCallback(
    (nextScenario = scenarioFilter, nextPos = positionFilter) => {
      const next = generatePreflopSpot(nextScenario, nextPos);
      setSpot(next);
      setEvaluation(null);
      setInspectedHand(null);
      if (blitzActive) {
        setBlitzTimeLeftMs(BLITZ_SECONDS_PER_HAND * 1000);
        blitzSpotStartRef.current = Date.now();
      }
      playPokerSound('card', prefs.soundEnabled);
    },
    [scenarioFilter, positionFilter, prefs.soundEnabled, blitzActive]
  );

  const handleAction = useCallback(
    (actionKey: 'raise' | 'call' | 'fold') => {
      if (evaluation || blitzFinished) return;
      const result = evaluatePreflopDecision(spot, actionKey);
      const isGood = result.grade === 'Optimal' || result.grade === 'Acceptable';
      playPokerSound(isGood ? 'optimal' : 'mistake', prefs.soundEnabled);
      onRecordAttempt({
        module: 'preflop',
        position: spot.template.heroPos,
        street: 'preflop',
        spotLabel: `${spot.template.title} (${spot.handKey})`,
        chosenAction: result.chosenAction,
        bestAction: result.bestAction,
        metricValue: result.chosenFreq,
        metricKind: 'freq_pct',
        grade: result.grade,
        accuracyScore: result.accuracyScore,
      });
      onPreflopAnswered?.();

      if (blitzActive) {
        const reactionMs = Math.max(100, Date.now() - blitzSpotStartRef.current);
        const entry: BlitzRoundEntry = {
          spot,
          chosen: actionKey,
          correct: isGood,
          reactionMs,
          bestAction: result.bestAction,
        };
        setBlitzEntries((prev) => {
          const nextEntries = [...prev, entry];
          if (nextEntries.length < BLITZ_TOTAL_HANDS) {
            const nextSpot = generatePreflopSpot(scenarioFilter, positionFilter);
            setSpot(nextSpot);
            setBlitzTimeLeftMs(BLITZ_SECONDS_PER_HAND * 1000);
            blitzSpotStartRef.current = Date.now();
          }
          return nextEntries;
        });
        return;
      }

      setEvaluation(result);
      setInspectedHand(spot.handKey);
    },
    [
      evaluation,
      blitzFinished,
      blitzActive,
      spot,
      prefs.soundEnabled,
      onRecordAttempt,
      onPreflopAnswered,
      scenarioFilter,
      positionFilter,
    ]
  );

  // Blitz 6-second shot clock
  useEffect(() => {
    if (!blitzActive || blitzFinished) return;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - blitzSpotStartRef.current;
      const remaining = Math.max(0, BLITZ_SECONDS_PER_HAND * 1000 - elapsed);
      setBlitzTimeLeftMs(remaining);
      if (remaining <= 0) {
        const bestRes = evaluatePreflopDecision(spot, 'fold');
        playPokerSound('mistake', prefs.soundEnabled);
        setBlitzEntries((prev) => {
          if (prev.length >= BLITZ_TOTAL_HANDS) return prev;
          const nextEntries: BlitzRoundEntry[] = [
            ...prev,
            {
              spot,
              chosen: 'timeout',
              correct: false,
              reactionMs: BLITZ_SECONDS_PER_HAND * 1000,
              bestAction: bestRes.bestAction,
            },
          ];
          if (nextEntries.length < BLITZ_TOTAL_HANDS) {
            const nextSpot = generatePreflopSpot(scenarioFilter, positionFilter);
            setSpot(nextSpot);
            setBlitzTimeLeftMs(BLITZ_SECONDS_PER_HAND * 1000);
            blitzSpotStartRef.current = Date.now();
          }
          return nextEntries;
        });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [blitzActive, blitzFinished, spot, prefs.soundEnabled, scenarioFilter, positionFilter]);

  // Keyboard shortcuts: F = Fold, C = Call, R = Raise, Enter = Next Spot
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const k = e.key.toLowerCase();
      if (!evaluation) {
        if (k === 'f') handleAction('fold');
        if (k === 'c' && spot.template.scenarioType !== 'RFI') handleAction('call');
        if (k === 'r') handleAction('raise');
      } else if (
        e.key === 'Enter' &&
        !(target instanceof HTMLButtonElement) &&
        !(target instanceof HTMLAnchorElement)
      ) {
        dealNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [evaluation, spot.template.scenarioType, handleAction, dealNext]);

  // Build 6-max table seats rotated so Hero is seat 0
  const heroPosIdx = SEAT_ORDER.indexOf(spot.template.heroPos);
  const tableSeats: TableSeatDisplay[] = Array.from({ length: 6 }, (_, i) => {
    const pos = SEAT_ORDER[(heroPosIdx + i) % 6];
    const isHero = i === 0;
    const isVillain = spot.template.villainPos === pos;
    let actionText = '';
    if (isVillain) {
      actionText =
        spot.template.scenarioType === 'FACING_OPEN'
          ? 'Opens 2.5bb'
          : '3-Bets';
    } else if (!isHero && pos === 'SB') {
      actionText = 'Posts SB 0.5bb';
    } else if (!isHero && pos === 'BB') {
      actionText = 'Posts BB 1.0bb';
    }
    return {
      seatIndex: i,
      position: pos,
      label: isHero ? t('common.hero') : isVillain ? t('common.villain') : `${t('common.seat')} ${i + 1}`,
      stackBb: isVillain ? 97.5 : 100,
      isHero,
      isVillain,
      isDealer: pos === 'BTN',
      isActiveTurn: isHero && !evaluation,
      folded: !isHero && !isVillain && pos !== 'SB' && pos !== 'BB',
      actionText,
      cards: isHero ? spot.heroCards : null,
    };
  });

  const activeInspectedCell =
    inspectedHand && spot.template.matrix[inspectedHand]
      ? spot.template.matrix[inspectedHand]
      : spot.template.matrix[spot.handKey];

  const localizedTemplate = localizePreflopTemplate(locale, spot.template);

  return (
    <div className="space-y-6 pb-10">
      {/* Workspace Filter & Utility Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2D28] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            {t('preflop.title')}
          </h1>
          <p className="text-xs text-slate-400">
            {localizedTemplate.subtitle} · {t('preflop.shortcuts')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Scenario Filter */}
          <div
            role="group"
            aria-label={t('preflop.ariaScenarioFilter')}
            className="flex flex-wrap items-center gap-1 p-1 bg-[#0E1513] border border-[#1F2D28] rounded-lg max-w-full"
          >
            {SCENARIO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setScenarioFilter(opt.value);
                  dealNext(opt.value, positionFilter);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  scenarioFilter === opt.value
                    ? 'bg-[#1E2E28] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>

          {/* Position Filter */}
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="sr-only">{t('preflop.srSeatPosition')}</span>
            <select
              aria-label={t('preflop.ariaSeatPosition')}
              value={positionFilter}
              onChange={(e) => {
                const nextPos = e.target.value as Position | 'ALL';
                setPositionFilter(nextPos);
                dealNext(scenarioFilter, nextPos);
              }}
              className="bg-[#0E1513] border border-[#1F2D28] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {POSITION_OPTIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos === 'ALL'
                    ? t('preflop.allSeats')
                    : `${t('preflop.heroPosPrefix')} ${translatePositionLabel(locale, pos)}`}
                </option>
              ))}
            </select>
          </label>

          {/* Speed Blitz Toggle */}
          <button
            type="button"
            data-testid="preflop-blitz-toggle"
            aria-pressed={blitzActive}
            onClick={() => (blitzActive ? stopBlitz() : startBlitz())}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              blitzActive
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-[#0E1513] border-[#1F2D28] text-amber-300 hover:border-amber-400/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{blitzActive ? t('preflop.exitBlitz') : t('preflop.speedBlitz')}</span>
          </button>

          {/* Deck & Audio Controls */}
          <button
            type="button"
            onClick={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
            aria-pressed={prefs.fourColorDeck}
            className={`px-3 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              prefs.fourColorDeck
                ? 'bg-[#172634] border-sky-500/40 text-sky-300'
                : 'bg-[#0E1513] border-[#1F2D28] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{prefs.fourColorDeck ? t('common.fourColor') : t('common.twoColor')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
            aria-label={prefs.soundEnabled ? t('common.muteSound') : t('common.enableSound')}
            className="p-2 rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {prefs.soundEnabled ? (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Speed Blitz Live Shot Clock or Summary */}
      {blitzActive && (
        <div
          data-testid="preflop-blitz-banner"
          className="bg-[#0E1513] border border-amber-400/35 rounded-xl p-4 space-y-3"
        >
          {!blitzFinished ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-amber-200">
                  <Timer className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <span>
                    {t('preflop.speedBlitz')} · {blitzEntries.length + 1} / {BLITZ_TOTAL_HANDS}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span className="text-emerald-300">
                    {blitzEntries.filter((e) => e.correct).length}/{blitzEntries.length}{' '}
                    {t('preflop.blitzHits')}
                  </span>
                  <span
                    className={`font-semibold ${
                      blitzTimeLeftMs <= 2000 ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    {(blitzTimeLeftMs / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#15221E] overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-100 ${
                    blitzTimeLeftMs <= 2000 ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{
                    width: `${Math.round((blitzTimeLeftMs / (BLITZ_SECONDS_PER_HAND * 1000)) * 100)}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {t('preflop.blitzComplete')} ·{' '}
                    <span className="text-emerald-400 font-mono">
                      {blitzEntries.filter((e) => e.correct).length} / {BLITZ_TOTAL_HANDS}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 font-mono tabular-nums">
                    {t('preflop.blitzAvgTime')}:{' '}
                    {(
                      blitzEntries.reduce((s, e) => s + e.reactionMs, 0) /
                      Math.max(1, blitzEntries.length) /
                      1000
                    ).toFixed(2)}
                    s
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startBlitz}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#04110C] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('preflop.blitzAgain')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopBlitz}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-[#141E1B] border border-[#243630] text-slate-300 hover:text-white cursor-pointer"
                  >
                    {t('preflop.exitBlitz')}
                  </button>
                </div>
              </div>

              {blitzEntries.some((e) => !e.correct) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {blitzEntries
                    .filter((e) => !e.correct)
                    .map((miss, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setBlitzActive(false);
                          setSpot(miss.spot);
                          setEvaluation(
                            evaluatePreflopDecision(
                              miss.spot,
                              miss.chosen === 'timeout' ? 'fold' : miss.chosen
                            )
                          );
                          setInspectedHand(miss.spot.handKey);
                        }}
                        className="px-2.5 py-1 text-xs font-mono rounded-md bg-rose-500/15 border border-rose-400/40 text-rose-200 hover:border-rose-300 cursor-pointer"
                      >
                        {miss.spot.template.heroPos} {miss.spot.handKey} → {miss.bestAction}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Two-Zone Studio Sandbox (65% Stage / 35% Analytics Deck) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Interactive Felt Stage */}
        <div className="xl:col-span-7 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-4 sm:p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="font-semibold text-white text-sm">{localizedTemplate.title}</span>
            <span className="font-mono tabular-nums">
              {t('preflop.handLabel')} {spot.handKey} · {localizedTemplate.actionSummary}
            </span>
          </div>

          <PokerTableOval
            seats={tableSeats}
            board={[]}
            potBb={spot.template.potBb}
            streetLabel={t('street.preflop')}
            fourColor={prefs.fourColorDeck}
            compact
          />

          {/* Action Control Strip */}
          <div className="pt-4 border-t border-[#1B2823] flex flex-wrap items-center justify-between gap-3">
            {!evaluation ? (
              <div className="flex flex-wrap items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => handleAction('fold')}
                  className="flex-1 min-w-[110px] min-h-[44px] px-4 py-2.5 rounded-lg bg-[#16211D] hover:bg-[#20302A] border border-[#2B3E37] text-sm font-semibold text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('common.fold')} <span className="text-xs font-mono text-slate-400 ml-1">[F]</span>
                </button>
                {spot.template.scenarioType !== 'RFI' && (
                  <button
                    type="button"
                    onClick={() => handleAction('call')}
                    className="flex-1 min-w-[120px] min-h-[44px] px-4 py-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/50 text-sm font-semibold text-sky-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {translateActionText(locale, spot.template.callLabel ?? `Call ${spot.template.toCallBb}bb`)}{' '}
                    <span className="text-xs font-mono text-sky-300/80 ml-1">[C]</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAction('raise')}
                  className="flex-1 min-w-[130px] min-h-[44px] px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {translateActionText(locale, spot.template.raiseLabel)}{' '}
                  <span className="text-xs font-mono text-slate-900/75 ml-1">[R]</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <GradeBadge
                  grade={evaluation.grade}
                  metricLabel={`${t('metric.freqPrefix')} ${evaluation.chosenFreq}%`}
                />
                <button
                  type="button"
                  onClick={() => dealNext()}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{t('preflop.nextSpot')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Analytics & 13x13 GTO Matrix Deck */}
        <div className="xl:col-span-5 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-5 sm:p-6 space-y-5">
          {!evaluation ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-white">{t('preflop.preActionTitle')}</h2>
                <p className="text-xs text-slate-400">{t('preflop.preActionDesc')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#1C2A25] py-4">
                <div>
                  <span className="text-slate-400 block">{t('preflop.heroSeat')}</span>
                  <span className="font-mono font-semibold text-white text-sm">
                    {translatePositionLabel(locale, spot.template.heroPos)} (100bb)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('preflop.startingPot')}</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-300 text-sm">
                    {spot.template.potBb.toFixed(1)} bb
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('preflop.scenario')}</span>
                  <span className="font-medium text-slate-200">
                    {spot.template.scenarioType === 'RFI'
                      ? t('preflop.unopenedRfi')
                      : spot.template.scenarioType === 'FACING_OPEN'
                        ? `${t('preflop.facingOpen')} (${spot.template.villainPos})`
                        : `${t('preflop.facing3Bet')} (${spot.template.villainPos})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('preflop.handClass')}</span>
                  <span className="font-mono font-semibold text-emerald-300 text-sm">
                    {spot.handKey}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {t('preflop.preActionTip')}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">
                  {t('preflop.solverSolution')} · {spot.handKey}
                </h2>
                <GradeBadge
                  grade={evaluation.grade}
                  metricLabel={`${t('metric.freqPrefix')} ${evaluation.chosenFreq}%`}
                  size="sm"
                />
              </div>

              <SolverBars actions={evaluation.actions} chosenLabel={evaluation.chosenAction} />

              <div className="space-y-2.5 pt-2 border-t border-[#1C2A25]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">
                    {t('preflop.fullMatrix')} ({localizedTemplate.title})
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                      {t('common.raise')}
                    </span>
                    {spot.template.scenarioType !== 'RFI' && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block" />
                        {t('common.call')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#192622] inline-block" />
                      {t('common.fold')}
                    </span>
                  </div>
                </div>

                <RangeMatrix13x13
                  mode="solver"
                  matrix={spot.template.matrix}
                  heroHandKey={spot.handKey}
                  inspectedHandKey={inspectedHand}
                  onInspectHand={setInspectedHand}
                />

                {/* Inspected Cell Micro-Readout */}
                {activeInspectedCell && (
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums bg-[#0A100E] border border-[#1B2823] rounded-lg px-3 py-2">
                    <span className="font-semibold text-amber-300">
                      {t('preflop.inspecting')} {activeInspectedCell.hand}
                    </span>
                    <span className="text-slate-300">
                      {t('common.raise')} {activeInspectedCell.raise}% · {t('common.call')}{' '}
                      {activeInspectedCell.call}% · {t('common.fold')} {activeInspectedCell.fold}%
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed border-t border-[#1C2A25] pt-3">
                {localizedTemplate.strategyNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
