import { describe, expect, it } from "vitest";
import {
  analyzeBalance,
  analyzeIncome,
  analyzeNetAssetsChange,
  chooseMoneyScale,
  prepareBreakdown
} from "@/lib/financialStory";

describe("financial story analysis", () => {
  it("uses the source thousand-yen unit and scales large values to oku yen", () => {
    expect(chooseMoneyScale([99_999])).toMatchObject({ divisor: 1_000, unit: "百万円" });
    expect(chooseMoneyScale([100_000])).toEqual({ divisor: 100_000, unit: "億円", maximumFractionDigits: 1 });
  });

  it("reconciles profit and derives only the unclassified remainder", () => {
    const result = analyzeIncome({
      totalRevenue: 1_000,
      totalExpense: 940,
      operatingRevenue: 800,
      nonOperatingRevenue: 200,
      extraordinaryProfit: 0,
      operatingExpense: 760,
      nonOperatingExpense: 180,
      extraordinaryLoss: 0,
      netIncome: 60,
      revenueBreakdown: [
        { label: "使用料", value: 600 },
        { label: "雨水処理負担金", value: 150 }
      ],
      expenseBreakdown: [
        { label: "減価償却費", value: 500 },
        { label: "維持管理費", value: 340 }
      ]
    });

    expect(result.state).toBe("ready");
    expect(result.gap).toBe(60);
    expect(result.revenueCoverageRate).toBeCloseTo(106.383, 3);
    expect(result.equation).toMatchObject({
      total: 1_000,
      leftTotal: 1_000,
      rightTotal: 1_000,
      difference: 0,
      reconciled: true,
      resultSide: "left"
    });
    expect(result.equation.left.at(-1)).toMatchObject({ id: "net-profit", value: 60 });
    expect(result.revenue.items.at(-1)).toMatchObject({ label: "その他", value: 250, derived: true });
    expect(result.expense.items.at(-1)).toMatchObject({ label: "その他", value: 100, derived: true });
  });

  it("does not draw a misleading proportional breakdown when parts exceed the official total", () => {
    const result = prepareBreakdown(100, [
      { label: "A", value: 70 },
      { label: "B", value: 40 }
    ], "合計");

    expect(result.state).toBe("invalid");
    expect(result.items).toEqual([{ id: "合計-total", label: "合計", value: 100, share: 1, derived: true }]);
    expect(result.messages.join(" ")).toContain("内訳の合計が総額を上回る");
  });

  it("treats an official negative adjustment as a visualization limit, not a data error", () => {
    const result = prepareBreakdown(100, [
      { label: "正の収益", value: 110 },
      { label: "雑収益調整", value: -10 }
    ], "収益合計");

    expect(result.state).toBe("limited");
    expect(result.items).toEqual([{ id: "収益合計-total", label: "収益合計", value: 100, share: 1, derived: true }]);
    expect(result.messages.join(" ")).toContain("マイナス調整後の総額");
  });

  it("treats a zero-activity statement as valid but not proportionally visualizable", () => {
    const result = analyzeIncome({
      totalRevenue: 0,
      totalExpense: 0,
      operatingRevenue: 0,
      nonOperatingRevenue: 0,
      extraordinaryProfit: 0,
      operatingExpense: 0,
      nonOperatingExpense: 0,
      extraordinaryLoss: 0,
      netIncome: 0,
      revenueBreakdown: [],
      expenseBreakdown: []
    });

    expect(result).toMatchObject({ available: true, visualizable: false, state: "limited", gap: 0 });
  });

  it("balances a net loss on the revenue side of the accounting equation", () => {
    const result = analyzeIncome({
      totalRevenue: 900,
      totalExpense: 1_000,
      operatingRevenue: 700,
      nonOperatingRevenue: 200,
      extraordinaryProfit: 0,
      operatingExpense: 850,
      nonOperatingExpense: 150,
      extraordinaryLoss: 0,
      netIncome: -100,
      revenueBreakdown: [],
      expenseBreakdown: []
    });

    expect(result.equation).toMatchObject({
      total: 1_000,
      leftTotal: 1_000,
      rightTotal: 1_000,
      difference: 0,
      reconciled: true,
      resultSide: "right"
    });
    expect(result.equation.right.at(-1)).toMatchObject({ id: "net-loss", value: 100 });
  });

  it("stops the diagram when the official net result does not reconcile", () => {
    const result = analyzeIncome({
      totalRevenue: 1_000,
      totalExpense: 900,
      operatingRevenue: 800,
      nonOperatingRevenue: 200,
      extraordinaryProfit: 0,
      operatingExpense: 750,
      nonOperatingExpense: 150,
      extraordinaryLoss: 0,
      netIncome: 99,
      revenueBreakdown: [],
      expenseBreakdown: []
    });

    expect(result).toMatchObject({ visualizable: false, state: "invalid" });
    expect(result.equation.reconciled).toBe(false);
  });

  it("reconciles assets with liabilities and net assets and explains the year-on-year change", () => {
    const balance = {
      fixedAssets: 8_000,
      currentAssets: 2_000,
      deferredAssets: 0,
      totalAssets: 10_000,
      fixedLiabilities: 5_000,
      currentLiabilities: 1_000,
      deferredRevenue: 1_000,
      totalLiabilities: 7_000,
      capital: 2_000,
      surplus: 1_000,
      capitalSurplus: 400,
      retainedEarnings: 600,
      otherSecuritiesValuationDifference: 0,
      totalNetAssets: 3_000,
      priorNetAssets: 2_800,
      priorCapital: 1_900,
      priorSurplus: 900,
      priorCapitalSurplus: 400,
      priorRetainedEarnings: 500,
      priorOtherSecuritiesValuationDifference: 0
    };

    const result = analyzeBalance(balance);
    const change = analyzeNetAssetsChange(balance);

    expect(result.reconciled).toBe(true);
    expect(result.balanceDifference).toBe(0);
    expect(result.debtRatio).toBe(70);
    expect(result.netAssetsRatio).toBe(30);
    expect(change).toMatchObject({
      available: true,
      delta: 200,
      direction: "increase",
      componentDifference: 0,
      priorComponentDifference: 0,
      currentComponentDifference: 0,
      componentsReconciled: true
    });
    expect(change.components.map(({ id, delta }) => ({ id, delta }))).toEqual([
      { id: "capital", delta: 100 },
      { id: "capital-surplus", delta: 0 },
      { id: "retained-earnings", delta: 100 },
      { id: "valuation-difference", delta: 0 }
    ]);
  });

  it("does not invent missing prior net-assets components", () => {
    const change = analyzeNetAssetsChange({
      fixedAssets: null,
      currentAssets: null,
      deferredAssets: null,
      totalAssets: null,
      fixedLiabilities: null,
      currentLiabilities: null,
      deferredRevenue: null,
      totalLiabilities: null,
      capital: 2_000,
      surplus: 1_000,
      capitalSurplus: 400,
      retainedEarnings: 600,
      otherSecuritiesValuationDifference: 0,
      priorNetAssets: 2_800,
      totalNetAssets: 3_000
    });

    expect(change).toMatchObject({ available: true, delta: 200, components: [], componentsReconciled: null });
  });

  it("rejects component reconciliation when both stock totals are offset by the same amount", () => {
    const change = analyzeNetAssetsChange({
      fixedAssets: null,
      currentAssets: null,
      deferredAssets: null,
      totalAssets: null,
      fixedLiabilities: null,
      currentLiabilities: null,
      deferredRevenue: null,
      totalLiabilities: null,
      capital: 2_000,
      surplus: 1_000,
      capitalSurplus: 400,
      retainedEarnings: 590,
      otherSecuritiesValuationDifference: 0,
      totalNetAssets: 3_000,
      priorNetAssets: 2_800,
      priorCapital: 1_900,
      priorSurplus: 900,
      priorCapitalSurplus: 400,
      priorRetainedEarnings: 490,
      priorOtherSecuritiesValuationDifference: 0
    });

    expect(change).toMatchObject({
      componentDifference: 0,
      priorComponentDifference: 10,
      currentComponentDifference: 10,
      componentsReconciled: false
    });
  });

  it("keeps mixed positive and negative component changes signed and reconciled", () => {
    const change = analyzeNetAssetsChange({
      fixedAssets: null,
      currentAssets: null,
      deferredAssets: null,
      totalAssets: null,
      fixedLiabilities: null,
      currentLiabilities: null,
      deferredRevenue: null,
      totalLiabilities: null,
      capital: 1_100,
      surplus: 630,
      capitalSurplus: 400,
      retainedEarnings: 250,
      otherSecuritiesValuationDifference: -20,
      priorNetAssets: 1_700,
      totalNetAssets: 1_730,
      priorCapital: 1_000,
      priorSurplus: 700,
      priorCapitalSurplus: 400,
      priorRetainedEarnings: 300,
      priorOtherSecuritiesValuationDifference: 0
    });

    expect(change).toMatchObject({
      delta: 30,
      componentDifference: 0,
      priorComponentDifference: 0,
      currentComponentDifference: 0,
      componentsReconciled: true
    });
    expect(change.components.map(({ id, delta }) => ({ id, delta }))).toEqual([
      { id: "capital", delta: 100 },
      { id: "capital-surplus", delta: 0 },
      { id: "retained-earnings", delta: -50 },
      { id: "valuation-difference", delta: -20 }
    ]);
  });

  it("does not erase a real net-assets change merely because it is small relative to the balance sheet", () => {
    const change = analyzeNetAssetsChange({
      fixedAssets: null,
      currentAssets: null,
      deferredAssets: null,
      totalAssets: null,
      fixedLiabilities: null,
      currentLiabilities: null,
      deferredRevenue: null,
      totalLiabilities: null,
      capital: null,
      surplus: null,
      otherSecuritiesValuationDifference: null,
      priorNetAssets: 20_000_000,
      totalNetAssets: 20_019_934
    });

    expect(change).toMatchObject({ delta: 19_934, direction: "increase" });
  });

  it("fails closed when the balance sheet does not balance", () => {
    const result = analyzeBalance({
      fixedAssets: 700,
      currentAssets: 300,
      deferredAssets: 0,
      totalAssets: 1_000,
      fixedLiabilities: 400,
      currentLiabilities: 100,
      deferredRevenue: 100,
      totalLiabilities: 600,
      capital: 200,
      surplus: 100,
      otherSecuritiesValuationDifference: 0,
      totalNetAssets: 300,
      priorNetAssets: null
    });

    expect(result.reconciled).toBe(false);
    expect(result.visualizable).toBe(false);
    expect(result.state).toBe("invalid");
    expect(result.messages.join(" ")).toContain("資産合計と「負債＋純資産」が一致しません");
  });

  it("classifies negative net assets as a balanced deficit rather than a source error", () => {
    const result = analyzeBalance({
      fixedAssets: 800,
      currentAssets: 200,
      deferredAssets: 0,
      totalAssets: 1_000,
      fixedLiabilities: 900,
      currentLiabilities: 300,
      deferredRevenue: 0,
      totalLiabilities: 1_200,
      capital: 100,
      surplus: -300,
      otherSecuritiesValuationDifference: 0,
      totalNetAssets: -200,
      priorNetAssets: -250
    });

    expect(result).toMatchObject({ reconciled: true, visualizable: false, state: "limited", totalNetAssets: -200 });
    expect(result.messages.join(" ")).toContain("債務超過");
  });
});
