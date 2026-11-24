import type { Locale } from './translations';
import { translateActionText, translateArchetype, translateMathCategory, translateStreetLabel } from './translations';
import type { PreflopSpotTemplate } from '../poker/preflopRanges';
import type { PostflopDrillSpot } from '../poker/postflopSpots';
import type { HandReadingSpot } from '../poker/handReadingSpots';
import type { MathDrawScenarioId, MathDrillQuestion } from '../poker/mathDrills';
import type {
  AuditNoteSpec,
  TableActionSpec,
  WinnerSummarySpec,
} from '../poker/tableEngine';

interface PreflopZhCopy {
  title: string;
  subtitle: string;
  actionSummary: string;
  strategyNote: string;
}

const PREFLOP_ZH: Record<string, PreflopZhCopy> = {
  'rfi-utg': {
    title: 'UTG 开池加注 (RFI)',
    subtitle: '6人桌 · 100bb · 枪口位（UTG）率先行动',
    actionSummary: '轮到你在枪口位（UTG）率先行动。',
    strategyNote:
      '身后还有 5 位玩家待行动，枪口位（UTG）开池加注范围需保持紧凑（约 17% 组合），优先保留强口袋对、同花大牌与高张牌力，弃掉容易被压制的杂色小 A 和弱同花连张。',
  },
  'rfi-hj': {
    title: 'HJ 开池加注 (RFI)',
    subtitle: '6人桌 · 100bb · HJ 率先行动',
    actionSummary: 'UTG 弃牌，轮到你在 HJ 行动。',
    strategyNote:
      '在 HJ（约 22% 开池加注率）可以放宽范围，加入所有同花小 A（A2s+）、K9s、Q9s、J9s 和中等同花连张，同时补充 ATo 与 KJo 兼顾不同公共牌面的覆盖。',
  },
  'rfi-co': {
    title: 'CO 开池加注 (RFI)',
    subtitle: '6人桌 · 100bb · CO 率先行动',
    actionSummary: 'UTG 与 HJ 均弃牌，轮到你在 CO 行动。',
    strategyNote:
      'CO 开池加注率约 29%。身后只剩按钮位（BTN）和大小盲，所有口袋对（22+）、低至 K6s 的同花 K、同花隔张（J8s、T8s、97s）以及 A9o／KTo 都适合加入开池加注范围。',
  },
  'rfi-btn': {
    title: 'BTN 开池加注 (RFI)',
    subtitle: '6人桌 · 100bb · 按钮位（BTN）率先行动',
    actionSummary: '前面全员弃牌，轮到你在按钮位（BTN）行动。',
    strategyNote:
      '按钮位（BTN）翻后全程有位置，开池加注率约 45%：所有口袋对、全部同花 A 与同花 K、低至 Q3s 的同花 Q、相连的同花牌以及低至 A5o 的杂色 A 都可以用来开池加注。',
  },
  'rfi-sb': {
    title: 'SB 开池加注 (RFI)',
    subtitle: '6人桌 · 100bb · 小盲对大盲（加注或弃牌策略）',
    actionSummary: '前面全员弃牌，轮到你在小盲位（SB）对阵大盲位（BB）。',
    strategyNote:
      '在 100bb 简化的纯加注或弃牌策略中，小盲位（SB）用约 42% 的起手牌开池加注到 3.0bb，既能压缩大盲位（BB）免费看牌的空间，也能在面对 3-Bet 时维持够强的没位置防守范围。',
  },
  'vs-open-btn-co': {
    title: 'BTN 面对 CO 开池加注',
    subtitle: '6人桌 · 100bb · 面对 CO 2.5bb 开池加注',
    actionSummary: 'CO 开池加注到 2.5bb，轮到你在按钮位（BTN）行动。',
    strategyNote:
      '在按钮位（BTN）有位置面对 CO 开池加注时，可用线性强牌搭配同花阻挡牌构建 3-Bet 范围（如 QQ+、AK、AQs、KQs、A5s–A4s），并用中等口袋对、同花连张和可玩性高的大牌跟注打翻后。',
  },
  'vs-open-bb-btn': {
    title: 'BB 防守 BTN 开池加注',
    subtitle: '6人桌 · 100bb · 大盲位（BB）面对 BTN 2.5bb 开池加注',
    actionSummary: 'BTN 开池加注到 2.5bb，SB 弃牌，轮到你在大盲位（BB）行动。',
    strategyNote:
      '大盲位（BB）最后行动且底池赔率很好（只需跟注 1.5bb 争夺 5.5bb 总底池，盈亏平衡仅需约 27% 权益），整体防守率约 55%：用两极化强价值牌（TT+、AQs+、AKo、KQs）搭配同花小 A 或同花 K 阻挡牌做 3-Bet，其余较宽的同花与连张组合以跟注防守为主。',
  },
  'vs-open-sb-btn': {
    title: 'SB 面对 BTN 开池加注（高频率 3-Bet）',
    subtitle: '6人桌 · 100bb · 小盲位（SB）面对 BTN 2.5bb 开池加注',
    actionSummary: 'BTN 开池加注到 2.5bb，轮到你在小盲位（SB）行动，身后大盲位（BB）尚未行动。',
    strategyNote:
      '小盲位（SB）翻后没位置且身后大盲位（BB）可能挤压加注，因此接近纯 3-Bet 或弃牌策略（约 16% 3-Bet），用 88+、A9s+、KTs+、QTs+、JTs、AJo+、KQo 与 A5s 等线性范围反击按钮位较宽的开池范围。',
  },
  'vs-3bet-btn-bb': {
    title: 'BTN 面对 BB 3-Bet',
    subtitle: '6人桌 · 100bb · 我方开池加注到 2.5bb，BB 3-Bet 到 10bb',
    actionSummary: '你在 BTN 开池加注到 2.5bb，大盲位（BB）3-Bet 到 10bb。',
    strategyNote:
      '有位置面对大盲位（BB）10bb 的 3-Bet 时，按钮位（BTN）约防守开池范围的 46%：用 KK+、AK 搭配带阻挡牌的两极化诈唬（A5s、A4s、KQo）做 4-Bet，用可玩性好的口袋对、同花大牌和同花连张跟注看翻牌。',
  },
  'vs-3bet-co-btn': {
    title: 'CO 面对 BTN 3-Bet',
    subtitle: '6人桌 · 100bb · 我方开池加注到 2.5bb，BTN 3-Bet 到 7.5bb',
    actionSummary: '你在 CO 开池加注到 2.5bb，按钮位（BTN）3-Bet 到 7.5bb。',
    strategyNote:
      '没位置面对紧凑的按钮位（BTN）3-Bet 时，CO 需要收紧防守：用 QQ+、AK 搭配 A5s 等带阻挡牌的组合做 4-Bet，避免在没位置的大底池中范围封顶，同时用 TT–77 与强同花大牌跟注。',
  },
};

export function localizePreflopTemplate(
  locale: Locale,
  template: PreflopSpotTemplate
): PreflopSpotTemplate {
  if (locale === 'en') return template;
  const zh = PREFLOP_ZH[template.id];
  if (!zh) return template;
  return {
    ...template,
    title: zh.title,
    subtitle: zh.subtitle,
    actionSummary: zh.actionSummary,
    strategyNote: zh.strategyNote,
  };
}

interface PostflopZhCopy {
  neutralTitle: string;
  title: string;
  numbersBreakdown: string;
  takeaways: {
    boardTexture: string;
    rangeAdvantage: string;
    blockerNote: string;
    coreRule: string;
  };
}

