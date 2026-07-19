import { accountingTypeLabel, displayBusinessName } from "@/lib/businessDisplay";
import { displayFeeRecoveryBandLabel } from "@/lib/feeRecoveryCopy";
import { formatSettlementFiscalLabel } from "@/lib/format";

export function municipalitiesToCsv(items: any[]) {
  const rows = [
    ["都道府県", "自治体名", "自治体コード", "事業キー", "表示事業種別", "会計区分", "最新決算", "経費回収率（%）", "使用料単価（円/m³）", "汚水処理原価（円/m³）", "100%相当の増収率（%・単純試算）", "経費回収率区分", "公式改定情報", "データ品質", "品質注記"],
    ...items.map((item) => [
      item.prefectureName,
      item.municipalityName,
      item.municipalityCode ?? "",
      item.businessKey ?? "",
      displayBusinessName(item),
      accountingTypeLabel(item.accountingType),
      item.latestYear ? formatSettlementFiscalLabel({ surveyYear: item.latestYear, fiscalYearLabel: item.latestFiscalYearLabel }) : "",
      item.diagnosis?.expenseRecoveryRate ?? "",
      item.diagnosis?.feeUnitPriceYenPerM3 ?? "",
      item.diagnosis?.treatmentCostYenPerM3 ?? "",
      item.diagnosis?.requiredRevisionRateTo100 == null ? "" : (item.diagnosis.requiredRevisionRateTo100 * 100).toFixed(1),
      displayFeeRecoveryBandLabel(item.diagnosis?.feeAdequacyLabel),
      item.hasRevisionEvent ? "登録あり" : "未登録",
      item.dataQualityStatus ?? "unchecked",
      Array.isArray(item.flags) ? item.flags.join("／") : ""
    ])
  ];
  return rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
}
