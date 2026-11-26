import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Link2, RotateCcw } from 'lucide-react';
import type { Card, Position } from '../../poker/types';
import type { FundamentalsLessonId } from '../../poker/fundamentalsLessons';
import { cardKey, compareShowdownCards } from '../../poker/evaluator';
import { PREFLOP_TEMPLATES } from '../../poker/preflopRanges';
import {
  SHOWDOWN_PUZZLES,
  type ShowdownPuzzleSlug,
} from '../../poker/showdownPuzzles';
import { copyShareUrl } from '../../utils/shareLink';
import { PlayingCard, type CardHighlightState } from '../PlayingCard';
import { RangeMatrix13x13 } from '../RangeMatrix13x13';
import { useLocale } from '../../i18n/LocaleContext';

interface LessonInteractiveWidgetProps {
  lessonId: FundamentalsLessonId;
  fourColor: boolean;
  initialPuzzleSlug?: string;
  onSolvedPuzzle?: (slug: ShowdownPuzzleSlug) => void;
}

const SEAT_GUIDE: {
  pos: Position;
  rfiPct: string;
  samples: string;
  noteEn: string;
  noteZh: string;
}[] = [
  {
    pos: 'UTG',
    rfiPct: '~16%',
    samples: '77+, ATs+, KQs, AQo+',
    noteEn: '5 players behind — play tight, strong high-card hands.',
    noteZh: '身后还有 5 人未行动，坚持紧手强牌开池。',
  },
  {
    pos: 'HJ',
    rfiPct: '~21%',
    samples: '66+, A9s+, KJs+, QJs, AJo+',
    noteEn: '4 players behind — add medium pairs and suited broadways.',
    noteZh: '身后剩 4 人，可加入中等口袋对与同花大牌。',
  },
  {
    pos: 'CO',
    rfiPct: '~29%',
    samples: '44+, A5s+, K9s+, 76s+, KJo+',
    noteEn: 'Only BTN and blinds left — start stealing with suited connectors.',
    noteZh: '仅剩庄位与大小盲，可加入同花连张积极偷盲。',
  },
  {
    pos: 'BTN',
    rfiPct: '~46%',
    samples: '22+, A2s+, K5s+, 54s+, Q9o+',
    noteEn: 'Best seat at the table — acts last on flop, turn, and river.',
    noteZh: '全场最佳位置——翻牌、转牌、河牌永远最后行动。',
  },
  {
    pos: 'SB',
    rfiPct: '~40% (vs BB)',
    samples: 'Raise or fold vs opens',
    noteEn: 'Worst postflop position — acts first on every street.',
    noteZh: '翻后最不利位置——每条街都必须最先表态。',
  },
  {
    pos: 'BB',
    rfiPct: 'Defend wide',
    samples: 'Already invested 1bb',
    noteEn: 'Closes preflop action with a discount — defend suited & connected hands.',
    noteZh: '已投入 1bb 且翻前最后行动，可凭赔率折扣宽范围防守。',
  },
];