const POSTFLOP_ZH: Record<string, PostflopZhCopy> = {
  'pf-srp-btn-bb-a72r': {
    neutralTitle: '翻牌决策：BTN 有位置面对 BB 过牌（干燥 A 高面）',
    title: 'BTN 在干燥 A 高彩虹面做小尺度持续下注',
    numbersBreakdown:
      '底池 5.5bb，有效筹码 97.5bb（SPR 筹码底池比 17.7）。下注 1.8bb（33% 底池）时，对手只要弃牌超过 24.7%，哪怕纯空气牌也能立刻盈利。',
    takeaways: {
      boardTexture: '干燥、不相连的 A 高彩虹牌面，顺子与同花听牌非常少。',
      rangeAdvantage:
        'BTN 拥有完整的 AA、AK、AQ、AJ 组合，面对翻前平跟封顶的大盲位（BB）握有明显的范围优势（整体牌力领先）与坚果优势。',
      blockerNote:
        'KQo 带有高张和后门潜力，用小尺度下注能顺手打弃大盲位（BB）的 6x–5x 边缘牌，不让对手免费看转牌。',
      coreRule: '在干燥牌面握有明显范围优势时，高频使用 25%–33% 底池的小尺度持续下注非常高效。',
    },
  },
  'pf-srp-co-bb-765tt': {
    neutralTitle: '翻牌决策：CO 有位置面对 BB 过牌（7-6-5 两同花）',
    title: 'CO 在低张相连两同花牌面在后位过牌',
    numbersBreakdown:
      '底池 5.5bb，有效筹码 97.5bb（SPR 17.7）。如果在这里习惯性下注，很容易撞上大盲位（BB）密集的两对、暗三条和强听牌过牌加注。',
    takeaways: {
      boardTexture: '低张高度相连的两同花牌面，两对、暗三条、成牌顺子及各类听牌都很密集。',
      rangeAdvantage:
        '大盲位（BB）非常契合 7-6-5 结构（98s、84s、76s、75s、65s 以及 55–77），CO 在这里没有坚果优势。',
      blockerNote:
        'AKo 带有两张高张和后门同花潜质，在后位过牌可以免费看转牌并稳稳实现权益，不必冒被过牌加注逼弃的风险。',
      coreRule: '在低张相连、明显利于大盲位（BB）的动态连张面上，克制惯性持续下注，提高在后位过牌的频率。',
    },
  },
  'pf-srp-bb-btn-xr-984': {
    neutralTitle: '翻牌决策：BB 面对 BTN 33% 持续下注（9-8-4 彩虹面）',
    title: 'BB 持强两头顺听牌面对小下注做过牌加注半诈唬',
    numbersBreakdown:
      '底池 7.3bb（含 BTN 下注的 1.8bb）。跟注 1.8bb 只需 19.8% 胜率，但加注到 7.0bb 能用 8 张两头顺补牌加两张高张直接给 BTN 宽范围施压。',
    takeaways: {
      boardTexture: '9-8-4 彩虹面中段相连，按钮位（BTN）高频小尺度持续下注的范围很宽，容易承受加注压力。',
      rangeAdvantage:
        '大盲位（BB）握有 98s、94s、84s、44 和 88 等强成牌，能支撑两极化（强价值牌配听牌半诈唬）的过牌加注范围。',
      blockerNote:
        'JTs 同花拥有 8 张两头顺补牌、两张高张和后门同花听牌，是很优质的半诈唬（靠对手弃牌或自己成牌双路盈利）候选。',
      coreRule: '面对小尺度持续下注，拿着两头顺加两张高张的强听牌，用过牌加注半诈唬既能做大底池，也能抢下弃牌率。',
    },
  },
  'pf-3bp-btn-co-k94r': {
    neutralTitle: '翻牌决策：3-Bet 底池 BTN 面对 CO 过牌（K-9-4 彩虹面）',
    title: '3-Bet 底池有位置在干燥 K 高面做小尺度范围持续下注',
    numbersBreakdown:
      '底池 16.5bb，有效筹码 92.5bb（SPR 5.6）。下注 5.5bb（33% 底池）时，对手需要弃牌超过 25.0% 即可让空气牌直接盈利，对中弱牌压力很大。',
    takeaways: {
      boardTexture: '低筹码底池比（SPR 5.6）的干燥 K 高彩虹牌面，牌面听牌极少。',
      rangeAdvantage:
        'BTN 保留完整权重的 AA、KK、AK 和 KQs，而 CO 翻前未做 4-Bet，范围里几乎没有 KK 或 AK。',
      blockerNote:
        'QJs 同花带有后门同花听牌和卡顺潜质，小尺度持续下注就能给 CO 的 AQo、AJo 与 66–88 带来很大防守压力。',
      coreRule: '在有位置的 3-Bet 底池干燥 A／K 高翻牌面上，用 25%–33% 底池的小尺度高频持续下注通常是简洁好用的基准打法。',
    },
  },
  'pf-3bp-sb-btn-qjt-oop': {
    neutralTitle: '翻牌决策：3-Bet 底池 SB 没位置率先行动（单花色 Q-J-T）',
    title: '3-Bet 底池没位置在单花色大牌相连面过牌控池',
    numbersBreakdown:
      '底池 22.0bb，有效筹码 89.0bb（SPR 4.0）。单花色 Q-J-T 面大量组合已成同花或顺子，无同花阻挡牌的 AA 没位置不宜把底池急着打大。',
    takeaways: {
      boardTexture: '单花色 Q-J-T 大牌相连牌面，双方范围里都有不少成牌同花、顺子与两对。',
      rangeAdvantage:
        '手里的口袋 AA 不带牌面同花花色的 A 阻挡牌，面对已成牌的同花、顺子和两对时，实战更接近偏脆的抓诈唬牌。',
      blockerNote:
        '两张 A 既不减少对手同花组合，也不挡 K9s／98s 顺子；先过牌能保护没位置的过牌范围，避免被对手加注陷入被动。',
      coreRule: '在单花色且高度相连的翻牌面上，不含同花阻挡牌的超对优先过牌控池。',
    },
  },
  'pf-srp-utg-bb-turn-overcard': {
    neutralTitle: '转牌决策：UTG 面对 BB 过牌（转牌发出高张 K）',
    title: '转牌发高张 K 偏向 UTG 范围，加大转牌继续下注尺度',
    numbersBreakdown:
      '底池 9.5bb，有效筹码 95.5bb（SPR 10.1）。转牌 K 极度利于 UTG，用 7.1bb（75%）或 11.9bb（125% 超池）向大盲位的 Tx、6x 和听牌收取高额价值。',
    takeaways: {
      boardTexture: '转牌高张 K 明显偏向枪口位（UTG）范围，同时翻牌面上的同花听牌仍未成型。',
      rangeAdvantage:
        'UTG 握有 KK、AK、KQ、KT 等强 K 组合，大盲位（BB）翻牌跟注范围大多停留在 Tx、6x 和未成牌的听牌上。',
      blockerNote:
        '顶对顶踢脚在转牌适合两极化并放大尺度，直接向对手的 Tx、6x 和未成听牌榨取价值。',
      coreRule: '当转牌高张明显偏向翻前加注者范围时，适合放大转牌继续下注的尺度（75%–125% 底池）。',
    },
  },
  'pf-srp-bb-co-turn-call-fd': {
    neutralTitle: '转牌决策：BB 面对 CO 75% 底池下注（组合听牌）',
    title: 'BB 持 15 张补牌组合听牌，按底池赔率在转牌跟注',
    numbersBreakdown:
      '下注前底池 11.0bb，CO 下注 8.3bb（75% 底池），跟注后总底池 27.6bb。跟注盈亏平衡需 8.3 ÷ 27.6 = 30.1%（按 19.3bb 跟注前底池精确算为 29.8%）；你手握 15 张补牌，河牌直接击中概率就有 15 ÷ 46 = 32.6%。',
    takeaways: {
      boardTexture: '转牌发出 6 后，我方组成两头顺加同花组合听牌（15 张干净补牌，河牌单街击中概率约 32.6%）。',
      rangeAdvantage:
        'CO 的 75% 转牌继续下注偏两极化（强 Kx+ 价值下注配诈唬）；仅按底池赔率（29.8%），你的直接补牌胜率就已经过线。',
      blockerNote:
        '直接赔率已经足够支持跟注，而且河牌击中非同花顺子时还有可观的隐含赔率（成牌后还能从对手价值牌多赢筹码）。',
      coreRule: '转牌拿听牌面对下注时，先把“补牌 ÷ 46”算出的直接成牌率，和底池赔率门槛摆在一起对比。',
    },
  },
  'pf-3bp-btn-bb-turn-checkback': {
    neutralTitle: '转牌决策：3-Bet 底池 BTN 有位置面对 BB 过牌（口袋 JJ）',
    title: '3-Bet 底池转牌有位置用中等成牌在后位过牌控池',
    numbersBreakdown:
      '底池 34.5bb，有效筹码 83.0bb（SPR 2.4）。口袋 JJ 很难在 2.4 SPR 下连打两条街价值，转牌在后位过牌能把底池控制在舒适大小。',
    takeaways: {
      boardTexture: '大盲位（BB）翻牌持续下注后，转牌发出低张白板并转入过牌。',
      rangeAdvantage:
        '口袋 JJ 处在按钮位（BTN）范围中段：领先对手的空气牌、TT 与 99，但落后于 Qx 以及慢打的 AA／KK。',
      blockerNote:
        '转牌继续下注会把落后于我们的弱牌打弃，却让更强的 Qx 轻松跟注甚至设下过牌加注陷阱。',
      coreRule: '有位置拿着中等摊牌价值的成牌时，转牌常选择在后位过牌控池，留到河牌抓诈唬或打薄价值下注。',
    },
  },
  'pf-srp-btn-bb-river-thin-value': {
    neutralTitle: '河牌决策：BTN 有位置面对 BB 过牌（J 高白板河牌）',
    title: '河牌白板上有位置用强顶对做 50% 底池薄价值下注',
    numbersBreakdown:
      '底池 22.5bb，有效筹码 89.0bb。河牌白板让翻牌/转牌听牌全部落空，下注 11.3bb（50% 底池）能让对手大量较弱的 Jx 和 8x 跟注买单。',
    takeaways: {
      boardTexture: '河牌发出干净低张白板，牌面听牌全部落空，大盲位（BB）范围里留着不少偏弱的 Jx 和 8x。',
      rangeAdvantage:
        'BTN 范围未封顶，仍保留暗三条与超对；AJ 顶对顶踢脚明显领先大盲位（BB）绝大多数抓诈唬牌。',
      blockerNote:
        '对手过牌范围偏弱，河牌在后位过牌会白白错过价值；50% 底池（11.3bb）既能让弱 Jx／8x 跟注，又不会把自己孤立在更强牌面前。',
      coreRule: '当对手行动线显露封顶且河牌未成听牌时，强顶对适合用中等尺度做薄价值下注。',
    },
  },
  'pf-srp-bb-btn-river-bluffcatch-blockers': {
    neutralTitle: '河牌决策：BB 面对 BTN 71% 底池下注（同花成型河牌）',
    title: '河牌持坚果同花阻挡牌做抓诈唬跟注',
    numbersBreakdown:
      '下注前底池 29.5bb，BTN 下注 21.0bb（71% 底池），跟注后总底池 71.5bb。跟注盈亏平衡需要 21.0 ÷ 71.5 = 29.4% 胜率；你手里的坚果花色 A 挡掉了对手最多的坚果同花价值组合。',
    takeaways: {
      boardTexture: '翻牌同花听牌在河牌成花，按钮位（BTN）打出两极化的 71% 底池下注。',
      rangeAdvantage:
        '底池赔率要求 29.4% 胜率；大盲位（BB）面对同花河牌必须挑出带关键阻挡牌的抓诈唬牌来防守。',
      blockerNote:
        '手中的牌面花色 A 阻挡了对手最高频的坚果同花价值牌，同时不阻挡对手错失的顺子诈唬听牌，是教科书级的抓诈唬跟注候选。',
      coreRule: '河牌抓诈唬时，优先选“能挡住对手最强价值牌、且不挡对手错失听牌”的组合。',
    },
  },
  'pf-srp-co-bb-river-bluff-blockers': {
    neutralTitle: '河牌决策：CO 有位置面对 BB 过牌（J-T-4-8-2 河牌）',
    title: '河牌用错失听牌的 K9s 借顺子阻挡牌做两极化诈唬',
    numbersBreakdown:
      '底池 24.5bb，有效筹码 88.0bb。你手里只有 K 高牌（0 摊牌价值）。下注 18.4bb（75% 底池）时，盈亏平衡弃牌率 α = 18.4 ÷ (24.5 + 18.4) = 42.9%——只要大盲位弃掉超过 43% 的范围，诈唬就有利可图。',
    takeaways: {
      boardTexture:
        '翻牌卡顺、转牌两头顺在 2♦ 河牌彻底落空，K9s 现在只有 K 高牌，靠过牌几乎赢不了摊牌。',
      rangeAdvantage:
        'CO 在这条行动线上可以合理代表 Q9 顺子、97 顺子、暗三条（JJ／TT／88）与超对，而大盲位（BB）在河牌过牌后多集中在单对 Jx／Tx。',
      blockerNote:
        '手里的 9 直接阻挡了大盲位（BB）最硬的顺子跟注牌（Q9、97），同时不阻挡对手翻牌／转牌跟注后落空的同花听牌（这些牌在河牌必然弃牌）。',
      coreRule: '选河牌诈唬牌看三条：几乎没摊牌价值、手里有阻挡对手强跟注牌的阻挡牌，且不挡对手会弃牌的错失听牌。',
    },
  },
  'pf-3bp-bb-btn-river-fold-overbet': {
    neutralTitle: '河牌决策：3-Bet 底池 BB 面对 BTN 110% 超池全下',
    title: '面对河牌 110% 超池全下，无阻挡牌中对纪律弃牌',
    numbersBreakdown:
      '下注前底池 62.5bb，BTN 全下 69.0bb（110% 超池），跟注后总底池 200.5bb。跟注盈亏平衡需要 69.0 ÷ 200.5 = 34.4% 胜率，而最小防守频率（MDF）已降到 62.5 ÷ 131.5 = 47.5%，你可以安心放弃边缘抓诈唬牌。',
    takeaways: {
      boardTexture:
        '河牌发出成花花色的高张 A，既让同花成型，也让对手此前跟注的 Ax 全部反超成为顶对。',
      rangeAdvantage:
        'BTN 在 3-Bet 底池转牌下注接河牌 110% 超池全下，范围高度两极化，价值端集中在同花、AK、A8 与暗三条。',
      blockerNote:
        '口袋 TT 既输给对手所有价值牌，又不带任何同花阻挡牌；面对高门槛赔率（34.4%），在没有关键阻挡牌时应纪律弃牌。',
      coreRule: '面对河牌超池全下，先算清高昂的底池赔率——没阻挡对手核心价值牌的边缘对子果断弃牌。',
    },
  },
  'pf-srp-bb-sb-river-size-small': {
    neutralTitle: '河牌对比题（A）：BB 面对 SB 33% 小下注（6.6bb）',
    title: '面对 33% 河牌小下注，底池赔率仅需 19.9%——顶对轻松跟注',
    numbersBreakdown:
      '下注前底池 20.0bb，SB 河牌只下注 6.6bb（33% 底池），跟注后总底池 33.2bb。跟注盈亏平衡只需 6.6 ÷ 33.2 = 19.9% 胜率，而最小防守频率（MDF，防止被任意牌诈唬盈利的最低防守比例）高达 20.0 ÷ 26.6 = 75.2%。',
    takeaways: {
      boardTexture:
        'Q♦ 8♠ 5♣ 2♥ 3♦ 是非常干燥的 Q 高牌面，没有成同花，只有 64／76 等零星顺子组合。',
      rangeAdvantage:
        '小盲位（SB）连打三条街但河牌缩到 33% 小尺度，既可能用较弱 Qx／8x 打薄价值，也可能混入少量错失高张诈唬。',
      blockerNote:
        'Q♥ T♣ 是带不错踢脚的顶对，既不挡对手错失的 76／97／KJ 诈唬，面对 19.9% 的低赔率门槛完全够格轻松跟注。',
      coreRule: '下注尺度直接决定你的价格：面对 33% 小下注只需赢不到五分之一，顶对基本是必跟抓诈唬牌。',
    },
  },
  'pf-srp-bb-sb-river-size-overbet': {
    neutralTitle: '河牌对比题（B）：BB 面对 SB 125% 超池下注（25.0bb）',
    title: '同一手牌改面对 125% 超池下注，赔率飙升到 35.7%——转而弃牌',
    numbersBreakdown:
      '底牌、公共牌和 20.0bb 底池完全没变，但 SB 河牌下注从 6.6bb 跳到 25.0bb（125% 超池），跟注后总底池 70.0bb。所需胜率从 19.9% 飙升到 25.0 ÷ 70.0 = 35.7%，MDF 也从 75.2% 骤降到 20.0 ÷ 45.0 = 44.4%。',
    takeaways: {
      boardTexture:
        '同样是干燥的 Q♦ 8♠ 5♣ 2♥ 3♦，牌面本身没变，但对手在河牌的 125% 超池下注彻底改变了对手范围结构。',
      rangeAdvantage:
        '125% 超池下注在河牌是强两极化尺度——价值端集中在两对以上、暗三条、KK／AA 与 AQ／KQ，较弱的 Qx 不会用这么大尺度价值下注。',
      blockerNote:
        '此时你只需防守 44.4% 的范围，应把跟注名额留给更好的顶对（AQ、KQ、QJ）、两对和暗三条；QTo 踢脚偏弱，面对 35.7% 赔率门槛应果断弃牌。',
      coreRule: '同一手牌、同一张牌面，只要对手下注尺度从 33% 变成 125%，你的所需胜率和防守比例就会翻天覆地——看牌先看尺度和底池赔率。',
    },
  },
};

