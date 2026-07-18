import type {
  FinancialBalance,
  FinancialBreakdownItem,
  FinancialIncome,
  FinancialStoryDisplayModel,
  FinancialTraceItem
} from "@/lib/financialStory";
import { FINANCIAL_STATEMENT_ITEM_CODES as ETL_ITEM_CODES } from "@/scripts/etl/statementMappings";

export const FINANCIAL_STATEMENT_ITEM_CODES = {
  totalRevenue: ETL_ITEM_CODES.total_revenue,
  operatingRevenue: ETL_ITEM_CODES.operating_revenue,
  nonOperatingRevenue: ETL_ITEM_CODES.non_operating_revenue,
  sewerFeeRevenue: ETL_ITEM_CODES.sewer_fee_revenue,
  rainwaterBurdenRevenue: ETL_ITEM_CODES.rainwater_burden_revenue,
  otherOperatingRevenue: ETL_ITEM_CODES.other_operating_revenue,
  nationalSubsidyRevenue: ETL_ITEM_CODES.national_subsidy_revenue,
  prefectureSubsidyRevenue: ETL_ITEM_CODES.prefectural_subsidy_revenue,
  otherAccountSubsidyRevenue: ETL_ITEM_CODES.other_account_subsidy_revenue,
  longTermDeferredRevenueReturn: ETL_ITEM_CODES.deferred_revenue_reversal,
  capitalCostTransferRevenue: ETL_ITEM_CODES.capital_cost_transfer_revenue,
  miscellaneousNonOperatingRevenue: ETL_ITEM_CODES.miscellaneous_non_operating_revenue,
  extraordinaryProfit: ETL_ITEM_CODES.extraordinary_profit,
  totalExpense: ETL_ITEM_CODES.total_expense,
  operatingExpense: ETL_ITEM_CODES.operating_expense,
  nonOperatingExpense: ETL_ITEM_CODES.non_operating_expense,
  pipelineExpense: ETL_ITEM_CODES.pipeline_expense,
  pumpStationExpense: ETL_ITEM_CODES.pump_station_expense,
  treatmentPlantExpense: ETL_ITEM_CODES.treatment_plant_expense,
  outsourcedConstructionExpense: ETL_ITEM_CODES.outsourced_construction_expense,
  businessExpense: ETL_ITEM_CODES.business_expense,
  generalAdministrationExpense: ETL_ITEM_CODES.general_administration_expense,
  depreciationExpense: ETL_ITEM_CODES.depreciation_expense,
  assetRetirementExpense: ETL_ITEM_CODES.asset_retirement_expense,
  regionalSewerageOperatingExpense: ETL_ITEM_CODES.regional_sewerage_operating_expense,
  otherOperatingExpense: ETL_ITEM_CODES.other_operating_expense,
  interestExpense: ETL_ITEM_CODES.interest_expense,
  otherNonOperatingExpense: ETL_ITEM_CODES.other_non_operating_expense,
  extraordinaryLoss: ETL_ITEM_CODES.extraordinary_loss,
  netProfit: ETL_ITEM_CODES.net_profit,
  netLoss: ETL_ITEM_CODES.net_loss,
  personnelCost: ETL_ITEM_CODES.personnel_cost_total,
  interestCost: ETL_ITEM_CODES.interest_cost_total,
  depreciationCost: ETL_ITEM_CODES.depreciation_cost,
  powerCost: ETL_ITEM_CODES.power_cost,
  utilitiesCost: ETL_ITEM_CODES.water_and_utilities_cost,
  communicationsCost: ETL_ITEM_CODES.communications_transport_cost,
  repairCost: ETL_ITEM_CODES.repair_cost,
  materialCost: ETL_ITEM_CODES.materials_cost,
  chemicalCost: ETL_ITEM_CODES.chemical_cost,
  roadRestorationCost: ETL_ITEM_CODES.road_restoration_cost,
  outsourcingCost: ETL_ITEM_CODES.outsourcing_cost,
  flowSewerBurdenCost: ETL_ITEM_CODES.regional_sewerage_contribution,
  otherCost: ETL_ITEM_CODES.other_cost,
  costTotal: ETL_ITEM_CODES.total_cost,
  fixedAssets: ETL_ITEM_CODES.fixed_assets,
  currentAssets: ETL_ITEM_CODES.current_assets,
  deferredAssets: ETL_ITEM_CODES.deferred_assets,
  totalAssets: ETL_ITEM_CODES.total_assets,
  fixedLiabilities: ETL_ITEM_CODES.fixed_liabilities,
  currentLiabilities: ETL_ITEM_CODES.current_liabilities,
  deferredRevenue: ETL_ITEM_CODES.deferred_revenue,
  totalLiabilities: ETL_ITEM_CODES.total_liabilities,
  capital: ETL_ITEM_CODES.capital,
  surplus: ETL_ITEM_CODES.surplus,
  capitalSurplus: ETL_ITEM_CODES.capital_surplus,
  retainedEarnings: ETL_ITEM_CODES.retained_earnings,
  otherSecuritiesValuationDifference: ETL_ITEM_CODES.other_securities_valuation_difference,
  totalNetAssets: ETL_ITEM_CODES.total_net_assets
} as const;

