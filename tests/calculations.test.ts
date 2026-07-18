import { describe, expect, it } from "vitest";
import {
  calculateConnectedRate,
  calculateDiagnosis,
  calculateExpenseRecoveryRate,
  calculateFeeUnitPrice,
  calculateRequiredRevisionRateTo100,
  calculateRequiredHouseholdFee20m3,
  calculateRequiredRevisionRateTo150yen,
  calculateRequiredRevisionRateTo80,
  calculateTreatmentCost,
  calculateWaterRevenueRate,
  getFeeAdequacyLabel,
  isIncreasingTrend,
  safeDivide
} from "@/lib/calculations";

describe("calculation formulas", () => {
  it("recalculates the specification example", () => {
    const sewerFeeRevenue = 80000;
    const wastewaterTreatmentCost = 100000;
    const annualBillableVolume = 500000;

    expect(calculateFeeUnitPrice(sewerFeeRevenue, annualBillableVolume)).toBe(160);
    expect(calculateTreatmentCost(wastewaterTreatmentCost, annualBillableVolume)).toBe(200);
    expect(calculateExpenseRecoveryRate(sewerFeeRevenue, wastewaterTreatmentCost)).toBe(80);
    expect(calculateRequiredRevisionRateTo100(80)).toBe(0.25);
    expect(calculateRequiredRevisionRateTo80(80)).toBe(0);
    expect(calculateRequiredRevisionRateTo150yen(160)).toBeLessThan(0);
  });

  it("returns null when denominators are missing", () => {
    expect(calculateFeeUnitPrice(100, 0)).toBeNull();
    expect(calculateTreatmentCost(100, null)).toBeNull();
    expect(calculateExpenseRecoveryRate(100, 0)).toBeNull();
    expect(calculateRequiredRevisionRateTo100(0)).toBeNull();
    expect(calculateRequiredHouseholdFee20m3(3000, 0)).toBeNull();
  });

  it("rejects negative accounting inputs instead of producing negative rates or unit costs", () => {
    expect(safeDivide(100, -10)).toBeNull();
    expect(calculateFeeUnitPrice(100, -1)).toBeNull();
    expect(calculateTreatmentCost(-100, 1_000)).toBeNull();
    expect(calculateExpenseRecoveryRate(100, -100)).toBeNull();
    expect(calculateRequiredRevisionRateTo100(-50)).toBeNull();
    expect(calculateRequiredRevisionRateTo80(-50)).toBeNull();
    expect(calculateRequiredRevisionRateTo150yen(-150)).toBeNull();
    expect(calculateWaterRevenueRate(-800, 1_000)).toBeNull();
    expect(calculateConnectedRate(900, -1_000)).toBeNull();
  });

  it("marks a negative treatment cost as a quality warning and keeps derived values unavailable", () => {
    const result = calculateDiagnosis({
      accountingType: "legal_applied",
      sewerFeeRevenue: 91_571,
      wastewaterTreatmentCost: -12_681,
      annualBillableVolume: 479_038
    });

    expect(result.treatmentCostYenPerM3).toBeNull();
    expect(result.expenseRecoveryRate).toBeNull();
    expect(result.requiredRevisionRateTo80).toBeNull();
    expect(result.requiredRevisionRateTo100).toBeNull();
    expect(result.flags).toContain("汚水処理費が負値");
    expect(result.flags).not.toContain("汚水処理費が0または欠損");
  });

  it("does not interpret negative observations as a five-year trend", () => {
    expect(isIncreasingTrend([100, 105, -110, 115, 120])).toBe(false);
  });

  it("converts the official household 20m3 tariff to a 100% recovery scenario", () => {
    expect(calculateRequiredHouseholdFee20m3(3000, 80)).toBe(3750);
    expect(calculateRequiredHouseholdFee20m3(3355, 100)).toBe(3355);
    expect(calculateRequiredHouseholdFee20m3(null, 80)).toBeNull();
  });

  it("labels fee adequacy by recovery rate and unit price", () => {
    expect(getFeeAdequacyLabel(101, 140)).toBe("適正水準");
    expect(getFeeAdequacyLabel(95, 140)).toBe("やや不足");
    expect(getFeeAdequacyLabel(85, 140)).toBe("要注意");
    expect(getFeeAdequacyLabel(75, 140)).toBe("重点監視");
    expect(getFeeAdequacyLabel(75, 180)).toBe("改定圧力高");
    expect(getFeeAdequacyLabel(null, 180)).toBe("判定不可");
  });

  it("calculates water revenue and connected rates", () => {
    expect(calculateWaterRevenueRate(800, 1000)).toBe(80);
    expect(calculateConnectedRate(900, 1000)).toBe(90);
  });

  it("builds a full diagnosis without mixing official values and site calculations", () => {
    const result = calculateDiagnosis({
      accountingType: "legal_applied",
      sewerFeeRevenue: 80000,
      wastewaterTreatmentCost: 100000,
      annualBillableVolume: 500000,
      ordinaryRevenue: 140000,
      ordinaryExpense: 145000,
      netIncome: -5000,
      nonStandardTransfer: 10000,
      accumulatedDeficit: 12000
    });

    expect(result.expenseRecoveryRate).toBe(80);
    expect(result.requiredRevisionRateTo100).toBe(0.25);
    expect(result.accountingBalanceLabel).toContain("経常赤字");
    expect(result.feeAdequacyLabel).toBe("要注意");
    expect(result.revisionRiskScore).toBeGreaterThanOrEqual(55);
    expect(result.calculationTrace.officialInputs).toEqual({
      sewerFeeRevenueThousandYen: 80000,
      annualBillableVolumeM3: 500000,
      wastewaterTreatmentCostThousandYen: 100000
    });
  });
});