export function localizePostflopLogLine(locale: Locale, line: string): string {
  if (locale === 'en') return line;
  return translateActionText(locale, line)
    .replace(/,/g, '，')
    .replace(/:/g, '：')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/轮到\s*([A-Z]{2,3})/g, '轮到 $1 行动')
    .replace(/\s*([，：（）])\s*/g, '$1')
    .trim();
}

export function localizePostflopSpot(
  locale: Locale,
  spot: PostflopDrillSpot
): PostflopDrillSpot {
  if (locale === 'en') return spot;
  const zh = POSTFLOP_ZH[spot.id];
  if (!zh) return spot;
  return {
    ...spot,
    neutralTitle: zh.neutralTitle,
    title: zh.title,
    numbersBreakdown: zh.numbersBreakdown,
    actionLog: spot.actionLog.map((line) => localizePostflopLogLine(locale, line)),
    takeaways: zh.takeaways,
  };
}

interface HandReadingZhCopy {
  title: string;
  streetLabel: string;
  timeline: {
    street: string;
    detail: string;
    narrowingHint: string;
  }[];
  promptQuestion: string;
  explanation: string;
  keyCombosNote: string;
}

const HAND_READING_ZH: Record<string, HandReadingZhCopy> = {
  'hr-utg-cbet-check-turn': {
    title: 'UTG 在转牌后位过牌后的封顶范围',
    streetLabel: '转牌 · 单次加注底池 · 100bb',
    timeline: [
      {
        street: '翻前',
        detail: 'UTG 开池加注到 2.5bb，BB 跟注防守。',
        narrowingHint: '枪口位（UTG）起手范围较紧（约 17%）：66+、A9s+、KTs+、QTs+、JTs、T9s、AJo+、KQo。',
      },
      {
        street: '翻牌 K♠ 8♦ 3♣',
        detail: 'BB 过牌，UTG 持续下注 3.5bb，BB 跟注。',
        narrowingHint: 'UTG 在干燥 K 高面高频持续下注，范围内保留口袋对、Kx 以及大牌高张。',
      },
      {
        street: '转牌 2♥',
        detail: 'BB 过牌，UTG 在后位过牌。',
        narrowingHint: 'AA、KK、AK、KQ、88 通常会在转牌继续下注拿价值；在后位过牌使 UTG 范围封顶在中等对子、较弱 Kx 与带摊牌价值的 Ax。',
      },
    ],
    promptQuestion: '请勾选 UTG 在 K♠ 8♦ 3♣ 2♥ 转牌后位过牌后，可能持有的手牌范围。',
    explanation:
      '当 UTG 在 K-8-3 翻牌持续下注、并在白板 2♥ 转牌选择在后位过牌时，最强的一批价值成牌（AA、KK、88、AK、KQ）通常会继续下注。因此 UTG 的过牌范围明显封顶在中等口袋对（QQ–99、77–66）、偏弱的 Kx（KJs、KTs）以及 A 高摊牌牌型。',
    keyCombosNote: '实战提示：若河牌继续发白板，由于 UTG 范围里大多缺少 AA／KK／AK，面对大尺度两极化领先下注会承受较大压力。',
  },
  'hr-bb-xr-low-board': {
    title: 'BB 在 8♠ 7♠ 3♦ 低张相连两同花牌面的过牌加注范围',
    streetLabel: '翻牌 · 单次加注底池 · 100bb',
    timeline: [
      {
        street: '翻前',
        detail: 'CO 开池加注到 2.5bb，BB 跟注防守。',
        narrowingHint: 'BB 翻前平跟范围通常不含会做 3-Bet 的 JJ+、AK、AQs，保留了中低口袋对、同花连张与同花隔张。',
      },
      {
        street: '翻牌 8♠ 7♠ 3♦',
        detail: 'BB 过牌，CO 持续下注 2.0bb（33% 底池），BB 过牌加注到 7.0bb。',
        narrowingHint: '过牌加注将 BB 范围两极化：强价值成牌（两对、暗三条）搭配高权益顺子／同花听牌半诈唬。',
      },
    ],
    promptQuestion: '请选出 BB 在 8♠ 7♠ 3♦ 翻牌两极化过牌加注时可能持有的手牌（价值成牌 + 半诈唬听牌）。',
    explanation:
      'BB 在 8♠ 7♠ 3♦ 牌面的过牌加注围绕强成牌价值（88、77、33、87）展开，并用强两头顺听牌（T9s、65s、96s）、带后门听牌的卡顺（J9s、64s、54s）及坚果同花听牌（A5s、A4s）做平衡。A8 或 K7 这类中等单对通常更倾向跟注。',
    keyCombosNote: '注意：AA–JJ 不会出现在参考范围中，因为大盲位（BB）翻前通常会用它们做 3-Bet。',
  },
  'hr-btn-3bet-double-barrel': {
    title: 'BTN 在 3-Bet 底池 Q♦ 9♣ 4♦ 2♠ 转牌继续下注范围',
    streetLabel: '转牌 · 3-Bet 底池 · 100bb',
    timeline: [
      {
        street: '翻前',
        detail: 'CO 开池加注到 2.5bb，BTN 3-Bet 到 7.5bb，CO 跟注。',
        narrowingHint: 'BTN 的 3-Bet 范围由线性强价值（JJ+、AK、AQs、KQs）以及同花小 A／同花大牌诈唬（A5s–A4s、KJs、QJs、JTs）构成。',
      },
      {
        street: '翻牌 Q♦ 9♣ 4♦',
        detail: 'CO 过牌，BTN 持续下注 5.5bb，CO 跟注。',
        narrowingHint: 'BTN 小尺度高频持续下注，翻牌圈仍混杂不少未击中的高张与听牌。',
      },
      {
        street: '转牌 2♠',
        detail: 'CO 过牌，BTN 转牌继续下注 14.5bb（53% 底池）。',
        narrowingHint: '在白板转牌上，BTN 通常会用中等对子（JJ／TT）在后位过牌控池，转而用强 Qx+、超对、暗三条以及方块同花／顺子听牌继续施压。',
      },
    ],
    promptQuestion: '请勾选 BTN 在 Q♦ 9♣ 4♦ 2♠ 转牌继续下注时可能持有的手牌范围。',
    explanation:
      '在 3-Bet 底池的 2♠ 白板转牌上，BTN 的转牌继续下注更趋两极化：强价值成牌（AA、KK、QQ、99、AQ、KQ、QJs）搭配高权益的方块同花听牌与顺子听牌（AKs、AJs、A5s、A4s、KJs、JTs）；而 JJ、TT 这类中等摊牌牌力倾向在后位过牌控池。',
    keyCombosNote: '参考范围中价值成牌约占 55%、半诈唬听牌约占 45%，CO 需要用强 Qx 与优质同花听牌继续防守。',
  },
  'hr-co-river-overbet': {
    title: 'CO 在 A♥ J♠ 6♣ 3♠ 2♦ 河牌两极化超池下注范围',
    streetLabel: '河牌 · 单次加注底池 · 100bb',
    timeline: [
      {
        street: '翻前',
        detail: 'CO 开池加注到 2.5bb，BB 跟注防守。',
        narrowingHint: '标准约 29% 的 CO 开池加注范围。',
      },
      {
        street: '翻牌 A♥ J♠ 6♣ → 转牌 3♠',
        detail: 'CO 翻牌持续下注 33% 底池、转牌继续下注 75% 底池，BB 两条街均跟注。',
        narrowingHint: '转牌 75% 底池尺度筛掉了弱 Jx 与小对子；CO 保留强 Ax+、暗三条、两对以及黑桃／顺子听牌。',
      },
      {
        street: '河牌 2♦',
        detail: 'BB 过牌，CO 打出 120% 底池超池下注。',
        narrowingHint: '错失的黑桃听牌与 KQ／KT 卡顺转为诈唬；中等顶对 AT–A8 在后位过牌摊牌，只有两对以上、暗三条、AK 与错失听牌适合超池下注。',
      },
    ],
    promptQuestion: '请勾选 CO 在河牌 120% 底池超池下注时的参考范围（强价值成牌 + 错失听牌诈唬）。',
    explanation:
      '河牌 120% 底池超池下注需要高度两极化：CO 会用中等顶对（AT、A9、A8）在后位过牌摊牌，用两对以上、暗三条和 AK 做价值下注，并以错失的 KQ／KT／QT 顺子听牌及黑桃听牌（T9s、98s、87s、75s）作为平衡诈唬。',
    keyCombosNote: '留意矩阵中段（QQ、KK、Jx、弱 Ax）在两极化河牌超池下注范围中几乎被抽空的结构特征。',
  },
};

