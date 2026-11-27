import type { PreflopCellStrategy } from '../poker/preflopRanges';
import { gridCellLabel } from '../poker/evaluator';
import { useLocale } from '../i18n/LocaleContext';

interface SolverMatrixProps {
  mode: 'solver';
  matrix: Record<string, PreflopCellStrategy>;
  heroHandKey?: string;
  inspectedHandKey?: string | null;
  onInspectHand?: (handKey: string) => void;
}

interface BuilderMatrixProps {
  mode: 'builder';
  selectedHands: Set<string>;
  targetHands?: Set<string>;
  showDiff?: boolean;
  viewMode?: 'mine' | 'solver' | 'diff';
  onToggleHand: (handKey: string) => void;
  disabled?: boolean;
}

type RangeMatrixProps = SolverMatrixProps | BuilderMatrixProps;

export function RangeMatrix13x13(props: RangeMatrixProps) {
  const { locale, t } = useLocale();
  const rows: { row: number; cells: { row: number; col: number; hand: string }[] }[] = [];
  for (let r = 0; r < 13; r++) {
    const rowCells: { row: number; col: number; hand: string }[] = [];
    for (let c = 0; c < 13; c++) {
      rowCells.push({ row: r, col: c, hand: gridCellLabel(r, c) });
    }
    rows.push({ row: r, cells: rowCells });
  }

  return (
    <div className="w-full min-w-0 select-none">
      <div
        className="w-full min-w-0 flex flex-col gap-[1px] sm:gap-[2px] bg-[#0A100E] p-1 sm:p-1.5 rounded-lg border border-[#1F2D28]"
        role="grid"
        aria-label={t('matrix.ariaGrid')}
      >
        {rows.map(({ row, cells }) => (
          <div key={row} role="row" className="grid grid-cols-13 gap-[1px] sm:gap-[2px]">
            {cells.map(({ hand }) => {
              if (props.mode === 'solver') {
                const strat = props.matrix[hand];
                const isHero = props.heroHandKey === hand;
                const isInspected = props.inspectedHandKey === hand;
                const raisePct = strat?.raise ?? 0;
                const callPct = strat?.call ?? 0;
                const foldPct = strat?.fold ?? 100;
                const activePct = raisePct + callPct;

                // Stacked horizontal bar inside cell: Emerald (Raise), Sky (Call), Obsidian (Fold)
                const bgStyle =
                  raisePct === 0 && callPct === 0
                    ? { backgroundColor: '#111917' }
                    : {
                        backgroundImage: `linear-gradient(90deg, #10B981 0%, #10B981 ${raisePct}%, #38BDF8 ${raisePct}%, #38BDF8 ${
                          activePct
                        }%, #111917 ${activePct}%, #111917 100%)`,
                      };

                const isSplit = activePct > 12 && activePct < 88;
                const isActive = activePct >= 88;
                const solverAriaLabel =
                  locale === 'zh-CN'
                    ? `${hand}：加注 ${raisePct}%，跟注 ${callPct}%，弃牌 ${foldPct}%`
                    : `${hand}: Raise ${raisePct}%, Call ${callPct}%, Fold ${foldPct}%`;

                return (
                  <div key={hand} role="gridcell" className="min-w-0">
                    <button
                      type="button"
                      onClick={() => props.onInspectHand?.(hand)}
                      onMouseEnter={() => props.onInspectHand?.(hand)}
                      style={bgStyle}
                      aria-label={solverAriaLabel}
                      className={`relative aspect-square w-full rounded-[2px] sm:rounded-[3px] flex items-center justify-center text-[8.5px] sm:text-[10px] md:text-[11px] leading-none font-mono tabular-nums font-semibold transition-transform duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        isHero
                          ? 'ring-2 ring-amber-300 z-10 scale-105 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95)] shadow-md'
                          : isInspected
                            ? 'ring-1 ring-white/80 z-10 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]'
                            : isSplit
                              ? 'text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]'
                              : isActive
                                ? 'text-slate-950'
                                : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {hand}
                    </button>
                  </div>
                );
              }

              // Builder / Hand Reading mode
              const isSelected = props.selectedHands.has(hand);
              const isTarget = props.targetHands?.has(hand) ?? false;
              const view = props.viewMode ?? 'mine';

              let cellClasses = 'bg-[#111917] text-slate-400 hover:bg-[#192823] hover:text-slate-200';
              if (!props.showDiff) {
                if (isSelected) {
                  cellClasses = 'bg-emerald-500 text-slate-950 font-bold';
                }
              } else if (view === 'solver') {
                if (isTarget) {
                  cellClasses = 'bg-sky-400 text-slate-950 font-bold';
                }
              } else if (view === 'mine') {
                if (isSelected) {
                  cellClasses = 'bg-emerald-500 text-slate-950 font-bold';
                }
              } else {
                // Diff overlay
                if (isSelected && isTarget) {
                  cellClasses = 'bg-emerald-400 text-slate-950 font-bold';
                } else if (!isSelected && isTarget) {
                  cellClasses = 'bg-sky-400 text-slate-950 font-bold ring-1 ring-sky-200';
                } else if (isSelected && !isTarget) {
                  cellClasses = 'bg-rose-500 text-white font-bold';
                }
              }

              const builderAriaLabel =
                locale === 'zh-CN'
                  ? `切换对手范围中的 ${hand}`
                  : `Toggle ${hand} in villain range`;

              return (
                <div key={hand} role="gridcell" className="min-w-0">
                  <button
                    type="button"
                    disabled={props.disabled}
                    onClick={() => props.onToggleHand(hand)}
                    aria-pressed={isSelected}
                    aria-label={builderAriaLabel}
                    className={`aspect-square w-full rounded-[2px] sm:rounded-[3px] flex items-center justify-center text-[8.5px] sm:text-[10px] md:text-[11px] leading-none font-mono tabular-nums transition-colors duration-100 cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${cellClasses}`}
                  >
                    {hand}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
