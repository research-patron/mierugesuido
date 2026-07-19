export type RankingType =
  | "expense-recovery-low"
  | "required-revision-high"
  | "fee-unit-low"
  | "treatment-cost-high"
  | "transfer-dependency-high";

export const rankingLabels: Record<RankingType, string> = {
  "expense-recovery-low": "経費回収率が低い順",
  "required-revision-high": "経費回収率100%相当の増収率が高い順",
  "fee-unit-low": "使用料単価が低い順",
  "treatment-cost-high": "汚水処理原価が高い順",
  "transfer-dependency-high": "基準外繰入金が大きい順"
};