type FinancialStatementCodeKey = keyof typeof FINANCIAL_STATEMENT_ITEM_CODES;

export type FinancialStatementSourceInput = {
  id?: number | string;
  tableNo?: number | null;
  tableName?: string | null;
  sourceUrl?: string | null;
  fiscalYearLabel?: string | null;
  governmentStatName?: string | null;
  providedStatName?: string | null;
};

export type FinancialStatementItemInput = {
  id?: number | string;
  statementType: string;
  section?: string | null;
  itemCode: string;
  label: string;
  amount: number;
  tableNo?: number | null;
  sourceTraceJson?: string | null;
  sourceFile?: FinancialStatementSourceInput | null;
};

export type FinancialStoryAnnualInput = {
  id?: number | string;
  sewerBusinessId?: number | string;
  businessKey?: string | null;
  surveyYear: number;
  fiscalYearLabel?: string | null;
  accountingType: string | null;
  financialStatementItems: FinancialStatementItemInput[];
};

type ItemIndex = Map<string, FinancialStatementItemInput>;

const CODE_ALIASES: Record<FinancialStatementCodeKey, string[]> = {
  totalRevenue: ["pl_total_revenue", "income_total_revenue"],
  operatingRevenue: ["pl_operating_revenue", "income_operating_revenue"],
  nonOperatingRevenue: ["pl_non_operating_revenue", "income_non_operating_revenue"],
  sewerFeeRevenue: ["sewer_charge_revenue", "sewerage_fee_revenue"],
  rainwaterBurdenRevenue: ["rainwater_burden", "rainwater_treatment_burden_revenue"],
  otherOperatingRevenue: [],
  nationalSubsidyRevenue: ["national_subsidy", "national_treasury_subsidy"],
  prefectureSubsidyRevenue: ["prefecture_subsidy", "prefecture_subsidy_revenue"],
  otherAccountSubsidyRevenue: ["other_account_subsidy", "general_account_subsidy"],
  longTermDeferredRevenueReturn: ["deferred_revenue_return", "long_term_deferred_revenue_return", "long_term_deferred_revenue_reversal"],
  capitalCostTransferRevenue: [],
  miscellaneousNonOperatingRevenue: [],
  extraordinaryProfit: [],
  totalExpense: ["pl_total_expense", "income_total_expense"],
  operatingExpense: ["pl_operating_expense", "income_operating_expense"],
  nonOperatingExpense: ["pl_non_operating_expense", "income_non_operating_expense"],
  pipelineExpense: [],
  pumpStationExpense: [],
  treatmentPlantExpense: [],
  outsourcedConstructionExpense: [],
  businessExpense: [],
  generalAdministrationExpense: [],
  depreciationExpense: [],
  assetRetirementExpense: [],
  regionalSewerageOperatingExpense: [],
  otherOperatingExpense: [],
  interestExpense: [],
  otherNonOperatingExpense: [],
  extraordinaryLoss: [],
  netProfit: ["current_net_profit", "net_income_profit"],
  netLoss: ["current_net_loss", "net_income_loss"],
  personnelCost: ["personnel_cost", "personnel_total"],
  interestCost: ["interest_cost", "interest_total"],
  depreciationCost: ["depreciation", "depreciation_expense"],
  powerCost: ["electricity_cost"],
  utilitiesCost: ["utilities_cost", "fuel_cost", "water_utilities_cost"],
  communicationsCost: ["communications_cost", "communication_cost"],
  repairCost: ["repairs_cost", "repair_expense"],
  materialCost: ["material_cost"],
  chemicalCost: ["chemicals_cost"],
  roadRestorationCost: ["road_repair_cost"],
  outsourcingCost: ["contracting_cost", "outsourced_cost"],
  flowSewerBurdenCost: ["flow_sewer_burden_cost", "regional_sewer_burden_cost", "flow_sewer_burden_expense"],
  otherCost: ["other_expense_composition"],
  costTotal: ["cost_total", "expense_composition_total"],
  fixedAssets: ["bs_fixed_assets"],
  currentAssets: ["bs_current_assets"],
  deferredAssets: ["bs_deferred_assets"],
  totalAssets: ["bs_total_assets", "assets_total"],
  fixedLiabilities: ["bs_fixed_liabilities"],
  currentLiabilities: ["bs_current_liabilities"],
  deferredRevenue: ["bs_deferred_revenue"],
  totalLiabilities: ["bs_total_liabilities", "liabilities_total"],
  capital: ["capital_stock", "paid_in_capital"],
  surplus: ["total_surplus", "surplus_total"],
  capitalSurplus: ["capital_surplus_total"],
  retainedEarnings: ["retained_earnings_total"],
  otherSecuritiesValuationDifference: ["other_valuation_difference", "securities_valuation_difference"],
  totalNetAssets: ["net_assets_total", "total_capital", "capital_total", "total_equity"]
};

