import { normalizeHomeComparison, selectComparisonRows, summarizeMunicipalities, orderRankingRows, competitionRanks } from "@/lib/comparison";
import { rankingMetricLabels } from "@/lib/rankingDisplay";
import { formulaCopy } from "@/lib/copy";
import type { DatasetProduct } from "@/lib/datasetProduct";

export const datasetMetrics = [
  { id: "expenseRecoveryRate", label: rankingMetricLabels["expense-recovery-low"], unit: "%", sources: ["sewerFeeRevenue", "wastewaterTreatmentCost"] },
  { id: "feeUnitPriceYenPerM3", label: rankingMetricLabels["fee-unit-low"], unit: "円/m³", sources: ["sewerFeeRevenue", "annualBillableVolume"] },
  { id: "treatmentCostYenPerM3", label: rankingMetricLabels["treatment-cost-low"], unit: "円/m³", sources: ["wastewaterTreatmentCost", "annualBillableVolume"] }
] as const;
export const datasetColumns = [
  { id: "rowId", label: "行識別子", unit: "", definition: "自治体コード・事業キー・会計区分・決算年度の組合せ" },
  { id: "municipalityCode", label: "自治体コード", unit: "文字列", definition: "先頭ゼロを含む6桁コード。表計算ソフトでは文字列列として取り込む" },
  { id: "prefectureName", label: "都道府県", unit: "", definition: "収録された都道府県名" },
  { id: "municipalityName", label: "自治体名", unit: "", definition: "収録された自治体名。同名でもコードで区別" },
  { id: "businessKey", label: "事業キー", unit: "文字列", definition: "自治体内の事業識別子" },
  { id: "accountingType", label: "会計区分", unit: "", definition: "legal_applied=法適用、non_legal_applied=法非適用（料金指標の参考比較）" },
  { id: "fiscalYear", label: "決算年度", unit: "西暦年度", definition: "カタログ年・公表年とは別。過年度による補完なし" },
  ...datasetMetrics.map(metric => ({ ...metric, definition: formulaCopy.find(item => item.title === metric.label)!.formula })),
  { id: "expenseRecoveryRank", label: "経費回収率の低い順の順位", unit: "位", definition: "同じ母集団の有効値を保存精度で比較。同値は1,2,2,4。欠損は順位なし" },
  { id: "qualityStatus", label: "自動チェック状態", unit: "", definition: "既存の取込状態。okも原資料全件照合を意味しない" },
  { id: "qualityFlags", label: "自動チェックの注意", unit: "", definition: "既存の注意理由。原資料との不一致を確定したものではない" }
];
export function buildDatasetEdition(homeInput: any, product: DatasetProduct) {
  const home = normalizeHomeComparison(homeInput);
  const scope = home.mapScopes[product.businessType === "17/4" ? "tokkan" : "public"];
  const params = new URLSearchParams({ fiscalYear: String(product.fiscalYear), businessType: product.businessType });
  if (product.accountingType) params.set("accountingType", product.accountingType);
  const selected = selectComparisonRows<any>(scope.mapMunicipalities, params, product.fiscalYear)
    .filter(row => product.regions.length === 0 || product.regions.includes(row.prefectureName))
    .sort((a,b) => a.municipalityCode.localeCompare(b.municipalityCode));
  if (!selected.length) throw new Error("Product scope has no records");
  const ranked = orderRankingRows(selected, "expense-recovery-low");
  const ranks = competitionRanks(ranked, "expense-recovery-low");
  const rankByCode = new Map(ranked.map((row,index) => [row.municipalityCode, ranks[index]]));
  const identities = new Set<string>();
  const municipalities = new Set<string>();
  const rows = selected.map(row => {
    const rowId = [row.municipalityCode,row.businessKey,row.accountingType,row.latestYear].join(":");
    if (identities.has(rowId) || municipalities.has(row.municipalityCode)) throw new Error("Duplicate product account or municipality");
    if (!/^\d{6}$/.test(row.municipalityCode)) throw new Error("Invalid municipality code");
    identities.add(rowId); municipalities.add(row.municipalityCode);
    for (const metric of datasetMetrics) if (row[metric.id] != null && !Number.isFinite(row[metric.id])) throw new Error("Non-finite product value");
    const values = Object.fromEntries(datasetMetrics.map(metric => [metric.id, row[metric.id] ?? null])) as Record<typeof datasetMetrics[number]["id"], number | null>;
    return { rowId, municipalityCode: row.municipalityCode, prefectureName: row.prefectureName, municipalityName: row.municipalityName,
      businessKey: row.businessKey, accountingType: row.accountingType, fiscalYear: row.latestYear,
      ...values,
      expenseRecoveryRank: rankByCode.get(row.municipalityCode) ?? null,
      qualityStatus: row.dataQualityStatus ?? "unchecked", qualityFlags: row.flags?.join("／") ?? "検証記録なし" };
  });
  return { rows, summary: summarizeMunicipalities(selected, product.fiscalYear),
    missingCounts: Object.fromEntries(datasetMetrics.map(metric => [metric.id, selected.filter(row => row[metric.id] == null).length])),
    sampleRows: rows.slice(0, product.sampleSize) };
}
export function datasetCsv(columns: readonly string[], rows: Record<string, any>[]) {
  const cell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    // Keep numbers numeric; protect imported external text from formula execution.
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [columns.map(cell).join(","), ...rows.map(row => columns.map(key => cell(row[key])).join(","))].join("\r\n") + "\r\n";
}
