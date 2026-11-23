import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSLATIONS,
  translateActionText,
  translateArchetype,
  translateGrade,
  translateKey,
  translateMathCategory,
  translatePositionLabel,
  translateQuickPreset,
  translateStreetLabel,
  type TranslationKey,
} from './translations.ts';
import { resolveInitialLocale } from './LocaleContext.tsx';
import {
  formatArenaAction,
  formatArenaAuditNote,
  formatSeatDisplayName,
  formatWinnerSummary,
  localizeArenaNote,
  localizeHandReadingSpot,
  localizeMathQuestion,
  localizePostflopSpot,
  localizePreflopTemplate,
  localizeSpotLabel,
  localizeWinnerSummary,
  translateHandRank,
} from './drillContentZh.ts';
import { PREFLOP_TEMPLATES } from '../poker/preflopRanges.ts';
import {
  POSTFLOP_BLUEPRINTS,
  generatePostflopSpotById,
} from '../poker/postflopSpots.ts';
import { HAND_READING_SPOTS, QUICK_RANGE_PRESETS } from '../poker/handReadingSpots.ts';
import {
  generateMathQuestion,
  type MathDrillCategory,
  type MathDrillQuestion,
} from '../poker/mathDrills.ts';
import type {
  AuditBaseReason,
  AuditExploitTipKind,
  TableActionSpec,
  WinnerSummarySpec,
} from '../poker/tableEngine.ts';

