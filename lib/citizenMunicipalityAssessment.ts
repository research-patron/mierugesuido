import type {
  PrefecturePeerComparisonResult,
  PrefecturePeerComparisonRow,
  PrefecturePeerCostCompositionShare
} from "@/lib/prefecturePeerComparison";

export const CITIZEN_METRIC_SAME_RANGE_PERCENT = 10 as const;
export const CITIZEN_VOLUME_STABLE_RANGE_PERCENT = 5 as const;
export const FUND_SHORTAGE_PLAN_THRESHOLD_PERCENT = 20 as const;

export type FeeRankSummary = {
  currentComparisonUnitKey: string;
  currentFee: number;
  rank: number;
  total: number;
  tied: boolean;
  tieCount: number;
  median: number;
  differenceYen: number;
  differencePercent: number;
};

export type MetricMedianPosition = "higher" | "similar" | "lower" | "unavailable";

export type MetricMedianComparison = {
  position: MetricMedianPosition;
  current: number | null;
  median: number | null;
  difference: number | null;
  differencePercent: number | null;
  sameRangePercent: number;
};

export type FeeCostRelationshipKind =
  | "high_fee_high_cost"
  | "high_fee_cost_not_high"
  | "fee_not_high_high_cost"
  | "low_fee_low_cost"
  | "mixed_or_similar"
  | "unavailable";

export type FeeCostRelationship = {
  kind: FeeCostRelationshipKind;
  headline: string;
  explanation: string;
  fee: MetricMedianComparison;
  treatmentCost: MetricMedianComparison;
  evidenceTarget: "prefecture";
};

export type CitizenR6DataAvailability =
  | {
    status: "available";
    sourceSurveyYear: 2024;
    reason: null;
  }
  | {
    status: "unavailable";
    sourceSurveyYear: number | null;
    reason: string;
  };

export type CitizenHouseholdFee20m3Applicability = "applicable" | "not_applicable";

export type CitizenAnnualMetricPoint = {
  surveyYear: number;
  annualBillableVolume?: number | null;
  bondBalance?: number | null;
};

export type VolumeTrendKind = "decreasing" | "stable" | "increasing" | "unavailable";

export type VolumeTrendAssessment = {
  kind: VolumeTrendKind;
  fromSurveyYear: 2020 | null;
  toSurveyYear: 2024 | null;
  fromValue: number | null;
  toValue: number | null;
  changePercent: number | null;
  stableRangePercent: number;
  explanation: string;
};

export type RecoveryBand =
  | "covered"
  | "slight_shortfall"
  | "attention"
  | "large_shortfall"
  | "unavailable";

export type RecoveryBandAssessment = {
  band: RecoveryBand;
  rate: number | null;
  label: string;
  explanation: string;
  evidenceTarget: "yearbook";
};

export type CitizenCostCompositionItemInput = {
  id: string;
  label: string;
  value?: number | null;
  sharePercent?: number | null;
};

export type CitizenCostCompositionInput = {
  total?: number | null;
  items: CitizenCostCompositionItemInput[];
};

export type CitizenCostCompositionInsight = {
  id: string;
  label: string;
  sharePercent: number;
  peerMedianPercent: number | null;
  differencePoints: number | null;
};

export type CitizenCostCompositionAssessment = {
  state: "ready" | "current_only" | "unavailable";
  topItems: CitizenCostCompositionInsight[];
  abovePeerMedianItems: CitizenCostCompositionInsight[];
  explanation: string;
  evidenceTarget: "finance";
};

export type CitizenCostCompositionDisplay = {
  topItems: CitizenCostCompositionInsight[];
  additionalAbovePeerMedianItems: CitizenCostCompositionInsight[];
};

/**
 * Structural subset shared with the official fund-shortage static-data model.
 * A positive-list row remains `shortage` even when its published ratio rounds
 * to 0.0 percent.
 */
export type CitizenFundShortageInput = {
  status: "shortage" | "no_shortage" | "unavailable";
  ratioPercent: number | null;
  fiscalYearLabel: string;
};

export type CitizenFinanceInput = {
  netIncome?: number | null;
  currentNetAssets?: number | null;
  priorNetAssets?: number | null;
  bondBalances?: Array<{
    surveyYear: number;
    value: number | null;
  }>;
};

export type SustainabilityReasonCategory =
  | "fund_shortage"
  | "expense_recovery"
  | "billable_volume"
  | "financial_result"
  | "net_assets"
  | "bond_balance";