const OPERATIONS_CODES: FinancialStatementCodeKey[] = [
  "powerCost",
  "utilitiesCost",
  "communicationsCost",
  "repairCost",
  "materialCost",
  "chemicalCost",
  "roadRestorationCost"
];

const COMPLETE_CURRENT_CODES: FinancialStatementCodeKey[] = [
  "totalRevenue",
  "operatingRevenue",
  "nonOperatingRevenue",
  "sewerFeeRevenue",
  "rainwaterBurdenRevenue",
  "otherOperatingRevenue",
  "nationalSubsidyRevenue",
  "prefectureSubsidyRevenue",
  "otherAccountSubsidyRevenue",
  "longTermDeferredRevenueReturn",
  "capitalCostTransferRevenue",
  "miscellaneousNonOperatingRevenue",
  "extraordinaryProfit",
  "totalExpense",
  "operatingExpense",
  "nonOperatingExpense",
  "pipelineExpense",
  "pumpStationExpense",
  "treatmentPlantExpense",
  "outsourcedConstructionExpense",
  "businessExpense",
  "generalAdministrationExpense",
  "depreciationExpense",
  "assetRetirementExpense",
  "regionalSewerageOperatingExpense",
  "otherOperatingExpense",
  "interestExpense",
  "otherNonOperatingExpense",
  "extraordinaryLoss",
  "netProfit",
  "netLoss",
  "personnelCost",
  "interestCost",
  "depreciationCost",
  ...OPERATIONS_CODES,
  "outsourcingCost",
  "flowSewerBurdenCost",
  "otherCost",
  "costTotal",
  "fixedAssets",
  "currentAssets",
  "deferredAssets",
  "totalAssets",
  "fixedLiabilities",
  "currentLiabilities",
  "deferredRevenue",
  "totalLiabilities",
  "capital",
  "surplus",
  "capitalSurplus",
  "retainedEarnings",
  "otherSecuritiesValuationDifference",
  "totalNetAssets"
];