describe('TurnRiver i18n EN / zh-CN locale support', () => {
  it('maintains 100% key parity and non-empty values between en and zh-CN', () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const zhKeys = Object.keys(TRANSLATIONS['zh-CN']).sort();
    assert.deepEqual(zhKeys, enKeys);

    for (const key of enKeys as TranslationKey[]) {
      assert.ok(TRANSLATIONS.en[key].trim().length > 0, `Empty en value for ${key}`);
      assert.ok(TRANSLATIONS['zh-CN'][key].trim().length > 0, `Empty zh-CN value for ${key}`);
    }
  });

  it('resolves initial locale with ?lang query param priority over localStorage', () => {
    assert.equal(resolveInitialLocale('?lang=zh-CN', 'en'), 'zh-CN');
    assert.equal(resolveInitialLocale('?lang=zh', 'en'), 'zh-CN');
    assert.equal(resolveInitialLocale('?lang=zh-Hans', 'en'), 'zh-CN');
    assert.equal(resolveInitialLocale('?lang=en', 'zh-CN'), 'en');
    assert.equal(resolveInitialLocale('', 'zh-CN'), 'zh-CN');
    assert.equal(resolveInitialLocale('', 'en'), 'en');
    assert.equal(resolveInitialLocale('', null), 'en');
    assert.equal(resolveInitialLocale('?lang=fr', 'zh-CN'), 'zh-CN');
    assert.equal(resolveInitialLocale('?lang=fr', null), 'en');
  });

  it('enforces idiomatic Simplified Chinese terminology across UI keys and drill content', () => {
    const bannedTerms = [
      '求解器',
      '工作室',
      'EV 审计',
      '重合度审计',
      '残存',
      '出牌速度',
      '连击',
      'Firestore',
      '花色旋转',
      'HJ (劫持)',
      'CO (关煞)',
      '劫持位',
      '关煞位',
      '修罗场',
      '个人漏洞画像',
      '精确转牌数学',
      '真实保留范围',
      '失血率',
      '湿润牌面',
      '湿润面',
      '估算精确全下胜率',
    ];

    for (const [key, val] of Object.entries(TRANSLATIONS['zh-CN'])) {
      for (const banned of bannedTerms) {
        assert.ok(
          !val.includes(banned),
          `Found banned term "${banned}" in zh-CN key "${key}": ${val}`
        );
      }
    }

    for (const tpl of PREFLOP_TEMPLATES) {
      const zh = localizePreflopTemplate('zh-CN', tpl);
      const blob = `${zh.title} ${zh.subtitle} ${zh.actionSummary} ${zh.strategyNote}`;
      for (const banned of bannedTerms) {
        assert.ok(!blob.includes(banned), `Found "${banned}" in preflop ${tpl.id}`);
      }
    }

    for (const bp of POSTFLOP_BLUEPRINTS) {
      const spot = generatePostflopSpotById(bp.id, { preserveSuits: true })!;
      const zh = localizePostflopSpot('zh-CN', spot);
      const blob = [
        zh.neutralTitle,
        zh.title,
        zh.numbersBreakdown,
        ...zh.actionLog,
        zh.takeaways.boardTexture,
        zh.takeaways.rangeAdvantage,
        zh.takeaways.blockerNote,
        zh.takeaways.coreRule,
      ].join(' ');
      for (const banned of bannedTerms) {
        assert.ok(!blob.includes(banned), `Found "${banned}" in postflop ${bp.id}`);
      }
    }

    for (const spot of HAND_READING_SPOTS) {
      const zh = localizeHandReadingSpot('zh-CN', spot);
      const blob = [
        zh.title,
        zh.streetLabel,
        zh.promptQuestion,
        zh.explanation,
        zh.keyCombosNote,
        ...zh.timeline.map((t) => `${t.street} ${t.detail} ${t.narrowingHint}`),
      ].join(' ');
      for (const banned of bannedTerms) {
        assert.ok(!blob.includes(banned), `Found "${banned}" in hand reading ${spot.id}`);
      }
    }
  });

  it('translates poker grades, positions, streets, archetypes, and action text into Chinese', () => {
    assert.equal(translateGrade('zh-CN', 'Optimal'), '最优');
    assert.equal(translateGrade('zh-CN', 'Acceptable'), '合理');
    assert.equal(translateGrade('zh-CN', 'Blunder'), '严重失误');

    // Keep standard seat codes without literal 劫持/关煞
    assert.equal(translatePositionLabel('zh-CN', 'UTG'), 'UTG');
    assert.equal(translatePositionLabel('zh-CN', 'HJ'), 'HJ');
    assert.equal(translatePositionLabel('zh-CN', 'CO'), 'CO');
    assert.equal(translatePositionLabel('zh-CN', 'BTN'), 'BTN');
    assert.equal(translatePositionLabel('zh-CN', 'SB'), 'SB');
    assert.equal(translatePositionLabel('zh-CN', 'BB'), 'BB');
    assert.equal(translatePositionLabel('zh-CN', 'ALL'), '全部位置');

    assert.equal(translateStreetLabel('zh-CN', 'preflop'), '翻前');
    assert.equal(translateStreetLabel('zh-CN', 'flop'), '翻牌');
    assert.equal(translateStreetLabel('zh-CN', 'turn'), '转牌');
    assert.equal(translateStreetLabel('zh-CN', 'river'), '河牌');
    assert.equal(translateStreetLabel('zh-CN', 'showdown'), '摊牌');

    assert.equal(translateArchetype('zh-CN', 'Balanced Reg'), '均衡常客');
    assert.equal(translateArchetype('zh-CN', 'Calling Station'), '跟注站');

    assert.equal(translateActionText('zh-CN', 'Raise to 7.5bb'), '加注到 7.5bb');
    assert.equal(translateActionText('zh-CN', '3-Bet'), '3-Bet');
    assert.equal(translateActionText('zh-CN', '3-Bets to 9bb'), '3-Bet 到 9bb');
    assert.equal(translateActionText('zh-CN', '4-Bets to 22bb'), '4-Bet 到 22bb');
    assert.equal(translateActionText('zh-CN', '4-Bet 21bb'), '4-Bet 到 21bb');
    assert.equal(translateActionText('zh-CN', 'Bet 33% Pot'), '下注 33% 底池');
    assert.equal(translateActionText('zh-CN', 'Check-Raise 6.5bb'), '过牌加注 6.5bb');
    assert.equal(translateActionText('zh-CN', 'Overbet 125% (13.1bb)'), '超池下注 125% (13.1bb)');
    assert.equal(translateActionText('zh-CN', 'Posts SB 0.5bb'), '下小盲 0.5bb');
    assert.equal(translateActionText('zh-CN', 'Calls All-In (18.5bb)'), '跟注全下（18.5bb）');
    assert.equal(translateActionText('zh-CN', 'Goes All-In to 42bb'), '全下到 42bb');
    assert.equal(translateActionText('zh-CN', 'Raise All-In 62bb'), '加注全下 62bb');
    assert.equal(translateActionText('zh-CN', '48 solver combos'), '48 个参考组合');
    assert.equal(translateActionText('zh-CN', '52 combos (81% overlap)'), '52 个组合 (81% 重合度)');

    assert.equal(translateKey('zh-CN', 'nav.preflop'), '翻前');
    assert.equal(translateKey('en', 'nav.preflop'), 'Preflop');
  });

  it('translates every real QUICK_RANGE_PRESETS label and math category into Chinese', () => {
    for (const label of Object.keys(QUICK_RANGE_PRESETS)) {
      const zh = translateQuickPreset('zh-CN', label);
      assert.notEqual(zh, label, `Untranslated quick preset: ${label}`);
      assert.match(zh, /[\u4e00-\u9fff]/, `Expected Chinese chars for preset ${label}, got ${zh}`);
    }

    const mathLabels = [
      'Pot Odds & Required Equity',
      'Outs & Hand Equity',
      'Expected Value (EV in bb)',
      'Minimum Defense Frequency (MDF)',
      'Bluff Break-Even Frequency',
    ];
    for (const label of mathLabels) {
      const zh = translateMathCategory('zh-CN', label);
      assert.notEqual(zh, label, `Untranslated math category: ${label}`);
      assert.match(zh, /[\u4e00-\u9fff]/, `Expected Chinese chars for math category ${label}`);
    }
  });

  it('localizes 100% of preflop templates, postflop spots, and hand reading spots', () => {
    for (const tpl of PREFLOP_TEMPLATES) {
      const zh = localizePreflopTemplate('zh-CN', tpl);
      assert.notEqual(zh.title, tpl.title, `Missing zh preflop title for ${tpl.id}`);
      assert.notEqual(zh.strategyNote, tpl.strategyNote, `Missing zh preflop note for ${tpl.id}`);
      assert.match(zh.actionSummary, /[\u4e00-\u9fff]/);
    }

    const zhSpoilerTerms = ['弃牌', '跟注', '诈唬', '价值下注', '过牌加注', '控池', '范围下注', '抓诈唬'];
    for (const bp of POSTFLOP_BLUEPRINTS) {
      const spot = generatePostflopSpotById(bp.id, { preserveSuits: true })!;
      const zh = localizePostflopSpot('zh-CN', spot);
      assert.notEqual(zh.neutralTitle, bp.neutralTitle, `Missing zh neutralTitle for ${bp.id}`);
      assert.notEqual(zh.title, bp.title, `Missing zh postflop title for ${bp.id}`);
      assert.notEqual(zh.numbersBreakdown, bp.numbersBreakdown, `Missing zh numbersBreakdown for ${bp.id}`);
      assert.match(zh.takeaways.coreRule, /[\u4e00-\u9fff]/);
      for (const spoiler of zhSpoilerTerms) {
        assert.ok(
          !zh.neutralTitle.includes(spoiler),
          `zh neutralTitle "${zh.neutralTitle}" for ${bp.id} leaks action spoiler "${spoiler}"`
        );
      }
      for (const line of zh.actionLog) {
        assert.match(line, /[\u4e00-\u9fff]/, `Untranslated postflop actionLog line: ${line}`);
      }
    }

    // Verify revised river bluff blocker spot in zh-CN references K9s and never KJ
    const zhBluff = localizePostflopSpot(
      'zh-CN',
      generatePostflopSpotById('pf-srp-co-bb-river-bluff-blockers', { preserveSuits: true })!
    );
    assert.ok(zhBluff.title.includes('K9s'));
    assert.ok(!zhBluff.title.includes('KJ') && !zhBluff.numbersBreakdown.includes('KJ'));

    for (const spot of HAND_READING_SPOTS) {
      const zh = localizeHandReadingSpot('zh-CN', spot);
      assert.notEqual(zh.promptQuestion, spot.promptQuestion, `Missing zh hand reading for ${spot.id}`);
      assert.equal(zh.timeline.length, spot.timeline.length);
      assert.match(zh.explanation, /[\u4e00-\u9fff]/);
    }
  });

  it('localizes structured math questions accurately across all draw scenarios and break-even edge cases', () => {
    const makeSeededRng = (firstVal: number, seedInit = 1337): (() => number) => {
      let called = false;
      let state = seedInit >>> 0;
      return () => {
        if (!called) {
          called = true;
          return firstVal;
        }
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 0x100000000;
      };
    };

    const mathCats: MathDrillCategory[] = ['POT_ODDS', 'OUTS_EQUITY', 'CALL_EV', 'MDF_BLUFF'];
    for (const cat of mathCats) {
      for (const seed of [0.05, 0.3, 0.6, 0.9]) {
        const q = generateMathQuestion(cat, makeSeededRng(seed, Math.round(seed * 10000)));
        const zh = localizeMathQuestion('zh-CN', q);
        assert.match(zh.prompt, /[\u4e00-\u9fff]/, `Untranslated math prompt for ${cat}`);
        assert.match(zh.takeaway, /[\u4e00-\u9fff]/, `Untranslated math takeaway for ${cat}`);
        assert.ok(zh.formulaSteps.every((s) => /[\u4e00-\u9fff]/.test(s)));
        // Ensure numerical consistency between structured data and zh-CN copy
        assert.ok(
          zh.formulaSteps.some((s) => s.includes(String(q.exactAnswer))),
          `Exact answer ${q.exactAnswer} missing in zh formulaSteps for ${cat}`
        );
      }
    }

    // Verify all 4 draw scenarios read structured cleanOuts (no 9-out fallback) and exact_enum vs monte_carlo
    const scenarioSeeds = [0.0, 0.26, 0.51, 0.76];
    const seenScenarios = new Set<string>();
    for (const s of scenarioSeeds) {
      const q = generateMathQuestion('OUTS_EQUITY', makeSeededRng(s, Math.round(s * 10000) + 17));
      seenScenarios.add(q.scenarioId ?? '');
      const zh = localizeMathQuestion('zh-CN', q);
      assert.ok(typeof q.cleanOuts === 'number' && q.cleanOuts > 0);
      assert.ok(
        zh.contextLine.includes(`直接反超补牌 ${q.cleanOuts} 张`),
        `Expected ${q.cleanOuts} outs in contextLine, got: ${zh.contextLine}`
      );
      if (q.equityMethod === 'exact_enum') {
        assert.ok(zh.prompt.includes('精确枚举') || zh.formulaSteps.some((st) => st.includes('精确枚举')));
        assert.ok(!zh.prompt.includes('模拟估算'));
      } else {
        assert.ok(zh.prompt.includes('模拟估算') || zh.formulaSteps.some((st) => st.includes('模拟估算')));
      }
    }
    assert.equal(seenScenarios.size, 4, 'Should cover all 4 structured draw scenarios');

    // Verify exact break-even (heroEquityPct === breakEvenPct) is 0 EV, NEVER +EV
    const breakEvenQ: MathDrillQuestion = {
      id: 'math-be-test',
      category: 'CALL_EV',
      categoryLabel: 'Expected Value (EV in bb)',
      prompt: 'test',
      contextLine: 'test',
      unit: 'bb',
      exactAnswer: 0,
      toleranceExact: 0.4,
      toleranceClose: 1.0,
      minVal: -10,
      maxVal: 10,
      step: 0.5,
      defaultVal: 0,
      potBb: 12,
      betBb: 6,
      potBeforeCallBb: 18,
      heroEquityPct: 25,
      breakEvenPct: 25,
      formulaSteps: [],
      takeaway: '',
    };
    const zhBe = localizeMathQuestion('zh-CN', breakEvenQ);
    assert.ok(zhBe.formulaSteps.some((s) => s.endsWith('= 0bb')), `Expected '= 0bb' without '+', got: ${zhBe.formulaSteps.join(' | ')}`);
    assert.ok(zhBe.takeaway.includes('恰好等于 25% 时为 0 EV'), `Expected exact 0 EV rule in takeaway: ${zhBe.takeaway}`);

    const breakEvenOutsQ: MathDrillQuestion = {
      id: 'math-oe-be-test',
      category: 'OUTS_EQUITY',
      categoryLabel: 'Outs & Hand Equity',
      scenarioId: 'oesd_turn',
      prompt: 'test',
      contextLine: 'test',
      unit: '%',
      exactAnswer: 25,
      toleranceExact: 3,
      toleranceClose: 6,
      minVal: 5,
      maxVal: 80,
      step: 1,
      defaultVal: 25,
      potBb: 12,
      betBb: 6,
      potBeforeCallBb: 18,
      heroEquityPct: 25,
      breakEvenPct: 25,
      cleanOuts: 11,
      unknownCardsCount: 44,
      nextCardOutPct: 25,
      tiePct: 0,
      equityMethod: 'exact_enum',
      equitySamples: 44,
      board: [
        { rank: 'Q', suit: 's' },
        { rank: 'J', suit: 'h' },
        { rank: '4', suit: 'c' },
        { rank: '2', suit: 'd' },
      ],
      formulaSteps: [],
      takeaway: '',
    };
    const zhBeOuts = localizeMathQuestion('zh-CN', breakEvenOutsQ);
    const compareStep = zhBeOuts.formulaSteps[2] ?? '';
    assert.ok(compareStep.includes('0 EV（盈亏平衡）'), `Expected 0 EV in compare step: ${compareStep}`);
    assert.ok(!compareStep.includes('正 EV'), `Must not claim +EV at exact break-even: ${compareStep}`);
  });

  it('formats structured Arena actions, winner summaries (including split pots), descriptive hand ranks, and audit notes cleanly', () => {
    const actions: [TableActionSpec, string, string][] = [
      [{ kind: 'post_sb', amountBb: 0.5 }, 'Posts SB 0.5bb', '下小盲 0.5bb'],
      [{ kind: 'post_bb', amountBb: 1 }, 'Posts BB 1bb', '下大盲 1bb'],
      [{ kind: 'blind', amountBb: 1 }, 'Blind 1bb', '盲注 1bb'],
      [{ kind: 'fold' }, 'Fold', '弃牌'],
      [{ kind: 'folded' }, 'Folded', '已弃牌'],
      [{ kind: 'check' }, 'Check', '过牌'],
      [{ kind: 'call', amountBb: 6 }, 'Call 6bb', '跟注 6bb'],
      [{ kind: 'call_allin', amountBb: 14.5 }, 'Calls All-In (14.5bb)', '跟注全下（14.5bb）'],
      [{ kind: 'bet', amountBb: 4.5 }, 'Bet 4.5bb', '下注 4.5bb'],
      [{ kind: 'raise', amountBb: 9 }, 'Raise to 9bb', '加注到 9bb'],
      [{ kind: 'three_bet', amountBb: 8.5 }, '3-Bet to 8.5bb', '3-Bet 到 8.5bb'],
      [{ kind: 'four_bet', amountBb: 22 }, '4-Bet to 22bb', '4-Bet 到 22bb'],
      [{ kind: 'all_in', amountBb: 55 }, 'All-In 55bb', '全下到 55bb'],
    ];
    for (const [spec, enExpected, zhExpected] of actions) {
      assert.equal(formatArenaAction('en', spec), enExpected);
      assert.equal(formatArenaAction('zh-CN', spec), zhExpected);
    }

    assert.equal(formatSeatDisplayName('zh-CN', 'Hero (You)', true), '我方');
    assert.equal(formatSeatDisplayName('zh-CN', 'Hero (You)'), '我方');
    assert.equal(formatSeatDisplayName('zh-CN', 'Bot Luna', false), 'Bot Luna');

    // Bare and descriptive hand ranks from evaluateHand()
    assert.equal(translateHandRank('zh-CN', 'Royal Flush'), '皇家同花顺');
    assert.equal(translateHandRank('zh-CN', 'Straight Flush, Nine-high'), '同花顺（9 高）');
    assert.equal(translateHandRank('zh-CN', 'Four of a Kind, Aces'), '四条（A）');
    assert.equal(translateHandRank('zh-CN', 'Full House, Kings full of Tens'), '葫芦（K 带 10）');
    assert.equal(translateHandRank('zh-CN', 'Flush, Ace-high'), '同花（A 高）');
    assert.equal(translateHandRank('zh-CN', 'Straight, King-high'), '顺子（K 高）');
    assert.equal(translateHandRank('zh-CN', 'Three of a Kind, Queens'), '三条（Q）');
    assert.equal(translateHandRank('zh-CN', 'Two Pair, Aces & Tens'), '两对（A 与 10）');
    assert.equal(translateHandRank('zh-CN', 'Pair of Kings'), '一对 K');
    assert.equal(translateHandRank('zh-CN', 'Ace-high'), '高牌（A 高）');

    const uncontestedSpec: WinnerSummarySpec = {
      type: 'uncontested',
      isSplit: false,
      potBb: 8.5,
      winners: [{ name: 'Hero (You)', position: 'BTN', isHero: true }],
    };
    assert.equal(
      formatWinnerSummary('zh-CN', uncontestedSpec),
      '我方 (BTN) 直接收下 8.5bb 底池（其余对手均弃牌）。'
    );

    const splitSpec: WinnerSummarySpec = {
      type: 'showdown',
      isSplit: true,
      potBb: 32,
      handLabel: 'Straight, King-high',
      winners: [
        { name: 'Hero (You)', position: 'BTN', isHero: true },
        { name: 'Bot Kai', position: 'BB', isHero: false },
      ],
    };
    const zhSplit = formatWinnerSummary('zh-CN', splitSpec);
    assert.ok(zhSplit.includes('我方 (BTN)'));
    assert.ok(zhSplit.includes('Bot Kai (BB)'));
    assert.ok(zhSplit.includes('顺子（K 高）'));
    assert.ok(zhSplit.includes('平分 32bb 底池'));

    const multiPotSpec: WinnerSummarySpec = {
      type: 'showdown',
      isSplit: false,
      potBb: 220,
      handLabel: 'Pair of Aces',
      winners: [{ name: 'Hero (You)', position: 'BTN', isHero: true }],
      potBreakdowns: [
        {
          potIndex: 0,
          amountBb: 60,
          isSplit: false,
          handLabel: 'Pair of Aces',
          winners: [{ seatIndex: 0, name: 'Hero (You)', position: 'BTN', isHero: true, payoutBb: 60 }],
        },
        {
          potIndex: 1,
          amountBb: 160,
          isSplit: false,
          handLabel: 'Pair of Kings',
          winners: [{ seatIndex: 1, name: 'Bot Viktor', position: 'SB', isHero: false, payoutBb: 160 }],
        },
      ],
    };
    const enMulti = formatWinnerSummary('en', multiPotSpec);
    assert.ok(enMulti.includes('Main pot (60bb)'));
    assert.ok(enMulti.includes('Side pot 1 (160bb)'));
    const zhMulti = formatWinnerSummary('zh-CN', multiPotSpec);
    assert.ok(zhMulti.includes('主池（60bb）'));
    assert.ok(zhMulti.includes('边池 1（160bb）'));
    assert.ok(zhMulti.includes('一对 A'));
    assert.ok(zhMulti.includes('一对 K'));

    // Every AuditBaseReason + AuditExploitTipKind produces idiomatic Chinese
    const reasons: AuditBaseReason[] = [
      'strong_value',
      'semi_bluff_cbet',
      'weak_showdown',
      'pot_control',
      'value_protect_raise',
      'pot_odds_call',
      'pot_odds_fold',
    ];
    const tips: AuditExploitTipKind[] = [
      'cs_value',
      'cs_no_bluff',
      'nit_respect',
      'nit_pressure',
      'lag_bluffcatch',
      'tag_discipline',
      'reg_mix',
    ];
    for (let i = 0; i < reasons.length; i++) {
      const zhAudit = formatArenaAuditNote('zh-CN', {
        reason: reasons[i],
        street: 'flop',
        handKey: 'AKs',
        toCallBb: 5,
        reqEqPct: 25,
        villainName: 'Bot Luna',
        villainArchetype: 'Calling Station',
        exploitTip: tips[i],
      });
      assert.match(zhAudit, /[\u4e00-\u9fff]/);
      assert.ok(!zhAudit.includes('Exploit vs'), `Leaked English prefix in ${reasons[i]}`);
    }
  });

  it('preserves legacy string localization and safe English fallback for unmatched strings', () => {
    const legacyNote =
      'Hand strength clears required pot odds (25%)—calling is +EV. Exploit vs Bot Luna (Calling Station): size up value bets—they call too wide.';
    const zhNote = localizeArenaNote('zh-CN', legacyNote);
    assert.ok(zhNote.includes('底池赔率门槛（25%）'));
    assert.ok(zhNote.includes('跟注站'));
    assert.ok(!zhNote.includes('Exploit vs'));

    const legacyUncontested = localizeWinnerSummary('zh-CN', 'Hero (You) (BTN) wins 8.5bb uncontested.');
    assert.ok(legacyUncontested.includes('我方 (BTN)'));
    assert.ok(legacyUncontested.includes('8.5bb'));

    const legacySplit = localizeWinnerSummary(
      'zh-CN',
      'Hero (You) (BTN), Bot Kai (BB) split 24bb with Two Pair.'
    );
    assert.ok(legacySplit.includes('平分 24bb 底池'));
    assert.ok(legacySplit.includes('两对'));

    assert.equal(
      localizeSpotLabel('zh-CN', 'BTN Open (RFI) (AKs)'),
      'BTN 开池加注 (RFI) (AKs)'
    );
    assert.equal(
      localizeSpotLabel('zh-CN', '6-Max Hand #4 (flop)'),
      '6人桌 第 4 手（翻牌）'
    );

    // Unknown legacy text falls back safely to original string without throwing or corrupting
    const unknownText = 'Custom legacy record from future version';
    assert.equal(localizeArenaNote('zh-CN', unknownText), unknownText);
    assert.equal(localizeWinnerSummary('zh-CN', unknownText), unknownText);
    assert.equal(localizeSpotLabel('zh-CN', unknownText), unknownText);
  });
});
