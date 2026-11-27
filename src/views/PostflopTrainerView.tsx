import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  GitCompareArrows,
  Link2,
  Palette,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  DecisionEvaluation,
  DrillAttemptRecord,
  Position,
  Street,
  UserPreferences,
} from '../poker/types';
import {
  evaluatePostflopDecision,
  generatePostflopSpot,
  generatePostflopSpotById,
  PAIRED_RIVER_OVERBET_ID,
  PAIRED_RIVER_SMALL_ID,
  type DecisiveDetailKey,
  type PostflopDrillSpot,
  type PotType,
} from '../poker/postflopSpots';
import { PokerTableOval, type TableSeatDisplay } from '../components/PokerTableOval';
import { GradeBadge } from '../components/GradeBadge';
import { SolverBars } from '../components/SolverBars';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import {
  translateActionText,
  translateStreetLabel,
  type TranslationKey,
} from '../i18n/translations';
import { localizePostflopSpot } from '../i18n/drillContentZh';
import { copyShareUrl } from '../utils/shareLink';

interface PostflopTrainerViewProps {
  prefs: UserPreferences;
  initialSpotId?: string;
  onUpdatePrefs: (patch: Partial<UserPreferences>) => void;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
  onSpotEvaluated?: (spotId: string) => void;
}

const SEAT_ORDER: Position[] = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];

const DECISIVE_DETAIL_OPTIONS: { key: DecisiveDetailKey; labelKey: TranslationKey }[] = [
  { key: 'bet_size_pot_odds', labelKey: 'postflop.detail.bet_size_pot_odds' },
  { key: 'board_range_advantage', labelKey: 'postflop.detail.board_range_advantage' },
  { key: 'blockers_showdown', labelKey: 'postflop.detail.blockers_showdown' },
  { key: 'draws_implied_odds', labelKey: 'postflop.detail.draws_implied_odds' },
];

