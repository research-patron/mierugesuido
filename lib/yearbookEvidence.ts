import type { FinancialCostComposition } from "@/lib/financialStory";

export type OfficialYearbookRow = {
  rowNumber: number;
  labelCells: string[];
  valueText: string;
  kind: "data" | "heading" | "note";
};

export type OfficialYearbookGroup = {
  id: string;
  title: string;
  workbookUrl: string;
  sheetName: string;
  rows: OfficialYearbookRow[];
};

export type OfficialYearbookBusiness = {
  accountingType: "legal_applied" | "non_legal_applied";
  groups: OfficialYearbookGroup[];
};

export type OfficialRowReference = {
  groupId: string;
  groupNumber: number;
  groupTitle: string;
  workbookUrl: string;
  sheetName: string;
  rowNumber: number;
  label: string;
  valueText: string;
};

export type OfficialValueComparison = "exact" | "dash_as_zero" | "mismatch" | "not_comparable";

type RowRule = {
  groupNumber: number;
  pattern: RegExp;
  occurrence?: "first" | "second" | "last";
};

const LEGAL_APPLIED_ROW_RULES: Record<string, RowRule> = {
  householdFee20m3Yen: {
    groupNumber: 2,
    pattern: /一般家庭用20m3.*月.*円/
  },
  sewerFeeRevenue: {
    groupNumber: 3,
    pattern: /^ア下水道使用料$/
  },
  annualBillableVolume: {
    groupNumber: 1,
    pattern: /年間有収水量/
  },
  wastewaterTreatmentCost: {
    groupNumber: 2,
    pattern: /内訳汚水処理費.*千円/,
    occurrence: "last"
  },
  opexComponent: {
    groupNumber: 2,
    pattern: /内訳汚水処理費.*千円/,
    occurrence: "first"
  },
  capitalCostComponent: {
    groupNumber: 2,
    pattern: /内訳汚水処理費.*千円/,
    occurrence: "second"
  },
  ordinaryProfitLoss: {
    groupNumber: 3,
    pattern: /経常利益又は経常損失/
  },
  netIncome: {
    groupNumber: 3,
    pattern: /純利益又は純損失/
  },
  operatingRevenue: {
    groupNumber: 3,
    pattern: /営業収益B$/
  },
  operatingExpense: {
    groupNumber: 3,
    pattern: /営業費用F$/
  },
  servicePopulation: {
    groupNumber: 1,
    pattern: /現在処理区域内人口/
  },
  connectedPopulation: {
    groupNumber: 1,
    pattern: /現在水洗便所設置済人口/
  },
  treatedVolume: {
    groupNumber: 1,
    pattern: /汚水処理水量/
  }
};

const COST_COMPOSITION_ROW_RULES: Record<string, RowRule> = {
  personnel: { groupNumber: 2, pattern: /^\(6\)計\(千円\)$/ },
  interest: { groupNumber: 2, pattern: /^2\.支払利息\(千円\)$/ },
  depreciation: { groupNumber: 2, pattern: /^3\.減価償却費\(千円\)$/ },
  power: { groupNumber: 2, pattern: /^4\.動力費\(千円\)$/ },
  utilities: { groupNumber: 2, pattern: /^5\.光熱水費\(千円\)$/ },
  communications: { groupNumber: 2, pattern: /^6\.通信運搬費\(千円\)$/ },
  repair: { groupNumber: 2, pattern: /^7\.修繕費\(千円\)$/ },
  materials: { groupNumber: 2, pattern: /^8\.材料費\(千円\)$/ },
  chemicals: { groupNumber: 2, pattern: /^9\.薬品費\(千円\)$/ },
  "road-restoration": { groupNumber: 2, pattern: /^10\.路面復旧費\(千円\)$/ },
  outsourcing: { groupNumber: 2, pattern: /^11\.委託料\(千円\)$/ },
  "regional-sewerage-contribution": {
    groupNumber: 2,
    pattern: /^12\.流域下水道管理運営費負担金\(千円\)$/
  },
  other: { groupNumber: 2, pattern: /^13\.その他\(千円\)$/ },
  total: { groupNumber: 2, pattern: /^14\.費用合計\(千円\)$/ }
};

export function resolveOfficialRowReference(
  business: OfficialYearbookBusiness | null | undefined,
  field: string
): OfficialRowReference | null {
  if (!business || business.accountingType !== "legal_applied") return null;
  const rule = LEGAL_APPLIED_ROW_RULES[field];
  if (!rule) return null;
  const group = business.groups.find((candidate) => groupNumber(candidate.id) === rule.groupNumber);
  if (!group) return null;
  const matches = group.rows.filter((row) => rule.pattern.test(normalizedLabel(row)));
  const row = selectOccurrence(matches, rule.occurrence);
  if (!row) return null;
  return {
    groupId: group.id,
    groupNumber: rule.groupNumber,
    groupTitle: group.title,
    workbookUrl: group.workbookUrl,
    sheetName: group.sheetName,
    rowNumber: row.rowNumber,
    label: row.labelCells.filter(Boolean).join("　"),
    valueText: row.valueText
  };
}