const PREVIOUS_NET_ASSET_COMPONENT_CODES: FinancialStatementCodeKey[] = [
  "capital",
  "capitalSurplus",
  "retainedEarnings",
  "otherSecuritiesValuationDifference",
  "totalNetAssets"
];

/**
 * Converts the imported R6 statement rows (and the matching R5 balance-sheet
 * row) into the intentionally small view model consumed by FinancialStory.
 * Monetary amounts remain in the source unit of thousand yen.
 */
export function buildFinancialStoryModel(
  current: FinancialStoryAnnualInput | null | undefined,
  previous?: FinancialStoryAnnualInput | null
): FinancialStoryDisplayModel {
  if (!current) {
    return {
      year: "最新",
      accountingType: null,
      income: null,
      balance: null,
      status: {
        state: "unavailable",
        label: "決算データ未取得",
        message: "対象事業の決算年度を確認できません。"
      },
      trace: []
    };
  }

  const year = current.fiscalYearLabel?.trim() || japaneseFiscalYearLabel(current.surveyYear);
  const accountingType = normalizeAccountingType(current.accountingType);
  const trace = buildTrace(current, previous);

  if (accountingType !== "legal_applied") {
    return {
      year,
      accountingType,
      income: null,
      balance: null,
      status: {
        state: "unavailable",
        label: accountingType === "non_legal_applied" ? "法非適用は財務図の対象外" : "会計区分未確認",
        message: "損益計算書と貸借対照表を共通定義で確認できる法適用事業だけを表示します。"
      },
      trace
    };
  }

  const index = indexItems(current.financialStatementItems);
  const income = buildIncome(index);
  const matchingPrevious = isMatchingPrevious(current, previous) ? previous : null;
  const priorIndex = matchingPrevious ? indexItems(matchingPrevious.financialStatementItems) : null;
  const balance = buildBalance(index, priorIndex);
  const hasIncomeCore = income.totalRevenue != null && income.totalExpense != null;
  const hasBalanceCore = balance.totalAssets != null && balance.totalLiabilities != null && balance.totalNetAssets != null;
  const missingCodes = COMPLETE_CURRENT_CODES.filter((code) => amount(index, code) == null);
  const hasPreviousNetAssets = balance.priorNetAssets != null;
  const hasPreviousNetAssetsComponents = Boolean(
    priorIndex && PREVIOUS_NET_ASSET_COMPONENT_CODES.every((code) => amount(priorIndex, code) != null)
  );

  const status = !hasIncomeCore && !hasBalanceCore
    ? {
        state: "unavailable" as const,
        label: `${year} 決算明細未取得`,
        message: "損益計算書と貸借対照表の主要項目が揃うまで、未取得値を推測値や0円とみなして表示しません。"
      }
    : missingCodes.length === 0 && hasPreviousNetAssetsComponents
      ? {
          state: "ready" as const,
          label: "必要項目取得済み",
          message: "金額は地方公営企業決算状況調査の原表値（千円）から構成しています。"
        }
      : {
          state: "partial" as const,
          label: "一部未取得",
          message: partialMessage({
            hasIncomeCore,
            hasBalanceCore,
            hasPreviousNetAssets,
            hasPreviousNetAssetsComponents,
            missingCount: missingCodes.length
          })
        };

  return {
    year,
    accountingType,
    income,
    balance,
    status,
    trace
  };
}

