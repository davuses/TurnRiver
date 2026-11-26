import { useState } from 'react';
import { ArrowRight, BookOpen, CalendarCheck2, CheckCircle2, Play } from 'lucide-react';
import type { DrillAttemptRecord, DrillModule, MasterySummary } from '../poker/types';
import { FUNDAMENTALS_LESSONS } from '../poker/fundamentalsLessons';
import type { DailySlotKind, DailyThreePlan } from '../poker/dailyChallenge';
import { useFundamentalsStore } from '../store/useFundamentalsStore';
import { useLocale } from '../i18n/LocaleContext';
import type { TranslationKey } from '../i18n/translations';
import heroStudioImg from '../assets/images/hero_studio_table.webp';

interface OverviewViewProps {
  summary: MasterySummary;
  attempts: DrillAttemptRecord[];
  dailyPlan: DailyThreePlan;
  dailyCompleted: DailySlotKind[];
  onNavigate: (view: 'learn' | DrillModule | 'leaks') => void;
  onLaunchRookieTable: () => void;
  onLaunchDailySlot: (slot: DailySlotKind) => void;
}

const CORE_DRILLS: {
  id: Exclude<DrillModule, 'table'>;
  titleKey: TranslationKey;
  metaKey: TranslationKey;
  descKey: TranslationKey;
  ctaKey: TranslationKey;
}[] = [
  {
    id: 'preflop',
    titleKey: 'overview.mod.preflop.title',
    metaKey: 'overview.mod.preflop.meta',
    descKey: 'overview.mod.preflop.desc',
    ctaKey: 'overview.mod.preflop.cta',
  },
  {
    id: 'postflop',
    titleKey: 'overview.mod.postflop.title',
    metaKey: 'overview.mod.postflop.meta',
    descKey: 'overview.mod.postflop.desc',
    ctaKey: 'overview.mod.postflop.cta',
  },
  {
    id: 'math',
    titleKey: 'overview.mod.math.title',
    metaKey: 'overview.mod.math.meta',
    descKey: 'overview.mod.math.desc',
    ctaKey: 'overview.mod.math.cta',
  },
  {
    id: 'reading',
    titleKey: 'overview.mod.reading.title',
    metaKey: 'overview.mod.reading.meta',
    descKey: 'overview.mod.reading.desc',
    ctaKey: 'overview.mod.reading.cta',
  },
];