export function localizeHandReadingSpot(
  locale: Locale,
  spot: HandReadingSpot
): HandReadingSpot {
  if (locale === 'en') return spot;
  const zh = HAND_READING_ZH[spot.id];
  if (!zh) return spot;
  return {
    ...spot,
    title: zh.title,
    streetLabel: zh.streetLabel,
    timeline: zh.timeline,
    promptQuestion: zh.promptQuestion,
    explanation: zh.explanation,
    keyCombosNote: zh.keyCombosNote,
  };
}

const DRAW_SCENARIO_ZH: Record<MathDrawScenarioId, string> = {
  nut_fd_flop: '翻牌坚果同花听牌',
  oesd_turn: '转牌两头顺听牌',
  combo_draw_flop: '翻牌两头顺加同花组合听牌',
  fd_overcard_turn: '转牌同花听牌加高张',
};

export function localizeMathQuestion(
  locale: Locale,
  q: MathDrillQuestion
): MathDrillQuestion {
  if (locale === 'en') return q;

  const multPct = q.betPotPct ?? Math.round((q.betBb / Math.max(0.1, q.potBb)) * 100);
  const potBeforeCall = q.potBeforeCallBb ?? Number((q.potBb + q.betBb).toFixed(1));
  const finalPot = Number((potBeforeCall + q.betBb).toFixed(1));

  if (q.category === 'POT_ODDS') {
    return {
      ...q,
      categoryLabel: translateMathCategory(locale, q.categoryLabel),
      prompt: `下注前底池为 ${q.potBb}bb，对手下注 ${q.betBb}bb（${multPct}% 底池）。你的跟注至少需要多少摊牌权益（%）才能达到盈亏平衡（0 EV）？`,
      contextLine: `6人桌 · 100bb · 下注前底池 ${q.potBb}bb · 面对下注 ${q.betBb}bb`,
      formulaSteps: [
        `跟注后的总底池 = ${q.potBb} + ${q.betBb} + ${q.betBb} = ${finalPot.toFixed(1)}bb`,
        `盈亏平衡所需最低权益 = 跟注额 ÷ 跟注后总底池 = ${q.betBb} ÷ ${finalPot.toFixed(1)} = ${q.exactAnswer}%`,
      ],
      takeaway:
        '记住四个常用尺度锚点：33% 底池需 20.0% 权益，50% 底池需 25.0%，75% 底池需 30.0%，100% 满池需 33.3%。',
    };
  }

  if (q.category === 'OUTS_EQUITY') {
    const isFlop = q.board?.length === 3;
    const streetZh = isFlop ? '翻牌' : '转牌';
    const scenarioZh = q.scenarioId ? DRAW_SCENARIO_ZH[q.scenarioId] : '听牌对抗';
    const cleanOuts = q.cleanOuts ?? 0;
    const unknownCards = q.unknownCardsCount ?? (isFlop ? 45 : 44);
    const nextCardOutPct =
      q.nextCardOutPct ?? Number(((cleanOuts / Math.max(1, unknownCards)) * 100).toFixed(1));
    const reqEq = q.breakEvenPct ?? 0;
    const heroEq = q.heroEquityPct ?? q.exactAnswer;
    const tiePct = q.tiePct ?? 0;
    const samples = q.equitySamples ?? (isFlop ? 990 : unknownCards);
    const isExactEnum = q.equityMethod === 'exact_enum' || (!isFlop && q.equityMethod !== 'monte_carlo');

    const tieSuffix = tiePct > 0 ? `（含 ${tiePct}% 平局分池）` : '（当前无平局分池）';
    const compareText =
      heroEq > reqEq
        ? `高于盈亏平衡所需最低权益（${reqEq}%），仅按直接底池赔率跟注为正 EV（+EV）`
        : heroEq === reqEq
          ? `恰好等于盈亏平衡所需最低权益（${reqEq}%），仅按直接底池赔率跟注为 0 EV（盈亏平衡）`
          : `低于盈亏平衡所需最低权益（${reqEq}%），仅看直接赔率跟注为负 EV，需结合隐含赔率评估`;

    const exactUnitZh = isFlop ? `全部 ${samples} 种未知转牌与河牌组合` : `全部 ${samples} 张未知河牌`;

    return {
      ...q,
      categoryLabel: translateMathCategory(locale, q.categoryLabel),
      prompt: isExactEnum
        ? `当前处于${streetZh}（${scenarioZh}），对抗对手亮出的底牌，请计算你的摊牌权益（%，计入平局分池，参考解由${exactUnitZh}精确枚举得出）。`
        : `当前处于${streetZh}（${scenarioZh}），对抗对手亮出的底牌，请估算你的摊牌权益（%，计入平局分池，参考解由 ${samples} 次随机发牌模拟估算得出）。`,
      contextLine: `6人桌 · ${streetZh} · 直接反超补牌 ${cleanOuts} 张（未知牌 ${unknownCards} 张）· 面对 ${q.betBb}bb 下注盈亏平衡需 ${reqEq}% 权益`,
      formulaSteps: [
        `下一张牌直接反超的补牌概率：${cleanOuts} ÷ ${unknownCards} = ${nextCardOutPct}%（${cleanOuts} 张直接补牌）`,
        isExactEnum
          ? isFlop
            ? `4 倍心算参考：${cleanOuts} × 4 ≈ ${Math.min(72, cleanOuts * 4)}% · 精确枚举（${exactUnitZh}）摊牌权益：${heroEq}%${tieSuffix}`
            : `精确枚举（${exactUnitZh}）所得摊牌权益：${heroEq}%${tieSuffix}`
          : `4 倍心算参考：${cleanOuts} × 4 ≈ ${Math.min(72, cleanOuts * 4)}% · 模拟估算（${samples} 次随机发牌）摊牌权益：${heroEq}%${tieSuffix}`,
        `对照底池赔率（最低需 ${reqEq}%）：${compareText}`,
      ],
      takeaway:
        '区分“下一张击中补牌的概率（补牌数 ÷ 未知牌数）”与“计入平局分池和多街发牌后的摊牌权益”。翻牌“乘以 4”、转牌“乘以 2”适合牌桌快速心算，补牌达到 12 张以上时通常需略微下调估算值。',
    };
  }

  if (q.category === 'CALL_EV') {
    const equityPct = q.heroEquityPct ?? 30;
    const reqEq = q.breakEvenPct ?? 0;
    const winPart = ((equityPct / 100) * potBeforeCall).toFixed(2);
    const losePart = (((100 - equityPct) / 100) * q.betBb).toFixed(2);

    return {
      ...q,
      categoryLabel: translateMathCategory(locale, q.categoryLabel),
      prompt: `下注前底池 ${q.potBb}bb，对手在河牌下注 ${q.betBb}bb。你的抓诈唬牌对抗对手范围有 ${equityPct}% 摊牌权益，此时跟注的期望值 EV 是多少（单位：bb）？`,
      contextLine: `6人桌 · 河牌 · 跟注前底池 ${potBeforeCall}bb · 需跟注 ${q.betBb}bb · 摊牌权益 ${equityPct}%`,
      formulaSteps: [
        'EV（跟注）=（摊牌权益 × 跟注前底池）−（（1 − 摊牌权益）× 跟注额）',
        `EV（跟注）=（${(equityPct / 100).toFixed(2)} × ${potBeforeCall}bb）−（${((100 - equityPct) / 100).toFixed(2)} × ${q.betBb}bb）`,
        `EV（跟注）= ${winPart}bb − ${losePart}bb = ${q.exactAnswer > 0 ? '+' : ''}${q.exactAnswer}bb`,
      ],
      takeaway: `当摊牌权益高于底池赔率盈亏平衡点（${reqEq}%）时，跟注优于弃牌（0.00bb），属于正 EV；恰好等于 ${reqEq}% 时为 0 EV（盈亏平衡）。`,
    };
  }

  // MDF_BLUFF — read structured subType with safe fallback for legacy objects
  const isMdf =
    q.subType !== undefined
      ? q.subType === 'MDF'
      : q.categoryLabel.includes('Minimum Defense');

  return {
    ...q,
    categoryLabel: translateMathCategory(locale, q.categoryLabel),
    prompt: isMdf
      ? `河牌底池 ${q.potBb}bb，对手下注 ${q.betBb}bb（${multPct}% 底池）。你至少需要保持多少最小防守频率（MDF %），才能防止对手用任意空气牌直接诈唬盈利？`
      : `河牌底池 ${q.potBb}bb，你用被跟注后 0% 胜率的空气牌诈唬下注 ${q.betBb}bb（${multPct}% 底池）。对手至少需要以多大频率（%）弃牌，你的诈唬才能达到盈亏平衡（0 EV）？`,
    contextLine: `6人桌 · 河牌理论 · 下注前底池 ${q.potBb}bb · 下注 ${q.betBb}bb（${multPct}%）`,
    formulaSteps: isMdf
      ? [
          'MDF = 下注前底池 ÷（下注前底池 + 下注额）',
          `代入计算：MDF = ${q.potBb} ÷（${q.potBb} + ${q.betBb}）= ${q.exactAnswer}%`,
        ]
      : [
          '诈唬盈亏平衡弃牌率（α）= 下注额 ÷（下注前底池 + 下注额）',
          `代入计算：α = ${q.betBb} ÷（${q.potBb} + ${q.betBb}）= ${q.exactAnswer}%`,
        ],
    takeaway:
      '最小防守频率 MDF 与诈唬盈亏平衡弃牌率 α 之和恒等于 100%。下注尺度越大，防守方最低防守比例越低，诈唬方需要对手弃牌的比例越高。',
  };
}