export type SustainabilityReason = {
  category: SustainabilityReasonCategory;
  direction: "pressure" | "supportive" | "context";
  title: string;
  detail: string;
  evidenceTarget: "finance" | "yearbook";
};

export type SustainabilityAssessment = {
  headline: string;
  derivedConclusion: string;
  reasons: SustainabilityReason[];
  limitations: string[];
};

export type SimpleHouseholdFeeIllustration = {
  currentFeeYen: number;
  illustratedFeeYen: number;
  monthlyDifferenceYen: number;
  assumption: string;
};

export type SimpleFeeScenario = {
  status: "gap" | "no_current_gap" | "unavailable";
  revenueIncreaseRatePercent: number | null;
  householdIllustration: SimpleHouseholdFeeIllustration | null;
  explanation: string;
  caveat: string;
};

export type CitizenMunicipalityAssessmentInput = {
  r6DataAvailability: CitizenR6DataAvailability;
  householdFee20m3Applicability: CitizenHouseholdFee20m3Applicability;
  peerComparison?: Pick<PrefecturePeerComparisonResult, "rows"> | null;
  peerRows?: PrefecturePeerComparisonRow[] | null;
  currentComparisonUnitKey?: string | null;
  householdFee20m3Yen?: number | null;
  feeUnitPriceYenPerM3?: number | null;
  treatmentCostYenPerM3?: number | null;
  expenseRecoveryRate?: number | null;
  sewerFeeRevenue?: number | null;
  wastewaterTreatmentCost?: number | null;
  annuals?: CitizenAnnualMetricPoint[];
  costComposition?: CitizenCostCompositionInput | null;
  finance?: CitizenFinanceInput | null;
  fundShortage?: CitizenFundShortageInput | null;
};

export type CitizenMunicipalityAssessment = {
  r6DataAvailability: CitizenR6DataAvailability;
  householdFee20m3Applicability: CitizenHouseholdFee20m3Applicability;
  comparisonBasis: {
    surveyYear: 2024;
    fiscalLabel: "R6";
    scopeLabel: string;
    sameRangePercent: number;
  };
  feeRank: FeeRankSummary | null;
  feeRankUnavailableReason: string | null;
  feeCostRelationship: FeeCostRelationship;
  volumeTrend: VolumeTrendAssessment;
  recovery: RecoveryBandAssessment;
  costComposition: CitizenCostCompositionAssessment;
  sustainability: SustainabilityAssessment;
  feeScenario: SimpleFeeScenario;
};

/** Competition ranking in descending fee order: 1, 2, 2, 4. */
export function buildFeeRankSummary(
  rows: PrefecturePeerComparisonRow[],
  currentComparisonUnitKey?: string | null
): FeeRankSummary | null {
  const uniqueRows = uniqueComparisonRows(rows);
  const current = findCurrentRow(uniqueRows, currentComparisonUnitKey);
  const currentFee = positiveFiniteOrNull(current?.householdFee20m3Yen);
  if (!current?.eligible || currentFee == null) return null;

  const eligibleFees = uniqueRows
    .filter((row) => row.eligible)
    .map((row) => positiveFiniteOrNull(row.householdFee20m3Yen))
    .filter((value): value is number => value != null);
  if (eligibleFees.length === 0) return null;

  const peerMedian = medianOfFiniteValues(eligibleFees);
  if (peerMedian == null || peerMedian <= 0) return null;
  const tieCount = eligibleFees.filter((value) => value === currentFee).length;
  const differenceYen = currentFee - peerMedian;

  return {
    currentComparisonUnitKey: current.comparisonUnitKey,
    currentFee,
    rank: 1 + eligibleFees.filter((value) => value > currentFee).length,
    total: eligibleFees.length,
    tied: tieCount > 1,
    tieCount,
    median: peerMedian,
    differenceYen,
    differencePercent: differenceYen / peerMedian * 100
  };
}

