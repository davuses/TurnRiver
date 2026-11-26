import { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Play, RotateCcw } from 'lucide-react';
import type { DrillModule, UserPreferences } from '../poker/types';
import {
  FUNDAMENTALS_LESSONS,
  type FundamentalsLessonId,
} from '../poker/fundamentalsLessons';
import type { ShowdownPuzzleSlug } from '../poker/showdownPuzzles';
import { useFundamentalsStore } from '../store/useFundamentalsStore';
import { LessonInteractiveWidget } from '../components/fundamentals/LessonInteractiveWidget';
import { PlayingCard } from '../components/PlayingCard';
import { playPokerSound } from '../utils/sound';
import { useLocale } from '../i18n/LocaleContext';
import { translateModuleLabel } from '../i18n/translations';

interface FundamentalsViewProps {
  prefs: UserPreferences;
  initialPuzzleSlug?: string;
  onSolvedPuzzle?: (slug: ShowdownPuzzleSlug) => void;
  onLaunchRookieTable?: () => void;
  onNavigateDrill: (mod: DrillModule) => void;
}

export function FundamentalsView({
  prefs,
  initialPuzzleSlug,
  onSolvedPuzzle,
  onLaunchRookieTable,
  onNavigateDrill,
}: FundamentalsViewProps) {
  const { locale, t } = useLocale();
  const store = useFundamentalsStore();
  const [activeId, setActiveId] = useState<FundamentalsLessonId>(FUNDAMENTALS_LESSONS[0].id);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const activeIdx = FUNDAMENTALS_LESSONS.findIndex((l) => l.id === activeId);
  const lesson = FUNDAMENTALS_LESSONS[activeIdx >= 0 ? activeIdx : 0];
  const nextLesson = FUNDAMENTALS_LESSONS[(activeIdx + 1) % FUNDAMENTALS_LESSONS.length];

  const handleSelectOption = (questionId: string, optionId: string, correctId: string) => {
    if (answers[questionId]) return;
    const isCorrect = optionId === correctId;
    playPokerSound(isCorrect ? 'optimal' : 'mistake', prefs.soundEnabled);

    const nextAnswers = { ...answers, [questionId]: optionId };
    setAnswers(nextAnswers);

    const allAnswered = lesson.questions.every((q) => Boolean(nextAnswers[q.id]));
    if (allAnswered) {
      const correctCount = lesson.questions.filter(
        (q) => nextAnswers[q.id] === q.correctOptionId
      ).length;
      store.markLessonCompleted(lesson.id, Math.round((correctCount / lesson.questions.length) * 100));
    }
  };

  const handleSwitchLesson = (id: FundamentalsLessonId) => {
    setActiveId(id);
    setAnswers({});
  };

  const progressPct = Math.round((store.completedCount / FUNDAMENTALS_LESSONS.length) * 100);
  const isLessonComplete = store.completedIds.includes(lesson.id);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Progress Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2D28] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <h1 className="text-xl sm:text-2xl font-semibold text-white">{t('learn.title')}</h1>
          </div>
          <p className="text-xs text-slate-400">{t('learn.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right space-y-1">
            <div className="text-xs font-medium text-slate-300 tabular-nums">
              {store.completedCount} / {FUNDAMENTALS_LESSONS.length} {t('learn.progress')}
            </div>
            <div className="w-36 h-1.5 rounded-full bg-[#141E1B] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-200 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {store.completedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                store.resetFundamentalsProgress();
                setAnswers({});
              }}
              className="p-2 rounded-lg bg-[#0E1513] border border-[#1F2D28] text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label={t('learn.resetProgress')}
              title={t('learn.resetProgress')}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Horizontal Lesson Selector */}
      <div className="lg:hidden no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {FUNDAMENTALS_LESSONS.map((item) => {
          const active = item.id === lesson.id;
          const done = store.completedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSwitchLesson(item.id)}
              className={`px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                active
                  ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                  : 'bg-[#0E1513] border-[#1F2D28] text-slate-300'
              }`}
            >
              {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />}
              <span>
                {item.order}. {item.title[locale]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Lesson Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Left Lesson Rail */}
        <aside className="hidden lg:block lg:col-span-4 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-3 space-y-1.5">
          {FUNDAMENTALS_LESSONS.map((item) => {
            const active = item.id === lesson.id;
            const done = store.completedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSwitchLesson(item.id)}
                className={`w-full text-left px-3.5 py-3 rounded-lg border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  active
                    ? 'bg-[#141E1B] border-emerald-400/50 text-white'
                    : 'bg-transparent border-transparent text-slate-300 hover:bg-[#121B18] hover:text-white'
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="text-sm font-semibold leading-snug">
                    {item.order}. {item.title[locale]}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {item.durationMin} {t('learn.minRead')} · {translateModuleLabel(locale, item.targetModule)}
                  </div>
                </div>
                {done && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </aside>

        {/* Right Active Lesson Stage */}
        <div className="lg:col-span-8 min-w-0 bg-[#0E1513] border border-[#1F2D28] rounded-xl p-5 sm:p-7 space-y-6">
          {/* Lesson Title & Summary */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl sm:text-2xl font-semibold text-white">
                {lesson.title[locale]}
              </h2>
              {isLessonComplete && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>{t('learn.completedBadge')}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#E5B95C]">{lesson.subtitle[locale]}</p>
            <p className="text-sm text-slate-300 leading-relaxed max-w-[65ch] pt-1">
              {lesson.summary[locale]}
            </p>
          </div>

          {/* Tailored Interactive Visual Sandbox */}
          <LessonInteractiveWidget
            lessonId={lesson.id}
            fourColor={prefs.fourColorDeck}
            initialPuzzleSlug={initialPuzzleSlug}
            onSolvedPuzzle={onSolvedPuzzle}
          />

          {/* 3 Key Takeaways */}
          <div className="space-y-2.5 border-t border-[#1C2A25] pt-5">
            <h3 className="text-sm font-semibold text-white">{t('learn.takeaways')}</h3>
            <ul className="space-y-2 text-sm text-slate-300 leading-relaxed">
              {lesson.keyTakeaways.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                  <span>{point[locale]}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2-Question Quick Check */}
          <div className="space-y-4 border-t border-[#1C2A25] pt-5">
            <h3 className="text-sm font-semibold text-white">{t('learn.quickCheck')}</h3>

            <div className="space-y-4">
              {lesson.questions.map((q, qIdx) => {
                const chosen = answers[q.id];
                const isAnswered = Boolean(chosen);
                const isCorrect = chosen === q.correctOptionId;

                return (
                  <div
                    key={q.id}
                    data-testid={`lesson-question-${q.id}`}
                    className="bg-[#0A100E] border border-[#1B2823] rounded-xl p-4 space-y-3"
                  >
                    <p className="text-sm font-medium text-white leading-snug">
                      {qIdx + 1}. {q.prompt[locale]}
                    </p>

                    {(q.board || q.heroCards) && (
                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        {q.heroCards && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-emerald-300 font-medium mr-1">
                              {t('common.hero')}
                            </span>
                            <PlayingCard card={q.heroCards[0]} fourColor={prefs.fourColorDeck} size="xs" />
                            <PlayingCard card={q.heroCards[1]} fourColor={prefs.fourColorDeck} size="xs" />
                          </div>
                        )}
                        {q.board && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-[#E5B95C] font-medium mr-1">
                              {locale === 'zh-CN' ? '公共牌' : 'Board'}
                            </span>
                            {q.board.map((c, idx) => (
                              <PlayingCard key={idx} card={c} fourColor={prefs.fourColorDeck} size="xs" />
                            ))}
                          </div>
                        )}
                        {q.villainCards && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-sky-300 font-medium mr-1">
                              {t('common.villain')}
                            </span>
                            <PlayingCard card={q.villainCards[0]} fourColor={prefs.fourColorDeck} size="xs" />
                            <PlayingCard card={q.villainCards[1]} fourColor={prefs.fourColorDeck} size="xs" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {q.options.map((opt) => {
                        const isThisChosen = chosen === opt.id;
                        const isThisCorrect = opt.id === q.correctOptionId;
                        let btnStyle =
                          'bg-[#0E1513] border-[#22332D] text-slate-200 hover:border-emerald-400/60 hover:text-white';
                        if (isAnswered) {
                          if (isThisCorrect) {
                            btnStyle = 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold';
                          } else if (isThisChosen) {
                            btnStyle = 'bg-rose-500/20 border-rose-400 text-rose-200';
                          } else {
                            btnStyle = 'bg-[#0E1513] border-[#1A2622] text-slate-500';
                          }
                        }
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isAnswered}
                            onClick={() => handleSelectOption(q.id, opt.id, q.correctOptionId)}
                            className={`px-3 py-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer disabled:cursor-default ${btnStyle}`}
                          >
                            {opt.label[locale]}
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <div
                        className={`text-xs leading-relaxed rounded-lg px-3 py-2 border ${
                          isCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        }`}
                      >
                        <span className="font-semibold mr-1.5">
                          {isCorrect ? t('learn.correct') : t('learn.tryAgain')}
                        </span>
                        <span className="text-slate-200">{q.explanation[locale]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Bridge Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1C2A25] pt-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onNavigateDrill(lesson.targetModule)}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#04110C] inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>
                  {t('learn.practiceNow')} {translateModuleLabel(locale, lesson.targetModule)}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              {onLaunchRookieTable && (
                <button
                  type="button"
                  data-testid="launch-rookie-table-btn"
                  onClick={onLaunchRookieTable}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/45 text-amber-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('learn.rookieTableCta')}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSwitchLesson(nextLesson.id)}
              className="max-w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[#141E1B] hover:bg-[#1D2D27] border border-[#273A33] text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="truncate">
                {t('learn.nextLesson')}: {nextLesson.title[locale]}
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
