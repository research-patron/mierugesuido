import { rankingSelection, type RankingType } from "@/lib/rankings";
import { formatPercent, formatYenPerM3 } from "@/lib/format";

export const rankingMetricLabels: Record<RankingType, string> = {
  "expense-recovery-high": "経費回収率",
  "expense-recovery-low": "経費回収率",
  "fee-unit-high": "使用料単価",
  "fee-unit-low": "使用料単価",
  "treatment-cost-high": "汚水処理原価",
  "treatment-cost-low": "汚水処理原価"
};

export function rankingMetricValue(item: any, type: RankingType): number | null {
  const { metric } = rankingSelection(type);
  const value = metric.metric === "expense-recovery"
    ? item.expenseRecoveryRate
    : metric.metric === "fee-unit"
      ? item.feeUnitPriceYenPerM3
      : item.treatmentCostYenPerM3;
  return value == null || !Number.isFinite(value) ? null : value;
}

export function formatRankingMetric(item: any, type: RankingType) {
  const value = rankingMetricValue(item, type);
  const { metric } = rankingSelection(type);
  if (metric.metric === "expense-recovery") return formatPercent(value);
  return formatYenPerM3(value);
}
