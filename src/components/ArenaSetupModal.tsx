import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Dices,
  DollarSign,
  EyeOff,
  GraduationCap,
  Layers,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Split,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import {
  ALL_BOT_ARCHETYPES,
  buildPresetConfig,
  POSITIONS_BY_SIZE,
  resizeConfigArchetypes,
  type ArenaConfig,
  type ArenaFormat,
  type ArenaSize,
  type BotArchetype,
  type BotDifficulty,
  type HeroPositionLock,
  type PoolPresetId,
} from '../poker/tableEngine';
import type { CoachMode, UserPreferences } from '../poker/types';
import { ARENA_CHALLENGES, type ArenaChallengeSpec } from '../poker/arenaChallenges';
import {
  CASH_STAKES_LIST,
  DEFAULT_CHIP_DISPLAY,
  formatChips,
  getCashStakes,
  type CashStakesId,
  type ChipDisplayConfig,
  type ChipDisplayUnit,
} from '../poker/currency';
import { useLocale } from '../i18n/LocaleContext';
import { translateArchetype, type TranslationKey } from '../i18n/translations';

interface ArenaSetupModalProps {
  open: boolean;
  config: ArenaConfig;
  chipDisplay?: ChipDisplayConfig;
  autoTopUp?: boolean;
  coachMode?: CoachMode;
  rngEnabled?: boolean;
  onChangeCoachMode?: (m: CoachMode) => void;
  onChangeRngEnabled?: (v: boolean) => void;
  onSelectChallenge?: (spec: ArenaChallengeSpec) => void;
  onClose: () => void;
  onApply: (next: ArenaConfig, prefsPatch?: Partial<UserPreferences>) => void;
}

const PRESET_LIST: Exclude<PoolPresetId, 'custom'>[] = [
  'mixed',
  'microstakes',
  'reg_wars',
  'lag_chaos',
  'heads_up',
];

const TABLE_SIZES: ArenaSize[] = [2, 3, 4, 6];
const STACK_OPTIONS: (50 | 100 | 200)[] = [50, 100, 200];
const ANTE_OPTIONS: (0 | 0.1 | 0.25)[] = [0, 0.1, 0.25];
const COACH_MODES: CoachMode[] = ['off', 'after_hand', 'live'];

function normalizeDraftConfig(config: ArenaConfig): ArenaConfig {
  return {
    ...config,
    botArchetypes: [...config.botArchetypes],
    anteBb: config.anteBb ?? 0,
    straddleEnabled: Boolean(config.straddleEnabled),
    runItTwiceEnabled: Boolean(config.runItTwiceEnabled),
  };
}

