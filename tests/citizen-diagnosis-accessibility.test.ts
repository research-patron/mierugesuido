import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const detailSource = readFileSync(path.join(root, "components/MunicipalityDetailClient.tsx"), "utf8");
const assessmentSource = readFileSync(
  path.join(root, "components/municipality-detail/CitizenAssessmentPanel.tsx"),
  "utf8"
);
const feeAnalysisSource = readFileSync(
  path.join(root, "components/municipality-detail/FeeLevelAnalysisPanel.tsx"),
  "utf8"
);
const assessmentCss = readFileSync(
  path.join(root, "components/municipality-detail/CitizenAssessmentPanel.module.css"),
  "utf8"
);
const detailCss = readFileSync(
  path.join(root, "app/municipalities/[municipalityCode]/page.module.css"),
  "utf8"
);
const peerSource = readFileSync(
  path.join(root, "components/municipality-detail/PrefecturePeerComparison.tsx"),
  "utf8"
);
const peerCss = readFileSync(
  path.join(root, "components/municipality-detail/PrefecturePeerComparison.module.css"),
  "utf8"
);
const financialCss = readFileSync(
  path.join(root, "components/municipality-detail/FinancialStory.module.css"),
  "utf8"
);
const sourcePage = readFileSync(path.join(root, "app/data-sources/page.tsx"), "utf8");
const sharedCopy = readFileSync(path.join(root, "lib/copy.ts"), "utf8");

