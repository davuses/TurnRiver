import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  History,
  Play,
  X,
} from 'lucide-react';
import type { TablePhase } from '../../poker/tableEngine';
import { useLocale } from '../../i18n/LocaleContext';
import { translateStreetLabel } from '../../i18n/translations';

export interface ReplayConsoleProps {
  handNumber: number;
  stepIndex: number;
  totalSteps: number;
  latestLine: string;
  currentPhase: TablePhase;
  availableStreets: { phase: TablePhase; index: number }[];
  onPrev: () => void;
  onNext: () => void;
  onJumpTo: (index: number) => void;
  onFlashback: () => void;
  onCopyHand: () => void;
  onDownloadHand: () => void;
  onExit: () => void;
}

export function ReplayConsole({
  handNumber,
  stepIndex,
  totalSteps,
  latestLine,
  currentPhase,
  availableStreets,
  onPrev,
  onNext,
  onJumpTo,
  onFlashback,
  onCopyHand,
  onDownloadHand,
  onExit,
}: ReplayConsoleProps) {
  const { locale, t } = useLocale();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    onCopyHand();
    setCopied(true);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 1800);
  };

  const handLabel =
    locale === 'zh-CN'
      ? `${t('table.hand')} ${handNumber} 手`
      : `${t('table.hand')} #${handNumber}`;

  return (
    <div data-testid="replay-controls" className="space-y-3">
      {/* Header + Flashback / Export / Exit Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
          <History className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">
            {t('arena.replayMode')} · {handLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="replay-flashback"
            onClick={onFlashback}
            className="min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('arena.flashbackBtn')}</span>
          </button>

          <button
            type="button"
            data-testid="replay-copy-hand"
            onClick={handleCopy}
            className={`min-h-[34px] px-2.5 py-1.5 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              copied
                ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                : 'bg-[#141E1B] hover:bg-[#1F2F29] border-[#283B34] text-slate-200'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{copied ? t('arena.copied') : t('arena.copyHand')}</span>
          </button>

          <button
            type="button"
            data-testid="replay-download-hand"
            onClick={onDownloadHand}
            className="min-h-[34px] px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#283B34] text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('arena.downloadHand')}</span>
          </button>

          <button
            type="button"
            data-testid="replay-exit"
            onClick={onExit}
            className="min-h-[34px] px-3 py-1.5 text-xs font-medium rounded-lg bg-[#16211D] hover:bg-[#22332D] border border-[#2B3E37] text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('arena.replayExit')}</span>
          </button>
        </div>
      </div>

      {/* Step Controls & Street Jump Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="replay-prev"
          onClick={onPrev}
          disabled={stepIndex <= 0}
          className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#283B34] text-slate-200 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('arena.replayPrev')}</span>
        </button>

        <span
          data-testid="replay-step-counter"
          className="px-1.5 font-mono tabular-nums text-xs text-slate-200 whitespace-nowrap"
        >
          {t('arena.replayStep')} {Math.min(stepIndex + 1, Math.max(1, totalSteps))} / {totalSteps}
        </span>

        <button
          type="button"
          data-testid="replay-next"
          onClick={onNext}
          disabled={stepIndex >= totalSteps - 1}
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
          {availableStreets.map(({ phase, index }) => {
            const active = currentPhase === phase;
            return (
              <button
                key={phase}
                type="button"
                data-testid={`replay-jump-${phase.toLowerCase()}`}
                aria-pressed={active}
                onClick={() => onJumpTo(index)}
                className={`px-2.5 py-1.5 text-xs font-mono rounded border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 font-semibold'
                    : 'bg-[#141E1B] hover:bg-[#1F2F29] border-[#273A33] text-slate-300'
                }`}
              >
                {translateStreetLabel(locale, phase)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Latest Action Narrative */}
      <p className="text-xs text-slate-300 min-h-[16px] leading-relaxed">{latestLine}</p>
    </div>
  );
}