const HAND_RANK_ZH: Record<string, string> = {
  'Royal Flush': '皇家同花顺',
  'Straight Flush': '同花顺',
  'Four of a Kind': '四条',
  'Full House': '葫芦',
  Flush: '同花',
  Straight: '顺子',
  'Three of a Kind': '三条',
  'Two Pair': '两对',
  'One Pair': '一对',
  'High Card': '高牌',
};

const RANK_WORD_TO_CODE: Record<string, string> = {
  Ace: 'A',
  Aces: 'A',
  King: 'K',
  Kings: 'K',
  Queen: 'Q',
  Queens: 'Q',
  Jack: 'J',
  Jacks: 'J',
  Ten: '10',
  Tens: '10',
  Nine: '9',
  Nines: '9',
  Eight: '8',
  Eights: '8',
  Seven: '7',
  Sevens: '7',
  Six: '6',
  Sixes: '6',
  Five: '5',
  Fives: '5',
  Four: '4',
  Fours: '4',
  Three: '3',
  Threes: '3',
  Two: '2',
  Twos: '2',
};

function rankWordToZh(word: string): string {
  return RANK_WORD_TO_CODE[word] ?? word;
}

export function translateHandRank(locale: Locale, label: string): string {
  if (locale === 'en') return label;
  if (HAND_RANK_ZH[label]) return HAND_RANK_ZH[label];

  const sf = label.match(/^Straight Flush,\s+(\w+)-high$/);
  if (sf) return `同花顺（${rankWordToZh(sf[1])} 高）`;

  const quads = label.match(/^Four of a Kind,\s+(\w+)$/);
  if (quads) return `四条（${rankWordToZh(quads[1])}）`;

  const fh = label.match(/^Full House,\s+(\w+)\s+full of\s+(\w+)$/);
  if (fh) return `葫芦（${rankWordToZh(fh[1])} 带 ${rankWordToZh(fh[2])}）`;

  const flush = label.match(/^Flush,\s+(\w+)-high$/);
  if (flush) return `同花（${rankWordToZh(flush[1])} 高）`;

  const straight = label.match(/^Straight,\s+(\w+)-high$/);
  if (straight) return `顺子（${rankWordToZh(straight[1])} 高）`;

  const trips = label.match(/^Three of a Kind,\s+(\w+)$/);
  if (trips) return `三条（${rankWordToZh(trips[1])}）`;

  const twoPair = label.match(/^Two Pair,\s+(\w+)\s*&\s*(\w+)$/);
  if (twoPair) return `两对（${rankWordToZh(twoPair[1])} 与 ${rankWordToZh(twoPair[2])}）`;

  const onePair = label.match(/^Pair of\s+(\w+)$/);
  if (onePair) return `一对 ${rankWordToZh(onePair[1])}`;

  const highCard = label.match(/^(\w+)-high$/);
  if (highCard) return `高牌（${rankWordToZh(highCard[1])} 高）`;

  return label;
}

