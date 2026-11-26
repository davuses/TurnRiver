import { useId, useMemo, useState } from 'react';
import { CheckCircle2, Play, RotateCcw, Trophy, TrendingDown, TrendingUp } from 'lucide-react';
import type { HeroArenaLifetime, SessionPoint } from '../../store/useArenaSessionStore';
import type { ArenaChallengeSpec } from '../../poker/arenaChallenges';
import { formatChips, formatSignedChips, type ChipDisplayConfig } from '../../poker/currency';
import { useLocale } from '../../i18n/LocaleContext';

export interface SessionChallengeItem {
  spec: ArenaChallengeSpec;
  current: number;
  target: number;
  completed: boolean;
}

export interface SessionGraphSvgProps {
  points: SessionPoint[];
  bankrollBb: number;
  sessionNetBb: number;
  sessionHands: number;
  heroLifetime: HeroArenaLifetime;
  chipDisplay: ChipDisplayConfig;
  challenges: SessionChallengeItem[];
  onResetBankroll: () => void;
  onLaunchChallenge: (spec: ArenaChallengeSpec) => void;
}

const CHART_W = 320;
const CHART_H = 110;
const PAD_X = 12;
const PAD_Y = 12;

export function SessionGraphSvg({
  points,
  bankrollBb,
  sessionNetBb,
  sessionHands,
  heroLifetime,
  chipDisplay,
  challenges,
  onResetBankroll,
  onLaunchChallenge,
}: SessionGraphSvgProps) {
  const { locale, t } = useLocale();
  const gradientId = useId();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const bbPer100 = useMemo(() => {
    if (sessionHands <= 0) return null;
    return (sessionNetBb / sessionHands) * 100;
  }, [sessionNetBb, sessionHands]);

  const chartModel = useMemo(() => {
    if (points.length === 0) return null;
    const series = [
      { handNumber: Math.max(0, points[0].handNumber - 1), handNetBb: 0, cumNetBb: 0, isOrigin: true },
      ...points.map((p) => ({ ...p, isOrigin: false })),
    ];
    const values = series.map((s) => s.cumNetBb);
    const minVal = Math.min(0, ...values);
    const maxVal = Math.max(0, ...values);
    const rawSpan = maxVal - minVal;
    const span = rawSpan < 2 ? 4 : rawSpan * 1.12;
    const center = (maxVal + minVal) / 2;
    const domainMin = Math.min(minVal, center - span / 2);
    const domainMax = Math.max(maxVal, center + span / 2);
    const safeSpan = Math.max(1, domainMax - domainMin);

    const innerW = CHART_W - PAD_X * 2;
    const innerH = CHART_H - PAD_Y * 2;

    const toX = (idx: number) =>
      series.length <= 1 ? PAD_X : PAD_X + (idx / (series.length - 1)) * innerW;
    const toY = (val: number) =>
      PAD_Y + ((domainMax - val) / safeSpan) * innerH;

    const coords = series.map((pt, i) => ({
      ...pt,
      x: toX(i),
      y: toY(pt.cumNetBb),
      pointIdx: i - 1,
    }));

    const zeroY = toY(0);
    const linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');

    const last = coords[coords.length - 1];
    const first = coords[0];
    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${zeroY.toFixed(1)} L ${first.x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

    const isPositive = points[points.length - 1].cumNetBb >= 0;
    return {
      coords,
      zeroY,
      linePath,
      areaPath,
      isPositive,
      lastCoord: last,
    };
  }, [points]);

  const activePoint =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length
      ? points[hoveredIdx]
      : points.length > 0
        ? points[points.length - 1]
        : null;

  const activeCoord =
    chartModel && hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length
      ? chartModel.coords[hoveredIdx + 1]
      : chartModel?.lastCoord ?? null;

  const heroStats = useMemo(() => {
    const h = heroLifetime.hands;
    const vpip = h > 0 ? `${Math.round((heroLifetime.vpipHands / h) * 100)}%` : '--';
    const pfr = h > 0 ? `${Math.round((heroLifetime.pfrHands / h) * 100)}%` : '--';
    const threeBet =
      heroLifetime.threeBetOpps > 0
        ? `${Math.round((heroLifetime.threeBetHands / heroLifetime.threeBetOpps) * 100)}%`
        : '--';
    const wtsd =
      heroLifetime.sawFlopHands > 0
        ? `${Math.round((heroLifetime.wtsdHands / heroLifetime.sawFlopHands) * 100)}%`
        : '--';
    const af =
      heroLifetime.postflopCalls > 0
        ? (heroLifetime.postflopAggActs / heroLifetime.postflopCalls).toFixed(1)
        : heroLifetime.postflopAggActs > 0
          ? '∞'
          : '--';
    const best =
      heroLifetime.biggestWinBb > 0
        ? formatSignedChips(heroLifetime.biggestWinBb, chipDisplay, { compact: true })
        : '--';
    const worst =
      heroLifetime.biggestLossBb < 0
        ? formatSignedChips(heroLifetime.biggestLossBb, chipDisplay, { compact: true })
        : '--';
    return { vpip, pfr, threeBet, wtsd, af, best, worst };
  }, [heroLifetime, chipDisplay]);

  const strokeColor = chartModel?.isPositive ? '#34D399' : '#FB7185';
  const fillTopColor = chartModel?.isPositive ? '#10B981' : '#F43F5E';

  return (
    <div data-testid="arena-session-panel" className="space-y-4">
      {/* Bankroll & Session Metrics */}
      <div className="bg-[#0E1513] border border-[#1F2D28] rounded-xl p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">{t('arena.bankrollLabel')}</p>
            <p
              data-testid="arena-bankroll-value"
              className="text-lg font-mono font-bold tabular-nums text-white mt-0.5"
            >
              {formatChips(bankrollBb, chipDisplay)}
            </p>
          </div>
          <button
            type="button"
            data-testid="reset-bankroll-btn"
            onClick={onResetBankroll}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#273A33] text-slate-300 hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>{t('arena.resetBankroll')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1A2722]">
          <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2.5 py-2">
            <p className="text-[10px] text-slate-400">{t('arena.sessionPnl')}</p>
            <p
              className={`text-xs font-mono font-semibold tabular-nums mt-0.5 inline-flex items-center gap-1 ${
                sessionNetBb > 0
                  ? 'text-emerald-300'
                  : sessionNetBb < 0
                    ? 'text-rose-300'
                    : 'text-slate-200'
              }`}
            >
              {sessionNetBb > 0 ? (
                <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : sessionNetBb < 0 ? (
                <TrendingDown className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : null}
              <span>{formatSignedChips(sessionNetBb, chipDisplay)}</span>
              {sessionHands > 0 && (
                <span className="text-[10px] text-slate-400 font-normal">({sessionHands}H)</span>
              )}
            </p>
          </div>

          <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2.5 py-2">
            <p className="text-[10px] text-slate-400">{t('arena.bbPer100')}</p>
            <p
              className={`text-xs font-mono font-semibold tabular-nums mt-0.5 ${
                bbPer100 === null
                  ? 'text-slate-400'
                  : bbPer100 >= 0
                    ? 'text-emerald-300'
                    : 'text-rose-300'
              }`}
            >
              {bbPer100 === null
                ? '--'
                : `${bbPer100 > 0 ? '+' : ''}${bbPer100.toFixed(1)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Session P&L Curve */}
      <div className="bg-[#0E1513] border border-[#1F2D28] rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-200">
            {t('arena.sessionGraphTitle')}
          </span>
          {activePoint ? (
            <span
              data-testid="session-graph-readout"
              className="text-[11px] font-mono tabular-nums text-slate-300 truncate"
            >
              {locale === 'zh-CN'
                ? `${t('table.hand')} ${activePoint.handNumber}`
                : `#${activePoint.handNumber}`}{' '}
              ·{' '}
              <span
                className={
                  activePoint.cumNetBb >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }
              >
                {formatSignedChips(activePoint.cumNetBb, chipDisplay, { compact: true })}
              </span>
              <span className="text-slate-500">
                {' '}
                ({formatSignedChips(activePoint.handNetBb, chipDisplay, { compact: true })})
              </span>
            </span>
          ) : null}
        </div>

        {chartModel ? (
          <div className="relative bg-[#0A100E] border border-[#1A2722] rounded-lg p-1.5">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              role="img"
              aria-label={t('arena.sessionGraphTitle')}
              className="w-full h-[110px] block select-none"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={fillTopColor} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={fillTopColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              {/* Dashed zero baseline */}
              <line
                x1={PAD_X}
                y1={chartModel.zeroY}
                x2={CHART_W - PAD_X}
                y2={chartModel.zeroY}
                stroke="#334E45"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Area fill */}
              <path d={chartModel.areaPath} fill={`url(#${gradientId})`} />

              {/* Line stroke */}
              <path
                d={chartModel.linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Active vertical guide + highlight dot */}
              {activeCoord && (
                <>
                  <line
                    x1={activeCoord.x}
                    y1={PAD_Y}
                    x2={activeCoord.x}
                    y2={CHART_H - PAD_Y}
                    stroke={strokeColor}
                    strokeOpacity={0.3}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="5.5"
                    fill={strokeColor}
                    fillOpacity={0.22}
                  />
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="2.8"
                    fill={strokeColor}
                    stroke="#0A100E"
                    strokeWidth="1.2"
                  />
                </>
              )}

              {/* Interactive hover bands per point */}
              {chartModel.coords.slice(1).map((pt, i) => {
                const prevX = i === 0 ? PAD_X : (chartModel.coords[i].x + pt.x) / 2;
                const nextX =
                  i === points.length - 1
                    ? CHART_W - PAD_X
                    : (pt.x + chartModel.coords[i + 2].x) / 2;
                const hitW = Math.max(4, nextX - prevX);
                return (
                  <rect
                    key={`${pt.handNumber}-${i}`}
                    x={prevX}
                    y={0}
                    width={hitW}
                    height={CHART_H}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoveredIdx(i)}
                  >
                    <title>
                      {`#${pt.handNumber}: ${formatSignedChips(pt.handNetBb, chipDisplay, { compact: true })} (${formatSignedChips(pt.cumNetBb, chipDisplay, { compact: true })})`}
                    </title>
                  </rect>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="h-[110px] rounded-lg border border-dashed border-[#243630] bg-[#0A100E] flex items-center justify-center px-4 text-center">
            <p className="text-xs text-slate-400 leading-relaxed">{t('arena.noSessionYet')}</p>
          </div>
        )}
      </div>

      {/* Compact 6-Stat Hero HUD Strip */}
      <div className="bg-[#0E1513] border border-[#1F2D28] rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-200">
            {t('arena.heroStatsTitle')}
          </span>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            {heroLifetime.hands}H
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-slate-400">{t('arena.hudColVpip')}</p>
            <p className="text-xs font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
              {heroStats.vpip}
            </p>
          </div>
          <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-slate-400">{t('arena.hudColPfr')}</p>
            <p className="text-xs font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
              {heroStats.pfr}
            </p>
          </div>
          <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-slate-400">{t('arena.hudCol3b')}</p>
            <p className="text-xs font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
              {heroStats.threeBet}
            </p>
          </div>
          <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-slate-400">{t('arena.wtsdCol')}</p>
            <p className="text-xs font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
              {heroStats.wtsd}
            </p>
          </div>
          <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-slate-400">{t('arena.hudColAf')}</p>
            <p className="text-xs font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
              {heroStats.af}
            </p>
          </div>
          <div className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-slate-400 truncate">
              {t('arena.biggestWin')} / {t('arena.biggestLoss')}
            </p>
            <p className="text-[11px] font-mono font-semibold tabular-nums mt-0.5 truncate">
              <span className="text-emerald-300">{heroStats.best}</span>
              <span className="text-slate-500"> / </span>
              <span className="text-rose-300">{heroStats.worst}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Compact Arena Challenges */}
      {challenges.length > 0 && (
        <div className="bg-[#0E1513] border border-[#1F2D28] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-slate-200">
              {t('arena.challengesTitle')}
            </span>
          </div>

          <div className="space-y-2">
            {challenges.map(({ spec, current, target, completed }) => {
              const pct = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
              const title = locale === 'zh-CN' ? spec.titleZh : spec.titleEn;
              const desc = locale === 'zh-CN' ? spec.descZh : spec.descEn;
              return (
                <div
                  key={spec.id}
                  data-testid={`challenge-card-${spec.id}`}
                  className={`rounded-lg border p-2.5 space-y-2 transition-colors ${
                    completed
                      ? 'bg-emerald-500/8 border-emerald-500/35'
                      : 'bg-[#0A100E] border-[#1B2823]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {completed && (
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-emerald-400 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <p className="text-xs font-semibold text-white truncate">{title}</p>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{desc}</p>
                    </div>

                    <button
                      type="button"
                      data-testid={`launch-challenge-${spec.id}`}
                      onClick={() => onLaunchChallenge(spec)}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-md border inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        completed
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25'
                          : 'bg-amber-400/15 border-amber-400/45 text-amber-200 hover:bg-amber-400/25'
                      }`}
                    >
                      <Play className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>
                        {completed ? t('arena.challengeDone') : t('arena.challengeLaunch')}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[#17241F] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          completed ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                      {Math.round(current * 10) / 10} / {target}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