export function resolveOfficialCostCompositionReference(
  business: OfficialYearbookBusiness | null | undefined,
  itemId: string
): OfficialRowReference | null {
  if (!business || business.accountingType !== "legal_applied") return null;
  const rule = COST_COMPOSITION_ROW_RULES[itemId];
  if (!rule) return null;
  const group = business.groups.find((candidate) => groupNumber(candidate.id) === rule.groupNumber);
  if (!group) return null;
  const matches = group.rows.filter((row) => rule.pattern.test(normalizedLabel(row)));
  const row = selectOccurrence(matches, rule.occurrence);
  if (!row) return null;
  return {
    groupId: group.id,
    groupNumber: rule.groupNumber,
    groupTitle: group.title,
    workbookUrl: group.workbookUrl,
    sheetName: group.sheetName,
    rowNumber: row.rowNumber,
    label: row.labelCells.filter(Boolean).join("　"),
    valueText: row.valueText
  };
}

export function assertCostCompositionMatchesOfficial(
  business: OfficialYearbookBusiness | null | undefined,
  composition: FinancialCostComposition
) {
  if (!business || business.accountingType !== "legal_applied") return null;
  const values = [
    ...composition.items.map((item) => ({ id: item.id, value: item.value })),
    { id: "total", value: composition.total }
  ];
  if (values.length !== 14 || new Set(values.map((item) => item.id)).size !== 14) {
    throw new Error("費用構成の13費目と費用合計が揃っていません");
  }

  let firstReference: OfficialRowReference | null = null;
  for (const item of values) {
    const reference = resolveOfficialCostCompositionReference(business, item.id);
    if (!reference) return null;
    const comparison = compareOfficialValue(item.value, reference, 0);
    if (comparison === "mismatch" || comparison === "not_comparable") {
      throw new Error(
        `${item.id}: 第21表の値と公式個表が一致しません `
          + `(第21表=${String(item.value)}, 個表=${reference.valueText}, 個表（2）${reference.rowNumber}行)`
      );
    }
    firstReference ??= reference;
  }

  return firstReference ? {
    checked: values.length,
    groupTitle: firstReference.groupTitle,
    workbookUrl: firstReference.workbookUrl,
    sheetName: firstReference.sheetName
  } : null;
}

export function resolvePublishedCalculationReference(
  business: OfficialYearbookBusiness | null | undefined,
  metric: "feeUnitPrice" | "treatmentCost" | "expenseRecoveryRate"
) {
  if (!business || business.accountingType !== "legal_applied") return null;
  const patterns = {
    feeUnitPrice: /使用料単価.*円.*m3/,
    treatmentCost: /汚水処理原価.*円.*m3/,
    expenseRecoveryRate: /汚水処理費に対する使用料の割合/
  };
  const group = business.groups.find((candidate) => groupNumber(candidate.id) === 2);
  const row = group?.rows.find((candidate) => patterns[metric].test(normalizedLabel(candidate)));
  if (!group || !row) return null;
  return {
    groupId: group.id,
    groupNumber: 2,
    groupTitle: group.title,
    workbookUrl: group.workbookUrl,
    sheetName: group.sheetName,
    rowNumber: row.rowNumber,
    label: row.labelCells.filter(Boolean).join("　"),
    valueText: row.valueText
  } satisfies OfficialRowReference;
}

export function compareOfficialValue(
  expected: unknown,
  reference: OfficialRowReference | null,
  precision = 0
): OfficialValueComparison {
  const expectedNumber = typeof expected === "number" ? expected : Number(expected);
  if (!reference || !Number.isFinite(expectedNumber)) return "not_comparable";
  const official = parseOfficialNumber(reference.valueText);
  if (official == null) {
    return expectedNumber === 0 && reference.valueText.trim() === "-" ? "dash_as_zero" : "not_comparable";
  }
  return roundTo(expectedNumber, precision) === roundTo(official, precision) ? "exact" : "mismatch";
}

export function assertMappedEvidenceMatchesOfficial(
  business: OfficialYearbookBusiness | null | undefined,
  entries: Array<[string, { value?: unknown }]>
) {
  if (!business || business.accountingType !== "legal_applied") return 0;
  let checked = 0;
  for (const [field, item] of entries) {
    if (!LEGAL_APPLIED_ROW_RULES[field]) continue;
    const reference = resolveOfficialRowReference(business, field);
    if (!reference) continue;
    const comparison = compareOfficialValue(item?.value, reference, 0);
    if (comparison === "mismatch" || comparison === "not_comparable") {
      throw new Error(
        `${field}: 計算用の値と公式個表が一致しません `
          + `(計算用=${String(item?.value)}, 個表=${reference.valueText}, ${reference.groupNumber}表${reference.rowNumber}行)`
      );
    }
    checked += 1;
  }
  return checked;
}

export function officialSourceNote(field: string, tableNo?: number | null) {
  if (LEGAL_APPLIED_ROW_RULES[field]) return null;
  if (tableNo === 40) {
    return "この値は「12．個表」ではなく、地方公営企業決算状況調査の第40表から直接取得しています。";
  }
  return "この項目は、表示中の「12．個表」に同一項目の対応行がないため、記載したe-Stat原資料から取得しています。";
}

function normalizedLabel(row: OfficialYearbookRow) {
  return row.labelCells.join("").normalize("NFKC").replace(/[\s　]/g, "");
}

function selectOccurrence(rows: OfficialYearbookRow[], occurrence: RowRule["occurrence"]) {
  if (rows.length === 0) return null;
  if (occurrence === "last") return rows[rows.length - 1] ?? null;
  if (occurrence === "second") return rows[1] ?? null;
  return rows[0] ?? null;
}

function groupNumber(id: string) {
  const parsed = Number(id.split("-", 1)[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOfficialNumber(value: string) {
  const normalized = value.normalize("NFKC").replace(/[,，%％円]/g, "").trim();
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