export function formatSeatDisplayName(
  locale: Locale,
  name: string,
  isHero?: boolean
): string {
  if (isHero || name === 'Hero' || name === 'Hero (You)') {
    return locale === 'zh-CN' ? '我方' : 'Hero (You)';
  }
  return name;
}

/**
 * Formats structured table action metadata for action logs, seat plates, and EV audits.
 * Falls back cleanly to translateActionText for legacy string-only records.
 */
export function formatArenaAction(
  locale: Locale,
  spec: TableActionSpec | undefined,
  fallbackText = ''
): string {
  if (!spec) return translateActionText(locale, fallbackText);
  const amt = spec.amountBb !== undefined ? `${spec.amountBb}bb` : '';

  if (locale === 'en') {
    if (fallbackText) return fallbackText;
    switch (spec.kind) {
      case 'post_sb':
        return `Posts SB ${amt}`.trim();
      case 'post_bb':
        return `Posts BB ${amt}`.trim();
      case 'blind':
        return `Blind ${amt}`.trim();
      case 'fold':
        return 'Fold';
      case 'folded':
        return 'Folded';
      case 'check':
        return 'Check';
      case 'call':
        return amt ? `Call ${amt}` : 'Call';
      case 'call_allin':
        return amt ? `Calls All-In (${amt})` : 'Calls All-In';
      case 'bet':
        return amt ? `Bet ${amt}` : 'Bet';
      case 'raise':
        return amt ? `Raise to ${amt}` : 'Raise';
      case 'three_bet':
        return amt ? `3-Bet to ${amt}` : '3-Bet';
      case 'four_bet':
        return amt ? `4-Bet to ${amt}` : '4-Bet';
      case 'all_in':
        return amt ? `All-In ${amt}` : 'All-In';
    }
  }

  switch (spec.kind) {
    case 'post_sb':
      return amt ? `下小盲 ${amt}` : '下小盲';
    case 'post_bb':
      return amt ? `下大盲 ${amt}` : '下大盲';
    case 'blind':
      return amt ? `盲注 ${amt}` : '盲注';
    case 'fold':
      return '弃牌';
    case 'folded':
      return '已弃牌';
    case 'check':
      return '过牌';
    case 'call':
      return amt ? `跟注 ${amt}` : '跟注';
    case 'call_allin':
      return amt ? `跟注全下（${amt}）` : '跟注全下';
    case 'bet':
      return amt ? `下注 ${amt}` : '下注';
    case 'raise':
      return amt ? `加注到 ${amt}` : '加注';
    case 'three_bet':
      return amt ? `3-Bet 到 ${amt}` : '3-Bet';
    case 'four_bet':
      return amt ? `4-Bet 到 ${amt}` : '4-Bet';
    case 'all_in':
      return amt ? `全下到 ${amt}` : '全下';
  }
}

