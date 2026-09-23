import { businessCategoryCode } from "@/lib/businessDisplay";
import { rankingMetricValue } from "@/lib/rankingDisplay";
import { rankingSelection, type RankingType } from "@/lib/rankings";

export const comparisonQueryKeys = ["fiscalYear", "businessType", "accountingType", "prefecture", "rowUnit"] as const;

export function comparisonHref(href: string, conditions: URLSearchParams | Record<string, string>) {
  const [path, query = ""] = href.split("?");
  const next = new URLSearchParams(query);
  const source = conditions instanceof URLSearchParams ? conditions : new URLSearchParams(conditions);
  for (const key of comparisonQueryKeys) {
    if (!next.has(key) && source.get(key)) next.set(key, source.get(key)!);
  }
  return `${path}${next.size ? `?${next}` : ""}`;
}

export function selectComparisonRows<T extends { latestYear?: number | null; surveyYear?: number; prefectureName?: string; accountingType?: string | null; businessKey?: string | null }>(rows: T[], conditions: URLSearchParams, defaultYear: number) {
  const year = conditions.has("fiscalYear") ? Number(conditions.get("fiscalYear")) : defaultYear;
  return rows.filter(row => (row.latestYear ?? row.surveyYear) === year
    && (!conditions.get("businessType") || businessCategoryCode(row) === conditions.get("businessType"))
    && (!conditions.get("accountingType") || row.accountingType === conditions.get("accountingType"))
    && (!conditions.get("prefecture") || row.prefectureName === conditions.get("prefecture")));
}

export function meanFinite(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

export function summarizeMunicipalities(rows: any[], year: number) {
  const values = rows.map(row => row.expenseRecoveryRate).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return {
    municipalityCount: rows.length, latestYear: year, latestFiscalYearLabel: `令和${year - 2018}年度`,
    averageExpenseRecoveryRate: meanFinite(values),
    averageFeeUnitPriceYenPerM3: meanFinite(rows.map(row => row.feeUnitPriceYenPerM3)),
    below100Rate: values.length ? values.filter(v => v < 100).length / values.length * 100 : null,
    recoveryCount: values.length, revisionEventCount: rows.filter(row => row.hasRevisionEvent).length,
    lowRecovery: [...rows].filter(row => row.expenseRecoveryRate != null).sort((a, b) => a.expenseRecoveryRate - b.expenseRecoveryRate).slice(0, 5)
  };
}

export function normalizeHomeComparison(data: any) {
  const year = data.overview.latestYear;
  const mapScopes = Object.fromEntries(Object.entries(data.mapScopes).map(([key, value]: [string, any]) => {
    const rows = selectComparisonRows(value.mapMunicipalities, new URLSearchParams(), year);
    const prefectureSummaries = value.prefectureSummaries.map((summary: any) => ({
      ...summary, ...summarizeMunicipalities(rows.filter(row => row.prefectureName === summary.prefectureName), year)
    }));
    return [key, { ...value, mapMunicipalities: rows, overview: summarizeMunicipalities(rows, year), prefectureSummaries,
      excludedYearCount: value.mapMunicipalities.length - rows.length }];
  }));
  return { ...data, mapScopes, ...mapScopes[data.defaultMapScope] };
}

export function orderRankingRows(items: any[], type: RankingType) {
  const sign = rankingSelection(type).direction === "high" ? -1 : 1;
  return items.filter(item => rankingMetricValue(item, type) != null)
    .sort((a, b) => sign * (rankingMetricValue(a, type)! - rankingMetricValue(b, type)!)
      || String(a.municipalityCode).localeCompare(String(b.municipalityCode)));
}

export function competitionRanks(items: any[], type: RankingType) {
  return items.map((row) => {
    const value = rankingMetricValue(row, type);
    return items.findIndex(item => rankingMetricValue(item, type) === value) + 1;
  });
}
