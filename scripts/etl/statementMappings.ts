export const FINANCIAL_STATEMENT_TABLES = [20, 21, 22] as const;

export type FinancialStatementTableNo = (typeof FINANCIAL_STATEMENT_TABLES)[number];
export type FinancialStatementType = "income_statement" | "cost_composition" | "balance_sheet";

export type FinancialStatementMapping = {
  tableNo: FinancialStatementTableNo;
  statementType: FinancialStatementType;
  section: string;
  itemCode: string;
  label: string;
  rowNo: 1;
  colNo: number;
  parentItemCode?: string;
  displayOrder: number;
  unit: "thousand_yen";
};

const item = (
  tableNo: FinancialStatementTableNo,
  statementType: FinancialStatementType,
  section: string,
  itemCode: string,
  label: string,
  colNo: number,
  displayOrder: number,
  parentItemCode?: string
): FinancialStatementMapping => ({
  tableNo,
  statementType,
  section,
  itemCode,
  label,
  rowNo: 1,
  colNo,
  parentItemCode,
  displayOrder,
  unit: "thousand_yen"
});

export const INCOME_STATEMENT_MAPPINGS = [
  item(20, "income_statement", "revenue", "total_revenue", "総収益", 1, 10),
  item(20, "income_statement", "revenue", "operating_revenue", "営業収益", 2, 20, "total_revenue"),
  item(20, "income_statement", "revenue", "sewer_fee_revenue", "下水道使用料", 3, 30, "operating_revenue"),
  item(20, "income_statement", "revenue", "rainwater_burden_revenue", "雨水処理負担金", 8, 40, "operating_revenue"),
  item(20, "income_statement", "revenue", "other_operating_revenue", "その他営業収益", 12, 50, "operating_revenue"),
  item(20, "income_statement", "revenue", "non_operating_revenue", "営業外収益", 15, 60, "total_revenue"),
  item(20, "income_statement", "revenue", "national_subsidy_revenue", "国庫補助金", 18, 70, "non_operating_revenue"),
  item(20, "income_statement", "revenue", "prefectural_subsidy_revenue", "都道府県補助金", 19, 80, "non_operating_revenue"),
  item(20, "income_statement", "revenue", "other_account_subsidy_revenue", "他会計補助金", 20, 90, "non_operating_revenue"),
  item(20, "income_statement", "revenue", "deferred_revenue_reversal", "長期前受金戻入", 22, 100, "non_operating_revenue"),
  item(20, "income_statement", "revenue", "capital_cost_transfer_revenue", "資本費繰入収益", 23, 110, "non_operating_revenue"),
  item(20, "income_statement", "revenue", "miscellaneous_non_operating_revenue", "雑収益", 24, 120, "non_operating_revenue"),

  item(20, "income_statement", "expense", "total_expense", "総費用", 25, 200),
  item(20, "income_statement", "expense", "operating_expense", "営業費用", 26, 210, "total_expense"),
  item(20, "income_statement", "expense", "pipeline_expense", "管渠費", 27, 220, "operating_expense"),
  item(20, "income_statement", "expense", "pump_station_expense", "ポンプ場費", 28, 230, "operating_expense"),
  item(20, "income_statement", "expense", "treatment_plant_expense", "処理場費", 29, 240, "operating_expense"),
  item(20, "income_statement", "expense", "outsourced_construction_expense", "受託工事費", 33, 250, "operating_expense"),
  item(20, "income_statement", "expense", "business_expense", "業務費", 34, 260, "operating_expense"),
  item(20, "income_statement", "expense", "general_administration_expense", "総係費", 35, 270, "operating_expense"),
  item(20, "income_statement", "expense", "depreciation_expense", "減価償却費", 36, 280, "operating_expense"),
  item(20, "income_statement", "expense", "asset_retirement_expense", "資産減耗費", 37, 290, "operating_expense"),
  item(20, "income_statement", "expense", "regional_sewerage_operating_expense", "流域下水道管理運営費", 38, 300, "operating_expense"),
  item(20, "income_statement", "expense", "other_operating_expense", "その他営業費用", 39, 310, "operating_expense"),
  item(20, "income_statement", "expense", "non_operating_expense", "営業外費用", 40, 320, "total_expense"),
  item(20, "income_statement", "expense", "interest_expense", "支払利息", 41, 330, "non_operating_expense"),
  item(20, "income_statement", "expense", "other_non_operating_expense", "その他営業外費用", 45, 340, "non_operating_expense"),

  item(20, "income_statement", "result", "ordinary_profit", "経常利益", 46, 400),
  item(20, "income_statement", "result", "ordinary_loss", "経常損失", 47, 410),
  item(20, "income_statement", "result", "extraordinary_profit", "特別利益", 48, 420),
  item(20, "income_statement", "result", "extraordinary_loss", "特別損失", 52, 430),
  item(20, "income_statement", "result", "net_profit", "当年度純利益", 55, 440),
  item(20, "income_statement", "result", "net_loss", "当年度純損失", 56, 450)
] as const satisfies readonly FinancialStatementMapping[];