export function formatWinnerSummary(
  locale: Locale,
  spec: WinnerSummarySpec | null | undefined,
  fallbackSummary: string | null = null
): string {
  if (spec) {
    const contestedPots = spec.potBreakdowns?.filter((p) => !p.isUncalledReturn) ?? [];
    if (spec.type === 'showdown' && contestedPots.length > 1) {
      const parts = contestedPots.map((pot, idx) => {
        const names = pot.winners
          .map((w) => `${formatSeatDisplayName(locale, w.name, w.isHero)} (${w.position})`)
          .join(locale === 'zh-CN' ? '、' : ' & ');
        if (locale === 'en') {
          const potLabel = idx === 0 ? 'Main pot' : `Side pot ${idx}`;
          const hand = pot.handLabel ?? '';
          return pot.isSplit
            ? `${potLabel} (${pot.amountBb}bb): ${names} split with ${hand}`
            : `${potLabel} (${pot.amountBb}bb): ${names} wins with ${hand}`;
        }
        const potLabelZh = idx === 0 ? '主池' : `边池 ${idx}`;
        const handZh = pot.handLabel ? translateHandRank(locale, pot.handLabel) : '';
        return pot.isSplit
          ? `${potLabelZh}（${pot.amountBb}bb）：${names} 凭「${handZh}」平分`
          : `${potLabelZh}（${pot.amountBb}bb）：${names} 凭「${handZh}」赢下`;
      });
      return locale === 'zh-CN' ? `${parts.join('；')}。` : `${parts.join(' · ')}.`;
    }

    const names = spec.winners
      .map((w) => `${formatSeatDisplayName(locale, w.name, w.isHero)} (${w.position})`)
      .join(locale === 'zh-CN' ? '、' : ' & ');
    if (locale === 'en') {
      if (spec.type === 'uncontested') {
        return `${names} wins ${spec.potBb}bb uncontested.`;
      }
      const hand = spec.handLabel ?? '';
      return spec.isSplit
        ? `${names} split ${spec.potBb}bb pot with ${hand}.`
        : `${names} wins ${spec.potBb}bb with ${hand}.`;
    }

    if (spec.type === 'uncontested') {
      return `${names} 直接收下 ${spec.potBb}bb 底池（其余对手均弃牌）。`;
    }
    const handZh = spec.handLabel ? translateHandRank(locale, spec.handLabel) : '';
    if (spec.isSplit) {
      return `${names} 凭借「${handZh}」平分 ${spec.potBb}bb 底池。`;
    }
    return `${names} 凭借「${handZh}」赢得 ${spec.potBb}bb 底池。`;
  }

  return localizeWinnerSummary(locale, fallbackSummary);
}

export function localizeWinnerSummary(locale: Locale, summary: string | null): string {
  if (!summary) return '';
  if (locale === 'en') return summary;

  const uncontested = summary.match(/^(.+?)\s+wins\s+([\d.]+)bb\s+uncontested\.$/);
  if (uncontested) {
    const winner = uncontested[1].replace(/Hero \(You\)|\bHero\b/g, '我方');
    return `${winner} 直接收下 ${uncontested[2]}bb 底池（其余对手均弃牌）。`;
  }

  const splitShowdown = summary.match(/^(.+?)\s+split\s+([\d.]+)bb(?:\s+pot)?\s+with\s+(.+)\.$/);
  if (splitShowdown) {
    const winners = splitShowdown[1]
      .replace(/Hero \(You\)|\bHero\b/g, '我方')
      .replace(/\s*&\s*/g, '、');
    const handZh = translateHandRank(locale, splitShowdown[3]);
    return `${winners} 凭借「${handZh}」平分 ${splitShowdown[2]}bb 底池。`;
  }

  const showdown = summary.match(/^(.+?)\s+wins\s+([\d.]+)bb\s+with\s+(.+)\.$/);
  if (showdown) {
    const winner = showdown[1]
      .replace(/Hero \(You\)|\bHero\b/g, '我方')
      .replace(/\s*&\s*/g, '、');
    const handZh = translateHandRank(locale, showdown[3]);
    if (showdown[1].includes('&')) {
      return `${winner} 凭借「${handZh}」平分 ${showdown[2]}bb 底池。`;
    }
    return `${winner} 凭借「${handZh}」赢得 ${showdown[2]}bb 底池。`;
  }

  return summary;
}

export function formatArenaAuditNote(
  locale: Locale,
  spec: AuditNoteSpec | undefined,
  fallbackNote = ''
): string {
  if (locale === 'en') return fallbackNote;
  if (!spec) return localizeArenaNote(locale, fallbackNote);

  const stZh = translateStreetLabel(locale, spec.street);
  let base = '';
  switch (spec.reason) {
    case 'strong_value':
      base = `强牌（${spec.handKey ?? ''}）在${stZh}适合通过下注或加注积极做大价值底池。`;
      break;
    case 'semi_bluff_cbet':
      base = `手握高权益听牌且握有翻前主动权，在${stZh}适合做半诈唬持续下注。`;
      break;
    case 'weak_showdown':
      base = '摊牌价值偏弱，倾向过牌控池或挑选带阻挡牌的时机诈唬，不宜强行打薄价值下注。';
      break;
    case 'pot_control':
      base = `中等牌力在${stZh}倾向选择过牌控制底池。`;
      break;
    case 'value_protect_raise':
      base = '对抗当前下注具备明显权益优势，支持加注获取价值并保护手牌权益。';
      break;
    case 'pot_odds_call':
      base = `面对 ${spec.toCallBb ?? 0}bb 下注至少需要 ${spec.reqEqPct ?? 0}% 胜率，这手牌的牌力足以继续跟注。`;
      break;
    case 'pot_odds_fold':
      base = `面对 ${spec.toCallBb ?? 0}bb 下注至少需要 ${spec.reqEqPct ?? 0}% 胜率，此时弃牌有助于控制损失。`;
      break;
  }

  let tip = '';
  if (spec.exploitTip && spec.villainName) {
    const name = spec.villainName.trim();
    switch (spec.exploitTip) {
      case 'cs_value':
        tip = ` 针对 ${name}（跟注站）：对手跟注范围较宽，强成牌可适当放大价值下注尺度。`;
        break;
      case 'cs_no_bluff':
        tip = ` 针对 ${name}（跟注站）：减少低权益纯诈唬，对手较难弃牌。`;
        break;
      case 'nit_respect':
        tip = ` 针对 ${name}（紧弱 Nit）：注意尊重其重注进攻，对手继续行动的范围偏向强价值牌。`;
        break;
      case 'nit_pressure':
        tip = ` 针对 ${name}（紧弱 Nit）：对手错过牌面时弃牌率较高，可保持适度施压。`;
        break;
      case 'lag_bluffcatch':
        tip = ` 针对 ${name}（${translateArchetype(locale, spec.villainArchetype ?? 'Loose-Aggressive')}）：对手进攻频率偏高，可适当放宽抓诈唬跟注范围。`;
        break;
      case 'tag_discipline':
        tip = ` 对抗 ${name}（紧凶 TAG）：保持范围纪律，在听牌多的牌面重点留意阻挡牌。`;
        break;
      case 'reg_mix':
        tip = ` 对抗 ${name}（均衡常客）：注意混合价值下注与听牌半诈唬，避免频率失衡。`;
        break;
    }
  }

  return `${base}${tip}`;
}