function buildIncome(index: ItemIndex): FinancialIncome {
  return {
    totalRevenue: amount(index, "totalRevenue"),
    totalExpense: amount(index, "totalExpense"),
    operatingRevenue: amount(index, "operatingRevenue"),
    nonOperatingRevenue: amount(index, "nonOperatingRevenue"),
    extraordinaryProfit: amount(index, "extraordinaryProfit"),
    operatingExpense: amount(index, "operatingExpense"),
    nonOperatingExpense: amount(index, "nonOperatingExpense"),
    extraordinaryLoss: amount(index, "extraordinaryLoss"),
    netIncome: signedNetIncome(index),
    revenueBreakdown: [
      breakdown("sewer-fee", "下水道使用料", amount(index, "sewerFeeRevenue"), "operating", "使用者が支払う料金"),
      breakdown("rainwater-burden", "雨水処理負担金", amount(index, "rainwaterBurdenRevenue"), "operating", "公費で負担する雨水処理分"),
      breakdown("other-operating-revenue", "その他営業収益", amount(index, "otherOperatingRevenue"), "operating"),
      breakdown("national-subsidy", "国庫補助金", amount(index, "nationalSubsidyRevenue"), "non-operating"),
      breakdown("prefectural-subsidy", "都道府県補助金", amount(index, "prefectureSubsidyRevenue"), "non-operating"),
      breakdown(
        "other-account-subsidy",
        "他会計補助金（営業外収益）",
        amount(index, "otherAccountSubsidyRevenue"),
        "non-operating",
        "損益計算書上の科目。繰出基準内の補助も含むため、基準外繰入金とは一致しません"
      ),
      breakdown("deferred-revenue-return", "長期前受金戻入", amount(index, "longTermDeferredRevenueReturn"), "non-operating", "過去の補助金等を減価償却に合わせて収益化した額"),
      breakdown("capital-cost-transfer", "資本費繰入収益", amount(index, "capitalCostTransferRevenue"), "non-operating"),
      breakdown("miscellaneous-revenue", "雑収益", amount(index, "miscellaneousNonOperatingRevenue"), "non-operating"),
      breakdown("extraordinary-profit-detail", "特別利益", amount(index, "extraordinaryProfit"), "extraordinary")
    ],
    expenseBreakdown: [
      breakdown("pipeline", "管渠費", amount(index, "pipelineExpense"), "operating"),
      breakdown("pump-station", "ポンプ場費", amount(index, "pumpStationExpense"), "operating"),
      breakdown("treatment-plant", "処理場費", amount(index, "treatmentPlantExpense"), "operating"),
      breakdown("outsourced-construction", "受託工事費", amount(index, "outsourcedConstructionExpense"), "operating"),
      breakdown("business", "業務費", amount(index, "businessExpense"), "operating"),
      breakdown("administration", "総係費", amount(index, "generalAdministrationExpense"), "operating"),
      breakdown("depreciation", "減価償却費", amount(index, "depreciationExpense"), "operating", "施設の価値を使用年数に配分した費用"),
      breakdown("asset-retirement", "資産減耗費", amount(index, "assetRetirementExpense"), "operating"),
      breakdown("regional-sewerage", "流域下水道管理運営費", amount(index, "regionalSewerageOperatingExpense"), "operating"),
      breakdown("other-operating-expense", "その他営業費用", amount(index, "otherOperatingExpense"), "operating"),
      breakdown("interest", "支払利息", amount(index, "interestExpense"), "non-operating"),
      breakdown("other-non-operating-expense", "その他営業外費用", amount(index, "otherNonOperatingExpense"), "non-operating"),
      breakdown("extraordinary-loss-detail", "特別損失", amount(index, "extraordinaryLoss"), "extraordinary")
    ]
  };
}

