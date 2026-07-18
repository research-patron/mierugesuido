import { describe, expect, it } from "vitest";
import {
  buildFinancialStoryModel,
  type FinancialStatementItemInput,
  type FinancialStoryAnnualInput
} from "@/lib/financialStoryModel";
import { FINANCIAL_STATEMENT_MAPPINGS } from "@/scripts/etl/statementMappings";

const CURRENT_VALUES: Record<string, number> = {
  total_revenue: 1_000,
  operating_revenue: 700,
  non_operating_revenue: 290,
  sewer_fee_revenue: 500,
  rainwater_burden_revenue: 100,
  other_operating_revenue: 40,
  national_subsidy_revenue: 50,
  prefecture_subsidy_revenue: 20,
  other_account_subsidy_revenue: 30,
  deferred_revenue_reversal: 120,
  capital_cost_transfer_revenue: 20,
  miscellaneous_non_operating_revenue: 50,
  extraordinary_profit: 10,
  total_expense: 1_050,
  operating_expense: 900,
  non_operating_expense: 150,
  pipeline_expense: 100,
  pump_station_expense: 50,
  treatment_plant_expense: 150,
  outsourced_construction_expense: 0,
  business_expense: 50,
  general_administration_expense: 100,
  depreciation_expense: 400,
  asset_retirement_expense: 20,
  regional_sewerage_operating_expense: 0,
  other_operating_expense: 30,
  interest_expense: 50,
  other_non_operating_expense: 100,
  extraordinary_loss: 0,
  current_net_profit: 0,
  current_net_loss: 50,
  personnel_cost_total: 100,
  interest_cost: 50,
  depreciation_cost: 300,
  power_cost: 10,
  utilities_cost: 20,
  communications_cost: 30,
  repair_cost: 40,
  material_cost: 50,
  chemical_cost: 60,
  road_restoration_cost: 70,
  outsourcing_cost: 150,
  flow_sewer_burden_cost: 100,
  other_cost: 70,
  total_cost: 1_050,
  fixed_assets: 8_000,
  current_assets: 2_000,
  deferred_assets: 0,
  total_assets: 10_000,
  fixed_liabilities: 5_000,
  current_liabilities: 1_000,
  deferred_revenue: 1_000,
  total_liabilities: 7_000,
  capital: 2_000,
  surplus: 1_000,
  capital_surplus: 400,
  retained_earnings: 600,
  other_securities_valuation_difference: 0,
  total_net_assets: 3_000
};

