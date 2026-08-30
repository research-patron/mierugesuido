import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { selectPeerComparisonView } from "@/components/MunicipalityDetailClient";
import { formatCostComponentDifference } from "@/components/municipality-detail/FeeLevelAnalysisPanel";
import type { PrefecturePeerComparisonResult } from "@/lib/prefecturePeerComparison";

const root = process.cwd();
const detailSource = readFileSync(
  path.join(root, "components/MunicipalityDetailClient.tsx"),
  "utf8"
);
const assessmentSource = readFileSync(
  path.join(root, "components/municipality-detail/CitizenAssessmentPanel.tsx"),
  "utf8"
);
const analysisSource = readFileSync(
  path.join(root, "components/municipality-detail/FeeLevelAnalysisPanel.tsx"),
  "utf8"
);

describe("fee-level analysis progressive-disclosure flow", () => {
  it("adds a directly addressable analysis view and falls back to the diagnosis for unknown views", () => {
    expect(detailSource).toContain(
      'type DetailView = "fees" | "fee-analysis" | "finance" | "prefecture" | "yearbook"'
    );
    expect(detailSource).toContain('value === "fee-analysis"');
    expect(detailSource).toMatch(/function parseDetailView[\s\S]*?: "fees";/);
    expect(detailSource).toContain('view === "fee-analysis" ? (');
    expect(detailSource).toContain("<FeeLevelAnalysisPanel");
  });

  it("preserves the selected business across the analysis and its onward links", () => {
    expect(detailSource).toContain(
      "router.push(detailHref(municipalityCode, event.currentTarget.value, view))"
    );
    expect(detailSource).toContain(
      'feeAnalysisHref={detailHref(municipalityCode, selectedGroup.key, "fee-analysis")}'
    );
    expect(detailSource).toContain(
      'diagnosisHref={detailHref(municipalityCode, selectedGroup.key, "fees")}'
    );
    expect(detailSource).toContain(
      'financeHref={detailHref(municipalityCode, selectedGroup.key, "finance")}'
    );
    expect(detailSource).toContain("peerLoading={peerLoading}");
    expect(detailSource).toContain(
      'yearbookHref={detailHref(municipalityCode, selectedGroup.key, "yearbook")}'
    );
  });

  it("treats a newly selected comparison key as loading before its effect starts", () => {
    const staleModel = { rows: [] } as unknown as PrefecturePeerComparisonResult;

    expect(selectPeerComparisonView("01:17-4-000", {
      requestKey: "01:17-1-000",
      status: "ready",
      model: staleModel
    })).toEqual({
      peerLoading: true,
      prefecturePeerComparison: null
    });
    expect(selectPeerComparisonView("01:17-4-000", {
      requestKey: "01:17-4-000",
      status: "loading",
      model: null
    }).peerLoading).toBe(true);
    expect(selectPeerComparisonView("01:17-4-000", {
      requestKey: "01:17-4-000",
      status: "ready",
      model: staleModel
    })).toEqual({
      peerLoading: false,
      prefecturePeerComparison: staleModel
    });
  });

  it("keeps four primary tabs and marks analysis as a child location of diagnosis", () => {
    const tabsStart = detailSource.indexOf('<nav className={styles.viewTabs}');
    const tabsEnd = detailSource.indexOf("</nav>", tabsStart);
    const tabsSource = detailSource.slice(tabsStart, tabsEnd);

    expect(tabsStart).toBeGreaterThan(-1);
    expect(tabsEnd).toBeGreaterThan(tabsStart);
    expect(tabsSource.match(/<Link\b/g)).toHaveLength(4);
    expect(tabsSource).not.toContain('href={detailHref(municipalityCode, selectedGroup.key, "fee-analysis")}');
    expect(tabsSource).toContain(
      'className={view === "fees" || view === "fee-analysis" ? styles.activeTab : undefined}'
    );
    expect(tabsSource).toContain(
      'aria-current={view === "fees" ? "page" : view === "fee-analysis" ? "location" : undefined}'
    );
  });

  it("keeps the initial diagnosis to a conclusion and the exact analysis CTA", () => {
    expect(assessmentSource).toContain("なぜ、この料金水準？");
    expect(assessmentSource).toContain('<Link href={feeAnalysisHref} className={styles.evidenceLink}>');
    expect(assessmentSource).toContain("料金水準の考察を見る");
    expect(assessmentSource).not.toContain("costEquation");
    expect(assessmentSource).not.toContain("costComponentGrid");
    expect(assessmentSource).not.toContain("costReasonDetails");
    expect(assessmentSource).not.toContain("purposeCostItems");
    expect(assessmentSource).not.toContain("natureCostItems");
    expect(assessmentSource).toContain("feeComparisonLoading");
    expect(assessmentSource).toContain("費用比較を読み込んでいます");
  });

  it("offers an explicit return path and onward finance and official-data paths", () => {
    expect(analysisSource).toContain('<Link href={diagnosisHref}');
    expect(analysisSource).toContain("このまちの診断に戻る");
    expect(analysisSource).toContain('<Link href={financeHref}');
    expect(analysisSource).toContain("費用と財務の根拠を見る");
    expect(analysisSource).toContain('<Link href={yearbookHref}');
    expect(analysisSource).toContain("{fiscalLabel}の公式値と計算式");
  });

  it("does not describe an older latest record as an R6 analysis", () => {
    expect(analysisSource).toContain('assessment.r6DataAvailability.status === "available"');
    expect(analysisSource).toContain("R6実績の確認状況");
    expect(analysisSource).toContain("R6実績が揃わないため、料金水準の費用分析は行いません");
    expect(analysisSource).toContain("comparisonLoading");
    expect(analysisSource).toContain("比較データを読み込み中");
    expect(analysisSource).toContain("比較を読み込み中");
  });

  it("shows the household fee together with total cost and billed-volume change", () => {
    expect(analysisSource).toContain("一般家庭用20m³／月（税込）");
    expect(analysisSource).toContain("assessment.feeCostRelationship.fee");
    expect(analysisSource).toContain("汚水処理原価（1m³あたり）");
    expect(analysisSource).toContain("R2→R6 有収水量（料金収入につながる水量）");
  });

  it("keeps detailed cost evidence collapsed until requested", () => {
    expect(analysisSource).toContain("<details");
    expect(analysisSource).toContain("費目の内訳と、ここから先の確認事項");
    expect(analysisSource).not.toMatch(/<details\b[^>]*\bopen(?:=|\s|>)/);
  });

  it("keeps the absolute cost gap when a zero median makes the percentage undefined", () => {
    expect(formatCostComponentDifference({
      position: "higher",
      current: 12.5,
      median: 0,
      difference: 12.5,
      differencePercent: null,
      sameRangePercent: 10
    })).toBe("+12.5円/m³（率比較不可）");
  });
});
