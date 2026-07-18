export type AccountingType = "legal_applied" | "non_legal_applied";

export type AnnualFinancialInput = {
  accountingType: AccountingType | string;
  sewerFeeRevenue: number | null;
  annualBillableVolume: number | null;
  wastewaterTreatmentCost: number | null;
  ordinaryRevenue?: number | null;
  ordinaryExpense?: number | null;
  netIncome?: number | null;
  accumulatedDeficit?: number | null;
  totalRevenueNonLegal?: number | null;
  totalExpenseNonLegal?: number | null;
  realBalance?: number | null;
  revenueExpenditureRatio?: number | null;
  generalAccountTransfer?: number | null;
  nonStandardTransfer?: number | null;
  bondRedemption?: number | null;
  treatedVolume?: number | null;
  servicePopulation?: number | null;
  connectedPopulation?: number | null;
};

export type TrendInput = {
  treatmentCostYenPerM3?: Array<number | null>;
  annualBillableVolume?: Array<number | null>;
};

export type DiagnosisCalculation = {
  feeUnitPriceYenPerM3: number | null;
  treatmentCostYenPerM3: number | null;
  expenseRecoveryRate: number | null;
  requiredRevisionRateTo80: number | null;
  requiredRevisionRateTo100: number | null;
  requiredRevisionRateTo150yen: number | null;
  accountingBalanceLabel: string;
  feeAdequacyLabel: string;
  revisionRiskScore: number;
  revisionRiskLabel: string;
  diagnosisComment: string;
  flags: string[];
  calculationTrace: Record<string, unknown>;
};

export function safeDivide(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (
    numerator == null
    || denominator == null
    || !Number.isFinite(numerator)
    || !Number.isFinite(denominator)
    || denominator <= 0
  ) return null;
  return numerator / denominator;
}

export function calculateFeeUnitPrice(sewerFeeRevenueThousandYen: number | null, annualBillableVolumeM3: number | null) {
  if (!isNonNegativeFinite(sewerFeeRevenueThousandYen) || !isPositiveFinite(annualBillableVolumeM3)) return null;
  const value = safeDivide(
    sewerFeeRevenueThousandYen * 1000,
    annualBillableVolumeM3
  );
  return round(value, 4);
}

export function calculateTreatmentCost(wastewaterTreatmentCostThousandYen: number | null, annualBillableVolumeM3: number | null) {
  if (!isNonNegativeFinite(wastewaterTreatmentCostThousandYen) || !isPositiveFinite(annualBillableVolumeM3)) return null;
  const value = safeDivide(
    wastewaterTreatmentCostThousandYen * 1000,
    annualBillableVolumeM3
  );
  return round(value, 4);
}

export function calculateExpenseRecoveryRate(sewerFeeRevenueThousandYen: number | null, wastewaterTreatmentCostThousandYen: number | null) {
  if (!isNonNegativeFinite(sewerFeeRevenueThousandYen) || !isPositiveFinite(wastewaterTreatmentCostThousandYen)) return null;
  const value = safeDivide(sewerFeeRevenueThousandYen, wastewaterTreatmentCostThousandYen);
  return value == null ? null : round(value * 100, 4);
}

export function calculateRequiredRevisionRateTo100(expenseRecoveryRate: number | null) {
  if (!isPositiveFinite(expenseRecoveryRate)) return null;
  return round(100 / expenseRecoveryRate - 1, 6);
}

/**
 * Applies the same proportional change implied by the expense-recovery rate
 * to the official household 20m³/month tariff. This is a scenario, not an
 * official tariff decision; callers should avoid presenting a value below the
 * current tariff as a price-cut recommendation when recovery is already 100%.
 */
export function calculateRequiredHouseholdFee20m3(
  householdFee20m3Yen: number | null | undefined,
  expenseRecoveryRate: number | null | undefined
) {
  if (
    householdFee20m3Yen == null
    || expenseRecoveryRate == null
    || !Number.isFinite(householdFee20m3Yen)
    || !Number.isFinite(expenseRecoveryRate)
    || householdFee20m3Yen < 0
    || expenseRecoveryRate <= 0
  ) return null;
  return Math.round(householdFee20m3Yen * 100 / expenseRecoveryRate);
}

export function calculateRequiredRevisionRateTo80(expenseRecoveryRate: number | null) {
  if (!isPositiveFinite(expenseRecoveryRate)) return null;
  return round(80 / expenseRecoveryRate - 1, 6);
}

export function calculateRequiredRevisionRateTo150yen(feeUnitPrice: number | null) {
  if (!isPositiveFinite(feeUnitPrice)) return null;
  return round(150 / feeUnitPrice - 1, 6);
}

export function calculateWaterRevenueRate(annualBillableVolume: number | null, treatedVolume: number | null) {
  if (!isNonNegativeFinite(annualBillableVolume) || !isPositiveFinite(treatedVolume)) return null;
  const value = safeDivide(annualBillableVolume, treatedVolume);
  return value == null ? null : round(value * 100, 4);
}