describe("buildFinancialStoryModel", () => {
  it("stays aligned with every canonical ETL item code used by the story", () => {
    const current = annualFromMappings(2024, "R6", canonicalValues());
    const previous = annualFromMappings(2023, "R5", previousNetAssetsValues());

    const model = buildFinancialStoryModel(current, previous);

    expect(model.status?.state).toBe("ready");
    expect(model.income?.netIncome).toBe(-50);
    expect(valueOf(model.income?.revenueBreakdown, "other-account-subsidy")).toBe(30);
    expect(model.income?.revenueBreakdown.find((item) => item.id === "other-account-subsidy")).toMatchObject({
      label: "他会計補助金（営業外収益）",
      note: "損益計算書上の科目。繰出基準内の補助も含むため、基準外繰入金とは一致しません"
    });
    expect(valueOf(model.income?.expenseBreakdown, "treatment-plant")).toBe(150);
    expect(model.balance?.priorNetAssets).toBe(2_800);
  });

  it("maps R6 P&L and balance-sheet rows and signs a net loss", () => {
    const current = annual(2024, "R6", "legal_applied", CURRENT_VALUES);
    const previous = annual(2023, "R5", "legal_applied", previousNetAssetsValues());

    const model = buildFinancialStoryModel(current, previous);

    expect(model.year).toBe("R6");
    expect(model.accountingType).toBe("legal_applied");
    expect(model.status).toMatchObject({ state: "ready" });
    expect(model.income).toMatchObject({
      totalRevenue: 1_000,
      totalExpense: 1_050,
      operatingRevenue: 700,
      nonOperatingRevenue: 290,
      extraordinaryProfit: 10,
      operatingExpense: 900,
      nonOperatingExpense: 150,
      extraordinaryLoss: 0,
      netIncome: -50
    });
    expect(valueOf(model.income?.revenueBreakdown, "other-account-subsidy")).toBe(30);
    expect(valueOf(model.income?.revenueBreakdown, "deferred-revenue-return")).toBe(120);
    expect(valueOf(model.income?.expenseBreakdown, "treatment-plant")).toBe(150);
    expect(model.balance).toEqual({
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
    });
    expect(model.trace).toHaveLength(4);
    expect(model.trace?.map((trace) => trace.table)).toEqual(expect.arrayContaining([
      "第20表 損益計算書",
      "第21表 費用構成表",
      "第22表 貸借対照表"
    ]));
    expect(model.trace?.some((trace) => trace.note === "前年度末の純資産と内訳の比較に使用")).toBe(true);
  });

  it("does not show accrual statements for a law-non-applied business", () => {
    const model = buildFinancialStoryModel(
      annual(2024, "R6", "non_legal_applied", { total_revenue: 1_000, total_expense: 900 })
    );

    expect(model.accountingType).toBe("non_legal_applied");
    expect(model.income).toBeNull();
    expect(model.balance).toBeNull();
    expect(model.status).toMatchObject({ state: "unavailable", label: "法非適用は財務図の対象外" });
  });

  it("keeps available totals but marks missing detail and R5 net assets as partial", () => {
    const model = buildFinancialStoryModel(
      annual(2024, null, "法適用", {
        total_revenue: 800,
        total_expense: 820,
        total_assets: 5_000,
        total_liabilities: 3_500,
        total_net_assets: 1_500
      })
    );

    expect(model.year).toBe("R6");
    expect(model.status?.state).toBe("partial");
    expect(model.income?.totalRevenue).toBe(800);
    expect(model.balance?.totalAssets).toBe(5_000);
    expect(model.balance?.priorNetAssets).toBeNull();
  });

  it("does not mark the model ready when the matching prior year lacks net-assets components", () => {
    const model = buildFinancialStoryModel(
      annual(2024, "R6", "legal_applied", CURRENT_VALUES),
      annual(2023, "R5", "legal_applied", { total_net_assets: 2_800 })
    );

    expect(model.balance?.priorNetAssets).toBe(2_800);
    expect(model.status).toMatchObject({ state: "partial" });
    expect(model.status?.message).toContain("前年度末の純資産内訳が未取得");
  });

  it("rejects an R5 net-assets row from another business", () => {
    const current = {
      ...annual(2024, "R6", "legal_applied", CURRENT_VALUES),
      sewerBusinessId: 10,
      businessKey: "17-1-000"
    };
    const previous = {
      ...annual(2023, "R5", "legal_applied", { total_net_assets: 2_800 }),
      sewerBusinessId: 11,
      businessKey: "17-2-000"
    };

    const model = buildFinancialStoryModel(current, previous);

    expect(model.balance?.priorNetAssets).toBeNull();
    expect(model.status?.state).toBe("partial");
    expect(model.trace).toHaveLength(3);
  });

  it("ignores malformed trace JSON and unsafe source URLs", () => {
    const current = annual(2024, "R6", "legal_applied", { total_revenue: 1, total_expense: 1 });
    current.financialStatementItems[0] = {
      ...current.financialStatementItems[0],
      sourceTraceJson: "{broken",
      sourceFile: { tableNo: 20, tableName: "第20表", sourceUrl: "javascript:alert(1)" }
    };

    const model = buildFinancialStoryModel(current);

    expect(model.trace?.[0]?.sourceUrl).toBeUndefined();
    expect(model.status?.state).toBe("partial");
  });
});

function annual(
  surveyYear: number,
  fiscalYearLabel: string | null,
  accountingType: string,
  values: Record<string, number>
): FinancialStoryAnnualInput {
  return {
    sewerBusinessId: 10,
    businessKey: "17-1-000",
    surveyYear,
    fiscalYearLabel,
    accountingType,
    financialStatementItems: Object.entries(values).map(([itemCode, amount], index) => item(itemCode, amount, surveyYear, index))
  };
}