export function ArenaSetupModal({
  open,
  config,
  chipDisplay = DEFAULT_CHIP_DISPLAY,
  autoTopUp = false,
  coachMode = 'after_hand',
  rngEnabled = false,
  onChangeCoachMode,
  onChangeRngEnabled,
  onSelectChallenge,
  onClose,
  onApply,
}: ArenaSetupModalProps) {
  const { locale, t } = useLocale();
  const [draft, setDraft] = useState<ArenaConfig>(() => normalizeDraftConfig(config));
  const [draftUnit, setDraftUnit] = useState<ChipDisplayUnit>(chipDisplay.unit);
  const [draftStakesId, setDraftStakesId] = useState<CashStakesId>(chipDisplay.stakesId);
  const [draftAutoTopUp, setDraftAutoTopUp] = useState<boolean>(autoTopUp);
  const [draftCoachMode, setDraftCoachMode] = useState<CoachMode>(coachMode);
  const [draftRngEnabled, setDraftRngEnabled] = useState<boolean>(rngEnabled);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setDraft(normalizeDraftConfig(config));
      setDraftUnit(chipDisplay.unit);
      setDraftStakesId(chipDisplay.stakesId);
      setDraftAutoTopUp(autoTopUp);
      setDraftCoachMode(coachMode);
      setDraftRngEnabled(rngEnabled);
    }
  }, [open, config, chipDisplay.unit, chipDisplay.stakesId, autoTopUp, coachMode, rngEnabled]);

  const draftDisplay: ChipDisplayConfig = {
    unit: draftUnit,
    stakesId: draftStakesId,
  };

  useEffect(() => {
    if (!open) return;
    const prevActive =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    closeBtnRef.current?.focus();

    const FOCUSABLE_SELECTOR =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (!active || active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevActive?.focus();
    };
  }, [open]);

  if (!open) return null;

  const availableLocks: HeroPositionLock[] = ['ROTATE', 'BTN', 'BB', 'CO'].filter(
    (loc): loc is HeroPositionLock =>
      loc === 'ROTATE' || POSITIONS_BY_SIZE[draft.tableSize].includes(loc as 'BTN' | 'BB' | 'CO')
  );

  const handleSelectSize = (size: ArenaSize) => {
    const nextArchetypes = resizeConfigArchetypes(draft.botArchetypes, size);
    const validLock: HeroPositionLock =
      draft.heroPositionLock !== 'ROTATE' &&
      POSITIONS_BY_SIZE[size].includes(draft.heroPositionLock)
        ? draft.heroPositionLock
        : 'ROTATE';
    setDraft({
      ...draft,
      tableSize: size,
      poolPreset: 'custom',
      botArchetypes: nextArchetypes,
      heroPositionLock: validLock,
    });
  };

  const handleSelectPreset = (preset: Exclude<PoolPresetId, 'custom'>) => {
    setDraft(normalizeDraftConfig(buildPresetConfig(preset, draft)));
  };

  const handleChangeSeatArchetype = (botIdx: number, arch: BotArchetype) => {
    const next = [...draft.botArchetypes];
    next[botIdx] = arch;
    setDraft({
      ...draft,
      poolPreset: 'custom',
      botArchetypes: next,
    });
  };

  const activeAnte = draft.anteBb ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arena-setup-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0E1513] border border-[#243630] rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1B2823] bg-[#0A100E]">
          <div className="flex items-start gap-2.5">
            <SlidersHorizontal
              className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <h2 id="arena-setup-title" className="text-base font-semibold text-white">
                {t('arena.modalTitle')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('arena.modalSubtitle')}</p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={t('arena.cancel')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#17231F] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Config Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Pool Presets */}
          <fieldset className="border-0 p-0 m-0">
            <legend className="text-xs font-semibold text-slate-200 mb-2">
              {t('arena.poolPreset')}
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRESET_LIST.map((preset) => {
                const active = draft.poolPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    data-testid={`preset-${preset}`}
                    aria-pressed={active}
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                        : 'bg-[#111917] border-[#22332D] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {t(`arena.preset.${preset}` as TranslationKey)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Game Format: Cash Game vs Solo Sit-and-Go Tournament */}
          <fieldset className="border-0 p-0 m-0">
            <legend className="text-xs font-semibold text-slate-200 mb-2 inline-flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              {t('arena.formatTitle')}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  { id: 'cash' as ArenaFormat, label: t('arena.formatCash'), sub: t('arena.formatCashSub') },
                  { id: 'sng_turbo_3' as ArenaFormat, label: t('arena.formatSng3'), sub: t('arena.formatSng3Sub') },
                  { id: 'sng_6max' as ArenaFormat, label: t('arena.formatSng6'), sub: t('arena.formatSng6Sub') },
                ]
              ).map((fmt) => {
                const active = (draft.arenaFormat ?? 'cash') === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    data-testid={`format-${fmt.id}`}
                    aria-pressed={active}
                    onClick={() => {
                      if (fmt.id === 'sng_turbo_3') {
                        setDraft({
                          ...draft,
                          arenaFormat: 'sng_turbo_3',
                          tableSize: 3,
                          startingStackBb: 50,
                          botArchetypes: resizeConfigArchetypes(draft.botArchetypes, 3),
                          heroPositionLock: 'ROTATE',
                        });
                      } else if (fmt.id === 'sng_6max') {
                        setDraft({
                          ...draft,
                          arenaFormat: 'sng_6max',
                          tableSize: 6,
                          startingStackBb: 100,
                          botArchetypes: resizeConfigArchetypes(draft.botArchetypes, 6),
                          heroPositionLock: 'ROTATE',
                        });
                      } else {
                        setDraft({ ...draft, arenaFormat: 'cash' });
                      }
                    }}
                    className={`px-3 py-2 text-left rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500/15 border-amber-400 text-amber-100'
                        : 'bg-[#111917] border-[#22332D] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-xs font-semibold block">{fmt.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{fmt.sub}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Chip Display Unit & Cash Stakes */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <fieldset className="sm:col-span-5 border-0 p-0 m-0">
              <legend className="text-xs font-semibold text-slate-200 mb-2 inline-flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                {t('arena.chipUnit')}
              </legend>
              <div className="grid grid-cols-2 gap-1.5">
                {(['bb', 'usd'] as ChipDisplayUnit[]).map((unit) => {
                  const active = draftUnit === unit;
                  return (
                    <button
                      key={unit}
                      type="button"
                      data-testid={`setup-unit-${unit}`}
                      aria-pressed={active}
                      onClick={() => setDraftUnit(unit)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-[#111917] border-[#22332D] text-slate-300 hover:text-white'
                      }`}
                    >
                      {unit === 'bb' ? t('arena.unitBb') : t('arena.unitUsd')}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="sm:col-span-7 border-0 p-0 m-0">
              <legend className="text-xs font-semibold text-slate-200 mb-2">
                {t('arena.stakes')}
              </legend>
              <div className="grid grid-cols-4 gap-1.5">
                {CASH_STAKES_LIST.map((preset) => {
                  const active = draftStakesId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`setup-stakes-${preset.id}`}
                      aria-pressed={active}
                      onClick={() => {
                        setDraftStakesId(preset.id);
                        setDraftUnit('usd');
                      }}
                      className={`px-2 py-2 text-xs font-mono tabular-nums rounded-lg border transition-colors cursor-pointer ${
                        active && draftUnit === 'usd'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                          : active
                            ? 'bg-[#15221E] border-emerald-500/40 text-slate-200'
                            : 'bg-[#111917] border-[#22332D] text-slate-300 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* Table Size & Starting Stack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <fieldset className="border-0 p-0 m-0">
              <legend className="text-xs font-semibold text-slate-200 mb-2">
                {t('arena.tableSize')}
              </legend>
              <div className="grid grid-cols-2 gap-1.5">
                {TABLE_SIZES.map((sz) => {
                  const active = draft.tableSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      data-testid={`table-size-${sz}`}
                      aria-pressed={active}
                      onClick={() => handleSelectSize(sz)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                          : 'bg-[#111917] border-[#22332D] text-slate-300 hover:text-white'
                      }`}
                    >
                      {t(`arena.size${sz}` as TranslationKey)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-3">
              <fieldset className="border-0 p-0 m-0">
                <legend className="text-xs font-semibold text-slate-200 mb-2">
                  {t('arena.startingStack')}
                </legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {STACK_OPTIONS.map((st) => (
                    <button
                      key={st}
                      type="button"
                      aria-pressed={draft.startingStackBb === st}
                      onClick={() => setDraft({ ...draft, startingStackBb: st })}
                      className={`px-2 py-2 text-xs font-mono tabular-nums rounded-lg border transition-colors cursor-pointer ${
                        draft.startingStackBb === st
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                          : 'bg-[#111917] border-[#22332D] text-slate-300 hover:text-white'
                      }`}
                    >
                      {draftUnit === 'usd' ? (
                        <span className="flex flex-col items-center leading-tight">
                          <span>{formatChips(st, draftDisplay)}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{st}bb</span>
                        </span>
                      ) : (
                        `${st}bb`
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="arena-hero-pos"
                    className="text-xs font-medium text-slate-300"
                  >
                    {t('arena.heroPos')}
                  </label>
                  <select
                    id="arena-hero-pos"
                    value={draft.heroPositionLock}
                    onChange={(e) =>
                      setDraft({ ...draft, heroPositionLock: e.target.value as HeroPositionLock })
                    }
                    className="w-full bg-[#111917] border border-[#22332D] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
                  >
                    {availableLocks.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc === 'ROTATE'
                          ? t('arena.posRotate')
                          : `${t('arena.posLockPrefix')} ${loc}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="arena-bot-speed"
                    className="text-xs font-medium text-slate-300"
                  >
                    {t('arena.botSpeed')}
                  </label>
                  <select
                    id="arena-bot-speed"
                    value={draft.speed}
                    onChange={(e) =>
                      setDraft({ ...draft, speed: e.target.value as 'normal' | 'fast' })
                    }
                    className="w-full bg-[#111917] border border-[#22332D] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
                  >
                    <option value="normal">{t('arena.speedNormal')}</option>
                    <option value="fast">{t('arena.speedFast')}</option>
                  </select>
                </div>
              </div>

              {/* Bot AI Difficulty (Casual / Standard / Pro Adaptive) */}
              <fieldset className="border-0 p-0 m-0 pt-2 border-t border-[#1F2D28]/70">
                <legend className="text-xs font-semibold text-slate-200 mb-2 inline-flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  {t('arena.botDifficulty')}
                </legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['casual', 'standard', 'pro'] as BotDifficulty[]).map((diff) => {
                    const active = (draft.botDifficulty ?? 'standard') === diff;
                    const activeCls =
                      diff === 'pro'
                        ? 'bg-purple-500/20 border-purple-400 text-purple-200 font-semibold'
                        : diff === 'casual'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                          : 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold';
                    return (
                      <button
                        key={diff}
                        type="button"
                        data-testid={`setup-difficulty-${diff}`}
                        aria-pressed={active}
                        onClick={() => setDraft({ ...draft, botDifficulty: diff })}
                        className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? activeCls
                            : 'bg-[#111917] border-[#22332D] text-slate-300 hover:text-white'
                        }`}
                      >
                        {t(`arena.diff.${diff}` as TranslationKey)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                  {t(`arena.diffDesc.${draft.botDifficulty ?? 'standard'}` as TranslationKey)}
                </p>
              </fieldset>
            </div>
          </div>

          {/* Table Rules: Ante, UTG Straddle, Run It Twice */}
          <div className="bg-[#0A100E] border border-[#1F2D28] rounded-xl p-3.5 space-y-3">
            <fieldset className="border-0 p-0 m-0">
              <legend className="text-xs font-semibold text-slate-200 mb-2 inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                {t('arena.anteLabel')}
              </legend>
              <div className="grid grid-cols-3 gap-1.5">
                {ANTE_OPTIONS.map((ante) => {
                  const active = activeAnte === ante;
                  return (
                    <button
                      key={ante}
                      type="button"
                      data-testid={`setup-ante-${ante}`}
                      aria-pressed={active}
                      onClick={() => setDraft({ ...draft, anteBb: ante })}
                      className={`px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-400/20 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-[#111917] border-[#22332D] text-slate-300 hover:text-white'
                      }`}
                    >
                      {ante === 0 ? t('arena.anteOff') : `${ante}bb`}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="setup-straddle-toggle"
                aria-pressed={Boolean(draft.straddleEnabled)}
                onClick={() =>
                  setDraft({ ...draft, straddleEnabled: !draft.straddleEnabled })
                }
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  draft.straddleEnabled
                    ? 'bg-amber-400/12 border-amber-400/50'
                    : 'bg-[#111917] border-[#22332D] hover:border-slate-500'
                }`}
              >
                <Zap
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    draft.straddleEnabled ? 'text-amber-300' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-semibold text-white">{t('arena.straddle')}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    {t('arena.straddleDesc')}
                  </p>
                </div>
              </button>

              <button
                type="button"
                data-testid="setup-run-it-twice-toggle"
                aria-pressed={Boolean(draft.runItTwiceEnabled)}
                onClick={() =>
                  setDraft({ ...draft, runItTwiceEnabled: !draft.runItTwiceEnabled })
                }
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  draft.runItTwiceEnabled
                    ? 'bg-emerald-500/12 border-emerald-400/50'
                    : 'bg-[#111917] border-[#22332D] hover:border-slate-500'
                }`}
              >
                <Split
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    draft.runItTwiceEnabled ? 'text-emerald-300' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-semibold text-white">{t('arena.runItTwice')}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    {t('arena.runItTwiceDesc')}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Coach Mode & RNG Randomizer */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7 bg-[#0A100E] border border-[#1F2D28] rounded-xl p-3">
              <fieldset className="border-0 p-0 m-0">
                <legend className="text-xs font-semibold text-slate-200 mb-2 inline-flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  {t('arena.coachMode')}
                </legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {COACH_MODES.map((mode) => {
                    const active = draftCoachMode === mode;
                    const labelKey: TranslationKey =
                      mode === 'off'
                        ? 'arena.coachOff'
                        : mode === 'after_hand'
                          ? 'arena.coachAfter'
                          : 'arena.coachLive';
                    return (
                      <button
                        key={mode}
                        type="button"
                        data-testid={`setup-coach-${mode}`}
                        aria-pressed={active}
                        onClick={() => setDraftCoachMode(mode)}
                        className={`px-2 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                            : 'bg-[#111917] border-[#22332D] text-slate-300 hover:text-white'
                        }`}
                      >
                        {t(labelKey)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <button
              type="button"
              data-testid="setup-rng-toggle"
              aria-pressed={draftRngEnabled}
              onClick={() => setDraftRngEnabled((v) => !v)}
              className={`sm:col-span-5 flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                draftRngEnabled
                  ? 'bg-amber-400/12 border-amber-400/50'
                  : 'bg-[#0A100E] border-[#1F2D28] hover:border-slate-500'
              }`}
            >
              <Dices
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  draftRngEnabled ? 'text-amber-300' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-white">{t('arena.rngToggle')}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  {t('arena.rngDesc')}
                </p>
              </div>
            </button>
          </div>

          {/* Per-Seat Custom Bot Roster */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                {t('arena.customRoster')}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {locale === 'zh-CN'
                  ? `${draft.botArchetypes.length} 名 AI`
                  : `${draft.botArchetypes.length} bots`}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {draft.botArchetypes.map((arch, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 bg-[#111917] border border-[#1F2F29] rounded-lg px-3 py-2"
                >
                  <label
                    htmlFor={`bot-seat-select-${idx}`}
                    className="text-xs font-mono text-slate-300 shrink-0"
                  >
                    {t('arena.seatLabel')} {idx + 2}
                  </label>
                  <select
                    id={`bot-seat-select-${idx}`}
                    value={arch}
                    onChange={(e) =>
                      handleChangeSeatArchetype(idx, e.target.value as BotArchetype)
                    }
                    className="bg-[#0A100E] border border-[#273A33] rounded-md px-2.5 py-1 text-xs text-emerald-300 cursor-pointer max-w-[190px]"
                  >
                    {ALL_BOT_ARCHETYPES.map((opt) => (
                      <option key={opt} value={opt}>
                        {translateArchetype(locale, opt)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Deliberate Practice Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              aria-pressed={draft.blindReadMode}
              onClick={() => setDraft({ ...draft, blindReadMode: !draft.blindReadMode })}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                draft.blindReadMode
                  ? 'bg-amber-500/10 border-amber-400/50'
                  : 'bg-[#111917] border-[#22332D] hover:border-slate-500'
              }`}
            >
              <EyeOff
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  draft.blindReadMode ? 'text-amber-300' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-white">{t('arena.blindRead')}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  {t('arena.blindReadDesc')}
                </p>
              </div>
            </button>

            <button
              type="button"
              aria-pressed={draft.fastFold}
              onClick={() => setDraft({ ...draft, fastFold: !draft.fastFold })}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                draft.fastFold
                  ? 'bg-emerald-500/10 border-emerald-400/50'
                  : 'bg-[#111917] border-[#22332D] hover:border-slate-500'
              }`}
            >
              <Zap
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  draft.fastFold ? 'text-emerald-300' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-white">{t('arena.fastFold')}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  {t('arena.fastFoldDesc')}
                </p>
              </div>
            </button>

            <button
              type="button"
              data-testid="setup-auto-top-up"
              aria-pressed={draftAutoTopUp}
              onClick={() => setDraftAutoTopUp((v) => !v)}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                draftAutoTopUp
                  ? 'bg-sky-500/10 border-sky-400/50'
                  : 'bg-[#111917] border-[#22332D] hover:border-slate-500'
              }`}
            >
              <RefreshCw
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  draftAutoTopUp ? 'text-sky-300' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-white">{t('arena.autoTopUp')}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  {t('arena.autoTopUpDesc')}
                </p>
              </div>
            </button>
          </div>

          {/* Optional Arena Challenge Quick Launch */}
          {onSelectChallenge && ARENA_CHALLENGES.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span className="text-xs font-semibold text-slate-200">
                  {t('arena.challengesHeading')}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ARENA_CHALLENGES.map((spec) => (
                  <button
                    key={spec.id}
                    type="button"
                    data-testid={`setup-challenge-${spec.id}`}
                    onClick={() => {
                      onSelectChallenge(spec);
                      onClose();
                    }}
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg bg-[#0A100E] hover:bg-[#131F1B] border border-[#1F2D28] hover:border-amber-400/45 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {locale === 'zh-CN' ? spec.titleZh : spec.titleEn}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {locale === 'zh-CN' ? spec.descZh : spec.descEn}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-[10px] font-semibold rounded bg-amber-400/15 border border-amber-400/35 text-amber-200 inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <Play className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>{t('arena.challengeLaunch')}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#1B2823] bg-[#0A100E]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#141E1B] hover:bg-[#1F2F29] border border-[#283B34] text-slate-300 cursor-pointer"
          >
            {t('arena.cancel')}
          </button>
          <button
            type="button"
            data-testid="apply-arena-config"
            onClick={() => {
              const nextSbBb =
                draftUnit === 'usd' ? getCashStakes(draftStakesId).sbBb : 0.5;
              onChangeCoachMode?.(draftCoachMode);
              onChangeRngEnabled?.(draftRngEnabled);
              onApply(
                {
                  ...draft,
                  sbBb: nextSbBb,
                  anteBb: draft.anteBb ?? 0,
                  straddleEnabled: Boolean(draft.straddleEnabled),
                  runItTwiceEnabled: Boolean(draft.runItTwiceEnabled),
                },
                {
                  chipDisplayUnit: draftUnit,
                  cashStakesId: draftStakesId,
                  autoTopUp: draftAutoTopUp,
                  coachMode: draftCoachMode,
                  rngEnabled: draftRngEnabled,
                }
              );
              onClose();
            }}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
          >
            {t('arena.applyDeal')}
          </button>
        </div>
      </div>
    </div>
  );
}