export function OverviewView({
  summary,
  attempts,
  dailyPlan,
  dailyCompleted,
  onNavigate,
  onLaunchRookieTable,
  onLaunchDailySlot,
}: OverviewViewProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const { t } = useLocale();
  const fundamentals = useFundamentalsStore();

  const optimalRate =
    summary.totalDecisions > 0
      ? Math.round((summary.optimalCount / summary.totalDecisions) * 100)
      : 0;
  const avgScore =
    summary.totalDecisions > 0
      ? Math.round((summary.totalAccuracyScore ?? 0) / summary.totalDecisions)
      : 0;

  const countByModule = (mod: DrillModule) =>
    attempts.filter((a) => a.module === mod).length;

  const formatLoggedCount = (mod: DrillModule) => {
    const completed = countByModule(mod);
    const unit =
      mod === 'math' || mod === 'reading'
        ? completed === 1
          ? t('overview.unitProblemSingular')
          : t('overview.unitProblemPlural')
        : completed === 1
          ? t('overview.unitDecisionSingular')
          : t('overview.unitDecisionPlural');
    return `${completed} ${unit}`;
  };

  return (
    <div className="pb-20">
      {/* Full-Bleed Living-Canvas Hero bleeding cleanly to y=0 behind the borderless top bar */}
      <section className="relative -mt-[110px] lg:-mt-16 min-h-[78vh] sm:min-h-[84vh] flex items-end overflow-hidden bg-[#06120E]">
        {!imgFailed ? (
          <img
            src={heroStudioImg}
            alt={t('overview.heroImgAlt')}
            width={1376}
            height={768}
            fetchPriority="high"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-center scale-[1.01]"
          />
        ) : (
          <div className="absolute inset-0 felt-surface" aria-hidden="true" />
        )}

        {/* Directional atmospheric clearing: keeps felt & chips rich on the right while giving high-contrast legibility to lower-left display type */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070B0A] via-[#070B0A]/62 to-[#070B0A]/30"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070B0A]/92 via-[#070B0A]/45 to-transparent"
        />

        <div className="relative z-10 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-14 sm:pb-20">
          <div className="max-w-3xl space-y-6">
            <h1 className="font-display text-[clamp(2.4rem,5.6vw,4.6rem)] font-bold tracking-[-0.035em] text-[#F2F4F1] leading-[1.03]">
              {t('overview.heroTitle')}
            </h1>

            <p className="text-[15px] sm:text-base text-[#C7D3CD] leading-relaxed max-w-[54ch]">
              {t('overview.heroDesc')}
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('preflop')}
                className="px-6 py-3.5 text-[15px] font-semibold rounded-lg bg-emerald-500 text-[#04110C] hover:bg-emerald-400 transition-colors duration-200 ease-out inline-flex items-center gap-2.5 cursor-pointer whitespace-nowrap shadow-[0_10px_30px_rgba(16,185,129,0.24)]"
              >
                <span>{t('overview.ctaPreflop')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Below-the-Fold Studio Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-16 pt-12 sm:pt-16">
        {/* Live Interactive Tables — Asymmetric Featured Stage */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2D28] pb-4">
            <h2 className="text-2xl sm:text-[28px] font-semibold text-[#F2F4F1]">
              {t('overview.curriculumValue')}
            </h2>
            <p className="text-[13px] text-[#99A8A1]">{t('overview.drillsSub')}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Flagship 3D Multi-Bot Arena Stage */}
            <button
              type="button"
              onClick={() => onNavigate('table')}
              className="group lg:col-span-8 text-left rounded-xl p-7 sm:p-9 flex flex-col justify-between gap-8 transition-[border-color,background-color] duration-200 ease-out cursor-pointer border felt-surface border-emerald-400/25 hover:border-emerald-400/55"
            >
              <div className="space-y-4">
                <p className="text-[13px] font-medium text-[#E5B95C]">
                  {t('overview.mod.table.meta')}
                </p>
                <h3 className="text-2xl sm:text-[26px] font-semibold text-[#F2F4F1] tracking-[-0.015em]">
                  {t('overview.mod.table.title')}
                </h3>
                <p className="text-[15px] text-[#C2CFC8] leading-relaxed max-w-[60ch]">
                  {t('overview.mod.table.desc')}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-[#081410]/80 text-emerald-200 border border-emerald-400/25">
                    {t('table.view3D')}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-[#081410]/80 text-[#E5B95C] border border-[#E5B95C]/25">
                    {t('arena.unitBb')} / {t('arena.unitUsd')}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-[#081410]/80 text-[#D8E2DD] border border-white/15">
                    {t('arena.tabReplay')} · {t('arena.flashbackBtn')}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-[#081410]/80 text-[#D8E2DD] border border-white/15">
                    {t('arena.bankrollLabel')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-[13px] tabular-nums text-[#99A8A1]">
                  {formatLoggedCount('table')}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-emerald-300 group-hover:text-emerald-200 transition-colors duration-200 ease-out">
                  <span>{t('overview.mod.table.cta')}</span>
                  <ArrowRight
                    className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </button>

            {/* Leak Tracker & Mastery Companion Card */}
            <button
              type="button"
              onClick={() => onNavigate('leaks')}
              className="group lg:col-span-4 text-left rounded-xl p-7 sm:p-8 flex flex-col justify-between gap-8 transition-[border-color,background-color] duration-200 ease-out cursor-pointer border bg-[#0E1513] border-[#1F2D28] hover:border-[#344A42] hover:bg-[#111A17]"
            >
              <div className="space-y-3">
                <p className="text-[13px] font-medium text-emerald-400">
                  {t('overview.leaksCardMeta')}
                </p>
                <h3 className="text-xl sm:text-2xl font-semibold text-[#F2F4F1]">
                  {t('overview.leaksCardTitle')}
                </h3>
                <p className="text-[15px] text-[#C2CFC8] leading-relaxed">
                  {t('overview.leaksCardDesc')}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-[13px] tabular-nums text-[#99A8A1]">
                  {summary.totalDecisions > 0
                    ? `${optimalRate}% · ${avgScore} / 100`
                    : `${summary.totalDecisions} ${t('overview.unitDecisionPlural')}`}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-emerald-300 group-hover:text-emerald-200 transition-colors duration-200 ease-out">
                  <span>{t('overview.leaksCardCta')}</span>
                  <ArrowRight
                    className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </button>
          </div>
        </section>

        {/* Optional Fundamentals Track On-Ramp */}
        <section className="rounded-xl bg-[#0E1513] border border-[#1F2D28] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <BookOpen className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-semibold text-[#F2F4F1]">
                  {t('overview.learnTitle')}
                </h2>
                <span className="text-xs tabular-nums text-emerald-300">
                  {fundamentals.completedCount} / {FUNDAMENTALS_LESSONS.length} {t('learn.progress')}
                </span>
              </div>
              <p className="text-sm text-[#99A8A1] leading-relaxed">
                {t('overview.learnDesc')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onLaunchRookieTable}
              data-testid="overview-rookie-table-btn"
              className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/45 inline-flex items-center gap-1.5 transition-colors duration-200 ease-out cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('learn.rookieTableCta')}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('learn')}
              className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#141E1B] hover:bg-emerald-500 text-[#F2F4F1] hover:text-[#04110C] border border-[#273A33] hover:border-emerald-400 inline-flex items-center gap-2 transition-colors duration-200 ease-out cursor-pointer whitespace-nowrap"
            >
              <span>{t('overview.learnCta')}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* UTC-Seeded Daily Three Workout (Zero Streak Punishment) */}
        <section
          data-testid="daily-three-card"
          className="rounded-xl bg-[#0E1513] border border-[#1F2D28] p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <CalendarCheck2 className="w-5 h-5 text-[#E5B95C]" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-[#F2F4F1]">
                  {t('daily.title')}{' '}
                  <span className="text-xs font-mono font-normal text-slate-400 ml-1">
                    {dailyPlan.dateKey}
                  </span>
                </h2>
                <p className="text-xs text-[#99A8A1]">{t('daily.subtitle')}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono tabular-nums bg-[#141E1B] border border-[#273A33] text-emerald-300">
              {dailyCompleted.length} / 3 {t('daily.done')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                {
                  slot: 'preflop' as const,
                  label: t('daily.slotPreflop'),
                  detail: dailyPlan.preflopTitle,
                },
                {
                  slot: 'postflop' as const,
                  label: t('daily.slotPostflop'),
                  detail: dailyPlan.postflopTitle,
                },
                {
                  slot: 'showdown' as const,
                  label: t('daily.slotShowdown'),
                  detail: dailyPlan.showdownSlug.replace(/-/g, ' '),
                },
              ]
            ).map((item) => {
              const done = dailyCompleted.includes(item.slot);
              return (
                <button
                  key={item.slot}
                  type="button"
                  data-testid={`daily-slot-${item.slot}`}
                  onClick={() => onLaunchDailySlot(item.slot)}
                  className={`text-left rounded-lg border px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    done
                      ? 'bg-emerald-500/12 border-emerald-400/45 text-emerald-100'
                      : 'bg-[#0A100E] border-[#1F2D28] hover:border-emerald-400/50 text-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">{item.label}</p>
                    <p className="text-[11px] text-slate-400 truncate capitalize mt-0.5">
                      {item.detail}
                    </p>
                  </div>
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Core Gameplay Drills — Hairline Editorial Grid (zero decorative numbers or card cages) */}
        <section className="space-y-6">
          <div className="border-b border-[#1F2D28] pb-4">
            <h2 className="text-2xl sm:text-[28px] font-semibold text-[#F2F4F1]">
              {t('overview.drillsHeading')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2 divide-y md:divide-y-0 divide-[#1A2622]">
            {CORE_DRILLS.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => onNavigate(mod.id)}
                className="group text-left py-6 md:border-b md:border-[#1F2D28] flex flex-col justify-between gap-5 transition-colors duration-200 ease-out hover:bg-[#0E1513]/70 md:px-4 md:-mx-4 rounded-lg cursor-pointer"
              >
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-lg font-semibold text-[#F2F4F1] group-hover:text-emerald-300 transition-colors duration-200 ease-out">
                      {t(mod.titleKey)}
                    </h3>
                    <span className="text-[13px] tabular-nums text-[#99A8A1] shrink-0">
                      {formatLoggedCount(mod.id)}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#E5B95C]/90">{t(mod.metaKey)}</p>
                  <p className="text-[15px] text-[#B7C4BD] leading-relaxed max-w-[58ch]">
                    {t(mod.descKey)}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-emerald-400 group-hover:text-emerald-300 transition-colors duration-200 ease-out">
                  <span>{t(mod.ctaKey)}</span>
                  <ArrowRight
                    className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Session Readiness Ledger — Clean Hairline Summary Strip */}
        <section
          aria-label={t('overview.ariaMetrics')}
          className="border-t border-[#1F2D28] pt-8 space-y-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold text-[#F2F4F1]">
              {t('overview.ariaMetrics')}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('leaks')}
              className="text-[14px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors duration-200 ease-out cursor-pointer"
            >
              {t('overview.inspectLeaks')}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="space-y-1 border-l border-[#1F2D28] pl-4">
              <p className="text-[13px] text-[#99A8A1]">{t('overview.kpiDecisions')}</p>
              <p className="text-2xl font-display tabular-nums font-semibold text-[#F2F4F1]">
                {summary.totalDecisions}
              </p>
              <p className="text-[13px] text-[#83948C]">{t('overview.kpiDecisionsSub')}</p>
            </div>
            <div className="space-y-1 border-l border-[#1F2D28] pl-4">
              <p className="text-[13px] text-[#99A8A1]">{t('overview.kpiOptimal')}</p>
              <p className="text-2xl font-display tabular-nums font-semibold text-emerald-400">
                {optimalRate}%
              </p>
              <p className="text-[13px] text-[#83948C]">{t('overview.kpiOptimalSub')}</p>
            </div>
            <div className="space-y-1 border-l border-[#1F2D28] pl-4">
              <p className="text-[13px] text-[#99A8A1]">{t('overview.kpiEvLoss')}</p>
              <p className="text-2xl font-display tabular-nums font-semibold text-[#E5B95C]">
                {summary.totalDecisions > 0 ? `${avgScore} / 100` : '—'}
              </p>
              <p className="text-[13px] text-[#83948C]">{t('overview.kpiEvLossSub')}</p>
            </div>
            <div className="space-y-1 border-l border-[#1F2D28] pl-4">
              <p className="text-[13px] text-[#99A8A1]">{t('overview.kpiStreak')}</p>
              <p className="text-2xl font-display tabular-nums font-semibold text-[#F2F4F1]">
                {summary.currentStreak}{' '}
                <span className="text-base text-[#99A8A1]">/ {summary.bestStreak}</span>
              </p>
              <p className="text-[13px] text-[#83948C]">{t('overview.depthBadge')}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
