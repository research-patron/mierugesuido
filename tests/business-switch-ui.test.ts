import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pageSource = readFileSync(
  path.join(root, "components/MunicipalityDetailClient.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  path.join(root, "app/municipalities/[municipalityCode]/page.module.css"),
  "utf8"
);

describe("municipality business switch UI", () => {
  it("shows every business group in one compact select without a submit step", () => {
    expect(pageSource).toContain("<select");
    expect(pageSource).toContain("groups.map((group) => (");
    expect(pageSource).toContain('<option key={group.key} value={group.key}>');
    expect(pageSource).toContain("groups.length > 1");
    expect(pageSource).not.toMatch(/<form\b[^>]*className=\{styles\.business/i);
    expect(pageSource).not.toContain('type="submit"');
  });

  it("labels the selected business, accounting basis, and fiscal year in text", () => {
    expect(pageSource).toContain("選択中の決算事業");
    expect(pageSource).toContain("displayBusinessName(group.latestBusiness)");
    expect(pageSource).toContain("accountingTypeLabel(group.latestBusiness.accountingType)");
    expect(pageSource).toContain("formatSettlementFiscalLabel({ surveyYear: group.latest.surveyYear");
  });

  it("explains that the control switches the displayed accounting dataset without redundant caveat copy", () => {
    expect(pageSource).toContain("料金・財務・{areaLabel}比較を、選んだ事業の決算へ切り替えます");
    expect(pageSource).not.toContain("処理区域や契約先を変える操作ではありません");
    expect(pageSource).not.toContain("styles.businessSelectorNote");
    expect(cssSource).not.toContain(".businessSelectorNote");
  });

  it("keeps the current detail view when switching business groups", () => {
    expect(pageSource).toContain("router.push(detailHref(municipalityCode, event.currentTarget.value, view))");
    expect(pageSource).toContain("function detailHref(municipalityCode: string, business: string, view: DetailView)");
  });

  it("passes the selected business into the citizen diagnosis", () => {
    expect(pageSource).toContain("<CitizenAssessmentPanel");
    expect(pageSource).toContain("businessKey={latestBusiness.businessKey}");
    expect(pageSource).toContain("businessLabel={displayBusinessName(latestBusiness)}");
    expect(pageSource).toContain('feeAnalysisHref={detailHref(municipalityCode, selectedGroup.key, "fee-analysis")}');
  });

  it("keeps the same selected business in the analysis return, finance, and official-data links", () => {
    const analysisStart = pageSource.indexOf("<FeeLevelAnalysisPanel");
    const analysisEnd = pageSource.indexOf("/>", analysisStart);
    const analysisProps = pageSource.slice(analysisStart, analysisEnd);

    expect(analysisStart).toBeGreaterThan(-1);
    expect(analysisProps).toContain('diagnosisHref={detailHref(municipalityCode, selectedGroup.key, "fees")}');
    expect(analysisProps).toContain('financeHref={detailHref(municipalityCode, selectedGroup.key, "finance")}');
    expect(analysisProps).toContain('yearbookHref={detailHref(municipalityCode, selectedGroup.key, "yearbook")}');
  });

  it("labels unavailable R6 financial views without implying that statements exist", () => {
    expect(pageSource).toContain("財務図 対象外");
    expect(pageSource).toContain("R6 財務（未取得）");
  });

  it("describes joint-operation links as fee-data destinations when they open the fees view", () => {
    const jointStart = pageSource.indexOf("function JointOperationLinks");
    const jointEnd = pageSource.indexOf("function EmptyMunicipality", jointStart);
    expect(jointStart).toBeGreaterThan(-1);
    expect(jointEnd).toBeGreaterThan(jointStart);

    const jointSource = pageSource.slice(jointStart, jointEnd);
    expect(pageSource).toContain('new URLSearchParams({ business: businessKey, view: "fees" })');
    expect(jointSource).not.toContain("組合の決算を見る");
    expect(jointSource).toMatch(/組合[^<\n]{0,20}料金[^<\n]{0,20}見る/);
  });

  it("gives the compact business select a 44px minimum target", () => {
    expect(cssSource).toMatch(/\.businessSelectControl select\s*\{[^}]*min-height:\s*44px/s);
    expect(cssSource).toMatch(/\.businessSelector\s*\{[^}]*grid-template-columns:\s*minmax\(260px, 0\.75fr\) minmax\(420px, 1\.25fr\)/s);
  });

  it("uses a restrained neutral boundary without decorative business cards", () => {
    expect(pageSource).not.toContain("businessOptionMark");
    expect(cssSource).not.toContain(".businessOptionMark");
    expect(cssSource).not.toContain(".businessOption");
    expect(cssSource).not.toMatch(/\.businessSelector[^}]*background:\s*(?:linear|radial)-gradient/s);
  });
});