export function calculateConnectedRate(connectedPopulation: number | null, servicePopulation: number | null) {
  if (!isNonNegativeFinite(connectedPopulation) || !isPositiveFinite(servicePopulation)) return null;
  const value = safeDivide(connectedPopulation, servicePopulation);
  return value == null ? null : round(value * 100, 4);
}

export function getFeeAdequacyLabel(expenseRecoveryRate: number | null, feeUnitPrice: number | null): string {
  if (expenseRecoveryRate == null) return "判定不可";
  if (expenseRecoveryRate >= 100) return "適正水準";
  if (expenseRecoveryRate >= 90) return "やや不足";
  if (expenseRecoveryRate >= 80) return "要注意";
  if (expenseRecoveryRate < 80 && feeUnitPrice != null && feeUnitPrice < 150) return "重点監視";
  return "改定圧力高";
}

export function getAccountingBalanceLabel(input: AnnualFinancialInput): string {
  if (input.accountingType === "legal_applied") {
    const ordinaryProfitLoss =
      input.ordinaryRevenue != null && input.ordinaryExpense != null
        ? input.ordinaryRevenue - input.ordinaryExpense
        : null;
    const ordinaryLabel =
      ordinaryProfitLoss == null ? "経常損益は判定不可" : ordinaryProfitLoss >= 0 ? "経常黒字" : "経常赤字";
    const netLabel =
      input.netIncome == null ? "純損益は判定不可" : input.netIncome >= 0 ? "純利益" : "純損失";
    return `${ordinaryLabel} / ${netLabel}`;
  }

  const balanceLabel =
    input.realBalance == null ? "実質収支は判定不可" : input.realBalance >= 0 ? "実質収支黒字" : "実質収支赤字";
  const ratioLabel =
    input.revenueExpenditureRatio == null
      ? "収益的収支比率は判定不可"
      : input.revenueExpenditureRatio >= 100
        ? "収益的収支は均衡以上"
        : "収益的収支は不足";
  return `${balanceLabel} / ${ratioLabel}`;
}

export function getRevisionRiskLabel(score: number): string {
  if (score >= 80) return "参考スコア80以上";
  if (score >= 60) return "参考スコア60〜79";
  if (score >= 30) return "参考スコア30〜59";
  return "参考スコア30未満";
}

export function calculateDiagnosis(input: AnnualFinancialInput, trend: TrendInput = {}): DiagnosisCalculation {
  const feeUnitPriceYenPerM3 = calculateFeeUnitPrice(input.sewerFeeRevenue, input.annualBillableVolume);
  const treatmentCostYenPerM3 = calculateTreatmentCost(input.wastewaterTreatmentCost, input.annualBillableVolume);
  const expenseRecoveryRate = calculateExpenseRecoveryRate(input.sewerFeeRevenue, input.wastewaterTreatmentCost);
  const requiredRevisionRateTo100 = calculateRequiredRevisionRateTo100(expenseRecoveryRate);
  const requiredRevisionRateTo80 = calculateRequiredRevisionRateTo80(expenseRecoveryRate);
  const requiredRevisionRateTo150yen = calculateRequiredRevisionRateTo150yen(feeUnitPriceYenPerM3);
  const feeAdequacyLabel = getFeeAdequacyLabel(expenseRecoveryRate, feeUnitPriceYenPerM3);
  const accountingBalanceLabel = getAccountingBalanceLabel(input);
  const flags = buildFlags(input, expenseRecoveryRate, feeUnitPriceYenPerM3, treatmentCostYenPerM3);
  const score = calculateRiskScore(input, expenseRecoveryRate, feeUnitPriceYenPerM3, trend);
  const revisionRiskLabel = getRevisionRiskLabel(score);
  const diagnosisComment = buildDiagnosisComment(feeAdequacyLabel, expenseRecoveryRate, requiredRevisionRateTo100);

  return {
    feeUnitPriceYenPerM3,
    treatmentCostYenPerM3,
    expenseRecoveryRate,
    requiredRevisionRateTo80,
    requiredRevisionRateTo100,
    requiredRevisionRateTo150yen,
    accountingBalanceLabel,
    feeAdequacyLabel,
    revisionRiskScore: score,
    revisionRiskLabel,
    diagnosisComment,
    flags,
    calculationTrace: {
      officialInputs: {
        sewerFeeRevenueThousandYen: input.sewerFeeRevenue,
        annualBillableVolumeM3: input.annualBillableVolume,
        wastewaterTreatmentCostThousandYen: input.wastewaterTreatmentCost
      },
      siteTrialCalculations: {
        feeUnitPrice: "下水道使用料収入（千円） × 1000 ÷ 年間有収水量（m³）",
        treatmentCost: "汚水処理費（千円） × 1000 ÷ 年間有収水量（m³）",
        expenseRecoveryRate: "下水道使用料収入 ÷ 汚水処理費 × 100",
        requiredRevisionRateTo100: "100 ÷ 経費回収率 - 1",
        requiredRevisionRateTo80: "80 ÷ 経費回収率 - 1",
        requiredRevisionRateTo150yen: "150 ÷ 使用料単価 - 1"
      },
      results: {
        feeUnitPriceYenPerM3,
        treatmentCostYenPerM3,
        expenseRecoveryRate,
        requiredRevisionRateTo80,
        requiredRevisionRateTo100,
        requiredRevisionRateTo150yen
      }
    }
  };
}

