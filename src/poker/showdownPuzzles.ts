import type { Card } from './types';
import type { LocalizedText } from './fundamentalsLessons';

export type ShowdownPuzzleSlug =
  | 'kicker'
  | 'play-the-board'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'wheel'
  | 'counterfeit'
  | 'higher-straight'
  | 'flush-vs-flush'
  | 'two-pair';

export interface ShowdownPuzzle {
  slug: ShowdownPuzzleSlug;
  title: LocalizedText;
  hook: LocalizedText;
  board: Card[];
  hero: [Card, Card];
  villain: [Card, Card];
  winner: 'hero' | 'villain' | 'split';
  explanation: LocalizedText;
  ruleTakeaway: LocalizedText;
  /** Optional interactive step: ask user to tap the winning side's deciding card */
  tapDeciderTarget?: 'hero' | 'villain';
  tapDeciderCardKey?: string;
}

export const SHOWDOWN_PUZZLES: ShowdownPuzzle[] = [
  {
    slug: 'kicker',
    title: { en: 'Same Pair, Higher Kicker', 'zh-CN': '同对子比踢脚' },
    hook: { en: 'Same pair. Different ending.', 'zh-CN': '同一个对子，截然不同的结局。' },
    board: [
      { rank: 'A', suit: 'h' },
      { rank: '9', suit: 'h' },
      { rank: '7', suit: 'c' },
      { rank: '5', suit: 'd' },
      { rank: '2', suit: 's' },
    ],
    hero: [
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'c' },
    ],
    villain: [
      { rank: 'A', suit: 'c' },
      { rank: 'Q', suit: 'd' },
    ],
    winner: 'hero',
    explanation: {
      en: 'Both players make a pair of Aces. Hero’s best five are A-A-K-9-7; Villain’s are A-A-Q-9-7. Hero’s King kicker beats the Queen.',
      'zh-CN': '双方都组成一对 A。我方最强五张是 A-A-K-9-7，对手是 A-A-Q-9-7。我方的 K 踢脚压制 Q 踢脚。',
    },
    ruleTakeaway: {
      en: 'When two players share the same pair, compare the highest unpaired kickers inside the best 5 cards.',
      'zh-CN': '双方对子相同时，依次比较最强五张牌中最高的单张踢脚。',
    },
    tapDeciderTarget: 'hero',
    tapDeciderCardKey: 'Kc',
  },
  {
    slug: 'counterfeit',
    title: { en: 'Counterfeited Pocket Pair', 'zh-CN': '口袋对被公共牌覆盖' },
    hook: { en: 'Your pair stopped counting.', 'zh-CN': '你的口袋对不再算数。' },
    board: [
      { rank: '9', suit: 'c' },
      { rank: '9', suit: 'd' },
      { rank: '4', suit: 's' },
      { rank: '4', suit: 'h' },
      { rank: 'K', suit: 'c' },
    ],
    hero: [
      { rank: '2', suit: 's' },
      { rank: '2', suit: 'd' },
    ],
    villain: [
      { rank: 'A', suit: 'h' },
      { rank: '3', suit: 'c' },
    ],
    winner: 'villain',
    explanation: {
      en: 'There is no “Three Pair”. Both players use the board’s 9-9-4-4. Hero’s 5th card is the board King, while Villain’s Ace plays as the winning kicker.',
      'zh-CN': '德州扑克没有“三对”。双方都使用牌面的 9-9-4-4，我方第 5 张只能用牌面 K，对手手里的 A 成为决胜踢脚。',
    },
    ruleTakeaway: {
      en: 'Only the best 5 cards play—when the board makes two higher pairs, a smaller pocket pair is counterfeited.',
      'zh-CN': '只算最强 5 张牌——公共牌出现两对更大的对子时，小口袋对会被直接覆盖失效。',
    },
    tapDeciderTarget: 'villain',
    tapDeciderCardKey: 'Ah',
  },
  {
    slug: 'play-the-board',
    title: { en: 'Playing the Board (Split Pot)', 'zh-CN': '直接打公共牌（平分底池）' },
    hook: { en: 'Nobody owns this royal.', 'zh-CN': '这手皇家同花顺谁也独占不了。' },
    board: [
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 's' },
      { rank: 'Q', suit: 's' },
      { rank: 'J', suit: 's' },
      { rank: 'T', suit: 's' },
    ],
    hero: [
      { rank: 'A', suit: 'h' },
      { rank: 'A', suit: 'd' },
    ],
    villain: [
      { rank: '7', suit: 'c' },
      { rank: '2', suit: 'd' },
    ],
    winner: 'split',
    explanation: {
      en: 'Neither player can improve the Royal Flush already on the board. Both players play the exact same 5 community cards and split the pot evenly.',
      'zh-CN': '双方底牌都无法改进牌面上已有的皇家同花顺。两家共用完全相同的 5 张公共牌，平分底池。',
    },
    ruleTakeaway: {
      en: 'In Hold’em you may use 2, 1, or 0 hole cards—if the 5 board cards are the best hand for both players, it is a chop.',
      'zh-CN': '德州扑克可以用 2 张、1 张或 0 张底牌——只要 5 张公共牌就是双方最强牌，就是平分底池。',
    },
  },
  {
    slug: 'full-house',
    title: { en: 'Full House: Trips First', 'zh-CN': '葫芦先比三条' },
    hook: { en: 'Three comes before two.', 'zh-CN': '三条永远先于对子比较。' },
    board: [
      { rank: '8', suit: 's' },
      { rank: '8', suit: 'h' },
      { rank: 'K', suit: 'd' },
      { rank: 'K', suit: 'c' },
      { rank: '3', suit: 's' },
    ],
    hero: [
      { rank: '8', suit: 'd' },
      { rank: 'A', suit: 'c' },
    ],
    villain: [
      { rank: 'K', suit: 'h' },
      { rank: '2', suit: 'd' },
    ],
    winner: 'villain',
    explanation: {
      en: 'Hero makes Eights full of Kings (8-8-8-K-K), while Villain makes Kings full of Eights (K-K-K-8-8). Full houses compare the three-of-a-kind first.',
      'zh-CN': '我方是 8 带 K 葫芦（8-8-8-K-K），对手是 K 带 8 葫芦（K-K-K-8-8）。葫芦优先比较三条的大小。',
    },
    ruleTakeaway: {
      en: 'A Full House is always ranked by its trips first, and only by its pair if both players share the same trips.',
      'zh-CN': '葫芦永远先比三条；只有三条相同时，才比较对子部分。',
    },
    tapDeciderTarget: 'villain',
    tapDeciderCardKey: 'Kh',
  },
  {
    slug: 'flush',
    title: { en: 'Four Suited Cards Aren’t a Flush', 'zh-CN': '四张同花不算同花' },
    hook: { en: 'A flush needs five.', 'zh-CN': '同花必须凑齐五张。' },
    board: [
      { rank: 'Q', suit: 'h' },
      { rank: '9', suit: 'h' },
      { rank: '6', suit: 'h' },
      { rank: '4', suit: 'c' },
      { rank: '2', suit: 's' },
    ],
    hero: [
      { rank: 'A', suit: 'h' },
      { rank: 'J', suit: 'd' },
    ],
    villain: [
      { rank: 'K', suit: 'c' },
      { rank: '4', suit: 'd' },
    ],
    winner: 'villain',
    explanation: {
      en: 'Hero only has four hearts (A♥ Q♥ 9♥ 6♥)—not a flush—so Hero holds Ace-high. Villain’s pair of Fours wins the pot.',
      'zh-CN': '我方只有 4 张红桃（A♥ Q♥ 9♥ 6♥），并不构成同花，只是 A 高牌；对手击中一对 4 获胜。',
    },
    ruleTakeaway: {
      en: 'Four cards of one suit has zero showdown value by itself; a flush strictly requires five suited cards.',
      'zh-CN': '四张同花在摊牌时没有任何成牌价值，必须凑满五张才是同花。',
    },
  },
  {
    slug: 'straight',
    title: { en: 'Shared Straight: Ace Doesn’t Play', 'zh-CN': '公共牌顺子：A 不能当第 6 张' },
    hook: { en: 'Your ace can take a seat.', 'zh-CN': '手里的 A 只能坐冷板凳。' },
    board: [
      { rank: '9', suit: 's' },
      { rank: '8', suit: 'd' },
      { rank: '7', suit: 'c' },
      { rank: '6', suit: 'h' },
      { rank: '5', suit: 's' },
    ],
    hero: [
      { rank: 'A', suit: 'c' },
      { rank: 'K', suit: 'd' },
    ],
    villain: [
      { rank: 'Q', suit: 'h' },
      { rank: '2', suit: 'c' },
    ],
    winner: 'split',
    explanation: {
      en: 'Neither player holds a Ten to make a higher straight, so both play the board’s 9-high straight (9-8-7-6-5). Kickers never play in a 5-card straight.',
      'zh-CN': '双方都没有 10 来凑更大的顺子，因此两家都打牌面的 9 高顺子（9-8-7-6-5）。顺子占满 5 张牌，不比额外踢脚。',
    },
    ruleTakeaway: {
      en: 'Straights use all 5 cards—an extra Ace in your hand cannot break a tied straight.',
      'zh-CN': '顺子已占满全部 5 张牌，手里的 A 无法打破顺子平局。',
    },
  },
  {
    slug: 'wheel',
    title: { en: 'The Wheel (Ace-Low Straight)', 'zh-CN': 'A-2-3-4-5 最小顺子' },
    hook: { en: 'The ace can play low.', 'zh-CN': 'A 也能当 1 连成顺子。' },
    board: [
      { rank: '5', suit: 'c' },
      { rank: '4', suit: 'd' },
      { rank: '3', suit: 'h' },
      { rank: 'K', suit: 's' },
      { rank: '9', suit: 'c' },
    ],
    hero: [
      { rank: 'A', suit: 'd' },
      { rank: '2', suit: 's' },
    ],
    villain: [
      { rank: 'K', suit: 'h' },
      { rank: 'K', suit: 'c' },
    ],
    winner: 'hero',
    explanation: {
      en: 'Hero’s Ace plays low to complete the 5-high straight (5-4-3-2-A, the “wheel”), which beats Villain’s Three Kings.',
      'zh-CN': '我方的 A 当 1 使用，凑成 5-4-3-2-A 最小顺子，稳稳击败对手的三条 K。',
    },
    ruleTakeaway: {
      en: 'An Ace can anchor either the highest straight (A-K-Q-J-10) or the lowest straight (5-4-3-2-A).',
      'zh-CN': 'A 既可以组成最大的 A-K-Q-J-10 顺子，也可以当 1 组成最小的 5-4-3-2-A 顺子。',
    },
  },
  {
    slug: 'higher-straight',
    title: { en: 'Two Straights: Top Card Wins', 'zh-CN': '顺子对顺子：比最高一张' },
    hook: { en: 'The top card decides.', 'zh-CN': '顺子对决，最高那张一锤定音。' },
    board: [
      { rank: 'T', suit: 'c' },
      { rank: '9', suit: 'd' },
      { rank: '8', suit: 'h' },
      { rank: '7', suit: 's' },
      { rank: '2', suit: 'c' },
    ],
    hero: [
      { rank: 'J', suit: 's' },
      { rank: '3', suit: 'd' },
    ],
    villain: [
      { rank: '6', suit: 'c' },
      { rank: '6', suit: 'h' },
    ],
    winner: 'hero',
    explanation: {
      en: 'Hero makes a Jack-high straight (J-10-9-8-7), beating Villain’s 10-high straight (10-9-8-7-6).',
      'zh-CN': '我方组成 J 高顺子（J-10-9-8-7），击败对手的 10 高顺子（10-9-8-7-6）。',
    },
    ruleTakeaway: {
      en: 'On four-to-a-straight boards, holding the top end beats the lower end every time.',
      'zh-CN': '公共牌出现四张连张时，拿上端顺子永远压制下端顺子。',
    },
    tapDeciderTarget: 'hero',
    tapDeciderCardKey: 'Js',
  },
  {
    slug: 'flush-vs-flush',
    title: { en: 'Two Flushes: Card by Card', 'zh-CN': '同花对同花：逐张比大小' },
    hook: { en: 'Two flushes. One winner.', 'zh-CN': '两家都是同花，逐张决出胜负。' },
    board: [
      { rank: 'A', suit: 'd' },
      { rank: 'Q', suit: 'd' },
      { rank: '8', suit: 'd' },
      { rank: '4', suit: 'd' },
      { rank: '3', suit: 'c' },
    ],
    hero: [
      { rank: 'J', suit: 'd' },
      { rank: '5', suit: 's' },
    ],
    villain: [
      { rank: 'T', suit: 'd' },
      { rank: '9', suit: 'h' },
    ],
    winner: 'hero',
    explanation: {
      en: 'Both players share the Ace and Queen of diamonds on board. Comparing the third-highest diamond, Hero’s J♦ beats Villain’s 10♦.',
      'zh-CN': '双方共用牌面的 A♦ 和 Q♦。比较第三大的方块时，我方的 J♦ 压制对手的 10♦。',
    },
    ruleTakeaway: {
      en: 'When two players make a flush in the same suit, compare the five suited cards from highest to lowest until one is higher.',
      'zh-CN': '双方都是同一花色同花时，从最大到最小逐张比较五张同花牌，直到分出高低。',
    },
    tapDeciderTarget: 'hero',
    tapDeciderCardKey: 'Jd',
  },
  {
    slug: 'two-pair',
    title: { en: 'Two Pair: Compare the Fifth Card', 'zh-CN': '两对相同比第五张' },
    hook: { en: 'Read both pairs—then the kicker.', 'zh-CN': '先看两对，再看第五张牌。' },
    board: [
      { rank: 'K', suit: 's' },
      { rank: 'K', suit: 'd' },
      { rank: '7', suit: 'h' },
      { rank: '7', suit: 'c' },
      { rank: '4', suit: 's' },
    ],
    hero: [
      { rank: 'Q', suit: 'c' },
      { rank: '5', suit: 'd' },
    ],
    villain: [
      { rank: 'J', suit: 's' },
      { rank: 'J', suit: 'h' },
    ],
    winner: 'villain',
    explanation: {
      en: 'Hero’s best five are K-K-7-7-Q, while Villain’s pocket Jacks beat the board’s Sevens to make K-K-J-J-7! Always compare the higher pairs before kickers.',
      'zh-CN': '我方最强五张是 K-K-7-7-Q，而对手的口袋 J 替换了牌面的一对 7，组成更大的两对 K-K-J-J-7！两对先比大对，再比小对，最后才比踢脚。',
    },
    ruleTakeaway: {
      en: 'Two pair compares the top pair first, the second pair next, and the 5th-card kicker last.',
      'zh-CN': '两对先比大对，再比小对，两对完全相同时才比第 5 张踢脚。',
    },
  },
];

export function getShowdownPuzzleBySlug(slug: string | null | undefined): ShowdownPuzzle | undefined {
  if (!slug) return undefined;
  return SHOWDOWN_PUZZLES.find((p) => p.slug === slug);
}
