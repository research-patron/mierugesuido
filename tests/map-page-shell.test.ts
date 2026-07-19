import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const nationalPageSource = readFileSync(path.join(root, "app/map/page.tsx"), "utf8");
const prefecturePageSource = readFileSync(path.join(root, "app/map/[prefectureCode]/page.tsx"), "utf8");

describe("map page shell guardrails", () => {
  it("keeps the national page aligned with the home KPI language and year display", () => {
    for (const label of ["収録自治体数", "最新年度", "経費回収率100%未満の割合", "公式改定情報あり"]) {
      expect(nationalPageSource).toContain(`label="${label}"`);
    }

    expect(nationalPageSource).toContain('style: "long"');
    expect(nationalPageSource).toContain("latestFiscalWesternYear");
    expect(nationalPageSource).toContain('max-w-[1491px]');
    expect(nationalPageSource).toContain('className="map-page-kpi-grid');
    expect(nationalPageSource).not.toContain('label="対象自治体数"');
    expect(nationalPageSource).not.toContain('label="最新決算"');
  });

  it("derives prefecture KPIs only from the municipalities shown on the page", () => {
    expect(prefecturePageSource).toContain("const targetMunicipalities = data.municipalities;");
    expect(prefecturePageSource).toContain("const targetCount = targetMunicipalities.length;");
    expect(prefecturePageSource).toMatch(/\.map\(\(item(?:: any)?\) => item\.expenseRecoveryRate\)/);
    expect(prefecturePageSource).toMatch(/recoveryRates\.reduce\(\(sum(?:: number)?, value(?:: number)?\) => sum \+ value, 0\) \/ recoveryRates\.length/);
    expect(prefecturePageSource).toMatch(/recoveryRates\.filter\(\(value(?:: number)?\) => value < 100\)\.length/);
    expect(prefecturePageSource).toMatch(/targetMunicipalities\.filter\(\(item(?:: any)?\) => item\.hasRevisionEvent\)\.length/);

    for (const label of ["対象市区町村数", "平均経費回収率", "経費回収率100%未満の割合", "公式改定情報あり"]) {
      expect(prefecturePageSource).toContain(`label="${label}"`);
    }
  });

  it("uses the refined prefecture shell and accurate comparison language", () => {
    expect(prefecturePageSource).toContain("流域下水道を除く");
    expect(prefecturePageSource).toContain('href="/map" className="button-secondary"');
    expect(prefecturePageSource).toContain("都道府県を変更");
    expect(prefecturePageSource).toContain('className="map-page"');
    expect(prefecturePageSource).toContain('className="map-page-kpi-grid');
    expect(prefecturePageSource).toContain('max-w-[1491px]');
    expect(prefecturePageSource).not.toContain("公共下水道");
    expect(prefecturePageSource).not.toContain("自治体を変更");
    expect(prefecturePageSource).not.toContain('label="対象外事業"');
  });
});