export const COST_COMPOSITION_MAPPINGS = [
  item(21, "cost_composition", "cost", "personnel_cost_total", "職員給与費計", 6, 10, "total_cost"),
  item(21, "cost_composition", "cost", "interest_cost_total", "支払利息計", 7, 20, "total_cost"),
  item(21, "cost_composition", "cost", "depreciation_cost", "減価償却費", 11, 30, "total_cost"),
  item(21, "cost_composition", "cost", "power_cost", "動力費", 12, 40, "total_cost"),
  item(21, "cost_composition", "cost", "water_and_utilities_cost", "水道光熱費", 13, 50, "total_cost"),
  item(21, "cost_composition", "cost", "communications_transport_cost", "通信運搬費", 14, 60, "total_cost"),
  item(21, "cost_composition", "cost", "repair_cost", "修繕費", 15, 70, "total_cost"),
  item(21, "cost_composition", "cost", "materials_cost", "材料費", 16, 80, "total_cost"),
  item(21, "cost_composition", "cost", "chemical_cost", "薬品費", 17, 90, "total_cost"),
  item(21, "cost_composition", "cost", "road_restoration_cost", "路面復旧費", 18, 100, "total_cost"),
  item(21, "cost_composition", "cost", "outsourcing_cost", "委託料", 19, 110, "total_cost"),
  item(21, "cost_composition", "cost", "regional_sewerage_contribution", "流域下水道管理運営費負担金", 27, 120, "total_cost"),
  item(21, "cost_composition", "cost", "other_cost", "その他", 28, 130, "total_cost"),
  item(21, "cost_composition", "cost", "total_cost", "費用合計", 29, 140)
] as const satisfies readonly FinancialStatementMapping[];

export const BALANCE_SHEET_MAPPINGS = [
  item(22, "balance_sheet", "asset", "fixed_assets", "固定資産", 1, 10, "total_assets"),
  item(22, "balance_sheet", "asset", "tangible_fixed_assets", "有形固定資産", 2, 20, "fixed_assets"),
  item(22, "balance_sheet", "asset", "intangible_fixed_assets", "無形固定資産", 9, 30, "fixed_assets"),
  item(22, "balance_sheet", "asset", "investments_and_other_assets", "投資その他の資産", 10, 40, "fixed_assets"),
  item(22, "balance_sheet", "asset", "current_assets", "流動資産", 14, 50, "total_assets"),
  item(22, "balance_sheet", "asset", "cash_and_deposits", "現金・預金", 15, 60, "current_assets"),
  item(22, "balance_sheet", "asset", "receivables", "未収金", 16, 70, "current_assets"),
  item(22, "balance_sheet", "asset", "deferred_assets", "繰延資産", 20, 80, "total_assets"),
  item(22, "balance_sheet", "asset", "total_assets", "資産合計", 21, 90),

  item(22, "balance_sheet", "liability", "fixed_liabilities", "固定負債", 22, 200, "total_liabilities"),
  item(22, "balance_sheet", "liability", "current_liabilities", "流動負債", 31, 210, "total_liabilities"),
  item(22, "balance_sheet", "liability", "deferred_revenue", "繰延収益", 42, 220, "total_liabilities"),
  item(22, "balance_sheet", "liability", "total_liabilities", "負債合計", 49, 230),

  item(22, "balance_sheet", "net_assets", "capital", "資本金", 50, 300, "total_net_assets"),
  item(22, "balance_sheet", "net_assets", "surplus", "剰余金", 55, 310, "total_net_assets"),
  item(22, "balance_sheet", "net_assets", "capital_surplus", "資本剰余金", 56, 320, "surplus"),
  item(22, "balance_sheet", "net_assets", "retained_earnings", "利益剰余金", 62, 330, "surplus"),
  item(22, "balance_sheet", "net_assets", "unappropriated_retained_earnings", "当年度未処分利益剰余金", 67, 340, "retained_earnings"),
  item(22, "balance_sheet", "net_assets", "unprocessed_deficit", "当年度未処理欠損金", 68, 350, "retained_earnings"),
  item(22, "balance_sheet", "net_assets", "current_net_profit", "当年度純利益", 69, 360, "unappropriated_retained_earnings"),
  item(22, "balance_sheet", "net_assets", "current_net_loss", "当年度純損失", 70, 370, "unprocessed_deficit"),
  item(22, "balance_sheet", "net_assets", "other_securities_valuation_difference", "その他有価証券評価差額", 71, 375, "total_net_assets"),
  item(22, "balance_sheet", "net_assets", "total_net_assets", "資本合計（純資産）", 72, 380),
  item(22, "balance_sheet", "total", "total_liabilities_and_net_assets", "負債・資本合計", 73, 400)
] as const satisfies readonly FinancialStatementMapping[];

export const FINANCIAL_STATEMENT_MAPPINGS = {
  20: INCOME_STATEMENT_MAPPINGS,
  21: COST_COMPOSITION_MAPPINGS,
  22: BALANCE_SHEET_MAPPINGS
} as const satisfies Record<FinancialStatementTableNo, readonly FinancialStatementMapping[]>;

export const FINANCIAL_STATEMENT_ITEM_CODES = Object.freeze(
  Object.fromEntries(
    Object.values(FINANCIAL_STATEMENT_MAPPINGS)
      .flat()
      .map((mapping) => [mapping.itemCode, mapping.itemCode])
  )
) as Readonly<Record<string, string>>;

export function mappingsForFinancialStatementTable(tableNo: number) {
  if (!FINANCIAL_STATEMENT_TABLES.includes(tableNo as FinancialStatementTableNo)) return [];
  return FINANCIAL_STATEMENT_MAPPINGS[tableNo as FinancialStatementTableNo];
}