const ARCHETYPE_CARDS: {
  id: string;
  nameEn: string;
  nameZh: string;
  vpip: number;
  pfr: number;
  threeBet: number;
  exploitEn: string;
  exploitZh: string;
}[] = [
  {
    id: 'reg',
    nameEn: 'Balanced Reg',
    nameZh: '均衡常客',
    vpip: 24,
    pfr: 19,
    threeBet: 8,
    exploitEn: 'Solid baseline — stick to sound ranges and look for subtle sizing leaks.',
    exploitZh: '均衡打法——坚持扎实范围，关注位置与下注尺度细节。',
  },
  {
    id: 'tag',
    nameEn: 'Tight-Aggressive (TAG)',
    nameZh: '紧凶型 (TAG)',
    vpip: 19,
    pfr: 16,
    threeBet: 8,
    exploitEn: 'Respect big turn/river raises; attack their capped check-back ranges.',
    exploitZh: '尊重其转河牌重注；在其过牌示弱时积极争夺底池。',
  },
  {
    id: 'lag',
    nameEn: 'Loose-Aggressive (LAG)',
    nameZh: '松凶型 (LAG)',
    vpip: 33,
    pfr: 27,
    threeBet: 12,
    exploitEn: 'Call down lighter with top/middle pair and trap occasionally with monsters.',
    exploitZh: '拿着顶对、中对更耐心地抓诈唬，强牌偶尔慢打设陷阱。',
  },
  {
    id: 'station',
    nameEn: 'Calling Station',
    nameZh: '跟注站',
    vpip: 49,
    pfr: 10,
    threeBet: 2,
    exploitEn: 'Stop bluffing! Value bet thinner and larger with one-pair+ hands.',
    exploitZh: '收起纯诈唬！拿着中等以上成牌做更薄、更大的价值下注。',
  },
  {
    id: 'nit',
    nameEn: 'Tight Nit',
    nameZh: '紧弱型 (Nit)',
    vpip: 14,
    pfr: 11,
    threeBet: 3,
    exploitEn: 'Steal their blinds relentlessly and over-fold when they wake up raising.',
    exploitZh: '频繁偷盲施压；一旦他们突然主动加注，果断弃掉边缘牌。',
  },
  {
    id: 'maniac',
    nameEn: 'Maniac',
    nameZh: '激进型 (Maniac)',
    vpip: 52,
    pfr: 41,
    threeBet: 20,
    exploitEn: 'Tighten bluffs, widen bluff-catchers, and let them fire into your value.',
    exploitZh: '减少无谓诈唬，放宽跟注抓诈唬范围，让对方自己送筹码。',
  },
];