function annualFromMappings(
  surveyYear: number,
  fiscalYearLabel: string,
  values: Record<string, number>
): FinancialStoryAnnualInput {
  const mappings = Object.values(FINANCIAL_STATEMENT_MAPPINGS).flat();
  return {
    sewerBusinessId: 10,
    businessKey: "17-1-000",
    surveyYear,
    fiscalYearLabel,
    accountingType: "legal_applied",
    financialStatementItems: mappings
      .filter((mapping) => Object.hasOwn(values, mapping.itemCode))
      .map((mapping, index) => ({
        ...item(mapping.itemCode, values[mapping.itemCode], surveyYear, index),
        statementType: mapping.statementType,
        section: mapping.section,
        label: mapping.label,
        tableNo: mapping.tableNo
      }))
  };
}

function canonicalValues() {
  return {
    total_revenue: 1_000,
    operating_revenue: 700,
    non_operating_revenue: 290,
    sewer_fee_revenue: 500,
    rainwater_burden_revenue: 100,
    other_operating_revenue: 40,
    national_subsidy_revenue: 50,
    prefectural_subsidy_revenue: 20,
    other_account_subsidy_revenue: 30,
    deferred_revenue_reversal: 120,
    capital_cost_transfer_revenue: 20,
    miscellaneous_non_operating_revenue: 50,
    extraordinary_profit: 10,
    total_expense: 1_050,
    operating_expense: 900,
    non_operating_expense: 150,
    pipeline_expense: 100,
    pump_station_expense: 50,
    treatment_plant_expense: 150,
    outsourced_construction_expense: 0,
    business_expense: 50,
    general_administration_expense: 100,
    depreciation_expense: 400,
    asset_retirement_expense: 20,
    regional_sewerage_operating_expense: 0,
    other_operating_expense: 30,
    interest_expense: 50,
    other_non_operating_expense: 100,
    extraordinary_loss: 0,
    net_profit: 0,
    net_loss: 50,
    personnel_cost_total: 100,
    interest_cost_total: 50,
    depreciation_cost: 300,
    power_cost: 10,
    water_and_utilities_cost: 20,
    communications_transport_cost: 30,
    repair_cost: 40,
    materials_cost: 50,
    chemical_cost: 60,
    road_restoration_cost: 70,
    outsourcing_cost: 150,
    regional_sewerage_contribution: 100,
    other_cost: 70,
    total_cost: 1_050,
    fixed_assets: 8_000,
    current_assets: 2_000,
    deferred_assets: 0,
    total_assets: 10_000,
    fixed_liabilities: 5_000,
    current_liabilities: 1_000,
    deferred_revenue: 1_000,
    total_liabilities: 7_000,
    capital: 2_000,
    surplus: 1_000,
    capital_surplus: 400,
    retained_earnings: 600,
    other_securities_valuation_difference: 0,
    total_net_assets: 3_000
  };
}

function previousNetAssetsValues() {
  return {
    capital: 1_900,
    surplus: 900,
    capital_surplus: 400,
    retained_earnings: 500,
    other_securities_valuation_difference: 0,
    total_net_assets: 2_800
  };
}

function item(itemCode: string, amount: number, surveyYear: number, index: number): FinancialStatementItemInput {
  const tableNo = tableFor(itemCode);
  const tableName = {
    20: "第20表 損益計算書",
    21: "第21表 費用構成表",
    22: "第22表 貸借対照表"
  }[tableNo];
  return {
    id: `${surveyYear}-${index}`,
    statementType: tableNo === 22 ? "balance_sheet" : tableNo === 21 ? "cost_composition" : "income_statement",
    itemCode,
    label: itemCode,
    amount,
    tableNo,
    sourceTraceJson: JSON.stringify({ cellAddress: `A${index + 1}` }),
    sourceFile: {
      id: `${surveyYear}-${tableNo}`,
      tableNo,
      tableName,
      sourceUrl: `https://www.e-stat.go.jp/example/${surveyYear}/${tableNo}`,
      governmentStatName: "地方公営企業決算状況調査"
    }
  };
}

function tableFor(itemCode: string): 20 | 21 | 22 {
  if (/assets|liabilities|deferred_revenue$|capital|surplus|retained_earnings|securities_valuation/.test(itemCode)) return 22;
  if (/cost/.test(itemCode)) return 21;
  return 20;
}

function valueOf(items: Array<{ id?: string; value?: number | null }> | undefined, id: string) {
  return items?.find((item) => item.id === id)?.value;
}