describe("citizen diagnosis accessibility and plain-language guardrails", () => {
  it("keeps each tab's visible name inside its accessible name", () => {
    expect(detailSource).toContain('aria-label="このまちの診断"');
    expect(detailSource).toContain('aria-label={`財務の根拠（${financeAvailabilityLabel}）`}');
    expect(detailSource).toContain('aria-label={`県内の位置（${municipality.prefectureName}内の比較）`}');
    expect(detailSource).toContain('aria-label="公式データ"');
  });

  it("keeps key mobile controls at least 44px and detailed analysis visible", () => {
    expect(assessmentCss).not.toContain("min-height: 32px");
    expect(assessmentCss).toMatch(/\.evidenceLink\s*\{[^}]*min-height:\s*44px/s);
    expect(feeAnalysisSource).not.toContain("<details");



    expect(feeAnalysisSource).toContain('<Link href={diagnosisHref}');
    expect(feeAnalysisSource).toContain('<Link href={financeHref}');
    expect(feeAnalysisSource).toContain('<Link href={yearbookHref}');
    expect(detailCss).toMatch(/\.backLink\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.jointOperationLinks > a\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.jointOperationLinks > \.jointOperationSource\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.viewTabs a\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.costBreakdown summary\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.disclaimer summary\s*\{[^}]*min-height:\s*44px/s);
    expect(detailSource).toContain("<details className={styles.feeEvidenceDetails}>");
  });

  it("keeps official-data controls and source evidence comfortable to tap", () => {
    expect(detailCss).toMatch(/\.yearbookSourcePageLink\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.yearbookMeta a\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.yearbookGroupToolbar select\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.yearbookReferenceLine a\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.yearbookEmpty a\s*\{[^}]*min-height:\s*44px/s);
    expect(detailCss).toMatch(/\.evidenceList a\s*\{[^}]*min-height:\s*44px/s);
    expect(peerCss).toMatch(/\.operatorLine a\s*\{[^}]*min-height:\s*44px/s);
    expect(financialCss).toMatch(/\.costSourceNote a\s*\{[^}]*min-height:\s*44px/s);
    expect(financialCss).toMatch(/\.traceDetails li a\s*\{[^}]*min-height:\s*44px/s);

    const informationPageLinks = sourcePage.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(informationPageLinks.length).toBeGreaterThan(0);
    for (const link of informationPageLinks) expect(link).toContain("min-h-11");
  });

  it("keeps primary citizen-facing explanations readable without enlarging the first-screen line boxes", () => {
    expect(assessmentSource).not.toContain("assessment.sustainability.derivedConclusion");
    expect(assessmentCss).toMatch(/\.reasonList span\s*\{[^}]*font-size:\s*12px/s);
    expect(assessmentCss).toMatch(/\.fundStatus small,[^}]*font-size:\s*12px/s);
    expect(detailCss).toMatch(/\.businessSelectorCopy p\s*\{[^}]*font-size:\s*12px;[^}]*line-height:\s*1\.35/s);
    expect(detailCss).toMatch(/\.yearbookViewHeading p\s*\{[^}]*font-size:\s*12px/s);
    expect(detailCss).toMatch(/\.disclaimer p\s*\{[^}]*font-size:\s*12px/s);
  });

  it("distinguishes the five citizen questions with semantic emphasis instead of color alone", () => {
    expect(assessmentSource).toContain('data-topic="fee"');
    expect(assessmentSource).toContain('data-topic="cost"');
    expect(assessmentSource).toContain('data-topic="sustainability" data-tone={sustainabilityTone}');
    expect(assessmentSource).toContain('data-topic="future" data-tone={futureTone}');
    expect(assessmentSource).toContain('data-topic="fund" data-tone={fundTone}');
    expect(assessmentSource).toContain('reason.direction === "pressure"');
    expect(assessmentSource).toContain('fundShortage.isAtOrAboveManagementImprovementThreshold ? "critical" : "pressure"');
    expect(assessmentSource).toContain('data-critical={reason.category === "fund_shortage"');

    expect(assessmentCss).toContain('.questionRow[data-topic="sustainability"]');
    expect(assessmentCss).toContain('.questionRow[data-tone="critical"]');
    expect(assessmentCss).toContain('.fundStatus[data-status="threshold"]');
    expect(assessmentCss).toMatch(/\.reasonList li\[data-direction="pressure"\]\s*\{[^}]*#fff0d8/s);
    expect(assessmentCss).toMatch(/\.reasonList li\[data-critical="true"\]\s*\{[^}]*#ab3048/s);
    expect(assessmentSource).toContain("資金不足会計一覧に掲載なし");
    expect(assessmentCss).not.toMatch(/background:\s*(?:linear|radial)-gradient/);
  });

  it("uses regional wording and explains technical terms at first use", () => {
    expect(assessmentSource).toContain('if (prefectureName === "北海道") return "道内"');
    expect(assessmentSource).toContain('if (prefectureName === "東京都") return "都内"');
    expect(assessmentSource).toContain('if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内"');
    expect(peerSource).toContain('const areaLabel = prefectureAreaLabel(model.prefectureName)');
    expect(feeAnalysisSource).toContain("汚水1m³を処理する費用");
    expect(assessmentSource).toContain("会計単位");
  });

  it("does not hide explanatory text inside an image role", () => {
    expect(peerSource).not.toContain('role="img"');
    expect(peerSource).toContain("比較条件の詳しい説明");
  });

  it("does not publish the misleading claims prohibited by the assessment rules", () => {
    const publicCopy = [detailSource, assessmentSource, feeAnalysisSource, peerSource, sourcePage, sharedCopy].join("\n");
    expect(publicCopy).not.toContain("自動的な起債禁止");
    expect(publicCopy).not.toContain("将来料金の予測");
    expect(publicCopy).not.toContain("安全です");
    expect(publicCopy).not.toContain("100%未満は営業損失");
    expect(publicCopy).toContain("経費回収率は使用料収入÷汚水処理費×100");
  });

  it("describes a non-listed fund-shortage account as a list cross-check rather than a published zero", () => {
    expect(assessmentSource).toContain("資金不足会計一覧に掲載なし");
    expect(assessmentSource).toContain("資金不足のデータ未確認");
    expect(assessmentSource).not.toContain("<strong>資金不足額なし");
    expect(sourcePage).toContain("「一覧に掲載なし」または「未確認」");
  });

  it("gives information-page tables captions, column scopes, and comfortable disclosures", () => {
    expect(sourcePage.match(/<caption className="sr-only">/g)).toHaveLength(3);
    expect(sourcePage).toContain('<th scope="col">');
    expect(sourcePage).toContain('summary className="flex min-h-11');
    expect(sourcePage).toContain("9. 公式データ項目の意味");
  });
});
