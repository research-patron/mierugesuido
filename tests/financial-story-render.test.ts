import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinancialStory, type FinancialStoryProps } from "@/components/municipality-detail/FinancialStory";

const BASE_PROPS: FinancialStoryProps = {
  year: "R6",
  accountingType: "legal_applied",
  status: { state: "ready" },
  income: {
    totalRevenue: 1_000,
    totalExpense: 900,
    operatingRevenue: 800,
    nonOperatingRevenue: 200,
    extraordinaryProfit: 0,
    operatingExpense: 700,
    nonOperatingExpense: 200,
    extraordinaryLoss: 0,
    netIncome: 100,
    revenueBreakdown: [
      { id: "sewer-fee", label: "下水道使用料", value: 700, group: "operating" },
      { id: "other-operating-revenue", label: "その他営業収益", value: 100, group: "operating" },
      { id: "other-account-subsidy", label: "他会計補助金（営業外収益）", value: 200, group: "non-operating" }
    ],
    expenseBreakdown: [
      { id: "depreciation", label: "減価償却費", value: 700, group: "operating" },
      { id: "interest", label: "支払利息", value: 200, group: "non-operating" }
    ]
  },
  costComposition: {
    total: 1_000,
    officialSource: {
      label: "地方公営企業年鑑 個表（2）№1",
      sourceUrl: "https://www.soumu.go.jp/main_content/official.xls",
      note: "14項目を第21表と照合済み"
    },
    items: [
      { id: "personnel", label: "職員給与費", value: 100, note: "職員にかかる費用" },
      { id: "interest", label: "支払利息", value: 50, note: "資金調達に伴う利息" },
      { id: "depreciation", label: "減価償却費", value: 300, note: "施設・設備の取得額を使用年数に分けた費用" },
      { id: "power", label: "動力費", value: 100, note: "設備を動かす費用" },
      { id: "utilities", label: "光熱水費", value: 10 },
      { id: "communications", label: "通信運搬費", value: 10 },
      { id: "repair", label: "修繕費", value: 50 },
      { id: "materials", label: "材料費", value: 10 },
      { id: "chemicals", label: "薬品費", value: 10 },
      { id: "road-restoration", label: "路面復旧費", value: 10 },
      { id: "outsourcing", label: "委託料", value: 200, note: "維持管理などを外部へ委託した費用" },
      { id: "regional-sewerage-contribution", label: "流域下水道管理運営費負担金", value: 100 },
      { id: "other", label: "その他", value: 50 }
    ]
  },
  balance: {
    fixedAssets: 800,
    currentAssets: 200,
    deferredAssets: 0,
    totalAssets: 1_000,
    fixedLiabilities: 500,
    currentLiabilities: 100,
    deferredRevenue: 100,
    totalLiabilities: 700,
    capital: 200,
    surplus: 100,
    capitalSurplus: 40,
    retainedEarnings: 60,
    otherSecuritiesValuationDifference: 0,
    totalNetAssets: 300,
    priorNetAssets: 280,
    priorCapital: 190,
    priorSurplus: 90,
    priorCapitalSurplus: 40,
    priorRetainedEarnings: 50,
    priorOtherSecuritiesValuationDifference: 0
  }
};