function buildFlags(
  input: AnnualFinancialInput,
  expenseRecoveryRate: number | null,
  feeUnitPrice: number | null,
  treatmentCost: number | null
) {
  const flags: string[] = [];
  pushInputQualityFlag(flags, "年間有収水量", input.annualBillableVolume);
  pushInputQualityFlag(flags, "下水道使用料収入", input.sewerFeeRevenue);
  pushInputQualityFlag(flags, "汚水処理費", input.wastewaterTreatmentCost);
  if (expenseRecoveryRate != null && expenseRecoveryRate > 300) flags.push("経費回収率が300%超");
  if (feeUnitPrice != null && feeUnitPrice > 500) flags.push("使用料単価が500円/m³超");
  if (treatmentCost != null && treatmentCost > 1000) flags.push("汚水処理原価が1000円/m³超");
  return flags;
}

function calculateRiskScore(
  input: AnnualFinancialInput,
  expenseRecoveryRate: number | null,
  feeUnitPrice: number | null,
  trend: TrendInput
) {
  let score = 0;
  if (expenseRecoveryRate != null && expenseRecoveryRate < 100) score += 20;
  if (expenseRecoveryRate != null && expenseRecoveryRate < 80) score += 30;
  if (feeUnitPrice != null && feeUnitPrice < 150) score += 15;
  if (isIncreasingTrend(trend.treatmentCostYenPerM3)) score += 15;
  if (isDecreasingTrend(trend.annualBillableVolume)) score += 10;
  if ((input.nonStandardTransfer ?? 0) > 0) score += 20;
  if ((input.accumulatedDeficit ?? 0) > 0) score += 15;
  return Math.min(score, 100);
}

export function isIncreasingTrend(values?: Array<number | null>) {
  return isTrend(values, "increasing");
}

export function isDecreasingTrend(values?: Array<number | null>) {
  return isTrend(values, "decreasing");
}

function isTrend(values: Array<number | null> | undefined, direction: "increasing" | "decreasing") {
  const clean = values?.filter((value): value is number => isNonNegativeFinite(value)) ?? [];
  if (clean.length < 5 || clean[0] === 0) return false;
  const first = clean[0];
  const last = clean[clean.length - 1];
  const changeRate = (last - first) / Math.abs(first);
  if (direction === "increasing") return changeRate >= 0.05 && slope(clean) > 0;
  return changeRate <= -0.05 && slope(clean) < 0;
}

function pushInputQualityFlag(flags: string[], label: string, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value === 0) {
    flags.push(`${label}が0または欠損`);
  } else if (value < 0) {
    flags.push(`${label}が負値`);
  }
}

function isNonNegativeFinite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function slope(values: number[]) {
  const n = values.length;
  const xs = values.map((_, index) => index + 1);
  const xMean = xs.reduce((sum, value) => sum + value, 0) / n;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;
  const numerator = values.reduce((sum, value, index) => sum + (xs[index] - xMean) * (value - yMean), 0);
  const denominator = xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

function buildDiagnosisComment(label: string, rate: number | null, required100: number | null) {
  const rateText = rate == null ? "算定不可" : `${round(rate, 1)}%`;
  const revisionText = required100 == null ? "算定不可" : `${round(Math.max(required100, 0) * 100, 1)}%`;
  if (label === "適正水準") {
    return `最新決算の経費回収率は${rateText}であり、汚水処理費に対する下水道使用料収入が概ね100%の水準です。ただし、将来の更新投資や有収水量の減少により、今後も同水準を維持できるとは限りません。`;
  }
  if (label === "やや不足" || label === "要注意") {
    return `最新決算の経費回収率は${rateText}であり、下水道使用料収入が汚水処理費を下回っています。費用や有収水量が変わらない仮定では、経費回収率100%相当の使用料収入は約${revisionText}の増加となる単純試算です。`;
  }
  if (label === "判定不可") {
    return "最新決算の主要値に欠損があるため、使用料水準の判定はできません。データ根拠と原資料を確認してください。";
  }
  return `最新決算の経費回収率は${rateText}であり、汚水処理費に対する使用料収入の不足割合が大きい状態です。費用や有収水量が変わらない仮定では、経費回収率100%相当の使用料収入は約${revisionText}の増加となる単純試算です。実際の使用料改定は、審議会、条例改正、一般会計繰入、投資計画等を踏まえて決まります。`;
}

export function round(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