export function localizeArenaNote(locale: Locale, note: string): string {
  if (locale === 'en' || !note) return note;

  let out = note;

  // Base decision notes (legacy string fallback)
  out = out.replace(
    /Strong holding \(([^)]+)\) builds value by betting\/raising on (\w+)\./,
    (_, hand: string, st: string) =>
      `强牌（${hand}）在${translateStreetLabel(locale, st)}适合通过下注或加注积极做大价值底池。`
  );
  out = out.replace(
    /High-equity draw with preflop initiative makes a strong semi-bluff c-bet on (\w+)\./,
    (_, st: string) =>
      `手握高权益听牌且握有翻前主动权，在${translateStreetLabel(locale, st)}适合做半诈唬持续下注。`
  );
  out = out.replace(
    /Weak showdown value prefers checking or selective bluffing rather than thin betting\./,
    '摊牌价值偏弱，倾向过牌控池或挑选带阻挡牌的时机诈唬，不宜强行打薄价值下注。'
  );
  out = out.replace(
    /Medium strength hand plays cleanly as a check for pot control on (\w+)\./,
    (_, st: string) => `中等牌力在${translateStreetLabel(locale, st)}倾向选择过牌控制底池。`
  );
  out = out.replace(
    /High equity vs current bet supports raising for value and protection\./,
    '对抗当前下注具备明显权益优势，支持加注获取价值并保护手牌权益。'
  );
  out = out.replace(
    /Hand strength clears required pot odds \((\d+)%\)—calling is \+EV\./,
    (_, pct: string) => `当前牌力已高于底池赔率门槛（${pct}%），跟注属于正 EV 选择。`
  );
  out = out.replace(
    /Facing ([\d.]+)bb requires (\d+)% equity; folding preserves stack\./,
    (_, toCall: string, pct: string) =>
      `面对 ${toCall}bb 下注至少需要 ${pct}% 权益，此时弃牌有助于控制损失。`
  );

  // Opponent-specific exploitative notes (legacy string fallback)
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(Calling Station\): size up value bets—they call too wide\./,
    (_, name: string) =>
      ` 针对 ${name.trim()}（跟注站）：对手跟注范围较宽，强成牌可适当放大价值下注尺度。`
  );
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(Calling Station\): avoid low-equity bluffs that rarely fold them out\./,
    (_, name: string) =>
      ` 针对 ${name.trim()}（跟注站）：减少低权益纯诈唬，对手较难弃牌。`
  );
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(Tight Nit\): respect heavy aggression—their continuing range is value-heavy\./,
    (_, name: string) =>
      ` 针对 ${name.trim()}（紧弱 Nit）：注意尊重其重注进攻，对手继续行动的范围偏向强价值牌。`
  );
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(Tight Nit\): steady pressure steals pots when they miss\./,
    (_, name: string) =>
      ` 针对 ${name.trim()}（紧弱 Nit）：对手错过牌面时弃牌率较高，可保持适度施压。`
  );
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(([^)]+)\): widen bluff-catching calls against over-aggression\./,
    (_, name: string, arch: string) =>
      ` 针对 ${name.trim()}（${translateArchetype(locale, arch)}）：对手进攻频率偏高，可适当放宽抓诈唬跟注范围。`
  );
  out = out.replace(
    /\s*Note vs ([^()]+) \(TAG\): keep ranges disciplined and watch blockers on (?:wet|draw-heavy) boards\./,
    (_, name: string) =>
      ` 对抗 ${name.trim()}（紧凶 TAG）：保持范围纪律，在听牌多的牌面重点留意阻挡牌。`
  );
  out = out.replace(
    /\s*Note vs ([^()]+) \(Balanced Reg\): mix value and draw semi-bluffs to stay unexploitable\./,
    (_, name: string) =>
      ` 对抗 ${name.trim()}（均衡常客）：注意混合价值下注与听牌半诈唬，避免频率失衡。`
  );

  return out;
}

const TITLE_EN_TO_ZH: Record<string, string> = {
  // Preflop
  'UTG Open (RFI)': PREFLOP_ZH['rfi-utg'].title,
  'HJ Open (RFI)': PREFLOP_ZH['rfi-hj'].title,
  'CO Open (RFI)': PREFLOP_ZH['rfi-co'].title,
  'BTN Open (RFI)': PREFLOP_ZH['rfi-btn'].title,
  'SB Open (RFI)': PREFLOP_ZH['rfi-sb'].title,
  'BTN vs CO Open': PREFLOP_ZH['vs-open-btn-co'].title,
  'BB vs BTN Open': PREFLOP_ZH['vs-open-bb-btn'].title,
  'SB vs BTN Open (3-Bet Heavy)': PREFLOP_ZH['vs-open-sb-btn'].title,
  'BTN Facing BB 3-Bet': PREFLOP_ZH['vs-3bet-btn-bb'].title,
  'CO Facing BTN 3-Bet': PREFLOP_ZH['vs-3bet-co-btn'].title,
  // Postflop
  'BTN C-Bet on Dry Ace-High Rainbow': POSTFLOP_ZH['pf-srp-btn-bb-a72r'].title,
  'CO C-Bet Check-Back on Low Connected Board': POSTFLOP_ZH['pf-srp-co-bb-765tt'].title,
  'BB Check-Raise Semi-Bluff vs Small C-Bet': POSTFLOP_ZH['pf-srp-bb-btn-xr-984'].title,
  '3-Bet Pot Range Bet IP on K-High Dry': POSTFLOP_ZH['pf-3bp-btn-co-k94r'].title,
  '3-Bet Pot OOP Polarized Check on Wet Broadway': POSTFLOP_ZH['pf-3bp-sb-btn-qjt-oop'].title,
  'Turn Overbet Barrel on Clean Overcard': POSTFLOP_ZH['pf-srp-utg-bb-turn-overcard'].title,
  'BB Turn Defense with Combo Draw vs 75% Barrel': POSTFLOP_ZH['pf-srp-bb-co-turn-call-fd'].title,
  'BTN Turn Pot Control IP with Medium Showdown Value': POSTFLOP_ZH['pf-3bp-btn-bb-turn-checkback'].title,
  'River Thin Value Sizing IP on Brick Runout': POSTFLOP_ZH['pf-srp-btn-bb-river-thin-value'].title,
  'River Bluff-Catch with Nut Flush Blocker': POSTFLOP_ZH['pf-srp-bb-btn-river-bluffcatch-blockers'].title,
  'River Polarized Bluff with Straight Blocker': POSTFLOP_ZH['pf-srp-co-bb-river-bluff-blockers'].title,
  'Disciplined River Fold vs Polarized Overbet': POSTFLOP_ZH['pf-3bp-bb-btn-river-fold-overbet'].title,
  'River Call vs 33% Bet on Dry Q-High Board': POSTFLOP_ZH['pf-srp-bb-sb-river-size-small'].title,
  'River Fold vs 125% Overbet on Dry Q-High Board': POSTFLOP_ZH['pf-srp-bb-sb-river-size-overbet'].title,
  // Hand reading
  'Capped UTG Range After Turn Check-Back': HAND_READING_ZH['hr-utg-cbet-check-turn'].title,
  'BB Polarized Check-Raise Range on 8♠ 7♠ 3♦': HAND_READING_ZH['hr-bb-xr-low-board'].title,
  'BTN 3-Bet Double Barrel Range on Q♦ 9♣ 4♦ 2♠': HAND_READING_ZH['hr-btn-3bet-double-barrel'].title,
  'Polarized CO River Jam on A♥ J♠ 6♣ 3♠ 2♦': HAND_READING_ZH['hr-co-river-overbet'].title,
};

export function localizeSpotLabel(locale: Locale, spotLabel: string): string {
  if (locale === 'en') return spotLabel;
  if (TITLE_EN_TO_ZH[spotLabel]) return TITLE_EN_TO_ZH[spotLabel];

  // Preflop format: "<Title> (<handKey>)"
  const preflopMatch = spotLabel.match(/^(.+?)\s+\(([AKQJT98765432]{2}[so]?)\)$/);
  if (preflopMatch && TITLE_EN_TO_ZH[preflopMatch[1]]) {
    return `${TITLE_EN_TO_ZH[preflopMatch[1]]} (${preflopMatch[2]})`;
  }

  // Math format: "<Category> (<pot>bb pot / <bet>bb bet)"
  const mathMatch = spotLabel.match(/^(.+?)\s+\(([\d.]+)bb pot \/ ([\d.]+)bb bet\)$/);
  if (mathMatch) {
    return `${translateMathCategory(locale, mathMatch[1])}（底池 ${mathMatch[2]}bb ／ 下注 ${mathMatch[3]}bb）`;
  }

  // Arena format: "6-Max Hand #3 (flop)"
  const arenaMatch = spotLabel.match(/^(\d+)-Max Hand #(\d+) \((\w+)\)$/);
  if (arenaMatch) {
    return `${arenaMatch[1]}人桌 第 ${arenaMatch[2]} 手（${translateStreetLabel(locale, arenaMatch[3])}）`;
  }

  return spotLabel;
}
