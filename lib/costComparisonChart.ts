import { displayBusinessName } from "@/lib/businessDisplay";
import { COST_COMPOSITION_ITEM_DEFINITIONS } from "@/lib/costCompositionDefinition";
import { PREFECTURE_PEER_PURPOSE_COST_DEFINITIONS, type PrefecturePeerComparisonRow } from "@/lib/prefecturePeerComparison";

export const COST_CHART_METRICS = [
  ...COST_COMPOSITION_ITEM_DEFINITIONS.map((item) => ({
    key: `nature:${item.id}` as const, label: item.label, group: "性質別の費用"
  })),
  ...PREFECTURE_PEER_PURPOSE_COST_DEFINITIONS.map((item) => ({
    key: `purpose:${item.id}` as const, label: item.label, group: "目的別の費用"
  }))
];
export type CostChartMetric = (typeof COST_CHART_METRICS)[number]["key"];
export type CostChartPoint = {
  key: string;
  name: string;
  businessName: string;
  municipalityCode: string;
  businessKey: string;
  x: number;
  y: number;
  yenPerM3: number;
  residual: number | null;
  standardizedResidual: number | null;
  distant: boolean;
};
export type CostChartFit = {
  slope: number;
  intercept: number;
  rSquared: number | null;
};

/** The already-eligible R6 comparison units stay equally weighted; shared operators count once. */
export function buildCostComparisonChart(rows: PrefecturePeerComparisonRow[], metric: CostChartMetric) {
  const seen = new Set<string>();
  const points: CostChartPoint[] = [];
  const [group, itemId] = metric.split(":");
  for (const row of rows) {
    if (!row.eligible || seen.has(row.comparisonUnitKey)) continue;
    const volume = row.annualBillableVolume;
    const items = group === "nature" ? row.costCompositionShares : row.purposeCostItems;
    const yenPerM3 = items?.find((item) => item.id === itemId)?.yenPerM3;
    if (volume == null || !Number.isFinite(volume) || volume <= 0
      || yenPerM3 == null || !Number.isFinite(yenPerM3) || yenPerM3 < 0) continue;
    // Both axes use millions: billed water (million m³) and this expense (million yen).
    // The supplement retains unrounded unit costs; reversing that normalization preserves the source amount.
    const x = volume / 1_000_000;
    const y = yenPerM3 * x;
    if (!Number.isFinite(y)) continue;
    seen.add(row.comparisonUnitKey);
    points.push({key: row.comparisonUnitKey, name: row.municipalityName,
      businessName: displayBusinessName(row),
      municipalityCode: row.detailMunicipalityCode, businessKey: row.businessKey,
      x, y, yenPerM3, residual: null, standardizedResidual: null, distant: false});
  }
  let fit: CostChartFit | null = null;
  if (points.length >= 3) {
    const n = points.length;
    const xMean = points.reduce((sum, p) => sum + p.x, 0) / n;
    const yMean = points.reduce((sum, p) => sum + p.y, 0) / n;
    const sxx = points.reduce((sum, p) => sum + (p.x - xMean) ** 2, 0);
    const syy = points.reduce((sum, p) => sum + (p.y - yMean) ** 2, 0);
    if (sxx > Number.EPSILON * Math.max(1, xMean ** 2) * n) {
      const slope = points.reduce((sum, p) => sum + (p.x - xMean) * (p.y - yMean), 0) / sxx;
      const intercept = yMean - slope * xMean;
      const sse = points.reduce((sum, p) => sum + (p.y - (slope * p.x + intercept)) ** 2, 0);
      fit = {slope, intercept, rSquared: syy > 1e-12 ? Math.max(0, Math.min(1, 1 - sse / syy)) : null};
      const variance = sse / (n - 2);
      for (const p of points) {
        p.residual = p.y - (slope * p.x + intercept);
        const leverage = 1 / n + (p.x - xMean) ** 2 / sxx;
        const residualVariance = variance * (1 - leverage);
        if (n >= 5 && residualVariance > 1e-10) {
          p.standardizedResidual = p.residual / Math.sqrt(residualVariance);
          p.distant = Math.abs(p.standardizedResidual) > 2;
        }
      }
    }
  }
  return {points, fit};
}
