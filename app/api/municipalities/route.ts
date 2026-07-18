import { NextResponse } from "next/server";
import { getMunicipalityList } from "@/lib/data";
import { formatSettlementFiscalLabel } from "@/lib/format";
import { displayFeeRecoveryBandLabel } from "@/lib/feeRecoveryCopy";
import { accountingTypeLabel, displayBusinessName } from "@/lib/businessDisplay";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isCsv = searchParams.get("format") === "csv";
  const result = await getMunicipalityList({
    q: searchParams.get("q") ?? undefined,
    municipalityNameQuery: searchParams.get("nameQuery") ?? undefined,
    prefecture: searchParams.get("prefecture") ?? undefined,
    label: searchParams.get("label") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 50),
    accountingType: searchParams.get("accountingType") ?? undefined,
    businessType: searchParams.get("businessType") ?? undefined,
    hasRevisionEvent: parseBoolean(searchParams.get("hasRevisionEvent")),
    municipalityKind: parseMunicipalityKind(searchParams.get("kind")),
    all: isCsv
  });
  if (isCsv) {
    return new Response(toCsv(result.items), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=municipalities.csv"
      }
    });
  }
  return NextResponse.json(result);
}

function parseMunicipalityKind(value: string | null) {
  if (value === "city" || value === "town" || value === "village") return value;
  return undefined;
}

function parseBoolean(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function toCsv(items: any[]) {
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
