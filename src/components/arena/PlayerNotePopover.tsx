import { useEffect, useRef } from 'react';
import { CheckCircle2, EyeOff, Lock, X, XCircle } from 'lucide-react';
import {
  ALL_BOT_ARCHETYPES,
  computeHudDisplay,
  type BotArchetype,
  type TableSeat,
} from '../../poker/tableEngine';
import {
  COLOR_TAG_DOT,
  type OpponentScoutingNote,
  type PlayerColorTag,
} from '../../store/useArenaSessionStore';
import { useLocale } from '../../i18n/LocaleContext';
import { translateArchetype } from '../../i18n/translations';

export interface PlayerNotePopoverProps {
  seat: TableSeat;
  note: OpponentScoutingNote;
  blindReadMode: boolean;
  onSaveNote: (patch: Partial<OpponentScoutingNote>) => void;
  onClose: () => void;
}

const COLOR_TAGS: { id: PlayerColorTag; labelEn: string; labelZh: string; swatchClass: string }[] = [
  { id: 'none', labelEn: 'None', labelZh: '无', swatchClass: 'bg-[#141E1B] border-slate-500/70' },
  { id: 'red', labelEn: 'Red', labelZh: '红色', swatchClass: 'bg-rose-500 border-rose-300' },
  { id: 'green', labelEn: 'Green', labelZh: '绿色', swatchClass: 'bg-emerald-500 border-emerald-300' },
  { id: 'blue', labelEn: 'Blue', labelZh: '蓝色', swatchClass: 'bg-sky-500 border-sky-300' },
  { id: 'gold', labelEn: 'Gold', labelZh: '金色', swatchClass: 'bg-amber-400 border-amber-200' },
  { id: 'purple', labelEn: 'Purple', labelZh: '紫色', swatchClass: 'bg-violet-500 border-violet-300' },
];

const BLIND_READ_MIN_HANDS = 5;

