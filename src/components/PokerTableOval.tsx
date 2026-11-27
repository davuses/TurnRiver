import type { Card, Position } from '../poker/types';
import type { TableActionSpec } from '../poker/tableEngine';
import { formatChips, type ChipDisplayConfig } from '../poker/currency';
import { PlayingCard } from './PlayingCard';
import { useLocale } from '../i18n/LocaleContext';
import { formatArenaAction } from '../i18n/drillContentZh';

export interface TableSeatDisplay {
  seatIndex: number;
  position: Position;
  label: string;
  sublabel?: string;
  stackBb: number;
  isHero?: boolean;
  isVillain?: boolean;
  isDealer?: boolean;
  isActiveTurn?: boolean;
  isWinner?: boolean;
  folded?: boolean;
  streetBetBb?: number;
  actionText?: string;
  actionSpec?: TableActionSpec;
  cards?: [Card, Card] | null;
  revealCards?: boolean;
}

interface PokerTableOvalProps {
  seats: TableSeatDisplay[];
  board: Card[];
  potBb: number;
  streetLabel?: string;
  sprLabel?: string;
  fourColor: boolean;
  compact?: boolean;
  mobileTight?: boolean;
  chipDisplay?: ChipDisplayConfig;
}

// 6-max clockwise positions anchored around oval:
// 0 = Hero (bottom center), 1 = bottom-left, 2 = top-left, 3 = top-center, 4 = top-right, 5 = bottom-right
const SEAT_COORDS: string[] = [
  'bottom-2 left-1/2 -translate-x-1/2',
  'bottom-[24%] left-3 sm:left-5',
  'top-[16%] left-3 sm:left-5',
  '-top-4 left-1/2 -translate-x-1/2',
  'top-[16%] right-3 sm:right-5',
  'bottom-[24%] right-3 sm:right-5',
];

