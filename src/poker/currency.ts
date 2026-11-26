export type ChipDisplayUnit = 'bb' | 'usd';

export type CashStakesId = 'nl100' | 'nl200' | 'nl500' | 'nl1000';

export interface CashStakesPreset {
  id: CashStakesId;
  label: string;
  sbUsd: number;
  bbUsd: number;
  sbBb: number;
  stepBb: number;
}

export const CASH_STAKES_PRESETS: Record<CashStakesId, CashStakesPreset> = {
  nl100: {
    id: 'nl100',
    label: '$0.5/$1',
    sbUsd: 0.5,
    bbUsd: 1,
    sbBb: 0.5,
    stepBb: 0.5,
  },
  nl200: {
    id: 'nl200',
    label: '$1/$2',
    sbUsd: 1,
    bbUsd: 2,
    sbBb: 0.5,
    stepBb: 0.5,
  },
  nl500: {
    id: 'nl500',
    label: '$2/$5',
    sbUsd: 2,
    bbUsd: 5,
    sbBb: 0.4,
    stepBb: 0.2,
  },
  nl1000: {
    id: 'nl1000',
    label: '$5/$10',
    sbUsd: 5,
    bbUsd: 10,
    sbBb: 0.5,
    stepBb: 0.5,
  },
};

export const CASH_STAKES_LIST: CashStakesPreset[] = [
  CASH_STAKES_PRESETS.nl100,
  CASH_STAKES_PRESETS.nl200,
  CASH_STAKES_PRESETS.nl500,
  CASH_STAKES_PRESETS.nl1000,
];

export interface ChipDisplayConfig {
  unit: ChipDisplayUnit;
  stakesId: CashStakesId;
}

export const DEFAULT_CHIP_DISPLAY: ChipDisplayConfig = {
  unit: 'bb',
  stakesId: 'nl200',
};

export function getCashStakes(stakesId?: CashStakesId): CashStakesPreset {
  if (stakesId && stakesId in CASH_STAKES_PRESETS) {
    return CASH_STAKES_PRESETS[stakesId];
  }
  return CASH_STAKES_PRESETS.nl200;
}

function roundTenth(val: number): number {
  const rounded = Math.round(val * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatUsd(usd: number): string {
  const cents = Math.round(Math.abs(usd) * 100);
  const sign = usd < 0 && cents > 0 ? '-' : '';
  const dollars = cents / 100;
  if (cents % 100 === 0) {
    return `${sign}$${Math.round(dollars).toLocaleString('en-US')}`;
  }
  return `${sign}$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatChips(
  bb: number,
  display?: ChipDisplayConfig,
  opts?: { compact?: boolean }
): string {
  const unit = display?.unit ?? 'bb';
  if (unit === 'usd') {
    const stakes = getCashStakes(display?.stakesId);
    return formatUsd(bb * stakes.bbUsd);
  }
  const clean = roundTenth(bb);
  return opts?.compact ? `${clean}bb` : `${clean} bb`;
}

export function formatSignedChips(
  bb: number,
  display?: ChipDisplayConfig,
  opts?: { compact?: boolean }
): string {
  const unit = display?.unit ?? 'bb';
  if (unit === 'usd') {
    const stakes = getCashStakes(display?.stakesId);
    const usd = bb * stakes.bbUsd;
    const cents = Math.round(Math.abs(usd) * 100);
    if (cents === 0) return '$0';
    const prefix = usd > 0 ? '+' : '-';
    return `${prefix}${formatUsd(Math.abs(usd))}`;
  }
  const clean = roundTenth(bb);
  const suffix = opts?.compact ? 'bb' : ' bb';
  if (clean === 0) return `0${suffix}`;
  return clean > 0 ? `+${clean}${suffix}` : `${clean}${suffix}`;
}

export function getSliderStepBb(display?: ChipDisplayConfig): number {
  if (display?.unit === 'usd') {
    return getCashStakes(display.stakesId).stepBb;
  }
  return 0.5;
}

export function snapRaiseBb(
  bb: number,
  display: ChipDisplayConfig,
  minBb: number,
  maxBb: number
): number {
  const safeMin = roundTenth(minBb);
  const safeMax = roundTenth(maxBb);
  if (safeMin >= safeMax) return safeMax;
  if (bb >= safeMax - 1e-6) return safeMax;
  if (bb <= safeMin + 1e-6) return safeMin;

  if (display.unit === 'usd') {
    const step = getCashStakes(display.stakesId).stepBb;
    let snapped = roundTenth(Math.round(bb / step) * step);
    if (snapped < safeMin) {
      const ceilStep = roundTenth(Math.ceil(safeMin / step - 1e-9) * step);
      snapped = ceilStep <= safeMax ? ceilStep : safeMin;
    }
    if (snapped > safeMax) {
      const floorStep = roundTenth(Math.floor(safeMax / step + 1e-9) * step);
      snapped = floorStep >= safeMin ? floorStep : safeMax;
    }
    return roundTenth(Math.max(safeMin, Math.min(safeMax, snapped)));
  }

  return roundTenth(Math.max(safeMin, Math.min(safeMax, bb)));
}