export function PlayerNotePopover({
  seat,
  note,
  blindReadMode,
  onSaveNote,
  onClose,
}: PlayerNotePopoverProps) {
  const { locale, t } = useLocale();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prevActive =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      prevActive?.focus();
    };
  }, []);

  const hud = computeHudDisplay(seat.stats);
  const hasGuessed = Boolean(note.blindReadGuess);
  const revealArchetype = !blindReadMode || hasGuessed;
  const canGuessBlindRead = seat.stats.handsDealt >= BLIND_READ_MIN_HANDS;

  const archetypeLabel =
    seat.archetype === 'Hero'
      ? seat.archetype
      : revealArchetype
        ? translateArchetype(locale, seat.archetype)
        : t('arena.hiddenTag');

  const handleSelectGuess = (guess: BotArchetype) => {
    const isCorrect = guess === seat.archetype;
    onSaveNote({
      blindReadGuess: guess,
      blindReadCorrect: isCorrect,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-note-popover-title"
      data-testid="player-note-popover"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[#0E1513] border border-[#243630] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[#1B2823] bg-[#0A100E]">
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-emerald-400">{t('arena.playerProfile')}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_TAG_DOT[note.colorTag]}`}
                aria-hidden="true"
              />
              <h3
                id="player-note-popover-title"
                className="text-sm font-semibold text-white truncate"
              >
                {seat.name}
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#15221E] border border-[#243630] text-slate-300">
                {seat.position}
              </span>
              <span
                data-testid="popover-archetype-badge"
                className={`px-2 py-0.5 text-[10px] font-medium rounded border inline-flex items-center gap-1 ${
                  revealArchetype
                    ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-200'
                    : 'bg-amber-500/12 border-amber-400/35 text-amber-200'
                }`}
              >
                {!revealArchetype && <EyeOff className="w-2.5 h-2.5" aria-hidden="true" />}
                <span>{archetypeLabel}</span>
              </span>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            data-testid="close-player-note-popover"
            onClick={onClose}
            aria-label={t('arena.cancel')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#17231F] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Extended HUD Grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t('arena.hudColHands'), val: String(seat.stats.handsDealt) },
              { label: t('arena.hudColVpip'), val: `${hud.vpipPct}%` },
              { label: t('arena.hudColPfr'), val: `${hud.pfrPct}%` },
              { label: t('arena.hudCol3b'), val: `${hud.threeBetPct}%` },
              { label: t('arena.cbetCol'), val: `${hud.cbetPct ?? 0}%` },
              { label: t('arena.foldToCbetCol'), val: `${hud.foldToCbetPct ?? 0}%` },
              { label: t('arena.wtsdCol'), val: `${hud.wtsdPct ?? 0}%` },
              { label: t('arena.hudColAf'), val: hud.af },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-[#0A100E] border border-[#1B2823] rounded-lg px-2 py-1.5 text-center"
              >
                <p className="text-[10px] text-slate-400 truncate">{item.label}</p>
                <p className="text-xs font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
                  {item.val}
                </p>
              </div>
            ))}
          </div>

          {/* Color Tag Picker */}
          <fieldset className="border-0 p-0 m-0 space-y-2">
            <legend className="text-xs font-semibold text-slate-200">
              {t('arena.colorTag')}
            </legend>
            <div className="flex items-center gap-2">
              {COLOR_TAGS.map((tag) => {
                const active = note.colorTag === tag.id;
                const ariaLabel = locale === 'zh-CN' ? tag.labelZh : tag.labelEn;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    data-testid={`color-tag-${tag.id}`}
                    aria-label={ariaLabel}
                    aria-pressed={active}
                    onClick={() => onSaveNote({ colorTag: tag.id })}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
                      tag.swatchClass
                    } ${active ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0E1513] scale-105' : 'opacity-75 hover:opacity-100'}`}
                  >
                    {tag.id === 'none' && (
                      <X className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Custom Note Textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="opponent-scouting-note"
              className="block text-xs font-semibold text-slate-200"
            >
              {t('arena.playerNote')}
            </label>
            <textarea
              id="opponent-scouting-note"
              data-testid="opponent-note-textarea"
              rows={3}
              value={note.note}
              onChange={(e) => onSaveNote({ note: e.target.value })}
              placeholder={t('arena.notePlaceholder')}
              className="w-full rounded-lg bg-[#0A100E] border border-[#22332D] focus:border-emerald-400 focus:outline-none px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 resize-none leading-relaxed"
            />
          </div>

          {/* Blind-Read Archetype Guess Quiz */}
          {blindReadMode && !seat.isHero && (
            <div
              data-testid="blind-read-quiz"
              className="bg-[#0A100E] border border-amber-400/30 rounded-lg p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-200">
                  {t('arena.blindReadGuess')}
                </span>
                <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                  {seat.stats.handsDealt}H
                </span>
              </div>

              {!canGuessBlindRead ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                  <Lock className="w-3.5 h-3.5 text-amber-300/80 shrink-0" aria-hidden="true" />
                  <span>
                    {t('arena.guessNeedMoreHands')} ({seat.stats.handsDealt}/{BLIND_READ_MIN_HANDS})
                  </span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_BOT_ARCHETYPES.map((arch) => {
                      const selected = note.blindReadGuess === arch;
                      const isActual = arch === seat.archetype;
                      const showMatch = hasGuessed && selected;
                      return (
                        <button
                          key={arch}
                          type="button"
                          data-testid={`blind-guess-${arch.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                          aria-pressed={selected}
                          onClick={() => handleSelectGuess(arch)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer truncate ${
                            showMatch && isActual
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                              : showMatch && !isActual
                                ? 'bg-rose-500/20 border-rose-400 text-rose-200 font-semibold'
                                : 'bg-[#111917] border-[#22332D] text-slate-300 hover:border-amber-400/50 hover:text-white'
                          }`}
                        >
                          {translateArchetype(locale, arch)}
                        </button>
                      );
                    })}
                  </div>

                  {hasGuessed && (
                    <div
                      data-testid="blind-read-feedback"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium ${
                        note.blindReadCorrect
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                          : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                      }`}
                    >
                      {note.blindReadCorrect ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        {note.blindReadCorrect
                          ? t('arena.guessCorrect')
                          : `${t('arena.guessWrong')} (${translateArchetype(locale, seat.archetype)})`}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