function buildBalance(index: ItemIndex, priorIndex: ItemIndex | null): FinancialBalance {
  return {
    fixedAssets: amount(index, "fixedAssets"),
    currentAssets: amount(index, "currentAssets"),
    deferredAssets: amount(index, "deferredAssets"),
    totalAssets: amount(index, "totalAssets"),
    fixedLiabilities: amount(index, "fixedLiabilities"),
    currentLiabilities: amount(index, "currentLiabilities"),
    deferredRevenue: amount(index, "deferredRevenue"),
    totalLiabilities: amount(index, "totalLiabilities"),
    capital: amount(index, "capital"),
    surplus: amount(index, "surplus"),
    capitalSurplus: amount(index, "capitalSurplus"),
    retainedEarnings: amount(index, "retainedEarnings"),
    otherSecuritiesValuationDifference: amount(index, "otherSecuritiesValuationDifference"),
    totalNetAssets: amount(index, "totalNetAssets"),
    priorNetAssets: priorIndex ? amount(priorIndex, "totalNetAssets") : null,
    priorCapital: priorIndex ? amount(priorIndex, "capital") : null,
    priorSurplus: priorIndex ? amount(priorIndex, "surplus") : null,
    priorCapitalSurplus: priorIndex ? amount(priorIndex, "capitalSurplus") : null,
    priorRetainedEarnings: priorIndex ? amount(priorIndex, "retainedEarnings") : null,
    priorOtherSecuritiesValuationDifference: priorIndex ? amount(priorIndex, "otherSecuritiesValuationDifference") : null
  };
}

function indexItems(items: FinancialStatementItemInput[]): ItemIndex {
  const index: ItemIndex = new Map();
  for (const item of items) {
    if (!Number.isFinite(item.amount)) continue;
    const normalized = normalizeCode(item.itemCode);
    if (normalized && !index.has(normalized)) index.set(normalized, item);
  }
  return index;
}

function amount(index: ItemIndex, code: FinancialStatementCodeKey) {
  const item = findItem(index, code);
  return item && Number.isFinite(item.amount) ? item.amount : null;
}

function findItem(index: ItemIndex, code: FinancialStatementCodeKey) {
  const candidates = [FINANCIAL_STATEMENT_ITEM_CODES[code], ...CODE_ALIASES[code]];
  for (const candidate of candidates) {
    const item = index.get(normalizeCode(candidate));
    if (item) return item;
  }
  return null;
}

function signedNetIncome(index: ItemIndex) {
  const profit = amount(index, "netProfit");
  const loss = amount(index, "netLoss");
  if (profit == null && loss == null) return null;
  return (profit ?? 0) - (loss ?? 0);
}

function breakdown(
  id: string,
  label: string,
  value: number | null,
  group: FinancialBreakdownItem["group"],
  note?: string
): FinancialBreakdownItem {
  return { id, label, value, group, note };
}

function isMatchingPrevious(
  current: FinancialStoryAnnualInput,
  previous: FinancialStoryAnnualInput | null | undefined
): previous is FinancialStoryAnnualInput {
  if (!previous || normalizeAccountingType(previous.accountingType) !== "legal_applied") return false;
  if (previous.surveyYear !== current.surveyYear - 1) return false;
  if (current.sewerBusinessId != null && previous.sewerBusinessId != null && current.sewerBusinessId !== previous.sewerBusinessId) return false;
  if (current.businessKey && previous.businessKey && current.businessKey !== previous.businessKey) return false;
  return true;
}

