import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Link2, RotateCcw } from 'lucide-react';
import type { DrillAttemptRecord, UserPreferences } from '../poker/types';
import {
  evaluateHandReading,
  HAND_READING_SPOTS,
  QUICK_RANGE_PRESETS,
  type HandReadingResult,
} from '../poker/handReadingSpots';
import { expandHandCombos } from '../poker/evaluator';
import { PlayingCard } from '../components/PlayingCard';
import { RangeMatrix13x13 } from '../components/RangeMatrix13x13';
import { GradeBadge } from '../components/GradeBadge';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import { translateQuickPreset } from '../i18n/translations';
import { localizeHandReadingSpot } from '../i18n/drillContentZh';
import { copyShareUrl } from '../utils/shareLink';

interface HandReadingViewProps {
  prefs: UserPreferences;
  initialSpotId?: string;
  onRecordAttempt: (attempt: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => void;
}

export function HandReadingView({
  prefs,
  initialSpotId,
  onRecordAttempt,
}: HandReadingViewProps) {
  const { locale, t } = useLocale();
  const [spotIndex, setSpotIndex] = useState(() => {
    if (initialSpotId) {
      const idx = HAND_READING_SPOTS.findIndex((s) => s.id === initialSpotId);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const [selectedHands, setSelectedHands] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<HandReadingResult | null>(null);
  const [matrixViewMode, setMatrixViewMode] = useState<'diff' | 'solver' | 'mine'>('diff');
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!initialSpotId) return;
    const idx = HAND_READING_SPOTS.findIndex((s) => s.id === initialSpotId);
    if (idx >= 0) {
      setSpotIndex(idx);
      setSelectedHands(new Set());
      setResult(null);
      setValidationMsg(null);
      setMatrixViewMode('diff');
    }
  }, [initialSpotId]);

  const spot = HAND_READING_SPOTS[spotIndex];
  const displaySpot = localizeHandReadingSpot(locale, spot);
  const targetSet = useMemo(() => new Set(spot.targetHands), [spot]);

  const selectedComboCount = useMemo(() => {
    let total = 0;
    selectedHands.forEach((h) => {
      total += expandHandCombos(h, spot.board).length;
    });
    return total;
  }, [selectedHands, spot.board]);

  const selectSpot = (idx: number) => {
    setSpotIndex(idx);
    setSelectedHands(new Set());
    setResult(null);
    setValidationMsg(null);
    setMatrixViewMode('diff');
    playPokerSound('card', prefs.soundEnabled);
  };

  const toggleHand = (hand: string) => {
    if (result) return;
    setValidationMsg(null);
    setSelectedHands((prev) => {
      const next = new Set(prev);
      if (next.has(hand)) next.delete(hand);
      else next.add(hand);
      return next;
    });
  };

  const togglePreset = (hands: string[]) => {
    if (result) return;
    setValidationMsg(null);
    setSelectedHands((prev) => {
      const next = new Set(prev);
      const allPresent = hands.every((h) => next.has(h));
      for (const h of hands) {
        if (allPresent) next.delete(h);
        else next.add(h);
      }
      return next;
    });
  };

  const handleGrade = () => {
    if (selectedHands.size === 0) {
      setValidationMsg(t('reading.errEmpty'));
      return;
    }
    const evaluated = evaluateHandReading(spot, selectedHands);
    setResult(evaluated);
    setMatrixViewMode('diff');
    playPokerSound(
      evaluated.grade === 'Optimal' || evaluated.grade === 'Acceptable' ? 'optimal' : 'mistake',
      prefs.soundEnabled
    );
    onRecordAttempt({
      module: 'reading',
      position: spot.villainPos,
      street: spot.board.length === 3 ? 'flop' : spot.board.length === 4 ? 'turn' : 'river',
      spotLabel: spot.title,
      chosenAction: `${evaluated.selectedCombos} combos (${evaluated.overlapPct}% overlap)`,
      bestAction: `${evaluated.targetCombos} solver combos`,
      metricValue: evaluated.overlapPct,
      metricKind: 'overlap_pct',
      grade: evaluated.grade,
      accuracyScore: evaluated.overlapPct,
    });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header & Spot Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2D28] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            {t('reading.title')}
          </h1>
          <p className="text-xs text-slate-400">{t('reading.subtitle')}</p>
        </div>

        <div
          role="group"
          aria-label={t('reading.ariaScenarios')}
          className="flex flex-wrap items-center gap-1 p-1 bg-[#0E1513] border border-[#1F2D28] rounded-lg"
        >
          {HAND_READING_SPOTS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSpot(idx)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                idx === spotIndex
                  ? 'bg-[#1E2E28] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('reading.spotPrefix')} {idx + 1}: {s.villainPos}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="copy-reading-link-btn"
          onClick={async () => {
            const ok = await copyShareUrl({ view: 'reading', spot: spot.id });
            if (ok) {
              setCopiedLink(true);
              window.setTimeout(() => setCopiedLink(false), 1800);
            }
          }}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-300 hover:border-emerald-400/50 hover:text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          {copiedLink ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <Link2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          )}
          <span>{copiedLink ? t('common.linkCopied') : t('common.copySpotLink')}</span>
        </button>
      </div>

      {/* Two-Zone Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Interactive 13x13 Range Builder */}
        <div className="xl:col-span-7 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">{displaySpot.promptQuestion}</h2>
              <p className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
                {displaySpot.streetLabel} · {t('common.pot')} {spot.potBb.toFixed(1)}bb · {t('reading.selected')}:{' '}
                <span className="text-emerald-300 font-semibold">
                  {selectedComboCount} {t('reading.combos')}
                </span>
              </p>
            </div>

            {result ? (
              <div
                role="group"
                aria-label={t('reading.ariaViewMode')}
                className="flex items-center gap-1 p-1 bg-[#0A100E] border border-[#1F2D28] rounded-lg"
              >
                {(['diff', 'solver', 'mine'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMatrixViewMode(m)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                      matrixViewMode === m
                        ? 'bg-[#1E2E28] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'diff'
                      ? t('reading.diffOverlay')
                      : m === 'solver'
                        ? t('reading.solverRange')
                        : t('reading.myRange')}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedHands(new Set())}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#141E1B] border border-[#273A33] text-slate-300 hover:text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('reading.clearGrid')}</span>
              </button>
            )}
          </div>

          {/* Quick Category Selection Helpers */}
          {!result && (
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(QUICK_RANGE_PRESETS).map(([label, hands]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => togglePreset(hands)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#141E1B] hover:bg-[#1D2D27] border border-[#243630] text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  + {translateQuickPreset(locale, label)}
                </button>
              ))}
            </div>
          )}

          {/* 13x13 Matrix */}
          <RangeMatrix13x13
            mode="builder"
            selectedHands={selectedHands}
            targetHands={targetSet}
            showDiff={Boolean(result)}
            viewMode={matrixViewMode}
            onToggleHand={toggleHand}
            disabled={Boolean(result)}
          />

          {/* Legend & Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1C2A25]">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              {!result ? (
                <span>{t('reading.gridHint')}</span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                    {t('reading.matched')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
                    {t('reading.missed')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                    {t('reading.overIncluded')}
                  </span>
                </>
              )}
            </div>

            {!result ? (
              <button
                type="button"
                onClick={handleGrade}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>{t('reading.gradeRange')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => selectSpot((spotIndex + 1) % HAND_READING_SPOTS.length)}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{t('reading.nextSpot')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {validationMsg && (
            <p role="alert" className="text-xs text-rose-400">
              {validationMsg}
            </p>
          )}
        </div>

        {/* Right Multi-Street Storyline & Range Audit */}
        <div className="xl:col-span-5 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-5 sm:p-6 space-y-5">
          {/* Board Strip */}
          <div className="felt-surface rounded-xl border border-emerald-400/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-emerald-200/80">
              <span>{t('reading.boardRunout')}</span>
              <span>
                {t('common.villain')}: {spot.villainPos}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {spot.board.map((c, idx) => (
                <PlayingCard
                  key={`${c.rank}${c.suit}-${idx}`}
                  card={c}
                  fourColor={prefs.fourColorDeck}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* Action Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">{t('reading.timelineTitle')}</h3>
            <div className="space-y-2.5">
              {displaySpot.timeline.map((step, i) => (
                <div
                  key={i}
                  className="bg-[#0A100E] border border-[#1B2823] rounded-lg p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-emerald-400 shrink-0">{step.street}</span>
                    <span className="text-slate-200 font-medium text-right">{step.detail}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.narrowingHint}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Post-Submission Range Overlap Analysis */}
          {result && (
            <div className="border-t border-[#1C2A25] pt-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{t('reading.auditTitle')}</h3>
                <GradeBadge
                  grade={result.grade}
                  metricLabel={`${result.overlapPct}${t('metric.overlapSuffix')}`}
                  size="sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-xs">
                <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg p-3">
                  <span className="text-slate-400 font-sans block">{t('reading.overlap')}</span>
                  <span className="text-lg font-semibold text-emerald-400">
                    {result.overlapPct}%
                  </span>
                </div>
                <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg p-3">
                  <span className="text-slate-400 font-sans block">{t('reading.precision')}</span>
                  <span className="text-lg font-semibold text-sky-400 block">
                    {result.precisionPct}%
                  </span>
                  <span className="text-[11px] font-sans text-slate-400 leading-snug block mt-1">
                    {t('reading.precisionDesc')}
                  </span>
                </div>
                <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg p-3">
                  <span className="text-slate-400 font-sans block">{t('reading.recall')}</span>
                  <span className="text-lg font-semibold text-amber-300 block">
                    {result.recallPct}%
                  </span>
                  <span className="text-[11px] font-sans text-slate-400 leading-snug block mt-1">
                    {t('reading.recallDesc')}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{displaySpot.explanation}</p>

              <div className="bg-[#0C1814] border border-emerald-500/25 rounded-lg p-3 text-xs text-slate-200">
                {displaySpot.keyCombosNote}
              </div>

              {result.missedHands.length > 0 && (
                <div className="text-xs text-slate-400">
                  <span className="text-sky-400 font-medium">{t('reading.missedCombos')} </span>
                  <span className="font-mono">{result.missedHands.slice(0, 12).join(', ')}</span>
                </div>
              )}
              {result.extraHands.length > 0 && (
                <div className="text-xs text-slate-400">
                  <span className="text-rose-400 font-medium">{t('reading.extraCombos')} </span>
                  <span className="font-mono">{result.extraHands.slice(0, 12).join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