export function medianOfFiniteValues(values: Array<number | null | undefined>): number | null {
  const sorted = values
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

export function compareMetricToMedian(
  currentValue: number | null | undefined,
  peerValues: Array<number | null | undefined>,
  sameRangePercent = CITIZEN_METRIC_SAME_RANGE_PERCENT
): MetricMedianComparison {
  const current = positiveFiniteOrNull(currentValue);
  const peerMedian = medianOfFiniteValues(peerValues.map(positiveFiniteOrNull));
  if (current == null || peerMedian == null || peerMedian <= 0) {
    return {
      position: "unavailable",
      current,
      median: peerMedian,
      difference: null,
      differencePercent: null,
      sameRangePercent
    };
  }
  const difference = current - peerMedian;
  const differencePercent = difference / peerMedian * 100;
  const inSameRange = Math.abs(differencePercent) <= sameRangePercent + Number.EPSILON * 100;
  return {
    position: inSameRange ? "similar" : differencePercent > 0 ? "higher" : "lower",
    current,
    median: peerMedian,
    difference,
    differencePercent,
    sameRangePercent
  };
}

export function buildFeeCostRelationship({
  currentHouseholdFee20m3Yen,
  peerHouseholdFees,
  currentTreatmentCostYenPerM3,
  peerTreatmentCostsYenPerM3,
  unavailableReason
}: {
  currentHouseholdFee20m3Yen: number | null | undefined;
  peerHouseholdFees: Array<number | null | undefined>;
  currentTreatmentCostYenPerM3: number | null | undefined;
  peerTreatmentCostsYenPerM3: Array<number | null | undefined>;
  unavailableReason?: string | null;
}): FeeCostRelationship {
  const fee = compareMetricToMedian(currentHouseholdFee20m3Yen, peerHouseholdFees);
  const treatmentCost = compareMetricToMedian(currentTreatmentCostYenPerM3, peerTreatmentCostsYenPerM3);
  const base = { fee, treatmentCost, evidenceTarget: "prefecture" as const };

  if (fee.position === "unavailable" || treatmentCost.position === "unavailable") {
    return {
      ...base,
      kind: "unavailable",
      headline: "料金水準の背景は比較できません",
      explanation: unavailableReason
        ?? "20m³料金または汚水処理原価が未取得のため、年鑑データによる県内比較は行いません。"
    };
  }
  if (fee.position === "higher" && treatmentCost.position === "higher") {
    return {
      ...base,
      kind: "high_fee_high_cost",
      headline: "料金と処理原価はいずれも県内中央値より高い水準です",
      explanation: "高い汚水処理原価が、料金水準の背景の一つと考えられます。因果関係を断定するものではありません。"
    };
  }
  if (fee.position === "higher" && treatmentCost.position !== "higher") {
    return {
      ...base,
      kind: "high_fee_cost_not_high",
      headline: "料金は高い一方、処理原価は高い水準ではありません",
      explanation: "年鑑の費用データだけでは料金水準を説明できません。料金体系や自治体の経営戦略も確認が必要です。"
    };
  }
  if (fee.position !== "higher" && treatmentCost.position === "higher") {
    return {
      ...base,
      kind: "fee_not_high_high_cost",
      headline: "処理原価は高い一方、料金は高い水準ではありません",
      explanation: "料金だけで費用を賄えているか、経費回収率と合わせて確認する必要があります。"
    };
  }
  if (fee.position === "lower" && treatmentCost.position === "lower") {
    return {
      ...base,
      kind: "low_fee_low_cost",
      headline: "料金と処理原価はいずれも県内中央値より低い水準です",
      explanation: "低い処理原価と料金水準が整合している可能性があります。因果関係を断定するものではありません。"
    };
  }
  return {
    ...base,
    kind: "mixed_or_similar",
    headline: "料金と処理原価は県内中央値に近いか、異なる動きです",
    explanation: "料金水準の背景を年鑑データだけで特定できないため、料金体系や施設更新計画も確認が必要です。"
  };
}

export function buildVolumeTrend(points: CitizenAnnualMetricPoint[]): VolumeTrendAssessment {
  const from = points.find((point) => point.surveyYear === 2020);
  const to = points.find((point) => point.surveyYear === 2024);
  const fromValue = positiveFiniteOrNull(from?.annualBillableVolume);
  const toValue = nonNegativeFiniteOrNull(to?.annualBillableVolume);
  const base = {
    fromSurveyYear: fromValue == null ? null : 2020 as const,
    toSurveyYear: toValue == null ? null : 2024 as const,
    fromValue,
    toValue,
    stableRangePercent: CITIZEN_VOLUME_STABLE_RANGE_PERCENT
  };
  if (fromValue == null || toValue == null) {
    return {
      ...base,
      kind: "unavailable",
      changePercent: null,
      explanation: "R2とR6の有収水量が揃わないため、5年間の動向は判定しません。"
    };
  }
  const changePercent = (toValue - fromValue) / fromValue * 100;
  if (changePercent < -CITIZEN_VOLUME_STABLE_RANGE_PERCENT) {
    return {
      ...base,
      kind: "decreasing",
      changePercent,
      explanation: "R2からR6にかけて有収水量が減少しています。利用量の減少は、将来の一人当たり負担を考える際の確認材料です。"
    };
  }
  if (changePercent > CITIZEN_VOLUME_STABLE_RANGE_PERCENT) {
    return {
      ...base,
      kind: "increasing",
      changePercent,
      explanation: "R2からR6にかけて有収水量が増加しています。ただし、将来も同じ傾向が続くことを示すものではありません。"
    };
  }
  return {
    ...base,
    kind: "stable",
    changePercent,
    explanation: "R2からR6の有収水量は±5%以内で、おおむね横ばいです。"
  };
}

export function buildRecoveryBand(value: number | null | undefined): RecoveryBandAssessment {
  const rate = nonNegativeFiniteOrNull(value);
  if (rate == null) {
    return {
      band: "unavailable",
      rate: null,
      label: "算定不可",
      explanation: "使用料収入または汚水処理費を確認できないため、経費回収率を判定しません。",
      evidenceTarget: "yearbook"
    };
  }
  if (rate >= 100) {
    return {
      band: "covered",
      rate,
      label: "R6の費用回収を確保",
      explanation: "R6は、経費回収率の対象となる汚水処理費を使用料収入で賄っています。将来の値上げがないことや値下げ余地を示すものではありません。",
      evidenceTarget: "yearbook"
    };
  }
  if (rate >= 90) {
    return {
      band: "slight_shortfall",
      rate,
      label: "費用回収にやや不足",
      explanation: "R6は、経費回収率の対象となる汚水処理費の一部を使用料収入で賄えていません。",
      evidenceTarget: "yearbook"
    };
  }
  if (rate >= 80) {
    return {
      band: "attention",
      rate,
      label: "費用回収に不足",
      explanation: "R6は使用料収入による費用回収に不足があり、改善策を確認する必要があります。",
      evidenceTarget: "yearbook"
    };
  }
  return {
    band: "large_shortfall",
    rate,
    label: "費用回収の不足が大きい",
    explanation: "R6は使用料収入で賄えていない汚水処理費の割合が大きく、経営戦略や料金方針の確認が必要です。",
    evidenceTarget: "yearbook"
  };
}

export function buildCostCompositionAssessment(
  current: CitizenCostCompositionInput | null | undefined,
  peerRows: PrefecturePeerComparisonRow[]
): CitizenCostCompositionAssessment {
  const currentShares = normalizeCurrentCostShares(current);
  if (currentShares.length === 0) {
    return {
      state: "unavailable",
      topItems: [],
      abovePeerMedianItems: [],
      explanation: "費用構成の合計または内訳を確認できないため、集中先を判定しません。",
      evidenceTarget: "finance"
    };
  }

  const eligiblePeers = uniqueComparisonRows(peerRows).filter((row) => row.eligible);
  const peerSharesById = new Map<string, number[]>();
  for (const row of eligiblePeers) {
    for (const item of row.costCompositionShares ?? []) {
      if (!Number.isFinite(item.sharePercent) || item.sharePercent < 0) continue;
      const values = peerSharesById.get(item.id) ?? [];
      values.push(item.sharePercent);
      peerSharesById.set(item.id, values);
    }
  }

  const insights = currentShares.map((item) => {
    const peerMedianPercent = medianOfFiniteValues(peerSharesById.get(item.id) ?? []);
    return {
      ...item,
      peerMedianPercent,
      differencePoints: peerMedianPercent == null ? null : item.sharePercent - peerMedianPercent
    };
  });
  const topItems = [...insights]
    .sort((left, right) => right.sharePercent - left.sharePercent || left.id.localeCompare(right.id))
    .slice(0, 3);
  const abovePeerMedianItems = insights
    .filter((item) => item.differencePoints != null && item.differencePoints >= 5)
    .sort((left, right) => (right.differencePoints ?? 0) - (left.differencePoints ?? 0))
    .slice(0, 2);
  const hasPeerMedians = insights.some((item) => item.peerMedianPercent != null);

  return {
    state: hasPeerMedians ? "ready" : "current_only",
    topItems,
    abovePeerMedianItems,
    explanation: abovePeerMedianItems.length > 0
      ? "費用構成比が県内中央値より5ポイント以上高い費目を、費用の集中先として示しています。効率性や料金への因果関係を断定するものではありません。"
      : hasPeerMedians
        ? "県内中央値より5ポイント以上高い費目は確認されませんでした。上位費目は金額構成の説明であり、非効率を示すものではありません。"
        : "費用の上位項目は確認できますが、県内の費用構成との比較に必要な値が揃っていません。",
    evidenceTarget: "finance"
  };
}

export function buildCostCompositionDisplay(
  assessment: Pick<CitizenCostCompositionAssessment, "topItems" | "abovePeerMedianItems">
): CitizenCostCompositionDisplay {
  const topItems = assessment.topItems.slice(0, 3);
  const topIds = new Set(topItems.map((item) => item.id));
  return {
    topItems,
    additionalAbovePeerMedianItems: assessment.abovePeerMedianItems
      .slice(0, 2)
      .filter((item) => !topIds.has(item.id))
  };
}

export function buildSustainabilityAssessment({
  fundShortage,
  recovery,
  volumeTrend,
  finance
}: {
  fundShortage?: CitizenFundShortageInput | null;
  recovery: RecoveryBandAssessment;
  volumeTrend: VolumeTrendAssessment;
  finance?: CitizenFinanceInput | null;
}): SustainabilityAssessment {
  const reasons: SustainabilityReason[] = [];
  const ratio = nonNegativeFiniteOrNull(fundShortage?.ratioPercent);
  const thresholdReached = fundShortage?.status === "shortage"
    && ratio != null
    && ratio >= FUND_SHORTAGE_PLAN_THRESHOLD_PERCENT;

  if (fundShortage?.status === "shortage") {
    reasons.push({
      category: "fund_shortage",
      direction: "pressure",
      title: thresholdReached ? "経営健全化計画の基準以上" : "資金不足額あり",
      detail: ratio == null
        ? `${fundShortage.fiscalYearLabel}確報で資金不足額が確認されています。比率は確認できません。`
        : `${fundShortage.fiscalYearLabel}確報の資金不足比率は${formatOneDecimal(ratio)}%です。${thresholdReached ? "20%以上は原則として経営健全化計画の基準です。" : "20%の経営健全化基準未満です。"}`,
      evidenceTarget: "finance"
    });
  }

  if (recovery.band !== "unavailable") {
    reasons.push({
      category: "expense_recovery",
      direction: recovery.band === "covered" ? "supportive" : "pressure",
      title: recovery.label,
      detail: recovery.explanation,
      evidenceTarget: "yearbook"
    });
  }

  if (volumeTrend.kind !== "unavailable") {
    reasons.push({
      category: "billable_volume",
      direction: volumeTrend.kind === "decreasing" ? "pressure" : volumeTrend.kind === "increasing" ? "supportive" : "context",
      title: volumeTrend.kind === "decreasing"
        ? "有収水量が減少"
        : volumeTrend.kind === "increasing"
          ? "有収水量が増加"
          : "有収水量はおおむね横ばい",
      detail: volumeTrend.explanation,
      evidenceTarget: "yearbook"
    });
  }

  reasons.push(...buildFinancialReasons(finance));
  const selectedReasons = reasons.slice(0, 3);
  const recoveryPressure = recovery.band !== "covered" && recovery.band !== "unavailable";
  const volumePressure = volumeTrend.kind === "decreasing";
  const headline = thresholdReached
    ? "資金不足比率は経営健全化計画の基準以上です"
    : fundShortage?.status === "shortage"
      ? "資金不足額への対応状況を確認する必要があります"
      : recoveryPressure && volumePressure
        ? "費用回収と利用量の両面に改善圧力があります"
        : recoveryPressure
          ? "R6の費用回収に改善余地があります"
          : recovery.band === "covered"
            ? "R6の費用回収は確保されています"
            : "確認できる指標からの見立ては限定的です";
  const conclusionParts = selectedReasons.map((reason) => reason.detail);

  return {
    headline,
    derivedConclusion: conclusionParts.join(" "),
    reasons: selectedReasons,
    limitations: [
      ...(fundShortage == null || fundShortage.status === "unavailable"
        ? ["公式データとの会計単位の照合ができないため、資金不足比率は評価に含めていません。"]
        : []),
      "人口や利用量の将来推計、施設更新計画、物価・電力価格、企業債の償還計画を含まないため、長期的な持続可能性や料金改定の時期は断定できません。"
    ]
  };
}

export function buildSimpleFeeScenario({
  currentHouseholdFee20m3Yen,
  sewerFeeRevenue,
  wastewaterTreatmentCost
}: {
  currentHouseholdFee20m3Yen: number | null | undefined;
  sewerFeeRevenue: number | null | undefined;
  wastewaterTreatmentCost: number | null | undefined;
}): SimpleFeeScenario {
  const revenue = positiveFiniteOrNull(sewerFeeRevenue);
  const cost = positiveFiniteOrNull(wastewaterTreatmentCost);
  const caveat = "費用、有収水量、利用者構成などを一定とした単純計算です。料金改定の予測、推奨改定率、公式指標ではありません。";
  if (revenue == null || cost == null) {
    return {
      status: "unavailable",
      revenueIncreaseRatePercent: null,
      householdIllustration: null,
      explanation: "使用料収入または汚水処理費が未取得・不適切なため、単純シナリオは算定しません。",
      caveat
    };
  }

  const increaseRate = Math.max(cost / revenue - 1, 0);
  const currentFee = positiveFiniteOrNull(currentHouseholdFee20m3Yen);
  const illustratedFee = currentFee == null ? null : Math.round(currentFee * (1 + increaseRate));
  const householdIllustration = currentFee == null || illustratedFee == null ? null : {
    currentFeeYen: Math.round(currentFee),
    illustratedFeeYen: illustratedFee,
    monthlyDifferenceYen: illustratedFee - Math.round(currentFee),
    assumption: "すべての料金区分が同じ率で変わると仮定した20m³月額の機械的な換算です。"
  };

  if (increaseRate === 0) {
    return {
      status: "no_current_gap",
      revenueIncreaseRatePercent: 0,
      householdIllustration,
      explanation: "R6の費用回収だけを理由とする追加増収は、この単純計算では必要ありません。将来の値上げがないことや値下げ余地を示すものではありません。",
      caveat
    };
  }
  return {
    status: "gap",
    revenueIncreaseRatePercent: increaseRate * 100,
    householdIllustration,
    explanation: `現在の汚水処理費を使用料収入だけで回収するには、事業全体の使用料収入が単純計算で${formatOneDecimal(increaseRate * 100)}%多く必要です。`,
    caveat
  };
}

export function buildCitizenMunicipalityAssessment(
  input: CitizenMunicipalityAssessmentInput
): CitizenMunicipalityAssessment {
  const r6Available = input.r6DataAvailability.status === "available";
  const householdFeeApplicable = input.householdFee20m3Applicability === "applicable";
  const peerRows = r6Available ? input.peerRows ?? input.peerComparison?.rows ?? [] : [];
  const current = findCurrentRow(peerRows, input.currentComparisonUnitKey);
  const currentPeerEligible = current?.eligible === true;
  const householdFee = r6Available && householdFeeApplicable
    ? positiveFiniteOrNull(input.householdFee20m3Yen)
      ?? (currentPeerEligible ? positiveFiniteOrNull(current.householdFee20m3Yen) : null)
    : null;
  const treatmentCost = r6Available
    ? positiveFiniteOrNull(input.treatmentCostYenPerM3)
      ?? (currentPeerEligible ? positiveFiniteOrNull(current.treatmentCostYenPerM3) : null)
    : null;
  const recoveryRate = r6Available
    ? nonNegativeFiniteOrNull(input.expenseRecoveryRate)
      ?? (currentPeerEligible ? nonNegativeFiniteOrNull(current.expenseRecoveryRate) : null)
    : null;
  const eligiblePeerRows = currentPeerEligible
    ? uniqueComparisonRows(peerRows).filter((row) => row.eligible)
    : [];
  const comparisonUnavailableReason = !r6Available
    ? input.r6DataAvailability.reason
    : !householdFeeApplicable
      ? "特定公共下水道は一般家庭向け20m³月額料金の比較対象ではないため、料金・原価の県内比較は行いません。"
      : !current
        ? "選択中の事業に対応するR6の県内比較行を確認できないため、料金・原価の比較は行いません。"
        : !current.eligible
          ? `${current.exclusionReason?.label ?? "県内比較の対象外"}のため、法適用の比較対象事業の中央値と料金・原価を比較しません。`
          : null;
  const feeRank = r6Available && householdFeeApplicable
    ? buildFeeRankSummary(peerRows, input.currentComparisonUnitKey)
    : null;
  const volumeTrend = buildVolumeTrend(r6Available ? input.annuals ?? [] : []);
  const recovery = buildRecoveryBand(recoveryRate);

  return {
    r6DataAvailability: input.r6DataAvailability,
    householdFee20m3Applicability: input.householdFee20m3Applicability,
    comparisonBasis: {
      surveyYear: 2024,
      fiscalLabel: "R6",
      scopeLabel: comparisonScopeLabel(current ?? eligiblePeerRows[0] ?? null),
      sameRangePercent: CITIZEN_METRIC_SAME_RANGE_PERCENT
    },
    feeRank,
    feeRankUnavailableReason: feeRank == null
      ? !r6Available
        ? input.r6DataAvailability.reason
        : !householdFeeApplicable
          ? "特定公共下水道は一般家庭向け20m³月額料金の比較対象ではありません。"
          : feeRankReason(current, eligiblePeerRows)
      : null,
    feeCostRelationship: buildFeeCostRelationship({
      currentHouseholdFee20m3Yen: householdFee,
      peerHouseholdFees: eligiblePeerRows.map((row) => row.householdFee20m3Yen),
      currentTreatmentCostYenPerM3: treatmentCost,
      peerTreatmentCostsYenPerM3: eligiblePeerRows.map((row) => row.treatmentCostYenPerM3),
      unavailableReason: comparisonUnavailableReason
    }),
    volumeTrend,
    recovery,
    costComposition: buildCostCompositionAssessment(
      r6Available ? input.costComposition : null,
      currentPeerEligible ? peerRows : []
    ),
    sustainability: buildSustainabilityAssessment({
      fundShortage: input.fundShortage,
      recovery,
      volumeTrend,
      finance: r6Available ? input.finance : null
    }),
    feeScenario: buildSimpleFeeScenario({
      currentHouseholdFee20m3Yen: householdFee,
      sewerFeeRevenue: r6Available ? input.sewerFeeRevenue : null,
      wastewaterTreatmentCost: r6Available ? input.wastewaterTreatmentCost : null
    })
  };
}

export function buildCitizenR6DataAvailability(
  surveyYear: number | null | undefined,
  fiscalLabel?: string | null
): CitizenR6DataAvailability {
  if (surveyYear === 2024) {
    return { status: "available", sourceSurveyYear: 2024, reason: null };
  }
  const sourceSurveyYear = finiteOrNull(surveyYear);
  const sourceLabel = fiscalLabel?.trim()
    || (sourceSurveyYear == null ? "他年度" : `調査年度${sourceSurveyYear}`);
  return {
    status: "unavailable",
    sourceSurveyYear,
    reason: `選択中の事業ではR6決算を確認できないため、${sourceLabel}の値をR6診断に代用していません。`
  };
}

function normalizeCurrentCostShares(
  current: CitizenCostCompositionInput | null | undefined
): Array<{ id: string; label: string; sharePercent: number }> {
  if (!current) return [];
  const total = positiveFiniteOrNull(current.total);
  return current.items.flatMap((item) => {
    const suppliedShare = nonNegativeFiniteOrNull(item.sharePercent);
    const value = nonNegativeFiniteOrNull(item.value);
    const sharePercent = suppliedShare ?? (total != null && value != null ? value / total * 100 : null);
    return sharePercent == null ? [] : [{ id: item.id, label: item.label, sharePercent }];
  });
}

function buildFinancialReasons(finance: CitizenFinanceInput | null | undefined): SustainabilityReason[] {
  if (!finance) return [];
  const reasons: SustainabilityReason[] = [];
  const netIncome = finiteOrNull(finance.netIncome);
  if (netIncome != null) {
    reasons.push({
      category: "financial_result",
      direction: netIncome < 0 ? "pressure" : netIncome > 0 ? "supportive" : "context",
      title: netIncome < 0 ? "R6は純損失" : netIncome > 0 ? "R6は純利益" : "R6の純損益は均衡",
      detail: netIncome < 0
        ? "R6は純損失です。単年度の結果だけで持続可能性は断定できないため、複数年度の推移を確認する必要があります。"
        : netIncome > 0
          ? "R6は純利益です。単年度の黒字だけで長期的な持続可能性を保証するものではありません。"
          : "R6の純損益はおおむね均衡しています。",
      evidenceTarget: "finance"
    });
  }

  const currentNetAssets = finiteOrNull(finance.currentNetAssets);
  const priorNetAssets = finiteOrNull(finance.priorNetAssets);
  if (currentNetAssets != null && priorNetAssets != null) {
    const delta = currentNetAssets - priorNetAssets;
    reasons.push({
      category: "net_assets",
      direction: delta < 0 ? "pressure" : delta > 0 ? "supportive" : "context",
      title: delta < 0 ? "純資産が前年度より減少" : delta > 0 ? "純資産が前年度より増加" : "純資産は前年度と同水準",
      detail: delta < 0
        ? "純資産は前年度より減少しています。減少理由と今後の投資計画を併せて確認する必要があります。"
        : delta > 0
          ? "純資産は前年度より増加していますが、将来の更新費用まで賄えることを示すものではありません。"
          : "純資産は前年度と同水準です。",
      evidenceTarget: "finance"
    });
  }

  const bondTrend = buildBondTrend(finance.bondBalances ?? []);
  if (bondTrend) reasons.push(bondTrend);
  return reasons;
}

function buildBondTrend(
  points: NonNullable<CitizenFinanceInput["bondBalances"]>
): SustainabilityReason | null {
  const sorted = points
    .map((point) => ({ surveyYear: point.surveyYear, value: nonNegativeFiniteOrNull(point.value) }))
    .filter((point): point is { surveyYear: number; value: number } => point.value != null)
    .sort((left, right) => left.surveyYear - right.surveyYear);
  if (sorted.length < 2) return null;
  const first = sorted[0];
  const last = sorted.at(-1)!;
  if (first.surveyYear === last.surveyYear) return null;
  const delta = last.value - first.value;
  return {
    category: "bond_balance",
    direction: delta > 0 ? "pressure" : delta < 0 ? "supportive" : "context",
    title: delta > 0 ? "企業債残高が増加" : delta < 0 ? "企業債残高が減少" : "企業債残高は同水準",
    detail: delta > 0
      ? "確認できる期間で企業債残高が増えています。更新投資の内容と償還計画を併せて確認する必要があります。"
      : delta < 0
        ? "確認できる期間で企業債残高は減っています。必要な更新投資が確保されているかは別途確認が必要です。"
        : "確認できる期間の企業債残高は同水準です。",
    evidenceTarget: "finance"
  };
}

function feeRankReason(
  current: PrefecturePeerComparisonRow | null,
  eligibleRows: PrefecturePeerComparisonRow[]
) {
  if (!current) return "この事業に対応する県内比較行を確認できません。";
  if (!current.eligible) return current.exclusionReason?.label ?? "この条件では県内順位を算定できません。";
  if (positiveFiniteOrNull(current.householdFee20m3Yen) == null) return "20m³月額使用料が未取得のため、県内順位を算定できません。";
  if (!eligibleRows.some((row) => positiveFiniteOrNull(row.householdFee20m3Yen) != null)) {
    return "比較できる20m³月額使用料がないため、県内順位を算定できません。";
  }
  return "この条件では県内順位を算定できません。";
}

function findCurrentRow(
  rows: PrefecturePeerComparisonRow[],
  currentComparisonUnitKey?: string | null
): PrefecturePeerComparisonRow | null {
  if (currentComparisonUnitKey) {
    return rows.find((row) => row.comparisonUnitKey === currentComparisonUnitKey) ?? null;
  }
  return rows.find((row) => row.isCurrent) ?? null;
}

function uniqueComparisonRows(rows: PrefecturePeerComparisonRow[]) {
  const unique = new Map<string, PrefecturePeerComparisonRow>();
  for (const row of rows) {
    const existing = unique.get(row.comparisonUnitKey);
    if (!existing || (!existing.isCurrent && row.isCurrent)) {
      unique.set(row.comparisonUnitKey, row);
    }
  }
  return [...unique.values()];
}

function comparisonScopeLabel(row: PrefecturePeerComparisonRow | null) {
  if (row && (row.businessKey === "17-1-000" || row.businessKey === "17-4-000")) {
    return "同一都道府県の法適用・公共下水道および特定環境保全公共下水道";
  }
  return "同一都道府県の法適用・同一事業種別";
}

function formatOneDecimal(value: number) {
  return value.toFixed(1);
}

function finiteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? null : value;
}

function nonNegativeFiniteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) || value < 0 ? null : value;
}

function positiveFiniteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) || value <= 0 ? null : value;
}

// Keeps the peer-row JSON contract explicit for cost-composition consumers.
export type CitizenPeerCostCompositionShare = PrefecturePeerCostCompositionShare;