describe("FinancialStory rendered relationships", () => {
  it("leads with the cost center, then discloses all official Table 21 values without judging efficiency", () => {
    const markup = renderStory();

    expect(markup).toContain("R6年度の財務を、4つの要点で読む");
    expect(markup).toContain('aria-label="R6年度決算の4つの要点"');
    expect(markup).toContain("費用の中心");
    expect(markup).toContain("減価償却費が最も大きい費用です");
    expect(markup).toContain("費用合計の30.0%を占めます");
    expect(markup).toContain("上位3費目の合計");
    expect(markup).toContain("60.0%");
    expect(markup).toContain('aria-label="R6年度の費用額が大きい上位3費目"');
    expect(markup.indexOf("減価償却費")).toBeLessThan(markup.indexOf("委託料"));
    expect(markup).toContain("13費目の公式値と構成比を見る");
    expect(markup).toContain("個表と第21表で一致を確認した値です");
    expect(markup).toContain("本サイトが算定しています");
    expect(markup).toContain("年鑑個表の原資料を確認");
    expect(markup).toContain("流域下水道管理運営費負担金");
    expect(markup).toContain("効率の良し悪しを直接判定するものではありません");
    expect(markup).toContain("損益の総費用や経費回収率の汚水処理費とは集計範囲が異なります");
  });

  it("fails closed when a cost item is missing instead of treating it as zero", () => {
    const markup = renderToStaticMarkup(createElement(FinancialStory, {
      ...BASE_PROPS,
      costComposition: {
        ...BASE_PROPS.costComposition!,
        items: BASE_PROPS.costComposition!.items.map((item) => item.id === "repair" ? { ...item, value: null } : item)
      }
    }));

    expect(markup).toContain("費用構成の評価を表示していません");
    expect(markup).toContain("未取得の費目を0円とは扱わず");
    expect(markup).not.toContain("減価償却費が最も大きい費用です");
  });

  it("renders one accessible three-box balance relationship and no repeated equation strip", () => {
    const markup = renderStory();
    const balanceFigure = extractFigure(markup, 'data-balance-relation="standard"');

    expect(markup).toContain('data-balance-relation="standard" aria-hidden="true"');
    expect(balanceFigure.match(/<p class="sr-only">/g)).toHaveLength(1);
    expect(balanceFigure).toContain("資産は、負債と純資産で支えられています");
    expect(balanceFigure).toContain("資産合計1百万円");
    expect(balanceFigure).toContain("負債0.7百万円");
    expect(balanceFigure).toContain("純資産0.3百万円");
    expect(markup.match(/data-balance-frame=/g)).toHaveLength(2);
    expect(markup).toContain('data-balance-frame="asset"');
    expect(markup).toContain('data-balance-frame="funding"');
    expect(markup.match(/data-balance-box=/g)).toHaveLength(3);
    expect(markup.match(/data-balance-breakdown="asset"/g)).toHaveLength(1);
    expect(markup.match(/data-balance-breakdown="liability"/g)).toHaveLength(1);
    expect(markup.match(/data-balance-breakdown="net-assets"/g)).toHaveLength(1);
    expect(markup).not.toContain("data-balance-callout");
    expect(markup.indexOf('data-balance-box="asset"')).toBeLessThan(markup.indexOf('data-balance-box="liability"'));
    expect(markup.indexOf('data-balance-box="liability"')).toBeLessThan(markup.indexOf('data-balance-box="net-assets"'));
    expect(markup).toContain("施設・設備などの帳簿価額");
    expect(markup).toContain("企業債・引当金など、主に長期");
    expect(markup).toContain("資産から負債を差し引いた残りです");
    expect(markup).toContain('data-balance-detail="fixed-assets"');
    expect(markup).toContain('<small>うち</small>固定資産');
    expect(markup).toContain("0.8百万円");
    expect(markup).toContain("資産内 80.0%");
    expect(markup).toContain('data-balance-detail="deferred-revenue"');
    expect(markup).toContain("負債内 14.3%");
    expect(markup).toContain('data-balance-detail="capital"');
    expect(markup).toContain("純資産内 66.7%");
    expect(markup).toContain("返済予定額ではありません");
    expect(balanceFigure).toContain("資産の内訳はうち固定資産0.8百万円、資産内80.0%");
    expect(markup).not.toContain("<figcaption");
    expect(markup.match(/費用 0.9百万円 ＋ 当年度純利益 100千円 ＝ 収益 1百万円/g)).toHaveLength(1);
    expect(markup).toContain('role="group" aria-label="R6年度損益の勘定式。費用 0.9百万円 ＋ 当年度純利益 100千円 ＝ 収益 1百万円"');
  });

  it("keeps source accounts in three disclosed groups without implying double counting", () => {
    const markup = renderStory();

    expect(markup).toContain("<summary><span>勘定科目の内訳とデータ確認</span>");
    expect(markup).toContain("R6年度 資産の内訳（原表単位：千円）");
    expect(markup).toContain("R6年度 負債の内訳（原表単位：千円）");
    expect(markup).toContain("R6年度 純資産の内訳（原表単位：千円）");
    expect(markup).toContain("固定資産");
    expect(markup).toContain("800千円");
    expect(markup).toContain("剰余金（小計）");
    expect(markup).toContain("小計の内訳。合計に再加算しません");
  });

  it("renders debt excess as assets plus deficit equals liabilities", () => {
    const markup = renderStory({
      fixedAssets: 100,
      currentAssets: 0,
      totalAssets: 100,
      fixedLiabilities: 120,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 120,
      capital: 0,
      surplus: -20,
      capitalSurplus: 0,
      retainedEarnings: -20,
      totalNetAssets: -20
    });
    const balanceFigure = extractFigure(markup, 'data-balance-relation="deficit"');

    expect(markup).toContain('data-balance-relation="deficit" aria-hidden="true"');
    expect(balanceFigure.match(/<p class="sr-only">/g)).toHaveLength(1);
    expect(balanceFigure).toContain("債務超過です");
    expect(markup.match(/data-balance-box=/g)).toHaveLength(3);
    expect(markup.indexOf('data-balance-box="asset"')).toBeLessThan(markup.indexOf('data-balance-box="deficit"'));
    expect(markup.indexOf('data-balance-box="deficit"')).toBeLessThan(markup.indexOf('data-balance-box="liability"'));
    expect(markup).toContain("純資産がマイナス（債務超過）");
    expect(markup).toContain("純資産のマイナス分");
    expect(markup).toContain("債務超過額（差額）");
    expect(markup).not.toContain('data-balance-breakdown="deficit"');
    expect(markup).toContain("繰延収益を含む貸借対照表上の合計です");
  });

  it("fails closed for unreconciled, missing, and zero-asset standard balances", () => {
    const unreconciled = renderStory({ totalAssets: 100, totalLiabilities: 70, totalNetAssets: 20 });
    const missing = renderStory({ totalAssets: null });
    const zeroAssets = renderStory({
      fixedAssets: 0,
      currentAssets: 0,
      totalAssets: 0,
      fixedLiabilities: 0,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 0,
      capital: 0,
      surplus: 0,
      totalNetAssets: 0
    });

    expect(unreconciled).not.toContain("data-balance-relation=");
    expect(unreconciled).toContain("資産合計と「負債＋純資産」が一致しません");
    expect(missing).not.toContain("data-balance-relation=");
    expect(missing).toContain("いずれかが未取得");
    expect(zeroAssets).not.toContain("data-balance-relation=");
    expect(zeroAssets).toContain("負数または0を含むため");
  });

  it("shows zero net assets without treating it as debt excess", () => {
    const markup = renderStory({
      fixedAssets: 100,
      currentAssets: 0,
      totalAssets: 100,
      fixedLiabilities: 100,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 100,
      capital: 0,
      surplus: 0,
      totalNetAssets: 0
    });

    expect(markup).toContain('data-balance-relation="standard"');
    expect(markup).toContain('data-balance-box="net-assets"');
    expect(markup).toContain('data-balance-compact="net-assets"');
    expect(markup).toContain('data-balance-inline="net-assets"');
    expect(markup).not.toContain("data-balance-callout");
    expect(markup).toContain("資産の 0.0%");
    expect(markup).not.toContain('data-balance-relation="deficit"');
  });

  it("does not label zero assets as 100 percent in a debt-excess edge case", () => {
    const markup = renderStory({
      fixedAssets: 0,
      currentAssets: 0,
      totalAssets: 0,
      fixedLiabilities: 10,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 10,
      capital: 0,
      surplus: -10,
      retainedEarnings: -10,
      totalNetAssets: -10
    });

    expect(markup).toContain('data-balance-relation="deficit"');
    expect(markup).toContain("割合なし");
    expect(markup).not.toContain("基準 100%");
  });

  it("preserves small nonzero amounts and percentages instead of rounding them to zero", () => {
    const smallPositive = renderStory({
      fixedAssets: 1_000_000,
      currentAssets: 0,
      totalAssets: 1_000_000,
      fixedLiabilities: 999_500,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 999_500,
      capital: 500,
      surplus: 0,
      totalNetAssets: 500
    });
    const smallNegative = renderStory({
      fixedAssets: 1_000_000,
      currentAssets: 0,
      totalAssets: 1_000_000,
      fixedLiabilities: 1_000_500,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 1_000_500,
      capital: 0,
      surplus: -500,
      retainedEarnings: -500,
      totalNetAssets: -500
    });

    expect(smallPositive).toContain("500千円");
    expect(smallPositive).toContain("0.5百万円");
    expect(smallPositive).toContain("0.1%未満");
    expect(smallPositive).toContain('data-balance-inline="net-assets"');
    expect(smallPositive).not.toContain('data-balance-breakdown="net-assets"');
    expect(smallPositive).toContain("純資産内100.0%");
    expect(smallPositive).not.toContain("純資産0億円");
    expect(smallNegative).toContain("−0.1%未満");
    expect(smallNegative).not.toContain("-0.0%");
  });

  it("labels an unclassified source gap inside the relevant box without inventing the missing account", () => {
    const markup = renderStory({ currentAssets: null });
    const assetBreakdown = extractList(markup, 'data-balance-breakdown="asset"');

    expect(assetBreakdown).toContain('data-balance-derived="true"');
    expect(assetBreakdown).toContain("<small>残り</small>（その他・未取得）");
    expect(assetBreakdown).toContain("資産内 20.0%");
    expect(assetBreakdown).not.toContain('<small>うち</small>流動資産');
  });

  it("marks a missing account as unknown even when disclosed accounts equal the total", () => {
    const markup = renderStory({
      fixedAssets: 1_000,
      currentAssets: null,
      deferredAssets: 0,
      totalAssets: 1_000
    });
    const assetBreakdown = extractList(markup, 'data-balance-breakdown="asset"');

    expect(assetBreakdown).toContain('data-balance-breakdown-state="partial"');
    expect(assetBreakdown).toContain("一部内訳未取得（0円とは扱いません）");
    expect(assetBreakdown).not.toContain("流動資産");
  });

  it("labels a source-complete arithmetic remainder as a derived difference", () => {
    const markup = renderStory({
      fixedAssets: 700,
      currentAssets: 200,
      deferredAssets: 0,
      totalAssets: 1_000
    });
    const assetBreakdown = extractList(markup, 'data-balance-breakdown="asset"');

    expect(assetBreakdown).toContain('data-balance-derived="true"');
    expect(assetBreakdown).toContain("<small>残り</small>（総額との差額）");
    expect(assetBreakdown).toContain("資産内 10.0%");
    expect(assetBreakdown).not.toContain("その他・未取得");
  });

  it("does not show misleading proportions when a negative child account requires offsetting", () => {
    const markup = renderStory({
      fixedAssets: 1_100,
      currentAssets: -100,
      deferredAssets: 0,
      totalAssets: 1_000
    });
    const assetBreakdown = extractList(markup, 'data-balance-breakdown="asset"');

    expect(assetBreakdown).toContain('data-balance-breakdown-state="limited"');
    expect(assetBreakdown).toContain("相殺・不整合を含むため、内訳の割合は表示しません");
    expect(assetBreakdown).not.toContain("資産内");
    expect(assetBreakdown).not.toContain("100.0%");
  });

  it("keeps a geometrically tiny liability label in the exact-area stack", () => {
    const markup = renderStory({
      fixedAssets: 1_000_000,
      currentAssets: 0,
      totalAssets: 1_000_000,
      fixedLiabilities: 100,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 100,
      capital: 999_900,
      surplus: 0,
      totalNetAssets: 999_900
    });

    expect(markup).toContain('data-balance-compact="liability"');
    expect(markup).toContain('data-balance-inline="liability"');
    expect(markup).not.toContain("data-balance-callout");
    expect(markup).toContain("0.1百万円");
    expect(markup).toContain("0.1%未満");
  });

  it("keeps a mobile-only compact breakdown in its original funding region", () => {
    const markup = renderStory({
      fixedAssets: 8_000,
      currentAssets: 2_000,
      deferredAssets: 0,
      totalAssets: 10_000,
      fixedLiabilities: 7_000,
      currentLiabilities: 800,
      deferredRevenue: 0,
      totalLiabilities: 7_800,
      capital: 1_500,
      surplus: 700,
      totalNetAssets: 2_200
    });
    expect(markup).toContain('data-balance-mobile-compact="net-assets"');
    expect(markup).not.toContain("data-balance-callout");
    expect(markup).toContain('data-balance-breakdown="net-assets"');
    expect(markup).toContain('data-balance-detail="capital"');
    expect(markup.match(/data-balance-breakdown="net-assets"/g)).toHaveLength(1);
  });

  it("keeps an 8.1 percent net-assets total inside the funding frame without a detached box", () => {
    const markup = renderStory({
      fixedAssets: 527_050_000,
      currentAssets: 4_817_724,
      deferredAssets: 0,
      totalAssets: 531_867_724,
      fixedLiabilities: 251_040_000,
      currentLiabilities: 24_381_217,
      deferredRevenue: 213_460_000,
      totalLiabilities: 488_881_217,
      capital: 28_800_000,
      surplus: 14_186_507,
      totalNetAssets: 42_986_507
    });

    expect(markup).toContain('data-balance-compact="net-assets"');
    expect(markup).toContain('data-balance-inline="net-assets"');
    expect(markup).toContain("429.9億円");
    expect(markup).toContain("資産の 8.1%");
    expect(markup).not.toContain("data-balance-callout");
    expect(markup).not.toContain('data-balance-breakdown="net-assets"');
  });

  it("keeps a 22.5 percent two-row net-assets breakdown inside its proportional box", () => {
    const markup = renderStory({
      fixedAssets: 8_000,
      currentAssets: 2_000,
      deferredAssets: 0,
      totalAssets: 10_000,
      fixedLiabilities: 7_000,
      currentLiabilities: 750,
      deferredRevenue: 0,
      totalLiabilities: 7_750,
      capital: 1_500,
      surplus: 750,
      totalNetAssets: 2_250
    });
    const netAssetsBreakdown = extractList(markup, 'data-balance-breakdown="net-assets"');

    expect(markup).not.toContain('data-balance-mobile-compact="net-assets"');
    expect(markup).not.toContain("data-balance-callout");
    expect(markup.match(/data-balance-breakdown="net-assets"/g)).toHaveLength(1);
    expect(netAssetsBreakdown).toContain('data-balance-detail="capital"');
    expect(netAssetsBreakdown).toContain('data-balance-detail="surplus"');
    expect(netAssetsBreakdown).toContain("純資産内 66.7%");
    expect(netAssetsBreakdown).toContain("純資産内 33.3%");
  });

  it("falls back to a finer common unit when independent rounding would break the equation", () => {
    const markup = renderStory({
      fixedAssets: 105_000,
      currentAssets: 0,
      totalAssets: 105_000,
      fixedLiabilities: 52_000,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 52_000,
      capital: 53_000,
      surplus: 0,
      totalNetAssets: 53_000
    });
    const balanceFigure = extractFigure(markup, 'data-balance-relation="standard"');

    expect(balanceFigure).toContain("資産合計105百万円");
    expect(balanceFigure).toContain("負債52百万円");
    expect(balanceFigure).toContain("純資産53百万円");
    expect(balanceFigure).not.toContain("1.1億円");
  });

  it("falls back before a less-than label would make the displayed equation ambiguous", () => {
    const markup = renderStory({
      fixedAssets: 105_000,
      currentAssets: 0,
      totalAssets: 105_000,
      fixedLiabilities: 100_000,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 100_000,
      capital: 5_000,
      surplus: 0,
      totalNetAssets: 5_000
    });
    const balanceFigure = extractFigure(markup, 'data-balance-relation="standard"');

    expect(balanceFigure).toContain("資産合計105百万円");
    expect(balanceFigure).toContain("負債100百万円");
    expect(balanceFigure).toContain("純資産5百万円");
    expect(balanceFigure).not.toContain("0.1億円未満");
  });

  it("keeps a very small disclosed subaccount exact in the source thousand-yen unit", () => {
    const markup = renderStory({
      fixedAssets: 99_950,
      currentAssets: 50,
      deferredAssets: 0,
      totalAssets: 100_000,
      fixedLiabilities: 50_000,
      currentLiabilities: 0,
      deferredRevenue: 0,
      totalLiabilities: 50_000,
      capital: 50_000,
      surplus: 0,
      totalNetAssets: 50_000
    });
    const assetBreakdown = extractList(markup, 'data-balance-breakdown="asset"');

    expect(assetBreakdown).toContain("50千円");
    expect(assetBreakdown).not.toContain("0.1億円未満");
  });
});

function renderStory(balanceOverrides: Partial<NonNullable<FinancialStoryProps["balance"]>> = {}) {
  const props: FinancialStoryProps = {
    ...BASE_PROPS,
    balance: { ...BASE_PROPS.balance!, ...balanceOverrides }
  };
  return renderToStaticMarkup(createElement(FinancialStory, props));
}

function extractFigure(markup: string, marker: string) {
  const markerIndex = markup.indexOf(marker);
  const figureStart = markup.lastIndexOf("<figure", markerIndex);
  const figureEnd = markup.indexOf("</figure>", markerIndex);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  expect(figureStart).toBeGreaterThanOrEqual(0);
  expect(figureEnd).toBeGreaterThan(markerIndex);
  return markup.slice(figureStart, figureEnd + "</figure>".length);
}

function extractList(markup: string, marker: string) {
  const markerIndex = markup.indexOf(marker);
  const listStart = markup.lastIndexOf("<ul", markerIndex);
  const listEnd = markup.indexOf("</ul>", markerIndex);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  expect(listStart).toBeGreaterThanOrEqual(0);
  expect(listEnd).toBeGreaterThan(markerIndex);
  return markup.slice(listStart, listEnd + "</ul>".length);
}
