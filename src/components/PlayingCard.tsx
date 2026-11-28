import type { Card, Suit } from '../poker/types';
import { SUIT_SYMBOL } from '../poker/evaluator';
import { useLocale } from '../i18n/LocaleContext';

export type CardHighlightState = 'none' | 'used' | 'dimmed' | 'decider';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  fourColor: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  highlighted?: boolean;
  highlightState?: CardHighlightState;
  onClick?: () => void;
}

function suitColorClass(suit: Suit, fourColor: boolean): string {
  if (suit === 's') return 'text-slate-900';
  if (suit === 'h') return 'text-rose-600';
  if (suit === 'd') return fourColor ? 'text-sky-600' : 'text-rose-600';
  return fourColor ? 'text-emerald-700' : 'text-slate-900';
}

const SIZE_STYLES: Record<
  NonNullable<PlayingCardProps['size']>,
  { box: string; rank: string; cornerSuit: string; centerSuit: string }
> = {
  xs: {
    box: 'w-8 h-11 rounded-[5px]',
    rank: 'text-[11px] leading-none font-bold',
    cornerSuit: 'text-[9px] leading-none',
    centerSuit: 'text-sm leading-none',
  },
  sm: {
    box: 'w-11 h-16 rounded-md',
    rank: 'text-xs leading-none font-bold',
    cornerSuit: 'text-[10px] leading-none',
    centerSuit: 'text-lg leading-none',
  },
  md: {
    box: 'w-14 h-20 rounded-lg',
    rank: 'text-sm leading-none font-bold',
    cornerSuit: 'text-xs leading-none',
    centerSuit: 'text-2xl leading-none',
  },
  lg: {
    box: 'w-[68px] h-[96px] rounded-lg',
    rank: 'text-base leading-none font-bold',
    cornerSuit: 'text-sm leading-none',
    centerSuit: 'text-3xl leading-none',
  },
};

export function PlayingCard({
  card,
  faceDown = false,
  fourColor,
  size = 'md',
  highlighted = false,
  highlightState = 'none',
  onClick,
}: PlayingCardProps) {
  const { locale, t } = useLocale();
  const s = SIZE_STYLES[size];

  if (faceDown || !card) {
    return (
      <div
        aria-label={t('common.faceDownCard')}
        className={`${s.box} playing-card-shadow relative overflow-hidden border border-slate-400/40 bg-[#172434] flex items-center justify-center select-none shrink-0`}
      >
        <div
          className="inset-1 absolute rounded-[4px] border border-emerald-400/25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(16,185,129,0.12) 0px, rgba(16,185,129,0.12) 2px, transparent 2px, transparent 6px)',
          }}
        />
      </div>
    );
  }

  const colorClass = suitColorClass(card.suit, fourColor);
  const symbol = SUIT_SYMBOL[card.suit];
  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const suitLabel =
    card.suit === 's'
      ? t('common.suit.s')
      : card.suit === 'h'
        ? t('common.suit.h')
        : card.suit === 'd'
          ? t('common.suit.d')
          : t('common.suit.c');
  const cardAriaLabel =
    locale === 'zh-CN' ? `${suitLabel} ${rankDisplay}` : `${rankDisplay} of ${suitLabel}`;

  const stateClass =
    highlightState === 'decider'
      ? 'border-amber-400 ring-2 ring-amber-400/85 shadow-[0_0_12px_rgba(251,191,36,0.45)] -translate-y-0.5'
      : highlightState === 'dimmed'
        ? 'border-slate-300/60 opacity-40 saturate-50'
        : highlightState === 'used' || highlighted
          ? 'border-emerald-400 ring-2 ring-emerald-400/50'
          : 'border-slate-300';

  const baseClass = `${s.box} playing-card-shadow relative bg-white border ${stateClass} select-none shrink-0 flex flex-col justify-between p-1.5 transition-all duration-150 ${
    onClick ? 'cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-amber-300/80' : ''
  }`;

  const showBottomCorner = size === 'md' || size === 'lg';
  const cardInner = (
    <>
      <div className={`flex flex-col items-center leading-none self-start ${colorClass}`}>
        <span className={`${s.rank} font-serif tabular-nums tracking-tighter`}>
          {rankDisplay}
        </span>
        <span className={s.cornerSuit}>{symbol}</span>
      </div>
      <div className={`self-center ${s.centerSuit} ${colorClass} ${showBottomCorner ? '' : '-mt-1'}`}>
        {symbol}
      </div>
      {showBottomCorner ? (
        <div className={`flex flex-col items-center leading-none self-end rotate-180 ${colorClass}`}>
          <span className={`${s.rank} font-serif tabular-nums tracking-tighter`}>
            {rankDisplay}
          </span>
          <span className={s.cornerSuit}>{symbol}</span>
        </div>
      ) : (
        <div className="h-1" />
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" aria-label={cardAriaLabel} onClick={onClick} className={baseClass}>
        {cardInner}
      </button>
    );
  }

  return (
    <div aria-label={cardAriaLabel} className={baseClass}>
      {cardInner}
    </div>
  );
}
