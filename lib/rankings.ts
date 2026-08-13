export type RankingDirection = "high" | "low";

export type RankingMetric =
  | "expense-recovery"
  | "fee-unit"
  | "treatment-cost";

export type RankingType =
  | "expense-recovery-high"
  | "expense-recovery-low"
  | "fee-unit-high"
  | "fee-unit-low"
  | "treatment-cost-high"
  | "treatment-cost-low";

type RankingMetricDefinition = {
  metric: RankingMetric;
  label: string;
  description: string;
  types: Record<RankingDirection, RankingType>;
};

export const rankingMetrics: readonly RankingMetricDefinition[] = [
  {
    metric: "expense-recovery",
    label: "経費回収率",
    description: "下水道使用料収入が、使用料で回収すべき汚水処理費をどの程度賄えているかを比較します。",
    types: {
      high: "expense-recovery-high",
      low: "expense-recovery-low"
    }
  },
  {
    metric: "fee-unit",
    label: "使用料単価",
    description: "年間下水道使用料収入を年間有収水量で割った、事業全体の1m³当たり実績額を比較します。",
    types: {
      high: "fee-unit-high",
      low: "fee-unit-low"
    }
  },
  {
    metric: "treatment-cost",
    label: "汚水処理原価",
    description: "使用料で回収すべき汚水処理費を年間有収水量で割った、1m³当たり費用を比較します。",
    types: {
      high: "treatment-cost-high",
      low: "treatment-cost-low"
    }
  }
] as const;

export const rankingLabels: Record<RankingType, string> = {
  "expense-recovery-high": "経費回収率が高い順",
  "expense-recovery-low": "経費回収率が低い順",
  "fee-unit-high": "使用料単価が高い順",
  "fee-unit-low": "使用料単価が低い順",
  "treatment-cost-high": "汚水処理原価が高い順",
  "treatment-cost-low": "汚水処理原価が低い順"
};

export const defaultRankingType: RankingType = "expense-recovery-low";

export function rankingSelection(type: RankingType) {
  for (const metric of rankingMetrics) {
    if (metric.types.high === type) return { metric, direction: "high" as const };
    if (metric.types.low === type) return { metric, direction: "low" as const };
  }
  return { metric: rankingMetrics[0], direction: "low" as const };
}

export function isRankingType(value: string): value is RankingType {
  return Object.prototype.hasOwnProperty.call(rankingLabels, value);
}
