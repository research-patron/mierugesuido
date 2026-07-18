import type { RankingType } from "@/lib/data";
import { formatMoneyThousandYen, formatPercent, formatRevisionRate, formatYenPerM3 } from "@/lib/format";

export const rankingMetricLabels: Record<RankingType, string> = {
  "expense-recovery-low": "経費回収率",
  "required-revision-high": "100%相当の増収率（単純試算）",
  "fee-unit-low": "使用料単価",
  "treatment-cost-high": "汚水処理原価",
  "transfer-dependency-high": "基準外繰入金"
};

export function rankingMetricValue(item: any, type: RankingType): number | null {
  const value = type === "expense-recovery-low"
    ? item.expenseRecoveryRate
    : type === "required-revision-high"
      ? item.requiredRevisionRateTo100
      : type === "fee-unit-low"
        ? item.feeUnitPriceYenPerM3
        : type === "treatment-cost-high"
          ? item.treatmentCostYenPerM3
          : item.nonStandardTransfer;
  return value == null || !Number.isFinite(value) ? null : value;
}

export function formatRankingMetric(item: any, type: RankingType) {
  const value = rankingMetricValue(item, type);
  if (type === "expense-recovery-low") return formatPercent(value);
  if (type === "required-revision-high") return formatRevisionRate(value);
  if (type === "fee-unit-low" || type === "treatment-cost-high") return formatYenPerM3(value);
  return formatMoneyThousandYen(value);
}