function buildTrace(
  current: FinancialStoryAnnualInput,
  previous: FinancialStoryAnnualInput | null | undefined
): FinancialTraceItem[] {
  const rows: Array<{ annual: FinancialStoryAnnualInput; item: FinancialStatementItemInput; previous: boolean }> = current.financialStatementItems
    .map((item) => ({ annual: current, item, previous: false }));

  if (isMatchingPrevious(current, previous)) {
    const previousIndex = indexItems(previous.financialStatementItems);
    const previousComparisonCodes: FinancialStatementCodeKey[] = [
      "capital",
      "capitalSurplus",
      "retainedEarnings",
      "otherSecuritiesValuationDifference",
      "totalNetAssets"
    ];
    for (const code of previousComparisonCodes) {
      const item = findItem(previousIndex, code);
      if (item) rows.push({ annual: previous, item, previous: true });
    }
  }

  const traces = new Map<string, FinancialTraceItem>();
  for (const row of rows) {
    const parsed = parseTrace(row.item.sourceTraceJson);
    const source = row.item.sourceFile;
    const tableNo = source?.tableNo ?? row.item.tableNo ?? parsed.tableNo;
    const tableName = cleanText(source?.tableName) ?? cleanText(parsed.tableName);
    const sourceUrl = safeSourceUrl(source?.sourceUrl ?? parsed.sourceUrl);
    const sourceId = source?.id ?? parsed.sourceFileId;
    const table = tableName
      ? tableNo != null && !tableName.includes(String(tableNo))
        ? `第${tableNo}表 ${tableName}`
        : tableName
      : tableNo == null
        ? undefined
        : `第${tableNo}表`;
    const traceKey = [sourceId ?? "", sourceUrl ?? "", tableNo ?? "", table ?? "", row.annual.surveyYear].join("|");
    if (traces.has(traceKey)) continue;

    const fiscalLabel = row.annual.fiscalYearLabel?.trim() || japaneseFiscalYearLabel(row.annual.surveyYear);
    const surveyName = cleanText(source?.governmentStatName)
      ?? cleanText(source?.providedStatName)
      ?? cleanText(parsed.sourceLabel)
      ?? "地方公営企業決算状況調査";
    traces.set(traceKey, {
      id: sourceId == null ? traceKey : `${sourceId}-${row.annual.surveyYear}-${tableNo ?? "table"}`,
      label: `${fiscalLabel} ${surveyName}`,
      table,
      sourceUrl,
      note: row.previous ? "前年度末の純資産と内訳の比較に使用" : undefined
    });
  }

  return [...traces.values()].sort((a, b) => {
    const yearOrder = b.label.localeCompare(a.label, "ja");
    return yearOrder || (a.table ?? "").localeCompare(b.table ?? "", "ja", { numeric: true });
  });
}

function parseTrace(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return {} as Record<string, unknown>;
    return parsed as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function partialMessage({
  hasIncomeCore,
  hasBalanceCore,
  hasPreviousNetAssets,
  hasPreviousNetAssetsComponents,
  missingCount
}: {
  hasIncomeCore: boolean;
  hasBalanceCore: boolean;
  hasPreviousNetAssets: boolean;
  hasPreviousNetAssetsComponents: boolean;
  missingCount: number;
}) {
  const messages: string[] = [];
  if (!hasIncomeCore) messages.push("損益の主要項目が未取得です");
  if (!hasBalanceCore) messages.push("貸借の主要項目が未取得です");
  if (missingCount > 0 && hasIncomeCore && hasBalanceCore) messages.push("一部の内訳項目が未取得です");
  if (!hasPreviousNetAssets) messages.push("前年度末の純資産が未取得です");
  else if (!hasPreviousNetAssetsComponents) messages.push("前年度末の純資産内訳が未取得です");
  return `${messages.join("。")}。取得済みの総額と内訳だけを表示します。`;
}

function normalizeAccountingType(value: string | null) {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (["legal_applied", "legal", "law_applied", "法適用"].includes(normalized)) return "legal_applied";
  if (["non_legal_applied", "non_legal", "nonlegal", "law_not_applied", "法非適用"].includes(normalized)) return "non_legal_applied";
  return value?.trim() || null;
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[\s./-]+/g, "_").replace(/_+/g, "_");
}

function japaneseFiscalYearLabel(year: number) {
  return Number.isInteger(year) && year >= 2019 ? `R${year - 2018}` : String(year);
}

function safeSourceUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  return /^https?:\/\//i.test(url) ? url : undefined;
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}
