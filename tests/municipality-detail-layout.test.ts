import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssSource = readFileSync(
  path.join(process.cwd(), "app/municipalities/[municipalityCode]/page.module.css"),
  "utf8"
);
const detailSource = readFileSync(
  path.join(process.cwd(), "components/MunicipalityDetailClient.tsx"),
  "utf8"
);

describe("municipality detail visual rhythm", () => {
  it("stretches the four view tabs across the shared content width", () => {
    expect(cssSource).toMatch(/\.viewTabs\s*\{[^}]*width:\s*100%[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
    expect(cssSource).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.tabLabelDesktop\s*\{[^}]*display:\s*none/s);
    expect(cssSource).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.tabLabelMobile\s*\{[^}]*display:\s*inline/s);
  });

  it("puts the citizen diagnosis before tabs and removes the repeated KPI-card row", () => {
    expect(detailSource.indexOf("<CitizenAssessmentPanel")).toBeLessThan(detailSource.indexOf("<nav className={styles.viewTabs}"));
    expect(detailSource.indexOf("<FeeLevelAnalysisPanel")).toBeGreaterThan(detailSource.indexOf("<nav className={styles.viewTabs}"));
    expect(detailSource).not.toContain("styles.kpiGrid");
    expect(cssSource).toMatch(/\.businessSelectControl select\s*\{[^}]*min-height:\s*44px/s);
    expect(cssSource).toMatch(/\.viewTabs\s*\{[^}]*margin-bottom:\s*8px/s);
    expect(cssSource).toMatch(/\.feeDecision \+ \.contentSection\s*\{[^}]*margin-top:\s*12px/s);
    expect(cssSource).toMatch(/\.contentSection \+ \.formulaSection,[\s\S]*?\.financeSection \+ \.formulaSection,[\s\S]*?\.yearbookView \+ \.formulaSection\s*\{[^}]*margin-top:\s*16px/s);
  });

  it("starts the finance tab directly with its evidence figures", () => {
    expect(detailSource).not.toContain("料金・持続可能性とのつながり");
    expect(detailSource).not.toContain("styles.financeBridge");
    expect(cssSource).not.toContain(".financeBridge");
    expect(detailSource).toContain("<FinancialStory {...financialStory} />");
  });

  it("removes municipality announcements and keeps indicator formulas always visible", () => {
    expect(detailSource).not.toContain("自治体の公式発表");
    expect(detailSource).not.toContain("styles.revisionCard");
    expect(detailSource).not.toContain("styles.disclosure");
    expect(detailSource).toContain('<section className={styles.formulaSection} aria-labelledby="indicator-formula-title">');
    expect(detailSource).toContain('<h2 id="indicator-formula-title">指標の計算式</h2>');
    expect(cssSource).not.toContain(".revisionCard");
    expect(cssSource).not.toContain(".revisionList");
    expect(cssSource).not.toContain(".disclosure");
  });
});
