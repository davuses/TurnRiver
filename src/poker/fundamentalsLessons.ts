import type { Card, DrillModule } from './types';

export type FundamentalsLessonId =
  | 'hand_rankings'
  | 'position_power'
  | 'matrix_basics'
  | 'pot_odds_2_4'
  | 'board_texture_cbet'
  | 'player_archetypes';

export interface LocalizedText {
  en: string;
  'zh-CN': string;
}

export interface LessonQuestionOption {
  id: string;
  label: LocalizedText;
}

export interface LessonQuestion {
  id: string;
  prompt: LocalizedText;
  board?: Card[];
  heroCards?: [Card, Card];
  villainCards?: [Card, Card];
  options: LessonQuestionOption[];
  correctOptionId: string;
  explanation: LocalizedText;
}

export interface FundamentalsLesson {
  id: FundamentalsLessonId;
  order: number;
  durationMin: number;
  targetModule: DrillModule;
  title: LocalizedText;
  subtitle: LocalizedText;
  summary: LocalizedText;
  keyTakeaways: LocalizedText[];
  questions: LessonQuestion[];
}

export const FUNDAMENTALS_LESSONS: FundamentalsLesson[] = [
  {
    id: 'hand_rankings',
    order: 1,
    durationMin: 2,
    targetModule: 'table',
    title: {
      en: 'Hand Rankings & Kicker Traps',
      'zh-CN': '牌型大小与踢脚陷阱',
    },
    subtitle: {
      en: 'Best 5-card hand wins · Why kickers & board pairs change everything',
      'zh-CN': '五张最佳成牌决胜 · 踢脚与公共牌对子如何逆转胜负',
    },
    summary: {
      en: 'In Hold’em, every player builds the single strongest 5-card hand from 7 cards (2 hole + 5 board). Most beginner losses happen when both players make the same pair—and the stronger kicker or a paired board decides the pot.',
      'zh-CN': '德州扑克中，双方用 2 张底牌 + 5 张公共牌凑出最强的 5 张成牌。新手最常见的亏损，是和对手凑出同一个对子却输在踢脚，或没注意公共牌成对把自己的两对反超。',
    },
    keyTakeaways: [
      {
        en: 'Always count exactly 5 cards: a 6th card never plays, so a board pair can counterfeit a smaller pocket pair.',
        'zh-CN': '始终只算最强的 5 张牌：第 6 张牌无效，公共牌出现更高对子可能让小口袋对失效。',
      },
      {
        en: 'Top pair with a weak kicker (like A6o facing heavy pressure) is a classic domination trap.',
        'zh-CN': '顶对配弱踢脚（例如 A6o 面对连续重注）是最经典的被压制陷阱。',
      },
      {
        en: 'Flushes always beat straights, and a full house beats any flush.',
        'zh-CN': '同花一定大于顺子，葫芦一定大于任何同花。',
      },
    ],
    questions: [
      {
        id: 'hr-q1',
        prompt: {
          en: 'Hero holds A♠ K♦ and Villain holds A♥ J♣ on A♣ 9♠ 9♦ 4♣ 2♥. Who wins?',
          'zh-CN': '公共牌 A♣ 9♠ 9♦ 4♣ 2♥，我方 A♠ K♦ 对上对手 A♥ J♣，谁赢？',
        },
        board: [
          { rank: 'A', suit: 'c' },
          { rank: '9', suit: 's' },
          { rank: '9', suit: 'd' },
          { rank: '4', suit: 'c' },
          { rank: '2', suit: 'h' },
        ],
        heroCards: [
          { rank: 'A', suit: 's' },
          { rank: 'K', suit: 'd' },
        ],
        villainCards: [
          { rank: 'A', suit: 'h' },
          { rank: 'J', suit: 'c' },
        ],
        options: [
          { id: 'hero', label: { en: 'Hero wins (King kicker)', 'zh-CN': '我方赢（K 踢脚更大）' } },
          { id: 'split', label: { en: 'Split pot (both have Two Pair)', 'zh-CN': '平分底池（双方都是两对）' } },
          { id: 'villain', label: { en: 'Villain wins (Jack kicker)', 'zh-CN': '对手赢（J 踢脚）' } },
        ],
        correctOptionId: 'hero',
        explanation: {
          en: 'Both players make Aces and Nines, so the 5th card (kicker) breaks the tie: Hero plays A-A-9-9-K, beating Villain’s A-A-9-9-J.',
          'zh-CN': '双方都组成 AA99 两对，第 5 张牌决定胜负：我方是 A-A-9-9-K，压制对手的 A-A-9-9-J。',
        },
      },
      {
        id: 'hr-q2',
        prompt: {
          en: 'Board runs out Q♠ Q♦ 8♣ 8♥ 3♠. Hero holds 5♣ 5♦ and Villain holds A♥ 4♦. Who wins?',
          'zh-CN': '公共牌 Q♠ Q♦ 8♣ 8♥ 3♠，我方拿 5♣ 5♦，对手拿 A♥ 4♦，谁赢？',
        },
        board: [
          { rank: 'Q', suit: 's' },
          { rank: 'Q', suit: 'd' },
          { rank: '8', suit: 'c' },
          { rank: '8', suit: 'h' },
          { rank: '3', suit: 's' },
        ],
        heroCards: [
          { rank: '5', suit: 'c' },
          { rank: '5', suit: 'd' },
        ],
        villainCards: [
          { rank: 'A', suit: 'h' },
          { rank: '4', suit: 'd' },
        ],
        options: [
          { id: 'hero', label: { en: 'Hero wins (Three Pair)', 'zh-CN': '我方赢（三对）' } },
          { id: 'villain', label: { en: 'Villain wins (Q-Q-8-8-A)', 'zh-CN': '对手赢（Q-Q-8-8-A）' } },
          { id: 'split', label: { en: 'Split pot', 'zh-CN': '平分底池' } },
        ],
        correctOptionId: 'villain',
        explanation: {
          en: 'There is no “Three Pair” in poker! Both players use Q-Q-8-8 from the board, and Villain’s Ace kicker beats Hero’s 5.',
          'zh-CN': '德州扑克没有“三对”！双方都用牌面的 Q-Q-8-8，对手的 A 踢脚轻松击败我方的 5。',
        },
      },
    ],
  },
  {
    id: 'position_power',
    order: 2,
    durationMin: 2,
    targetModule: 'preflop',
    title: {
      en: 'Position Is King (UTG → BTN)',
      'zh-CN': '位置就是筹码（UTG → BTN）',
    },
    subtitle: {
      en: 'Why the Button plays ~3× more hands than Under the Gun',
      'zh-CN': '为什么庄位（BTN）能打的手牌数量是枪口位（UTG）的近 3 倍',
    },
    summary: {
      en: 'Acting last on the flop, turn, and river lets you see your opponent’s action before risking chips. That information edge means you should play tight from UTG and open dramatically wider from CO and BTN.',
      'zh-CN': '在翻牌、转牌、河牌最后行动，意味着你可以先看对手表态再决定是否投入筹码。这种信息优势决定了枪口位必须打紧，而关位（CO）与庄位（BTN）可以大幅放宽开池。',
    },
    keyTakeaways: [
      {
        en: 'UTG acts first preflop with 5 players still behind—stick to ~16–18% strong hands.',
        'zh-CN': 'UTG 身后还有 5 位玩家未行动，开池范围应控制在约 16%–18% 的强牌。',
      },
      {
        en: 'BTN acts last on every postflop street and can profitably open ~43–48% of hands when folded to.',
        'zh-CN': 'BTN 翻后每条街都最后行动，无人入池时可盈利开池约 43%–48% 的起手牌。',
      },
      {
        en: 'Avoid open-limping: raising first-in (RFI) builds pots with strong hands and wins the blinds uncontested.',
        'zh-CN': '尽量避免率先平跟（Open-Limp）：主动加注入池既能拿价值，也有机会直接收下盲注。',
      },
    ],
    questions: [
      {
        id: 'pos-q1',
        prompt: {
          en: 'Everyone folds to you on the Button (BTN) with K♠ 8♠ at 100bb. What is the standard play?',
          'zh-CN': '100bb 筹码，前面全部弃牌，你在庄位（BTN）拿到 K♠ 8♠，标准打法是？',
        },
        heroCards: [
          { rank: 'K', suit: 's' },
          { rank: '8', suit: 's' },
        ],
        options: [
          { id: 'raise', label: { en: 'Raise to 2.5bb (RFI)', 'zh-CN': '加注开池至 2.5bb' } },
          { id: 'limp', label: { en: 'Limp 1bb to see a cheap flop', 'zh-CN': '平跟 1bb 便宜看翻牌' } },
          { id: 'fold', label: { en: 'Fold (too weak)', 'zh-CN': '直接弃牌（牌力太弱）' } },
        ],
        correctOptionId: 'raise',
        explanation: {
          en: 'With only the blinds left to act and guaranteed postflop position, K8s is a clear, profitable Button open-raise.',
          'zh-CN': '身后只剩大小盲且翻后稳居有位置，K8s 在 BTN 是非常标准的盈利开池加注牌。',
        },
      },
      {
        id: 'pos-q2',
        prompt: {
          en: 'Which seat has the biggest positional disadvantage after the flop?',
          'zh-CN': '翻牌后，哪个位置处于最不利的行动顺序？',
        },
        options: [
          { id: 'btn', label: { en: 'Button (BTN)', 'zh-CN': '庄位（BTN）' } },
          { id: 'sb', label: { en: 'Small Blind (SB)', 'zh-CN': '小盲位（SB）' } },
          { id: 'co', label: { en: 'Cutoff (CO)', 'zh-CN': 'CO 位' } },
        ],
        correctOptionId: 'sb',
        explanation: {
          en: 'The Small Blind acts first on every postflop street against every other seat at the table, so it should play tight and mostly 3-bet or fold vs opens.',
          'zh-CN': '小盲位翻后面对桌上任何位置都必须最先行动，因此面对开池应以紧手 3-Bet 或弃牌为主。',
        },
      },
    ],
  },
  {
    id: 'matrix_basics',
    order: 3,
    durationMin: 2,
    targetModule: 'preflop',
    title: {
      en: 'Reading a 13×13 Range Matrix',
      'zh-CN': '看懂 13×13 起手牌范围矩阵',
    },
    subtitle: {
      en: 'Pairs on the diagonal · Suited above · Offsuit below (6 / 4 / 12 combos)',
      'zh-CN': '对角线是对子 · 右上方是同花 · 左下方是杂色（6 / 4 / 12 组合）',
    },
    summary: {
      en: 'Every serious poker study tool summarizes all 1,326 starting hands into a 13×13 grid of 169 hand classes. Learning its geometry takes 60 seconds and immediately unlocks preflop range charts and hand reading.',
      'zh-CN': '所有现代扑克训练工具都会把 1,326 种具体起手牌压缩进 13×13 的 169 格矩阵。花 1 分钟看懂它的排布规律，就能立刻上手翻前范围表与多街读牌。',
    },
    keyTakeaways: [
      {
        en: 'Diagonal = Pocket Pairs (6 combos each). Upper-right = Suited hands (4 combos). Lower-left = Offsuit hands (12 combos).',
        'zh-CN': '对角线 = 口袋对（每格 6 组合）；右上方 = 同花牌（每格 4 组合）；左下方 = 杂色牌（每格 12 组合）。',
      },
      {
        en: 'Suited hands realize far more equity than offsuit hands because of flush potential and smoother playability.',
        'zh-CN': '同花牌因为有成同花潜力与更好的翻后可玩性，能比同牌面杂色牌实现高得多的胜率。',
      },
      {
        en: 'Hands like KJo or QTo look pretty, but from UTG they are easily dominated by AK, KQ, AQ, and AJ.',
        'zh-CN': '像 KJo、QTo 看似大牌，但在 UTG 开池极易被 AK、KQ、AQ、AJ 压制踢脚。',
      },
    ],
    questions: [
      {
        id: 'mat-q1',
        prompt: {
          en: 'How many exact starting combinations make up A♠ K♠ / A♥ K♥ / A♦ K♦ / A♣ K♣ (AKs) vs AKo?',
          'zh-CN': 'AK 同花（AKs）与 AK 杂色（AKo）分别包含多少种具体牌型组合？',
        },
        options: [
          { id: '4-12', label: { en: '4 suited combos · 12 offsuit combos', 'zh-CN': '4 种同花组合 · 12 种杂色组合' } },
          { id: '6-6', label: { en: '6 suited combos · 6 offsuit combos', 'zh-CN': '6 种同花组合 · 6 种杂色组合' } },
          { id: '4-6', label: { en: '4 suited combos · 6 offsuit combos', 'zh-CN': '4 种同花组合 · 6 种杂色组合' } },
        ],
        correctOptionId: '4-12',
        explanation: {
          en: 'There are 4 suits for AKs (4 combos) and 4 × 3 = 12 mismatched-suit pairs for AKo. Pocket pairs have 6 combos.',
          'zh-CN': '同花共有 4 种花色（4 组合），杂色有 4 × 3 = 12 组合，而口袋对则是 6 组合。',
        },
      },
      {
        id: 'mat-q2',
        prompt: {
          en: 'In a standard 6-max 100bb UTG RFI chart, which hand is a cleaner open?',
          'zh-CN': '在标准 6 人桌 100bb 的 UTG 开池矩阵里，哪一手更适合开池？',
        },
        options: [
          { id: 'kjs', label: { en: 'KJs (upper-right suited)', 'zh-CN': 'KJs（右上方同花）' } },
          { id: 'kto', label: { en: 'KTo (lower-left offsuit)', 'zh-CN': 'KTo（左下方杂色）' } },
          { id: 'q9o', label: { en: 'Q9o (lower-left offsuit)', 'zh-CN': 'Q9o（左下方杂色）' } },
        ],
        correctOptionId: 'kjs',
        explanation: {
          en: 'KJs has flush equity and strong broadway connectivity, making it a clear UTG open, while offsuit KTo and Q9o are folds from early position.',
          'zh-CN': 'KJs 兼具同花听牌与顺子连接性，是清晰的 UTG 开池牌；而杂色 KTo、Q9o 在前位应直接弃牌。',
        },
      },
    ],
  },
  {
    id: 'pot_odds_2_4',
    order: 4,
    durationMin: 2,
    targetModule: 'math',
    title: {
      en: 'Pot Odds & The Rule of 2 and 4',
      'zh-CN': '底池赔率与“乘 2 乘 4 法则”',
    },
    subtitle: {
      en: 'Estimate draw equity in 3 seconds and compare it to the bet price',
      'zh-CN': '3 秒心算听牌胜率，直接对照下注尺度判断是否划算',
    },
    summary: {
      en: 'Every call is a simple comparison: does your chance of winning (equity) beat the price you’re paying (pot odds)? Multiply your outs by 4 on the flop (2 cards left) or by 2 on the turn (1 card left).',
      'zh-CN': '每一次跟注本质上只比一件事：你的成牌胜率是否高于需要支付的底池赔率？翻牌圈还有两张牌把补牌数乘 4，转牌圈剩一张牌把补牌数乘 2，即可快速心算。',
    },
    keyTakeaways: [
      {
        en: 'Required Equity = Call ÷ (Pot Before Call + Call). Half-pot bet needs 25%; full-pot bet needs 33.3%.',
        'zh-CN': '所需胜率 = 跟注额 ÷（跟注前底池 + 跟注额）。半池下注需 25%，满池下注需 33.3%。',
      },
      {
        en: 'Flush draw = 9 outs (~36% on flop, ~18% on turn). Open-ended straight draw = 8 outs (~32% flop, ~16% turn).',
        'zh-CN': '同花听牌有 9 张补牌（翻牌约 36%，转牌约 18%）；两头顺听牌有 8 张补牌（翻牌约 32%，转牌约 16%）。',
      },
      {
        en: 'When bet size jumps from 33% pot (20% needed) to 100% pot (33.3% needed), pure turn flush draws lose direct pot odds.',
        'zh-CN': '当下注从 1/3 池（需 20%）涨到满池（需 33.3%）时，转牌纯同花听牌（约 18%）不再具备直接赔率。',
      },
    ],
    questions: [
      {
        id: 'po-q1',
        prompt: {
          en: 'The pot is 20bb and Villain bets 10bb (50% pot). What minimum equity do you need to call?',
          'zh-CN': '底池 20bb，对手下注 10bb（半池），你至少需要多少胜率才能直接跟注？',
        },
        options: [
          { id: '20', label: { en: '20%', 'zh-CN': '20%' } },
          { id: '25', label: { en: '25%', 'zh-CN': '25%' } },
          { id: '33', label: { en: '33.3%', 'zh-CN': '33.3%' } },
        ],
        correctOptionId: '25',
        explanation: {
          en: 'You call 10bb to win a final pot of 20 + 10 + 10 = 40bb. 10 ÷ 40 = 25%. Memorize: 50% pot = 25% required equity.',
          'zh-CN': '支付 10bb 争夺 20 + 10 + 10 = 40bb 的总底池，10 ÷ 40 = 25%。记住基准：半池下注 = 25% 胜率门槛。',
        },
      },
      {
        id: 'po-q2',
        prompt: {
          en: 'On the turn you hold a clean 9-out flush draw (no pair). About how often will you hit on the river?',
          'zh-CN': '转牌圈你持有干净的 9 张补牌同花听牌，河牌击中同花的概率大约是多少？',
        },
        heroCards: [
          { rank: 'A', suit: 's' },
          { rank: 'J', suit: 's' },
        ],
        board: [
          { rank: '9', suit: 's' },
          { rank: '5', suit: 's' },
          { rank: '2', suit: 'd' },
          { rank: 'K', suit: 'c' },
        ],
        options: [
          { id: '18', label: { en: '~18–20% (9 outs × 2)', 'zh-CN': '约 18%–20%（9 补牌 × 2）' } },
          { id: '36', label: { en: '~36% (9 outs × 4)', 'zh-CN': '约 36%（9 补牌 × 4）' } },
          { id: '9', label: { en: '~9%', 'zh-CN': '约 9%' } },
        ],
        correctOptionId: '18',
        explanation: {
          en: 'Only 1 card remains on the turn, so use the Rule of 2: 9 × 2 = 18% (exact math is 9 / 46 = 19.6%).',
          'zh-CN': '转牌只剩 1 张河牌，应用乘 2 法则：9 × 2 = 18%（精确值为 9 ÷ 46 = 19.6%）。',
        },
      },
    ],
  },
  {
    id: 'board_texture_cbet',
    order: 5,
    durationMin: 2,
    targetModule: 'postflop',
    title: {
      en: 'Dry vs. Wet Boards & C-Betting',
      'zh-CN': '干燥面、动态面与持续下注（C-Bet）',
    },
    subtitle: {
      en: 'Match your flop bet size and frequency to who owns the board',
      'zh-CN': '根据牌面结构与范围优势，决定小额高频下注还是过牌控池',
    },
    summary: {
      en: 'As the preflop raiser, you shouldn’t blindly bet 75% pot on every flop. High, disconnected (“dry”) boards favor your big-card range for cheap 33% c-bets, while low, connected (“wet”) boards hit the Big Blind hard and call for more checking.',
      'zh-CN': '作为翻前加注者，绝不能每个翻牌都盲目打 3/4 池。高牌且分散的“干燥面”更利好加注者范围，适合 33% 小额高频持续下注；而低连同花听牌多的“动态面”更利好大盲防守范围，应更多过牌。',
    },
    keyTakeaways: [
      {
        en: 'Dry high boards (K♠ 7♦ 2♣): PFR holds more AK, KQ, KK—bet small (25–33% pot) at high frequency.',
        'zh-CN': '高张干燥面（如 K♠ 7♦ 2♣）：翻前加注者拥有更多 AK、KQ、KK，适合用 25%–33% 小尺度高频持续下注。',
      },
      {
        en: 'Wet low connected boards (9♥ 8♥ 6♣): BB holds tons of two pair, straights, and combo draws—check often and size up when betting.',
        'zh-CN': '低张动态面（如 9♥ 8♥ 6♣）：大盲拥有大量两对、顺子与复合听牌，加注者应提高过牌频率，下注时用更大尺度。',
      },
      {
        en: 'Small bets force opponents to fold weak air cheaply while letting you keep pressure on with your whole range.',
        'zh-CN': '小尺度下注成本低，既能低价逼弃对手空气牌，又能保持整体范围的施压连贯性。',
      },
    ],
    questions: [
      {
        id: 'bt-q1',
        prompt: {
          en: 'You raised BTN and BB called. Flop is K♠ 7♦ 2♣ rainbow and BB checks. What sizing fits your range best?',
          'zh-CN': '你 BTN 开池，BB 跟注。翻牌 K♠ 7♦ 2♣ 彩虹面，BB 过牌。最符合范围优势的持续下注尺度是？',
        },
        board: [
          { rank: 'K', suit: 's' },
          { rank: '7', suit: 'd' },
          { rank: '2', suit: 'c' },
        ],
        options: [
          { id: 'small', label: { en: 'Small ~33% pot high-frequency c-bet', 'zh-CN': '约 33% 底池的高频小额持续下注' } },
          { id: 'overbet', label: { en: '150% pot overbet with your entire range', 'zh-CN': '全范围 150% 超池下注' } },
          { id: 'never', label: { en: 'Never c-bet without a set', 'zh-CN': '没有暗三条绝不持续下注' } },
        ],
        correctOptionId: 'small',
        explanation: {
          en: 'On K72 rainbow, BTN has a massive range and nut advantage. A 33% pot c-bet puts immediate pressure on BB’s wide defending range at minimal risk.',
          'zh-CN': 'K72 彩虹面 BTN 拥有压倒性范围与坚果优势，33% 小额持续下注能以极低成本给大盲宽范围制造巨大压力。',
        },
      },
      {
        id: 'bt-q2',
        prompt: {
          en: 'Why should the preflop raiser check back more often on 9♥ 8♥ 6♣ than on A♠ 7♦ 2♣?',
          'zh-CN': '为什么翻前加注者在 9♥ 8♥ 6♣ 牌面上，应比 A♠ 7♦ 2♣ 更频繁地过牌？',
        },
        board: [
          { rank: '9', suit: 'h' },
          { rank: '8', suit: 'h' },
          { rank: '6', suit: 'c' },
        ],
        options: [
          { id: 'bb_hits', label: { en: 'BB connects heavily with straights, two pairs, and draws', 'zh-CN': '大盲防守范围在此牌面击中了大量顺子、两对与听牌' } },
          { id: 'no_aces', label: { en: 'Because there is no Ace on the board', 'zh-CN': '仅仅因为牌面上没有 A' } },
          { id: 'always_check', label: { en: 'Because you should never bet flush-draw boards', 'zh-CN': '因为有同花听牌的牌面永远不能下注' } },
        ],
        correctOptionId: 'bb_hits',
        explanation: {
          en: 'BB defends lots of suited connectors and medium gappers (T7s, 98s, 75s, 86s) that smash 986 two-tone, erasing the preflop raiser’s automatic c-bet advantage.',
          'zh-CN': '大盲防守了大量中低连张与同花牌（T7s、98s、75s、86s），在 986 双同花牌面命中率极高，因此加注者不能再无脑全范围持续下注。',
        },
      },
    ],
  },
  {
    id: 'player_archetypes',
    order: 6,
    durationMin: 2,
    targetModule: 'table',
    title: {
      en: 'Spotting Player Types (HUD Basics)',
      'zh-CN': '识别对手类型（HUD 基础）',
    },
    subtitle: {
      en: 'Decode VPIP & PFR in seconds to exploit Stations, Nits, and Maniacs',
      'zh-CN': '通过 VPIP 与 PFR 快速看穿跟注站、紧弱玩家与激进型对手',
    },
    summary: {
      en: 'You don’t need a database of 50 stats to crush real opponents. Just two numbers—VPIP (how often they put money in preflop) and PFR (how often they raise)—tell you almost everything you need to adjust.',
      'zh-CN': '实战中不需要死记几十项数据，只看两个核心指标——VPIP（主动入池率）与 PFR（翻前加注率）——就能立刻摸清对手底细并制定针对策略。',
    },
    keyTakeaways: [
      {
        en: 'Calling Station (high VPIP ~48%, low PFR ~10%): Stop bluffing them—value bet thinner and larger!',
        'zh-CN': '跟注站（高 VPIP 约 48%、低 PFR 约 10%）：减少纯诈唬，拿着中强成牌放心做更薄、更大的价值下注。',
      },
      {
        en: 'Tight Nit (low VPIP ~14%, low PFR ~11%): Steal their blinds relentlessly, and fold medium hands when they suddenly raise big.',
        'zh-CN': '紧弱型 Nit（低 VPIP 约 14%、低 PFR 约 11%）：积极偷他们的盲注；一旦他们突然重注加注，尊重其极强的牌力。',
      },
      {
        en: 'Maniac / LAG (high VPIP & high PFR): Tighten your bluffs, widen your bluff-catchers, and let them hang themselves.',
        'zh-CN': '松凶 / 激进型（高 VPIP 且高 PFR）：减少无谓诈唬，放宽抓诈唬范围，让对手自己把筹码送进底池。',
      },
    ],
    questions: [
      {
        id: 'arch-q1',
        prompt: {
          en: 'An opponent’s HUD shows VPIP 49% / PFR 10% (Calling Station). You miss your flush draw on the river. Best adjustment?',
          'zh-CN': '对手 HUD 显示 VPIP 49% / PFR 10%（跟注站）。河牌你听同花落空，最佳调整是？',
        },
        options: [
          { id: 'giveup', label: { en: 'Give up — don’t bluff players who hate folding', 'zh-CN': '果断放弃——不要去诈唬不爱弃牌的对手' } },
          { id: 'triple', label: { en: 'Triple-barrel all-in to force a fold', 'zh-CN': '全下强行逼迫对方弃牌' } },
          { id: 'minbet', label: { en: 'Min-bet 1bb as a bluff', 'zh-CN': '最小下注 1bb 尝试诈唬' } },
        ],
        correctOptionId: 'giveup',
        explanation: {
          en: 'Bluffs only profit when opponents fold often enough. Against Calling Stations, save your chips on missed draws and punish them with big value bets when you hit.',
          'zh-CN': '诈唬盈利的前提是对手有足够弃牌率。面对跟注站，听牌落空就省下筹码，成牌时靠厚重价值注赢回来。',
        },
      },
      {
        id: 'arch-q2',
        prompt: {
          en: 'A Tight Nit (VPIP 13% / PFR 11%) 3-bets your CO open from the Button. What does their range look like?',
          'zh-CN': '一位紧弱型对手（VPIP 13% / PFR 11%）在庄位 3-Bet 你的 CO 开池，他的范围大概率是什么？',
        },
        options: [
          { id: 'premium', label: { en: 'Heavily weighted to QQ+, AK — fold marginal hands', 'zh-CN': '高度集中在 QQ+、AK 等超强牌——果断弃掉边缘牌' } },
          { id: 'anytwo', label: { en: 'Random suited trash and weak bluff combos', 'zh-CN': '大量随机同花垃圾牌与松散诈唬' } },
          { id: 'pairs_only', label: { en: 'Only small pocket pairs 22–55', 'zh-CN': '只有 22–55 小口袋对' } },
        ],
        correctOptionId: 'premium',
        explanation: {
          en: 'Nits rarely light 3-bet. Respect their aggression by folding dominated broadways like KJo/ATo and continuing mostly with strong hands or good implied-odds pairs.',
          'zh-CN': '紧弱型玩家极少轻率 3-Bet。面对其反加应果断弃掉 KJo、ATo 等易被压制的大牌，只用强牌或合适赔率的手牌继续。',
        },
      },
    ],
  },
];
