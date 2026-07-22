export const GOVERNMENT_STAT_CODE = "00200251";
export const GOVERNMENT_STAT_NAME = "地方財政状況調査";
export const PROVIDED_STAT_NAME = "地方公営企業決算状況調査";
export const RECENT_FIVE_YEARS = [2025, 2024, 2023, 2022, 2021];
export const DEFAULT_YEARS = RECENT_FIVE_YEARS;
export const RAW_ESTAT_DIR = "data/raw/e-stat";
export const RAW_MANUAL_DIR = "data/raw/manual";
export const MANUAL_SOURCE_FILES = "data/manual/source_files.csv";
export const MANUAL_REVISION_EVENTS = "data/manual/fee_revision_events.csv";
export const FIELD_MAPPING_FILE = "03_FIELD_MAPPING.yml";

export const TARGET_TABLES = {
  legal_applied: [10, 20, 21, 22, 23, 24, 32, 33, 34, 40, 45],
  non_legal_applied: [10, 21, 24, 26, 32, 33, 34, 40, 45]
} as const;

export const FIELD_LABELS: Record<string, string> = {
  sewerFeeRevenue: "下水道使用料収入",
  householdFee20m3Yen: "一般家庭用20m³／月使用料",
  annualBillableVolume: "年間有収水量",
  wastewaterTreatmentCost: "汚水処理費",
  opexComponent: "汚水処理費_維持管理費分",
  capitalCostComponent: "汚水処理費_資本費分",
  operatingRevenue: "営業収益",
  operatingExpense: "営業費用",
  ordinaryRevenue: "経常収益",
  ordinaryExpense: "経常費用",
  netIncome: "当年度純損益",
  accumulatedDeficit: "累積欠損金",
  totalRevenueNonLegal: "総収益_法非適用",
  totalExpenseNonLegal: "総費用_法非適用",
  realBalance: "実質収支",
  revenueExpenditureRatio: "収益的収支比率",
  generalAccountTransfer: "一般会計繰入金",
  standardTransfer: "基準内繰入金",
  nonStandardTransfer: "基準外繰入金",
  table40RainwaterBurden: "雨水処理負担金（第40表・実繰入額）",
  table40OtherAccountSubsidy: "他会計補助金（第40表・実繰入額）",
  table40CapitalOtherAccountSubsidy: "資本勘定の他会計補助金（第40表・実繰入額）",
  table40RainwaterBurdenNonStandard: "雨水処理負担金（第40表・基準外）",
  table40OtherAccountSubsidyNonStandard: "他会計補助金（第40表・基準外）",
  table40CapitalOtherAccountSubsidyNonStandard: "資本勘定の他会計補助金（第40表・基準外）",
  bondBalance: "企業債・地方債残高",
  bondIssued: "企業債・地方債発行額",
  bondRedemption: "企業債・地方債償還額",
  servicePopulation: "処理区域内人口",
  connectedPopulation: "水洗便所設置済人口",
  treatedVolume: "汚水処理水量"
};

export const STANDARD_FIELD_COLUMNS: Record<string, keyof typeof FIELD_LABELS> = {
  sewer_fee_revenue: "sewerFeeRevenue",
  "下水道使用料収入": "sewerFeeRevenue",
  household_fee_20m3_yen: "householdFee20m3Yen",
  "一般家庭用20m³／月使用料": "householdFee20m3Yen",
  annual_billable_volume: "annualBillableVolume",
  "年間有収水量": "annualBillableVolume",
  wastewater_treatment_cost: "wastewaterTreatmentCost",
  "汚水処理費": "wastewaterTreatmentCost",
  opex_component: "opexComponent",
  "汚水処理費_維持管理費分": "opexComponent",
  capital_cost_component: "capitalCostComponent",
  "汚水処理費_資本費分": "capitalCostComponent",
  operating_revenue: "operatingRevenue",
  "営業収益": "operatingRevenue",
  operating_expense: "operatingExpense",
  "営業費用": "operatingExpense",
  ordinary_revenue: "ordinaryRevenue",
  "経常収益": "ordinaryRevenue",
  ordinary_expense: "ordinaryExpense",
  "経常費用": "ordinaryExpense",
  net_income: "netIncome",
  "当年度純損益": "netIncome",
  accumulated_deficit: "accumulatedDeficit",
  "累積欠損金": "accumulatedDeficit",
  total_revenue_non_legal: "totalRevenueNonLegal",
  "総収益_法非適用": "totalRevenueNonLegal",
  total_expense_non_legal: "totalExpenseNonLegal",
  "総費用_法非適用": "totalExpenseNonLegal",
  real_balance: "realBalance",
  "実質収支": "realBalance",
  revenue_expenditure_ratio: "revenueExpenditureRatio",
  "収益的収支比率": "revenueExpenditureRatio",
  general_account_transfer: "generalAccountTransfer",
  "一般会計繰入金": "generalAccountTransfer",
  standard_transfer: "standardTransfer",
  "基準内繰入金": "standardTransfer",
  non_standard_transfer: "nonStandardTransfer",
  "基準外繰入金": "nonStandardTransfer",
  table40_rainwater_burden: "table40RainwaterBurden",
  table40_other_account_subsidy: "table40OtherAccountSubsidy",
  table40_capital_other_account_subsidy: "table40CapitalOtherAccountSubsidy",
  table40_rainwater_burden_non_standard: "table40RainwaterBurdenNonStandard",
  table40_other_account_subsidy_non_standard: "table40OtherAccountSubsidyNonStandard",
  table40_capital_other_account_subsidy_non_standard: "table40CapitalOtherAccountSubsidyNonStandard",
  bond_balance: "bondBalance",
  "企業債・地方債残高": "bondBalance",
  bond_issued: "bondIssued",
  "企業債・地方債発行額": "bondIssued",
  bond_redemption: "bondRedemption",
  "企業債・地方債償還額": "bondRedemption",
  service_population: "servicePopulation",
  "処理区域内人口": "servicePopulation",
  connected_population: "connectedPopulation",
  "水洗便所設置済人口": "connectedPopulation",
  treated_volume: "treatedVolume",
  "汚水処理水量": "treatedVolume"
};
