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
import { translateHandRank } from '../../i18n/drillContentZh';

const SHOWDOWN_SOLVED_STORAGE_KEY = 'turnriver_showdown_solved_v1';

function readSolvedSlugs(): Set<ShowdownPuzzleSlug> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SHOWDOWN_SOLVED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const validSlugs = new Set<string>(SHOWDOWN_PUZZLES.map((p) => p.slug));
    return new Set(
      parsed.filter((s): s is ShowdownPuzzleSlug => typeof s === 'string' && validSlugs.has(s))
    );
  } catch {
    return new Set();
  }
}

interface LessonInteractiveWidgetProps {
  lessonId: FundamentalsLessonId;
  fourColor: boolean;
  initialPuzzleSlug?: string;
  onSolvedPuzzle?: (slug: ShowdownPuzzleSlug) => void;
}

const SEAT_GUIDE: {
  pos: Position;
  rfiPct: string;
  rfiPctZh?: string;
  samples: string;
  samplesZh?: string;
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
    rfiPctZh: '~40%（对 BB）',
    samples: 'Raise or fold vs opens',
    samplesZh: '面对开池多用加注或弃牌',
    noteEn: 'Worst postflop position — acts first on every street.',
    noteZh: '翻后最不利位置——每条街都必须最先表态。',
  },
  {
    pos: 'BB',
    rfiPct: 'Defend wide',
    rfiPctZh: '宽范围防守',
    samples: 'Already invested 1bb',
    samplesZh: '已投入 1bb 大盲注',
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

  // Day-1 Beginner Widgets state
  const [streetStep, setStreetStep] = useState<0 | 1 | 2 | 3>(0);
  const [facingBetDemo, setFacingBetDemo] = useState<boolean>(false);
  const [demoActionMsg, setDemoActionMsg] = useState<string | null>(null);
  const [ladderIdx, setLadderIdx] = useState<number>(0);

  // Widget 1 state (10-puzzle Showdown Pack + Tap-the-Decider)
  const [showdownIdx, setShowdownIdx] = useState(() => {
    if (initialPuzzleSlug) {
      const found = SHOWDOWN_PUZZLES.findIndex((p) => p.slug === initialPuzzleSlug);
      if (found >= 0) return found;
    }
    return 0;
  });
  const [showdownGuess, setShowdownGuess] = useState<'hero' | 'villain' | 'split' | null>(null);
  const [solvedSlugs, setSolvedSlugs] = useState<Set<ShowdownPuzzleSlug>>(readSolvedSlugs);
  const [tappedCardKey, setTappedCardKey] = useState<string | null>(null);
  const [copiedPuzzleLink, setCopiedPuzzleLink] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SHOWDOWN_SOLVED_STORAGE_KEY,
        JSON.stringify(Array.from(solvedSlugs))
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [solvedSlugs]);

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

  if (lessonId === 'how_holdem_works') {
    const heroHole: [Card, Card] = [
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'h' },
    ];
    const fullBoard: Card[] = [
      { rank: 'K', suit: 'd' },
      { rank: '9', suit: 's' },
      { rank: '4', suit: 'c' },
      { rank: 'J', suit: 'h' },
      { rank: 'A', suit: 'c' },
    ];
    const stages = [
      {
        labelEn: '1. Preflop',
        labelZh: '1. 翻前',
        visibleCount: 0,
        noteEn: 'Blinds are posted ($1 / $2). Everyone gets 2 private hole cards. First betting round!',
        noteZh: '大小盲下注（$1 / $2），每人发 2 张私有底牌，开始第一轮下注。',
      },
      {
        labelEn: '2. Flop (3)',
        labelZh: '2. 翻牌 (3张)',
        visibleCount: 3,
        noteEn: '3 shared community cards hit the felt. Your A♠ K♥ pairs the K♦ for Top Pair, Top Kicker!',
        noteZh: '一次性发出 3 张公共牌！你的 A♠ K♥ 击中 K♦，组成顶对顶踢脚。',
      },
      {
        labelEn: '3. Turn (+1)',
        labelZh: '3. 转牌 (+1张)',
        visibleCount: 4,
        noteEn: 'A 4th community card (J♥) is dealt, followed by the third betting round.',
        noteZh: '发出第 4 张公共牌（J♥），进入第三轮下注。',
      },
      {
        labelEn: '4. River (+1)',
        labelZh: '4. 河牌 (+1张)',
        visibleCount: 5,
        noteEn: 'Final 5th card (A♣)! You now make Two Pair (Aces & Kings) — best 5 of 7 cards wins at showdown.',
        noteZh: '第 5 张公共牌（A♣）落地！你升级成 AA-KK 两对，7 选 5 摊牌决胜。',
      },
    ];
    const stage = stages[streetStep];
    return (
      <div
        data-testid="lesson-widget-streets"
        className="felt-surface rounded-xl border border-emerald-400/20 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#E5B95C]">
            {isZh ? '动手体验 · 点击四条街看发牌流程' : 'Interactive · Step Through All 4 Streets'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {stages.map((st, idx) => (
              <button
                key={st.labelEn}
                type="button"
                onClick={() => setStreetStep(idx as 0 | 1 | 2 | 3)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer transition-colors ${
                  streetStep === idx
                    ? 'bg-emerald-500 text-[#04110C] border-emerald-400 font-semibold'
                    : 'bg-[#0A100E]/85 text-slate-300 border-[#22332D] hover:text-white'
                }`}
              >
                {isZh ? st.labelZh : st.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 py-1">
          <div className="space-y-1.5 text-center">
            <span className="text-[11px] font-mono text-amber-200/80">
              {isZh ? '5 张共享公共牌' : '5 Shared Community Cards'}
            </span>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              {fullBoard.map((c, idx) => (
                <PlayingCard
                  key={idx}
                  card={idx < stage.visibleCount ? c : undefined}
                  faceDown={idx >= stage.visibleCount}
                  fourColor={fourColor}
                  size="sm"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#0A100E]/85 border border-[#1F2D28] rounded-lg px-4 py-2.5">
            <span className="text-xs font-semibold text-emerald-300">
              {isZh ? '你的 2 张底牌' : 'Your 2 Hole Cards'}
            </span>
            <div className="flex items-center gap-1.5">
              <PlayingCard card={heroHole[0]} fourColor={fourColor} size="xs" />
              <PlayingCard card={heroHole[1]} fourColor={fourColor} size="xs" />
            </div>
          </div>

          <p className="text-xs text-emerald-100/95 text-center max-w-lg leading-relaxed">
            {isZh ? stage.noteZh : stage.noteEn}
          </p>
        </div>
      </div>
    );
  }

  if (lessonId === 'five_actions') {
    return (
      <div
        data-testid="lesson-widget-actions"
        className="felt-surface rounded-xl border border-emerald-400/20 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#E5B95C]">
            {isZh ? '互动演练 · 切换局面看哪些按钮合法' : 'Interactive · Toggle Situation to Test Legal Buttons'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setFacingBetDemo(false);
                setDemoActionMsg(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer ${
                !facingBetDemo
                  ? 'bg-emerald-500 text-[#04110C] border-emerald-400 font-semibold'
                  : 'bg-[#0A100E]/85 text-slate-300 border-[#22332D]'
              }`}
            >
              {isZh ? '没人下注（轮到你）' : 'No Bet Yet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFacingBetDemo(true);
                setDemoActionMsg(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer ${
                facingBetDemo
                  ? 'bg-amber-400 text-[#04110C] border-amber-300 font-semibold'
                  : 'bg-[#0A100E]/85 text-slate-300 border-[#22332D]'
              }`}
            >
              {isZh ? '对手下注 $10（你已投 $2）' : 'Opponent Bet $10 (You have $2 in)'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {!facingBetDemo ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setDemoActionMsg(
                    isZh
                      ? '过牌（Check）：不花一分钱，把行动权交给下家，免费看下一张牌。'
                      : 'Check: Costs $0 — passes action to the next player and lets you see the next card for free.'
                  )
                }
                className="px-3 py-2.5 rounded-lg bg-sky-500/20 border border-sky-400/50 text-xs font-semibold text-sky-200 cursor-pointer"
              >
                {isZh ? '过牌 Check ($0)' : 'Check ($0)'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setDemoActionMsg(
                    isZh
                      ? '下注（Bet $10）：主动把 $10 推入底池，逼迫对手决定弃牌、跟注或加注。'
                      : 'Bet $10: Opens the betting on this street, forcing your opponent to Fold, Call, or Raise.'
                  )
                }
                className="px-3 py-2.5 rounded-lg bg-emerald-500 text-xs font-semibold text-[#04110C] cursor-pointer"
              >
                {isZh ? '下注 Bet $10' : 'Bet $10'}
              </button>
              <button
                type="button"
                disabled
                className="px-3 py-2.5 rounded-lg bg-[#0A100E]/60 border border-[#1B2823] text-xs text-slate-500 cursor-not-allowed"
              >
                {isZh ? '跟注不可用' : 'Call (N/A)'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  setDemoActionMsg(
                    isZh
                      ? '弃牌（Fold）：放弃底池里的 $2，但保住你剩下的全部筹码，立刻结束本手牌。'
                      : 'Fold: Gives up the $2 already in the pot, but protects the rest of your stack.'
                  )
                }
                className="px-3 py-2.5 rounded-lg bg-[#141E1B] border border-[#2B3E37] text-xs font-semibold text-slate-200 cursor-pointer"
              >
                {isZh ? '弃牌 Fold' : 'Fold'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setDemoActionMsg(
                    isZh
                      ? '跟注（Call $8）：因为你本街已投 $2，只需再补 $8 就能跟平对手的 $10！'
                      : 'Call $8: You already put $2 in this street, so matching $10 costs just $8 more!'
                  )
                }
                className="px-3 py-2.5 rounded-lg bg-sky-500/20 border border-sky-400/50 text-xs font-semibold text-sky-200 cursor-pointer"
              >
                {isZh ? '跟注 Call $8' : 'Call $8'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setDemoActionMsg(
                    isZh
                      ? '加注（Raise 到 $25）：先补齐 $10，再额外加注 $15，把压力反推给对手。'
                      : 'Raise to $25: Matches the $10 bet and increases the price to $25 total.'
                  )
                }
                className="px-3 py-2.5 rounded-lg bg-emerald-500 text-xs font-semibold text-[#04110C] cursor-pointer"
              >
                {isZh ? '加注 Raise $25' : 'Raise to $25'}
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-emerald-100/95 bg-[#0A100E]/80 border border-[#1E2E28] rounded-lg px-3.5 py-2.5 leading-relaxed">
          {demoActionMsg ??
            (isZh
              ? '点击上方任意按钮，查看它的真实含义与筹码计算方式。'
              : 'Click any button above to see what it does and how much it costs.')}
        </p>
      </div>
    );
  }

  if (lessonId === 'hand_ladder') {
    const LADDER: {
      rank: number;
      en: string;
      zh: string;
      noteEn: string;
      noteZh: string;
      cards: Card[];
    }[] = [
      {
        rank: 1,
        en: 'Royal Flush',
        zh: '皇家同花顺',
        noteEn: 'A-K-Q-J-10 all in the same suit — unbeatable.',
        noteZh: '同花色的 A-K-Q-J-10，全场最大无法被击败。',
        cards: [
          { rank: 'A', suit: 's' },
          { rank: 'K', suit: 's' },
          { rank: 'Q', suit: 's' },
          { rank: 'J', suit: 's' },
          { rank: 'T', suit: 's' },
        ],
      },
      {
        rank: 2,
        en: 'Straight Flush',
        zh: '同花顺',
        noteEn: 'Five consecutive cards of the same suit.',
        noteZh: '五张点数连续且花色完全相同的牌。',
        cards: [
          { rank: '9', suit: 'h' },
          { rank: '8', suit: 'h' },
          { rank: '7', suit: 'h' },
          { rank: '6', suit: 'h' },
          { rank: '5', suit: 'h' },
        ],
      },
      {
        rank: 3,
        en: 'Four of a Kind',
        zh: '四条',
        noteEn: 'All four cards of one rank plus any 5th kicker.',
        noteZh: '四张相同点数加任意一张第 5 张牌。',
        cards: [
          { rank: 'Q', suit: 's' },
          { rank: 'Q', suit: 'h' },
          { rank: 'Q', suit: 'd' },
          { rank: 'Q', suit: 'c' },
          { rank: 'A', suit: 's' },
        ],
      },
      {
        rank: 4,
        en: 'Full House',
        zh: '葫芦',
        noteEn: 'Three of a kind plus a pair — beats any Flush.',
        noteZh: '三条加一对——稳压任何同花。',
        cards: [
          { rank: 'K', suit: 's' },
          { rank: 'K', suit: 'h' },
          { rank: 'K', suit: 'd' },
          { rank: '8', suit: 'c' },
          { rank: '8', suit: 's' },
        ],
      },
      {
        rank: 5,
        en: 'Flush',
        zh: '同花',
        noteEn: 'Any 5 cards of the same suit — always beats a Straight.',
        noteZh: '任意 5 张同花色牌——永远大于顺子。',
        cards: [
          { rank: 'A', suit: 'd' },
          { rank: 'J', suit: 'd' },
          { rank: '8', suit: 'd' },
          { rank: '5', suit: 'd' },
          { rank: '2', suit: 'd' },
        ],
      },
      {
        rank: 6,
        en: 'Straight',
        zh: '顺子',
        noteEn: 'Five consecutive ranks in mixed suits (A-2-3-4-5 is lowest).',
        noteZh: '五张连续点数、花色不限（A-2-3-4-5 最小）。',
        cards: [
          { rank: 'T', suit: 's' },
          { rank: '9', suit: 'h' },
          { rank: '8', suit: 'd' },
          { rank: '7', suit: 'c' },
          { rank: '6', suit: 's' },
        ],
      },
      {
        rank: 7,
        en: 'Three of a Kind',
        zh: '三条',
        noteEn: 'Three cards of the same rank plus two kickers.',
        noteZh: '三张相同点数加两张踢脚。',
        cards: [
          { rank: '7', suit: 's' },
          { rank: '7', suit: 'h' },
          { rank: '7', suit: 'd' },
          { rank: 'A', suit: 'c' },
          { rank: 'K', suit: 's' },
        ],
      },
      {
        rank: 8,
        en: 'Two Pair',
        zh: '两对',
        noteEn: 'Two different pairs plus one 5th-card kicker.',
        noteZh: '两组不同对子加一张第 5 张踢脚。',
        cards: [
          { rank: 'A', suit: 's' },
          { rank: 'A', suit: 'h' },
          { rank: '9', suit: 'd' },
          { rank: '9', suit: 'c' },
          { rank: 'K', suit: 'd' },
        ],
      },
      {
        rank: 9,
        en: 'One Pair',
        zh: '一对',
        noteEn: 'Two cards of the same rank plus three kickers.',
        noteZh: '两张相同点数加三张单张踢脚。',
        cards: [
          { rank: 'J', suit: 's' },
          { rank: 'J', suit: 'c' },
          { rank: 'A', suit: 'h' },
          { rank: '8', suit: 'd' },
          { rank: '4', suit: 's' },
        ],
      },
      {
        rank: 10,
        en: 'High Card',
        zh: '高牌',
        noteEn: 'No pair, straight, or flush — highest card plays.',
        noteZh: '无对子、无顺子、无同花——按最大单张比大小。',
        cards: [
          { rank: 'A', suit: 's' },
          { rank: 'Q', suit: 'd' },
          { rank: '9', suit: 'c' },
          { rank: '6', suit: 'h' },
          { rank: '2', suit: 's' },
        ],
      },
    ];
    const active = LADDER[ladderIdx] ?? LADDER[0];
    return (
      <div
        data-testid="lesson-widget-ladder"
        className="felt-surface rounded-xl border border-emerald-400/20 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#E5B95C]">
            {isZh ? '十级牌型图谱 · 点击任意等级查看示例' : '10-Tier Hand Rankings · Click Any Rank'}
          </span>
          <span className="text-xs font-mono text-emerald-300">
            #{active.rank} / 10
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {LADDER.map((item, idx) => (
            <button
              key={item.rank}
              type="button"
              onClick={() => setLadderIdx(idx)}
              className={`px-2 py-1.5 text-[11px] font-medium rounded-md border text-left transition-colors cursor-pointer truncate ${
                idx === ladderIdx
                  ? 'bg-emerald-500 text-[#04110C] border-emerald-400 font-semibold'
                  : 'bg-[#0A100E]/85 text-slate-300 border-[#22332D] hover:text-white'
              }`}
            >
              {item.rank}. {isZh ? item.zh : item.en}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2.5 bg-[#0A100E]/80 border border-[#1E2E28] rounded-lg p-3.5">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {active.cards.map((c, idx) => (
              <PlayingCard key={idx} card={c} fourColor={fourColor} size="sm" />
            ))}
          </div>
          <p className="text-xs text-slate-200 text-center">
            <span className="font-semibold text-emerald-300 mr-1.5">
              #{active.rank} {isZh ? active.zh : active.en}:
            </span>
            {isZh ? active.noteZh : active.noteEn}
          </p>
        </div>
      </div>
    );
  }

  if (lessonId === 'hand_rankings') {
    const puzzle = SHOWDOWN_PUZZLES[showdownIdx] ?? SHOWDOWN_PUZZLES[0];
    const comparison = compareShowdownCards(puzzle.hero, puzzle.villain, puzzle.board);
    const heroHandLabel = translateHandRank(locale, comparison.heroEval.label);
    const villainHandLabel = translateHandRank(locale, comparison.villainEval.label);
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
              className="min-h-[40px] px-3 py-1.5 text-xs font-medium rounded-md bg-[#0A100E]/90 border border-[#243630] text-slate-200 hover:border-emerald-400/60 hover:text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
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
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-md bg-[#0A100E]/90 border border-[#243630] text-slate-300 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={isZh ? '下一题' : 'Next puzzle'}
              onClick={() => selectPuzzle(showdownIdx + 1)}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-md bg-[#0A100E]/90 border border-[#243630] text-slate-300 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 10-Puzzle Quick Selector Strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SHOWDOWN_PUZZLES.map((item, idx) => {
            const active = idx === showdownIdx;
            const done = solvedSlugs.has(item.slug);
            return (
              <button
                key={item.slug}
                type="button"
                onClick={() => selectPuzzle(idx)}
                className={`min-h-[36px] min-w-[36px] px-2.5 py-1 text-xs font-mono rounded-md border transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center ${
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
                    ? heroHandLabel
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
                    ? villainHandLabel
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
                  className={`min-h-[40px] px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:cursor-default ${cls}`}
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
                    <span className="text-emerald-300">{heroHandLabel}</span>
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
                    <span className="text-sky-300">{villainHandLabel}</span>
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
                    className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-md bg-[#141E1B] border border-[#243630] text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>{isZh ? '重做' : 'Retry'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPuzzle(showdownIdx + 1)}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-500 hover:bg-emerald-400 text-[#04110C] cursor-pointer"
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
                  {isZh ? (seat.rfiPctZh ?? seat.rfiPct) : seat.rfiPct}
                </span>
              </button>
            );
          })}
        </div>
        <div className="rounded-lg bg-[#0E1513] border border-[#1F2D28] p-4 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-white">
              {active.pos} ·{' '}
              <span className="text-emerald-400 tabular-nums">
                {isZh ? (active.rfiPctZh ?? active.rfiPct) : active.rfiPct}
              </span>
            </span>
            <span className="text-xs tabular-nums text-[#E5B95C]">
              {isZh ? (active.samplesZh ?? active.samples) : active.samples}
            </span>
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