export function PokerTableOval({
  seats,
  board,
  potBb,
  streetLabel,
  sprLabel,
  fourColor,
  compact = false,
  mobileTight = false,
  chipDisplay,
}: PokerTableOvalProps) {
  const { locale, t } = useLocale();
  const heroSeat = seats.find((s) => s.isHero) ?? seats[0];
  const otherSeats = seats.filter((s) => s.seatIndex !== heroSeat?.seatIndex);
  const fmtStack = (bb: number, compactUnit = false) =>
    chipDisplay
      ? formatChips(bb, chipDisplay, { compact: compactUnit })
      : compactUnit
        ? `${bb.toFixed(1)}bb`
        : `${bb.toFixed(1)} bb`;

  return (
    <div className={`w-full select-none ${mobileTight ? 'space-y-1.5 sm:space-y-3' : 'space-y-3'}`}>
      {/* Compact Mobile Opponent Bar (prevents seat/pot overlap on <640px screens) */}
      {mobileTight ? (
        <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
          {otherSeats
            .filter((s) => !s.folded || s.isVillain || s.actionText || s.isDealer)
            .slice(0, 4)
            .map((seat) => (
              <div
                key={`mob-${seat.seatIndex}`}
                className={`flex-1 min-w-[140px] px-2.5 py-1 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                  seat.isVillain
                    ? 'bg-[#121B18] border-sky-400/60'
                    : 'bg-[#0E1513] border-[#23342E]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-slate-200 truncate">{seat.label}</span>
                  <span className="font-mono font-bold text-emerald-400">{seat.position}</span>
                  {seat.isDealer && (
                    <span
                      data-testid={`mobile-dealer-btn-${seat.seatIndex}`}
                      aria-label={t('common.dealerButton')}
                      className="w-4 h-4 rounded-full bg-amber-300 text-slate-950 font-bold text-[10px] inline-flex items-center justify-center shrink-0"
                    >
                      D
                    </span>
                  )}
                  <span className="font-mono tabular-nums text-[10px] text-slate-400">
                    {fmtStack(seat.stackBb, true)}
                  </span>
                </div>
                {(seat.actionSpec || seat.actionText) && (
                  <span className="font-mono tabular-nums text-[10px] text-amber-300 shrink-0">
                    {formatArenaAction(locale, seat.actionSpec, seat.actionText, chipDisplay)}
                  </span>
                )}
              </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:hidden">
          {otherSeats
            .filter((s) => !s.folded || s.isVillain || s.actionText || s.isDealer)
            .slice(0, 6)
            .map((seat) => (
              <div
                key={`mob-${seat.seatIndex}`}
                className={`px-2 py-1.5 rounded-lg border text-[11px] ${
                  seat.isWinner
                    ? 'bg-[#132620] border-emerald-400'
                    : seat.isActiveTurn
                      ? 'bg-[#17231F] border-amber-400'
                      : seat.isVillain
                        ? 'bg-[#121B18] border-sky-400/60'
                        : 'bg-[#0E1513] border-[#23342E]'
                } ${seat.folded ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-slate-200 truncate">{seat.label}</span>
                  <span className="font-mono font-bold text-emerald-400 shrink-0">{seat.position}</span>
                </div>
                <div className="flex items-center justify-between gap-1 font-mono tabular-nums text-[10px] text-slate-400 mt-0.5">
                  <span>{fmtStack(seat.stackBb, true)}</span>
                  {seat.isDealer && (
                    <span
                      data-testid={`mobile-dealer-btn-${seat.seatIndex}`}
                      aria-label={t('common.dealerButton')}
                      className="w-4 h-4 rounded-full bg-amber-300 text-slate-950 font-bold text-[10px] inline-flex items-center justify-center shrink-0"
                    >
                      D
                    </span>
                  )}
                </div>
                {(seat.actionSpec || seat.actionText) && (
                  <div className="font-mono tabular-nums text-[10px] text-amber-300 truncate mt-0.5">
                    {formatArenaAction(locale, seat.actionSpec, seat.actionText, chipDisplay)}
                  </div>
                )}
                {seat.revealCards && seat.cards && (
                  <div
                    data-testid={`mobile-seat-cards-${seat.seatIndex}`}
                    className="flex items-center gap-1 mt-1"
                  >
                    <PlayingCard
                      card={seat.cards[0]}
                      fourColor={fourColor}
                      size="xs"
                      highlighted={seat.isWinner}
                    />
                    <PlayingCard
                      card={seat.cards[1]}
                      fourColor={fourColor}
                      size="xs"
                      highlighted={seat.isWinner}
                    />
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      <div
        className={`relative w-full ${
          mobileTight
            ? 'min-h-[222px] sm:min-h-[372px] px-0.5 pt-1 pb-4 sm:px-5 sm:py-5'
            : compact
              ? 'min-h-[290px] sm:min-h-[420px] px-1 py-3 sm:px-6 sm:py-6'
              : 'min-h-[310px] sm:min-h-[480px] px-1 py-3 sm:px-6 sm:py-6'
        } flex items-center justify-center`}
      >
        {/* Outer matte graphite rail */}
        <div
          className={`felt-rail relative w-full max-w-[780px] sm:aspect-[16/10] ${
            mobileTight
              ? 'min-h-[208px] sm:min-h-[310px] rounded-[46px]'
              : 'min-h-[260px] sm:min-h-[340px] rounded-[72px]'
          } sm:rounded-[160px] p-2 sm:p-4 flex items-center justify-center border border-[#273932]`}
        >
          {/* Inner high-stakes dark emerald felt */}
          <div
            className={`felt-surface relative w-full h-full ${
              mobileTight
                ? 'min-h-[190px] sm:min-h-0 rounded-[38px] justify-start pt-3 pb-16 sm:justify-center sm:pt-0 sm:pb-0'
                : 'min-h-[236px] sm:min-h-0 rounded-[62px] justify-center pb-8 sm:pb-0'
            } sm:rounded-[145px] border border-emerald-400/15 flex flex-col items-center px-2.5 sm:px-6`}
          >
            {/* Subtle inner betting ring line */}
            <div className="pointer-events-none absolute inset-3 sm:inset-9 rounded-[32px] sm:rounded-[115px] border border-white/[0.06]" />

            {/* Center Pot & Board Stage */}
            <div
              className={`relative z-10 flex flex-col items-center ${
                mobileTight ? 'gap-1.5 sm:gap-2.5 mt-0 sm:mt-8' : 'gap-2 sm:gap-3 mt-0 sm:mt-8'
              }`}
            >
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-mono tabular-nums text-emerald-200/80">
                {streetLabel && <span>{streetLabel}</span>}
                {streetLabel && <span aria-hidden="true" className="text-white/25">·</span>}
                <span className="text-amber-300 font-semibold text-sm">
                  {t('common.pot')} {fmtStack(potBb)}
                </span>
                {sprLabel && (
                  <>
                    <span aria-hidden="true" className="text-white/25">·</span>
                    <span className="text-slate-300">{sprLabel}</span>
                  </>
                )}
              </div>

              {/* Community Cards */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[64px] sm:min-h-[82px]">
                {board.length > 0 ? (
                  board.map((c, idx) => (
                    <PlayingCard
                      key={`${c.rank}${c.suit}-${idx}`}
                      card={c}
                      fourColor={fourColor}
                      size="sm"
                    />
                  ))
                ) : (
                  <div className="flex items-center gap-2 opacity-30">
                    {[0, 1, 2].map((slot) => (
                      <div
                        key={slot}
                        className="w-10 h-14 sm:w-12 sm:h-[68px] rounded-md border border-dashed border-emerald-200/40"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop/Tablet Opponent Seats (symmetric for 2, 3, 4, or 6-max) */}
          {otherSeats.map((seat, idx) => {
            const slotMap: Record<number, number[]> = {
              1: [3],
              2: [2, 4],
              3: [1, 3, 5],
              4: [1, 2, 4, 5],
            };
            const slotIdx = slotMap[otherSeats.length]?.[idx] ?? ((idx + 1) % 6);
            const coord = SEAT_COORDS[slotIdx];
            const isTurn = seat.isActiveTurn;
            const isWin = seat.isWinner;

            return (
              <div
                key={seat.seatIndex}
                className={`hidden sm:flex absolute ${coord} z-20 flex-col items-center gap-1`}
              >
                {/* Opponent Cards */}
                {seat.cards && !seat.folded && (
                  <div className="flex items-center -space-x-2 mb-0.5">
                    <PlayingCard
                      card={seat.cards[0]}
                      faceDown={!seat.revealCards}
                      fourColor={fourColor}
                      size="xs"
                      highlighted={isWin}
                    />
                    <PlayingCard
                      card={seat.cards[1]}
                      faceDown={!seat.revealCards}
                      fourColor={fourColor}
                      size="xs"
                      highlighted={isWin}
                    />
                  </div>
                )}

                {/* Seat Plate */}
                <div
                  className={`min-w-[138px] sm:min-w-[156px] px-3 py-2 rounded-xl border shadow-md transition-colors ${
                    isWin
                      ? 'bg-[#132620] border-emerald-400'
                      : isTurn
                        ? 'bg-[#17231F] border-amber-400'
                        : seat.isVillain
                          ? 'bg-[#121B18] border-sky-400/60'
                          : 'bg-[#0E1513]/95 border-[#23342E]'
                  } ${seat.folded ? 'opacity-45' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs sm:text-[13px]">
                    <span className="font-semibold text-slate-100 truncate max-w-[92px]">
                      {seat.label}
                    </span>
                    <span className="font-mono font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded text-xs shrink-0">
                      {seat.position}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs sm:text-[13px] font-mono tabular-nums mt-1">
                    <span className="text-white font-bold">{fmtStack(seat.stackBb)}</span>
                    {seat.isDealer && (
                      <span
                        aria-label={t('common.dealerButton')}
                        className="w-5 h-5 rounded-full bg-amber-300 text-slate-950 font-bold text-[11px] inline-flex items-center justify-center"
                      >
                        D
                      </span>
                    )}
                  </div>
                  {seat.sublabel && (
                    <div className="text-[11px] text-slate-300/80 truncate mt-0.5">
                      {seat.sublabel}
                    </div>
                  )}
                </div>

                {(seat.actionSpec || seat.actionText) && (
                  <div className="text-xs font-mono font-semibold tabular-nums text-amber-200 bg-[#0A100E]/95 border border-[#2D3B52] px-2.5 py-0.5 rounded-md shadow whitespace-nowrap">
                    {formatArenaAction(locale, seat.actionSpec, seat.actionText, chipDisplay)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Hero Seat (Bottom Center) */}
          {heroSeat && (
            <div
              className={`absolute ${
                mobileTight ? '-bottom-3 sm:-bottom-5' : '-bottom-5'
              } left-1/2 -translate-x-1/2 z-30 flex items-end gap-2 sm:gap-3`}
            >
              {heroSeat.cards && (
                <div className="flex items-center gap-1.5">
                  <PlayingCard
                    card={heroSeat.cards[0]}
                    fourColor={fourColor}
                    size="md"
                    highlighted={heroSeat.isWinner || heroSeat.isActiveTurn}
                  />
                  <PlayingCard
                    card={heroSeat.cards[1]}
                    fourColor={fourColor}
                    size="md"
                    highlighted={heroSeat.isWinner || heroSeat.isActiveTurn}
                  />
                </div>
              )}
              <div
                className={`min-w-[116px] sm:min-w-[136px] px-2.5 sm:px-3 py-2 rounded-lg border ${
                  heroSeat.isWinner
                    ? 'bg-[#132620] border-emerald-400'
                    : heroSeat.isActiveTurn
                      ? 'bg-[#182436] border-emerald-400'
                      : 'bg-[#0E1513] border-[#2C3B50]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-white">{t('common.hero')}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-emerald-400">
                      {heroSeat.position}
                    </span>
                    {heroSeat.isDealer && (
                      <span
                        aria-label={t('common.dealerButton')}
                        className="w-4 h-4 rounded-full bg-amber-300 text-slate-950 font-bold text-[10px] inline-flex items-center justify-center"
                      >
                        D
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-mono tabular-nums text-sm font-semibold text-slate-200 mt-0.5">
                  {fmtStack(heroSeat.stackBb)}
                </div>
                {(heroSeat.actionSpec || heroSeat.actionText) && (
                  <div className="text-[11px] font-mono tabular-nums text-amber-300 mt-0.5 whitespace-nowrap">
                    {formatArenaAction(locale, heroSeat.actionSpec, heroSeat.actionText, chipDisplay)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