export function LessonInteractiveWidget({
  lessonId,
  fourColor,
  initialPuzzleSlug,
  onSolvedPuzzle,
}: LessonInteractiveWidgetProps) {
  const { locale } = useLocale();
  const isZh = locale === 'zh-CN';

  // Widget 1 state (10-puzzle Showdown Pack + Tap-the-Decider)
  const [showdownIdx, setShowdownIdx] = useState(() => {
    if (initialPuzzleSlug) {
      const found = SHOWDOWN_PUZZLES.findIndex((p) => p.slug === initialPuzzleSlug);
      if (found >= 0) return found;
    }
    return 0;
  });
  const [showdownGuess, setShowdownGuess] = useState<'hero' | 'villain' | 'split' | null>(null);
  const [solvedSlugs, setSolvedSlugs] = useState<Set<ShowdownPuzzleSlug>>(() => new Set());
  const [tappedCardKey, setTappedCardKey] = useState<string | null>(null);
  const [copiedPuzzleLink, setCopiedPuzzleLink] = useState(false);

  useEffect(() => {
    if (!initialPuzzleSlug) return;
    const found = SHOWDOWN_PUZZLES.findIndex((p) => p.slug === initialPuzzleSlug);
    if (found >= 0) {
      setShowdownIdx(found);
      setShowdownGuess(null);
      setTappedCardKey(null);
    }
  }, [initialPuzzleSlug]);
  // Widget 2 state
  const [selectedPos, setSelectedPos] = useState<Position>('BTN');
  // Widget 3 state
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'pairs' | 'suited' | 'offsuit'>('all');
  const [inspectedHand, setInspectedHand] = useState<string>('KJs');
  // Widget 4 state
  const [betPct, setBetPct] = useState<33 | 50 | 75 | 100>(50);
  const [drawType, setDrawType] = useState<'flush' | 'oesd'>('flush');
  // Widget 5 state
  const [boardKind, setBoardKind] = useState<'dry' | 'wet'>('dry');
  // Widget 6 state
  const [archIdx, setArchIdx] = useState(3);

  const utgTemplate = useMemo(
    () => PREFLOP_TEMPLATES.find((tpl) => tpl.id === 'rfi-utg') ?? PREFLOP_TEMPLATES[0],
    []
  );

  const filteredMatrix = useMemo(() => {
    if (matrixFilter === 'all') return utgTemplate.matrix;
    const out: typeof utgTemplate.matrix = {};
    for (const [hand, strat] of Object.entries(utgTemplate.matrix)) {
      const isPair = hand.length === 2;
      const isSuited = hand.endsWith('s');
      const isOffsuit = hand.endsWith('o');
      const keep =
        (matrixFilter === 'pairs' && isPair) ||
        (matrixFilter === 'suited' && isSuited) ||
        (matrixFilter === 'offsuit' && isOffsuit);
      out[hand] = keep ? strat : { ...strat, raise: 0, call: 0, fold: 100 };
    }
    return out;
  }, [utgTemplate.matrix, matrixFilter]);

  if (lessonId === 'hand_rankings') {
    const puzzle = SHOWDOWN_PUZZLES[showdownIdx] ?? SHOWDOWN_PUZZLES[0];
    const comparison = compareShowdownCards(puzzle.hero, puzzle.villain, puzzle.board);
    const isAnswered = showdownGuess !== null;
    const isCorrect = showdownGuess === comparison.winner;
    const decidingSet = new Set(comparison.decidingCardKeys);
    const heroBestSet = new Set(comparison.heroBestKeys);
    const villainBestSet = new Set(comparison.villainBestKeys);

    const selectPuzzle = (idx: number) => {
      const wrapped = (idx + SHOWDOWN_PUZZLES.length) % SHOWDOWN_PUZZLES.length;
      setShowdownIdx(wrapped);
      setShowdownGuess(null);
      setTappedCardKey(null);
      setCopiedPuzzleLink(false);
    };

    const handleGuess = (pick: 'hero' | 'villain' | 'split') => {
      if (isAnswered) return;
      setShowdownGuess(pick);
      setTappedCardKey(null);
      if (pick === comparison.winner) {
        setSolvedSlugs((prev) => new Set(prev).add(puzzle.slug));
        onSolvedPuzzle?.(puzzle.slug);
      }
    };

    const handleCopyLink = async () => {
      const ok = await copyShareUrl({ view: 'learn', puzzle: puzzle.slug });
      if (ok) {
        setCopiedPuzzleLink(true);
        window.setTimeout(() => setCopiedPuzzleLink(false), 1800);
      }
    };

    const cardStateFor = (
      key: string,
      sideBestSet: Set<string>
    ): CardHighlightState => {
      if (!isAnswered) return 'none';
      if (decidingSet.has(key)) return 'decider';
      return sideBestSet.has(key) ? 'used' : 'dimmed';
    };

    const showTapDecider =
      isAnswered && Boolean(puzzle.tapDeciderTarget && puzzle.tapDeciderCardKey);
    const tapTargetCards =
      puzzle.tapDeciderTarget === 'hero' ? puzzle.hero : puzzle.villain;
    const tapCorrect = tappedCardKey === puzzle.tapDeciderCardKey;

    return (
      <div
        data-testid="showdown-puzzle-pack"
        className="felt-surface rounded-xl border border-emerald-400/20 p-4 sm:p-5 space-y-4"
      >
        {/* Top Bar: Stepper + Share Link */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#E5B95C]">
                {isZh
                  ? `摊牌谜题 ${showdownIdx + 1} / ${SHOWDOWN_PUZZLES.length}`
                  : `Showdown Puzzle ${showdownIdx + 1} / ${SHOWDOWN_PUZZLES.length}`}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-emerald-300">
                {solvedSlugs.size}/{SHOWDOWN_PUZZLES.length}{' '}
                {isZh ? '已破解' : 'solved'}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              {puzzle.title[locale]}{' '}
              <span className="text-xs font-normal text-slate-300">
                — {puzzle.hook[locale]}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="copy-puzzle-link-btn"
              onClick={handleCopyLink}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#0A100E]/90 border border-[#243630] text-slate-200 hover:border-emerald-400/60 hover:text-white inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              {copiedPuzzleLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Link2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              )}
              <span>
                {copiedPuzzleLink
                  ? isZh
                    ? '已复制链接'
                    : 'Link Copied'
                  : isZh
                    ? '复制谜题链接'
                    : 'Copy Link'}
              </span>
            </button>
            <button
              type="button"
              aria-label={isZh ? '上一题' : 'Previous puzzle'}
              onClick={() => selectPuzzle(showdownIdx - 1)}
              className="p-1.5 rounded-md bg-[#0A100E]/90 border border-[#243630] text-slate-300 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={isZh ? '下一题' : 'Next puzzle'}
              onClick={() => selectPuzzle(showdownIdx + 1)}
              className="p-1.5 rounded-md bg-[#0A100E]/90 border border-[#243630] text-slate-300 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 10-Puzzle Quick Selector Strip */}
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5">
          {SHOWDOWN_PUZZLES.map((item, idx) => {
            const active = idx === showdownIdx;
            const done = solvedSlugs.has(item.slug);
            return (
              <button
                key={item.slug}
                type="button"
                onClick={() => selectPuzzle(idx)}
                className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-500 text-[#04110C] border-emerald-400 font-semibold'
                    : done
                      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40'
                      : 'bg-[#0A100E]/80 text-slate-400 border-[#1F2D28] hover:text-white'
                }`}
              >
                {idx + 1}
                {done ? ' ✓' : ''}
              </button>
            );
          })}
        </div>

        {/* Community Board */}
        <div className="flex flex-col items-center gap-3">
          <div className="space-y-1 text-center">
            <span className="text-[11px] font-mono text-amber-200/80">
              {isZh ? '公共牌 (5 张)' : 'Community Board'}
            </span>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              {puzzle.board.map((c, i) => {
                const ck = cardKey(c);
                const boardState: CardHighlightState = !isAnswered
                  ? 'none'
                  : decidingSet.has(ck)
                    ? 'decider'
                    : heroBestSet.has(ck) || villainBestSet.has(ck)
                      ? 'used'
                      : 'dimmed';
                return (
                  <PlayingCard
                    key={i}
                    card={c}
                    fourColor={fourColor}
                    size="sm"
                    highlightState={boardState}
                  />
                );
              })}
            </div>
          </div>

          {/* Hero vs Villain Hole Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div
              className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                isAnswered && comparison.winner === 'hero'
                  ? 'bg-emerald-500/15 border-emerald-400/60'
                  : 'bg-[#0A100E]/80 border-[#1F2D28]'
              }`}
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold text-white block">
                  {isZh ? '我方 Hero' : 'Hero'}
                  {isAnswered && comparison.winner === 'hero' && (
                    <span className="text-emerald-300 ml-1.5">
                      {isZh ? '✓ 获胜' : '✓ Wins'}
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-300">
                  {isAnswered
                    ? comparison.heroEval.label
                    : isZh
                      ? '先判断谁赢'
                      : 'Who wins?'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {puzzle.hero.map((c, i) => (
                  <PlayingCard
                    key={i}
                    card={c}
                    fourColor={fourColor}
                    size="sm"
                    highlightState={cardStateFor(cardKey(c), heroBestSet)}
                  />
                ))}
              </div>
            </div>

            <div
              className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                isAnswered && comparison.winner === 'villain'
                  ? 'bg-emerald-500/15 border-emerald-400/60'
                  : 'bg-[#0A100E]/80 border-[#1F2D28]'
              }`}
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold text-white block">
                  {isZh ? '对手 Villain' : 'Villain'}
                  {isAnswered && comparison.winner === 'villain' && (
                    <span className="text-emerald-300 ml-1.5">
                      {isZh ? '✓ 获胜' : '✓ Wins'}
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-300">
                  {isAnswered
                    ? comparison.villainEval.label
                    : isZh
                      ? '先判断谁赢'
                      : 'Who wins?'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {puzzle.villain.map((c, i) => (
                  <PlayingCard
                    key={i}
                    card={c}
                    fourColor={fourColor}
                    size="sm"
                    highlightState={cardStateFor(cardKey(c), villainBestSet)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Active Guess Buttons */}
          <div className="grid grid-cols-3 gap-2 w-full">
            {(
              [
                { id: 'hero', en: 'Hero Wins', zh: '我方赢' },
                { id: 'split', en: 'Split Pot', zh: '平分底池' },
                { id: 'villain', en: 'Villain Wins', zh: '对手赢' },
              ] as const
            ).map((opt) => {
              const picked = showdownGuess === opt.id;
              const right = comparison.winner === opt.id;
              let cls =
                'bg-[#0A100E]/90 border-[#243630] text-slate-200 hover:border-emerald-400/60 hover:text-white';
              if (isAnswered) {
                if (right) {
                  cls = 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold';
                } else if (picked) {
                  cls = 'bg-rose-500/20 border-rose-400 text-rose-200';
                } else {
                  cls = 'bg-[#0A100E]/60 border-[#1B2823] text-slate-500';
                }
              }
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`showdown-guess-${opt.id}`}
                  disabled={isAnswered}
                  onClick={() => handleGuess(opt.id)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:cursor-default ${cls}`}
                >
                  {isZh ? opt.zh : opt.en}
                </button>
              );
            })}
          </div>

          {/* Post-Answer: Best-5 Side-by-Side Diff + Tap Deciding Card + Rule Takeaway */}
          {isAnswered && (
            <div className="w-full space-y-3 pt-1">
              <div
                className={`rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed ${
                  isCorrect
                    ? 'bg-emerald-500/12 border-emerald-400/40 text-emerald-100'
                    : 'bg-amber-500/12 border-amber-400/40 text-amber-100'
                }`}
              >
                <span className="font-semibold mr-1.5">
                  {isCorrect
                    ? isZh
                      ? '判断正确！'
                      : 'Spot on!'
                    : isZh
                      ? '差一点——'
                      : 'Not quite —'}
                </span>
                <span>{puzzle.explanation[locale]}</span>
              </div>

              {/* Best-5 Visual Comparison with Gold Decider Ring */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#08100D]/85 border border-[#1E2E28] rounded-lg p-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-slate-300">
                    {isZh ? '我方最佳 5 张' : 'Hero’s Best Five'} ·{' '}
                    <span className="text-emerald-300">{comparison.heroEval.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {comparison.heroEval.bestFive.map((c, idx) => (
                      <PlayingCard
                        key={idx}
                        card={c}
                        fourColor={fourColor}
                        size="xs"
                        highlightState={decidingSet.has(cardKey(c)) ? 'decider' : 'used'}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-slate-300">
                    {isZh ? '对手最佳 5 张' : 'Villain’s Best Five'} ·{' '}
                    <span className="text-sky-300">{comparison.villainEval.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {comparison.villainEval.bestFive.map((c, idx) => (
                      <PlayingCard
                        key={idx}
                        card={c}
                        fourColor={fourColor}
                        size="xs"
                        highlightState={decidingSet.has(cardKey(c)) ? 'decider' : 'used'}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive "Tap the Deciding Card" Check */}
              {showTapDecider && (
                <div
                  data-testid="tap-deciding-card-box"
                  className="bg-[#0A100E]/90 border border-amber-400/35 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-amber-300">
                      {isZh
                        ? '加试：点击赢家手牌中打破平局的那张牌'
                        : 'Bonus: Tap the winning side’s deciding card'}
                    </p>
                    {tappedCardKey && (
                      <p
                        className={`text-[11px] ${
                          tapCorrect ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {tapCorrect
                          ? isZh
                            ? '✓ 找对了！就是这张关键牌决出胜负。'
                            : '✓ Exact match — that card breaks the tie.'
                          : isZh
                            ? '不是这张，再点另一张试试。'
                            : 'Not that one — tap the other hole card.'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {tapTargetCards.map((c) => {
                      const ck = cardKey(c);
                      const pickedThis = tappedCardKey === ck;
                      return (
                        <PlayingCard
                          key={ck}
                          card={c}
                          fourColor={fourColor}
                          size="xs"
                          highlightState={
                            pickedThis && tapCorrect
                              ? 'decider'
                              : pickedThis
                                ? 'dimmed'
                                : 'none'
                          }
                          onClick={() => setTappedCardKey(ck)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Progressive Disclosure Rule Takeaway + Retry / Next */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0A100E]/80 border border-[#1B2823] rounded-lg px-3 py-2">
                <p className="text-[11px] text-slate-300">
                  <span className="font-semibold text-[#E5B95C] mr-1">
                    {isZh ? '决胜规则：' : 'What decides this hand:'}
                  </span>
                  {puzzle.ruleTakeaway[locale]}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowdownGuess(null);
                      setTappedCardKey(null);
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[#141E1B] border border-[#243630] text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>{isZh ? '重做' : 'Retry'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPuzzle(showdownIdx + 1)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-500 hover:bg-emerald-400 text-[#04110C] cursor-pointer"
                  >
                    {isZh ? '下一题 →' : 'Next Puzzle →'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (lessonId === 'position_power') {
    const active = SEAT_GUIDE.find((s) => s.pos === selectedPos) ?? SEAT_GUIDE[3];
    return (
      <div className="bg-[#0A100E] border border-[#1F2D28] rounded-xl p-4 sm:p-5 space-y-4">
        <span className="text-xs font-semibold text-[#E5B95C] block">
          {isZh ? '交互演示 · 点击 6 人桌任意位置查看开池宽度' : 'Interactive · Click Any 6-Max Seat'}
        </span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SEAT_GUIDE.map((seat) => {
            const isSel = seat.pos === selectedPos;
            return (
              <button
                key={seat.pos}
                type="button"
                onClick={() => setSelectedPos(seat.pos)}
                className={`px-3 py-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-emerald-500 text-[#04110C] border-emerald-400 font-bold'
                    : 'bg-[#0E1513] text-slate-200 border-[#1F2D28] hover:border-emerald-400/50'
                }`}
              >
                <span className="block text-sm font-semibold">{seat.pos}</span>
                <span
                  className={`block text-[11px] tabular-nums mt-0.5 ${
                    isSel ? 'text-[#04110C]/80' : 'text-slate-400'
                  }`}
                >
                  {seat.rfiPct}
                </span>
              </button>
            );
          })}
        </div>
        <div className="rounded-lg bg-[#0E1513] border border-[#1F2D28] p-4 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-white">
              {active.pos} · <span className="text-emerald-400 tabular-nums">{active.rfiPct}</span>
            </span>
            <span className="text-xs tabular-nums text-[#E5B95C]">{active.samples}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isZh ? active.noteZh : active.noteEn}
          </p>
        </div>
      </div>
    );
  }

  if (lessonId === 'matrix_basics') {
    const cell = utgTemplate.matrix[inspectedHand] ?? utgTemplate.matrix['KJs'];
    const combos = inspectedHand.length === 2 ? 6 : inspectedHand.endsWith('s') ? 4 : 12;
    return (
      <div className="bg-[#0A100E] border border-[#1F2D28] rounded-xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#E5B95C]">
            {isZh ? '交互演示 · UTG 13×13 矩阵（点击高亮区域）' : 'Interactive · UTG 13×13 Matrix Explorer'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', en: 'All', zh: '全部' },
                { id: 'pairs', en: 'Pairs (6)', zh: '对子 (6)' },
                { id: 'suited', en: 'Suited (4)', zh: '同花 (4)' },
                { id: 'offsuit', en: 'Offsuit (12)', zh: '杂色 (12)' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setMatrixFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  matrixFilter === f.id
                    ? 'bg-emerald-500 text-[#04110C] border-emerald-400 font-semibold'
                    : 'bg-[#0E1513] text-slate-300 border-[#22332D] hover:text-white'
                }`}
              >
                {isZh ? f.zh : f.en}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full min-w-0 max-w-[420px] mx-auto">
          <RangeMatrix13x13
            mode="solver"
            matrix={filteredMatrix}
            heroHandKey="KJs"
            inspectedHandKey={inspectedHand}
            onInspectHand={setInspectedHand}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums bg-[#0E1513] border border-[#1F2D28] rounded-lg px-3 py-2">
          <span className="font-semibold text-[#E5B95C]">
            {inspectedHand} ({combos} {isZh ? '种组合' : 'combos'})
          </span>
          <span className="text-slate-300">
            {isZh ? 'UTG 开池' : 'UTG Raise'}: {cell.raise}% · {isZh ? '弃牌' : 'Fold'}: {cell.fold}%
          </span>
        </div>
      </div>
    );
  }

  if (lessonId === 'pot_odds_2_4') {
    const reqEq = ((betPct / (100 + betPct * 2)) * 100).toFixed(1);
    const ratio = ((100 + betPct) / betPct).toFixed(1);
    const outs = drawType === 'flush' ? 9 : 8;
    const flopEq = outs * 4;
    const turnEq = outs * 2;

    return (
      <div className="bg-[#0A100E] border border-[#1F2D28] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#E5B95C]">
            {isZh ? '交互演示 · 下注尺度 vs 所需胜率' : 'Interactive · Bet Size vs Required Equity'}
          </span>
          <div className="flex gap-1.5">
            {([33, 50, 75, 100] as const).map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setBetPct(pct)}
                className={`px-2.5 py-1 text-xs font-semibold tabular-nums rounded-md border transition-colors cursor-pointer ${
                  betPct === pct
                    ? 'bg-emerald-500 text-[#04110C] border-emerald-400'
                    : 'bg-[#0E1513] text-slate-300 border-[#22332D] hover:text-white'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center tabular-nums">
          <div className="bg-[#0E1513] border border-[#1F2D28] rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">
              {isZh ? '下注尺度' : 'Bet Size'}
            </span>
            <span className="text-lg font-bold text-white">{betPct}%</span>
          </div>
          <div className="bg-[#0E1513] border border-[#1F2D28] rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">
              {isZh ? '所需胜率' : 'Need Equity'}
            </span>
            <span className="text-lg font-bold text-emerald-400">{reqEq}%</span>
          </div>
          <div className="bg-[#0E1513] border border-[#1F2D28] rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">
              {isZh ? '底池赔率' : 'Pot Odds'}
            </span>
            <span className="text-lg font-bold text-[#E5B95C]">{ratio}:1</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1A2622]">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setDrawType('flush')}
              className={`px-2.5 py-1 text-xs rounded-md border cursor-pointer ${
                drawType === 'flush'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                  : 'bg-[#0E1513] border-[#22332D] text-slate-400'
              }`}
            >
              {isZh ? '同花听牌 (9 补牌)' : 'Flush Draw (9 outs)'}
            </button>
            <button
              type="button"
              onClick={() => setDrawType('oesd')}
              className={`px-2.5 py-1 text-xs rounded-md border cursor-pointer ${
                drawType === 'oesd'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                  : 'bg-[#0E1513] border-[#22332D] text-slate-400'
              }`}
            >
              {isZh ? '两头顺 (8 补牌)' : 'OESD (8 outs)'}
            </button>
          </div>
          <span className="text-xs tabular-nums text-slate-300">
            {isZh
              ? `翻牌 (×4) ≈ ${flopEq}% · 转牌 (×2) ≈ ${turnEq}%`
              : `Flop (×4) ≈ ${flopEq}% · Turn (×2) ≈ ${turnEq}%`}
          </span>
        </div>
      </div>
    );
  }

  if (lessonId === 'board_texture_cbet') {
    const dryBoard: Card[] = [
      { rank: 'K', suit: 's' },
      { rank: '7', suit: 'd' },
      { rank: '2', suit: 'c' },
    ];
    const wetBoard: Card[] = [
      { rank: '9', suit: 'h' },
      { rank: '8', suit: 'h' },
      { rank: '6', suit: 'c' },
    ];
    const cards = boardKind === 'dry' ? dryBoard : wetBoard;
    return (
      <div className="felt-surface rounded-xl border border-emerald-400/20 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#E5B95C]">
            {isZh ? '交互演示 · 切换干燥面与动态面' : 'Interactive · Compare Dry vs Wet Boards'}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setBoardKind('dry')}
              className={`px-3 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                boardKind === 'dry'
                  ? 'bg-emerald-500 text-[#04110C] border-emerald-400'
                  : 'bg-[#0A100E]/85 text-slate-300 border-[#22332D]'
              }`}
            >
              {isZh ? '干燥面 K72r' : 'Dry K72r'}
            </button>
            <button
              type="button"
              onClick={() => setBoardKind('wet')}
              className={`px-3 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                boardKind === 'wet'
                  ? 'bg-emerald-500 text-[#04110C] border-emerald-400'
                  : 'bg-[#0A100E]/85 text-slate-300 border-[#22332D]'
              }`}
            >
              {isZh ? '动态面 986ss' : 'Wet 986ss'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          {cards.map((c, i) => (
            <PlayingCard key={i} card={c} fourColor={fourColor} size="md" />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs bg-[#0A100E]/85 border border-[#1F2D28] rounded-lg p-3.5">
          <div>
            <span className="text-slate-400 block">{isZh ? '建议持续下注频率' : 'Target C-Bet Freq'}</span>
            <span className="text-sm font-semibold text-emerald-400">
              {boardKind === 'dry' ? '70%–85%' : '30%–45%'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">{isZh ? '首选下注尺度' : 'Preferred Sizing'}</span>
            <span className="text-sm font-semibold text-[#E5B95C]">
              {boardKind === 'dry'
                ? isZh
                  ? '33% 小额全范围'
                  : '33% Small Range'
                : isZh
                  ? '66% 两极化 / 多过牌'
                  : '66% Polar / Check Often'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // player_archetypes
  const arch = ARCHETYPE_CARDS[archIdx];
  return (
    <div className="bg-[#0A100E] border border-[#1F2D28] rounded-xl p-4 sm:p-5 space-y-4">
      <span className="text-xs font-semibold text-[#E5B95C] block">
        {isZh ? '交互演示 · 点击查看 6 类对手 HUD 画像与针对策略' : 'Interactive · Explore 6 Opponent HUD Profiles'}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {ARCHETYPE_CARDS.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setArchIdx(idx)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              idx === archIdx
                ? 'bg-emerald-500 text-[#04110C] border-emerald-400 font-semibold'
                : 'bg-[#0E1513] text-slate-300 border-[#22332D] hover:text-white'
            }`}
          >
            {isZh ? item.nameZh : item.nameEn}
          </button>
        ))}
      </div>

      <div className="bg-[#0E1513] border border-[#1F2D28] rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center tabular-nums">
          <div>
            <span className="text-[11px] text-slate-400 block">VPIP</span>
            <span className="text-lg font-bold text-white">{arch.vpip}%</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">PFR</span>
            <span className="text-lg font-bold text-emerald-400">{arch.pfr}%</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">3-Bet</span>
            <span className="text-lg font-bold text-[#E5B95C]">{arch.threeBet}%</span>
          </div>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed border-t border-[#1C2A25] pt-2.5">
          {isZh ? arch.exploitZh : arch.exploitEn}
        </p>
      </div>
    </div>
  );
}