export function PostflopTrainerView({
  prefs,
  initialSpotId,
  onUpdatePrefs,
  onRecordAttempt,
  onSpotEvaluated,
}: PostflopTrainerViewProps) {
  const { locale, t } = useLocale();
  const [streetFilter, setStreetFilter] = useState<Exclude<Street, 'preflop'> | 'ALL'>('ALL');
  const [potFilter, setPotFilter] = useState<PotType | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'IP' | 'OOP'>('ALL');
  const [copiedLink, setCopiedLink] = useState(false);

  const [spot, setSpot] = useState<PostflopDrillSpot>(() => {
    if (initialSpotId) {
      const matched = generatePostflopSpotById(initialSpotId, { preserveSuits: true });
      if (matched) return matched;
    }
    return generatePostflopSpot('ALL', 'ALL', 'ALL');
  });
  const [evaluation, setEvaluation] = useState<DecisionEvaluation | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<DecisiveDetailKey | null>(null);
  const [detailNote, setDetailNote] = useState<string>('');
  const [detailError, setDetailError] = useState<boolean>(false);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  const resetDecisionInputs = useCallback(() => {
    setEvaluation(null);
    setSelectedDetail(null);
    setDetailNote('');
    setDetailError(false);
    setCopiedLink(false);
  }, []);

  useEffect(() => {
    if (!initialSpotId) return;
    const matched = generatePostflopSpotById(initialSpotId, { preserveSuits: true });
    if (matched) {
      setSpot(matched);
      resetDecisionInputs();
    }
  }, [initialSpotId, resetDecisionInputs]);

  const handleCopySpotLink = async () => {
    const ok = await copyShareUrl({ view: 'postflop', spot: spot.id });
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  const dealNext = useCallback(
    (
      nextStreet = streetFilter,
      nextPot = potFilter,
      nextRole = roleFilter,
      prevId = spot.id
    ) => {
      const next = generatePostflopSpot(nextStreet, nextPot, nextRole, prevId);
      setSpot(next);
      resetDecisionInputs();
      playPokerSound('card', prefs.soundEnabled);
    },
    [streetFilter, potFilter, roleFilter, spot.id, prefs.soundEnabled, resetDecisionInputs]
  );

  const loadSpotById = useCallback(
    (spotId: string, preserveSuits = true) => {
      const next = generatePostflopSpotById(spotId, { preserveSuits });
      if (!next) return;
      setSpot(next);
      resetDecisionInputs();
      playPokerSound('card', prefs.soundEnabled);
    },
    [prefs.soundEnabled, resetDecisionInputs]
  );

  const handleChoose = (actionKey: string) => {
    if (evaluation) return;
    if (!selectedDetail) {
      setDetailError(true);
      return;
    }
    setDetailError(false);
    const res = evaluatePostflopDecision(spot, actionKey);
    setEvaluation(res);
    playPokerSound(
      res.grade === 'Optimal' || res.grade === 'Acceptable' ? 'optimal' : 'mistake',
      prefs.soundEnabled
    );
    onRecordAttempt({
      module: 'postflop',
      position: spot.heroPos,
      street: spot.street,
      spotLabel: spot.title,
      chosenAction: res.chosenAction,
      bestAction: res.bestAction,
      metricValue: res.chosenFreq,
      metricKind: 'freq_pct',
      grade: res.grade,
      accuracyScore: res.accuracyScore,
    });
    onSpotEvaluated?.(spot.id);
  };

  const heroIdx = SEAT_ORDER.indexOf(spot.heroPos);
  const seats: TableSeatDisplay[] = Array.from({ length: 6 }, (_, i) => {
    const pos = SEAT_ORDER[(heroIdx + i) % 6];
    const isHero = i === 0;
    const isVillain = pos === spot.villainPos;
    return {
      seatIndex: i,
      position: pos,
      label: isHero
        ? t('common.hero')
        : isVillain
          ? t('common.villain')
          : `${t('common.seat')} ${i + 1}`,
      stackBb: isHero || isVillain ? spot.effectiveStackBb : 100,
      isHero,
      isVillain,
      isDealer: pos === 'BTN',
      isActiveTurn: isHero && !evaluation,
      folded: !isHero && !isVillain,
      actionText:
        isVillain && spot.toCallBb > 0
          ? `Bets ${spot.toCallBb}bb`
          : isVillain
            ? 'Checks'
            : '',
      cards: isHero
        ? spot.heroCards
        : isVillain
          ? [spot.heroCards[0], spot.heroCards[1]]
          : null,
      revealCards: isHero,
    };
  });

  const spr = (spot.effectiveStackBb / Math.max(1, spot.potBb)).toFixed(1);
  const displaySpot = localizePostflopSpot(locale, spot);
  const lastActionLine =
    displaySpot.actionLog[displaySpot.actionLog.length - 1] ?? '';
  const isPairedSpot = Boolean(spot.pairedSpotId);
  const detailMatched = selectedDetail === spot.decisiveDetail;

  const detailLabel = (key: DecisiveDetailKey) =>
    t(`postflop.detail.${key}` as TranslationKey);

  return (
    <div className="space-y-3 sm:space-y-5 pb-10">
      {/* Toolbar (compact 1-row quick controls on mobile; full filter bar on desktop) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 border-b border-[#1F2D28] pb-3 sm:pb-4">
        <div className="space-y-0.5">
          <h1 className="text-lg sm:text-2xl font-semibold text-white">
            {t('postflop.title')}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400">{t('postflop.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
          {/* Direct entry to the Paired River Bet-Size Exercise */}
          <button
            type="button"
            data-testid="paired-bet-size-btn"
            onClick={() => loadSpotById(PAIRED_RIVER_SMALL_ID, true)}
            className={`min-h-[38px] sm:min-h-0 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              isPairedSpot
                ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300'
                : 'bg-[#121D19] border-[#283B34] text-emerald-300 hover:bg-[#1C2B40]'
            }`}
          >
            <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('postflop.pairedDrillBtn')}</span>
          </button>

          <button
            type="button"
            data-testid="copy-postflop-link-btn"
            onClick={handleCopySpotLink}
            className="min-h-[38px] sm:min-h-0 px-2.5 py-1.5 sm:py-2 text-xs font-medium rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-300 hover:border-emerald-400/50 hover:text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Link2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            )}
            <span>{copiedLink ? t('common.linkCopied') : t('common.copySpotLink')}</span>
          </button>

          {/* Mobile-only collapsible filter toggle (saves vertical height on <640px so table & buttons stay close) */}
          <button
            type="button"
            onClick={() => setShowMobileFilters((v) => !v)}
            aria-expanded={showMobileFilters}
            className={`sm:hidden min-h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              showMobileFilters
                ? 'bg-[#182621] border-emerald-400/50 text-emerald-200'
                : 'bg-[#0E1513] border-[#1F2D28] text-slate-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('postflop.filters')}</span>
          </button>

          {/* Sound toggle stays accessible alongside mobile quick controls */}
          <button
            type="button"
            onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
            aria-label={prefs.soundEnabled ? t('common.muteSound') : t('common.enableSound')}
            className="sm:hidden min-h-[38px] min-w-[38px] p-2 rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-300 hover:text-white inline-flex items-center justify-center cursor-pointer"
          >
            {prefs.soundEnabled ? (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" aria-hidden="true" />
            )}
          </button>

          {/* Street / Pot / Position / Deck Filters */}
          <div
            className={`${
              showMobileFilters ? 'flex' : 'hidden'
            } sm:flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto pt-1 sm:pt-0`}
          >
            {/* Street Segmented Filter */}
            <div
              role="group"
              aria-label={t('postflop.ariaStreetFilter')}
              className="flex items-center gap-1 p-1 bg-[#0E1513] border border-[#1F2D28] rounded-lg"
            >
              {(['ALL', 'flop', 'turn', 'river'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStreetFilter(st);
                    dealNext(st, potFilter, roleFilter);
                  }}
                  className={`min-h-[38px] sm:min-h-0 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    streetFilter === st
                      ? 'bg-[#1E2E28] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st === 'ALL' ? t('postflop.allStreets') : translateStreetLabel(locale, st)}
                </button>
              ))}
            </div>

            <select
              aria-label={t('postflop.ariaPotFilter')}
              value={potFilter}
              onChange={(e) => {
                const v = e.target.value as PotType | 'ALL';
                setPotFilter(v);
                dealNext(streetFilter, v, roleFilter);
              }}
              className="min-h-[38px] sm:min-h-0 bg-[#0E1513] border border-[#1F2D28] rounded-lg px-2.5 py-2 text-xs text-slate-200 cursor-pointer"
            >
              <option value="ALL">{t('postflop.allPots')}</option>
              <option value="SRP">{t('postflop.srp')}</option>
              <option value="3BP">{t('postflop.3bp')}</option>
            </select>

            <select
              aria-label={t('postflop.ariaRoleFilter')}
              value={roleFilter}
              onChange={(e) => {
                const v = e.target.value as 'ALL' | 'IP' | 'OOP';
                setRoleFilter(v);
                dealNext(streetFilter, potFilter, v);
              }}
              className="min-h-[38px] sm:min-h-0 bg-[#0E1513] border border-[#1F2D28] rounded-lg px-2.5 py-2 text-xs text-slate-200 cursor-pointer"
            >
              <option value="ALL">{t('postflop.allRoles')}</option>
              <option value="IP">{t('postflop.ip')}</option>
              <option value="OOP">{t('postflop.oop')}</option>
            </select>

            <button
              type="button"
              onClick={() => onUpdatePrefs({ fourColorDeck: !prefs.fourColorDeck })}
              className={`min-h-[38px] sm:min-h-0 px-2.5 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                prefs.fourColorDeck
                  ? 'bg-[#172634] border-sky-500/40 text-sky-300'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-400'
              }`}
            >
              <Palette className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {prefs.fourColorDeck ? t('common.fourColorShort') : t('common.twoColorShort')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
              aria-label={prefs.soundEnabled ? t('common.muteSound') : t('common.enableSound')}
              className="hidden sm:inline-flex p-2 rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-300 hover:text-white cursor-pointer"
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

      {/* Two-Zone Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left Live Felt Stage */}
        <div className="xl:col-span-7 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-3 sm:p-5 flex flex-col justify-between gap-2.5 sm:gap-4">
          {/* Neutral Title Before Answer; Full Lesson Title Revealed Only After Answering */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-slate-400">
              <span
                data-testid="postflop-spot-title"
                className="text-sm font-semibold text-white leading-snug"
              >
                {evaluation ? displaySpot.title : displaySpot.neutralTitle}
              </span>
              <span className="font-mono tabular-nums text-[11px]">
                {spot.potType === 'SRP'
                  ? locale === 'zh-CN'
                    ? '单次加注底池 (SRP)'
                    : 'SRP'
                  : locale === 'zh-CN'
                    ? '3-Bet 底池'
                    : '3BP'}{' '}
                · {spot.heroPos} vs {spot.villainPos} ·{' '}
                {spot.heroInPosition ? t('postflop.ipShort') : t('postflop.oopShort')}
              </span>
            </div>

            {isPairedSpot && (
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] bg-[#0D1A18] border border-emerald-500/30 rounded-lg px-2.5 py-1 text-emerald-200">
                <span className="font-semibold text-emerald-300">
                  {t('postflop.pairedBadge')}
                </span>
                <span className="text-slate-300">{t('postflop.pairedHint')}</span>
              </div>
            )}
          </div>

          <PokerTableOval
            seats={seats}
            board={spot.board}
            potBb={spot.potBb}
            streetLabel={translateStreetLabel(locale, spot.street)}
            sprLabel={`SPR ${spr}`}
            fourColor={prefs.fourColorDeck}
            mobileTight
          />

          {/* Compact Last-Action Strip right below board & Hero hand (keeps board + last action + buttons tight on mobile) */}
          <div
            data-testid="postflop-last-action"
            className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-[#0A100E] border border-[#20312B] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="font-mono font-semibold text-amber-300 shrink-0">
                {t('postflop.lastAction')}
              </span>
              <span className="text-slate-200 font-mono leading-snug">{lastActionLine}</span>
            </div>
            <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
              {t('common.pot')} {spot.potBb.toFixed(1)}bb
              {spot.toCallBb > 0 ? ` · ${t('common.call')} ${spot.toCallBb.toFixed(1)}bb` : ''}
            </span>
          </div>

          {/* Decisive Detail + Decision Buttons */}
          <div className="pt-2 sm:pt-3 border-t border-[#1B2823] space-y-2.5">
            {!evaluation ? (
              <>
                {/* Step 1: Identify the Decisive Detail */}
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-xs font-medium text-slate-200">
                    {t('postflop.detailPrompt')}
                  </p>
                  <div
                    role="group"
                    aria-label={t('postflop.detailPrompt')}
                    className="grid grid-cols-2 gap-1.5 sm:gap-2"
                  >
                    {DECISIVE_DETAIL_OPTIONS.map((opt) => {
                      const active = selectedDetail === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          data-testid={`detail-chip-${opt.key}`}
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedDetail(opt.key);
                            setDetailError(false);
                          }}
                          className={`min-h-[38px] sm:min-h-0 px-2.5 py-1.5 sm:py-2 rounded-lg border text-left text-xs font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                              : 'bg-[#0A100E] border-[#21322C] text-slate-300 hover:border-[#324A41] hover:text-white'
                          }`}
                        >
                          {t(opt.labelKey)}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={detailNote}
                    onChange={(e) => setDetailNote(e.target.value)}
                    placeholder={t('postflop.detailReasonPlaceholder')}
                    maxLength={120}
                    className="w-full bg-[#0A100E] border border-[#1F2F29] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />

                  {detailError && (
                    <p
                      role="alert"
                      data-testid="postflop-detail-error"
                      className="text-xs text-amber-300"
                    >
                      {t('postflop.detailRequired')}
                    </p>
                  )}
                </div>

                {/* Step 2: Choose Action */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {spot.actions.map((act) => {
                    const style =
                      act.kind === 'bet' || act.kind === 'raise'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : act.kind === 'call'
                          ? 'bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-200'
                          : act.kind === 'check'
                            ? 'bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/45 text-amber-200'
                            : 'bg-[#16211D] hover:bg-[#20302A] border border-[#2B3E37] text-slate-200';
                    return (
                      <button
                        key={act.action}
                        type="button"
                        data-testid={`postflop-action-${act.action}`}
                        onClick={() => handleChoose(act.action)}
                        className={`flex-1 min-w-[110px] min-h-[44px] px-3 sm:px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${style}`}
                      >
                        {translateActionText(locale, act.label)}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <GradeBadge
                  grade={evaluation.grade}
                  metricLabel={`${t('metric.freqPrefix')} ${evaluation.chosenFreq}%`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {spot.pairedSpotId && (
                    <button
                      type="button"
                      data-testid="paired-switch-btn"
                      onClick={() => loadSpotById(spot.pairedSpotId!, true)}
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-[#152436] hover:bg-[#1C3047] border border-sky-400/50 text-xs sm:text-sm font-semibold text-sky-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <GitCompareArrows className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        {spot.pairedSpotId === PAIRED_RIVER_OVERBET_ID
                          ? t('postflop.pairedSwitchToOverbet')
                          : t('postflop.pairedSwitchToSmall')}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => dealNext()}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>{t('postflop.nextSpot')}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Analytics & Coaching Deck */}
        <div className="xl:col-span-5 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-4 sm:p-6 space-y-5">
          {/* Action History Trail */}
          <div className="space-y-2.5">
            <h2 className="text-sm font-semibold text-white">{t('postflop.actionHistory')}</h2>
            <ol className="space-y-1.5 text-xs text-slate-300 font-mono">
              {displaySpot.actionLog.map((line, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 bg-[#0A100E] border border-[#1B2823] rounded-md px-3 py-2"
                >
                  <span className="text-slate-500 tabular-nums">{idx + 1}.</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>

          {!evaluation ? (
            <div className="border-t border-[#1C2A25] pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">{t('postflop.checklistTitle')}</h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <li>{t('postflop.check1')}</li>
                <li>{t('postflop.check2')}</li>
                <li>
                  {locale === 'zh-CN'
                    ? `${t('postflop.check3Prefix')} ${spr}${t('postflop.check3Suffix')}`
                    : `${t('postflop.check3Prefix')} ${spr} ${t('postflop.check3Suffix')}`}
                </li>
              </ul>
            </div>
          ) : (
            <div className="border-t border-[#1C2A25] pt-5 space-y-5">
              {/* Decisive Detail & Hand Numbers Review */}
              <div
                data-testid="postflop-numbers-card"
                className="bg-[#0B141A] border border-sky-500/30 rounded-lg p-3.5 space-y-2.5 text-xs leading-relaxed"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sky-300">
                    {t('postflop.detailReviewTitle')}
                  </h3>
                  {detailMatched && (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t('postflop.detailMatch')}</span>
                    </span>
                  )}
                </div>

                {!detailMatched && selectedDetail && (
                  <p className="text-slate-300">
                    <span className="text-slate-400">{t('postflop.detailDiffPrefix')} </span>
                    <span className="text-amber-300">{detailLabel(selectedDetail)}</span>
                    <span className="text-slate-500 mx-1.5">·</span>
                    <span className="text-slate-400">{t('postflop.detailTargetPrefix')} </span>
                    <span className="text-emerald-300 font-medium">
                      {detailLabel(spot.decisiveDetail)}
                    </span>
                  </p>
                )}

                {detailNote.trim() && (
                  <p className="text-slate-400">
                    <span>{t('postflop.yourNoteLabel')} </span>
                    <span className="text-slate-200">{detailNote.trim()}</span>
                  </p>
                )}

                <div className="border-t border-[#1D2B38] pt-2">
                  <span className="font-semibold text-slate-200 block mb-0.5">
                    {t('postflop.numbersLabel')}
                  </span>
                  <p className="text-slate-300">{displaySpot.numbersBreakdown}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{t('postflop.solverTitle')}</h3>
                  <GradeBadge
                    grade={evaluation.grade}
                    metricLabel={`${t('metric.freqPrefix')} ${evaluation.chosenFreq}%`}
                    size="sm"
                  />
                </div>

                <SolverBars actions={evaluation.actions} chosenLabel={evaluation.chosenAction} />

                <p className="text-[11px] text-slate-500 leading-snug">
                  {t('postflop.referenceNote')}
                </p>
              </div>

              <div className="border-t border-[#1C2A25] pt-4 space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-semibold text-slate-200 block">
                    {t('postflop.boardTexture')}
                  </span>
                  <span className="text-slate-400">{displaySpot.takeaways.boardTexture}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-200 block">
                    {t('postflop.rangeAdvantage')}
                  </span>
                  <span className="text-slate-400">{displaySpot.takeaways.rangeAdvantage}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-200 block">
                    {t('postflop.blockerEffect')}
                  </span>
                  <span className="text-slate-400">{displaySpot.takeaways.blockerNote}</span>
                </div>
                <div className="bg-[#0C1814] border border-emerald-500/25 rounded-lg p-3">
                  <span className="font-semibold text-emerald-300 block mb-0.5">
                    {t('postflop.coreRule')}
                  </span>
                  <span className="text-slate-200">{displaySpot.takeaways.coreRule}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
