import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pageSource = readFileSync(
  path.join(root, "app/municipalities/[municipalityCode]/page.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  path.join(root, "app/municipalities/[municipalityCode]/page.module.css"),
  "utf8"
);

describe("municipality business switch UI", () => {
  it("shows every business group as a direct Link instead of a select-and-submit form", () => {
    expect(pageSource).toMatch(/groups\.map\(\(group\)\s*=>\s*\{[\s\S]{0,1800}<Link\b/);
    expect(pageSource).toContain("href={detailHref(municipalityCode, group.key, view)}");
    expect(pageSource).toContain("groups.length > 1");

    expect(pageSource).not.toContain('id="detail-business"');
    expect(pageSource).not.toContain('name="business"');
    expect(pageSource).not.toMatch(/<form\b[^>]*className=\{styles\.business/i);
    expect(pageSource).not.toContain('type="submit"');
  });

  it("makes the selected and available business states explicit without relying on color", () => {
    expect(pageSource).toMatch(/aria-current=\{[^}]+\?\s*"page"\s*:\s*undefined\}/);
    expect(pageSource).toContain("表示中");
    expect(pageSource).toContain("この事業の決算を表示");
  });

  it("explains that the control changes only the displayed accounting dataset", () => {
    expect(pageSource).toContain("表示する決算データを選びます");
    expect(pageSource).toContain("事業・処理区域・契約先を変更する操作ではありません");
  });

  it("keeps the current detail view when switching business groups", () => {
    expect(pageSource).toContain("href={detailHref(municipalityCode, group.key, view)}");
    expect(pageSource).toContain("function detailHref(municipalityCode: string, business: string, view: DetailView)");
  });

  it("names the KPI region with the currently displayed business", () => {
    const kpiGridIndex = pageSource.indexOf("styles.kpiGrid");
    expect(kpiGridIndex).toBeGreaterThan(-1);

    const kpiContext = pageSource.slice(
      Math.max(0, kpiGridIndex - 350),
      kpiGridIndex + 350
    );
    expect(kpiContext).toContain("displayBusinessName(latestBusiness)");
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
    expect(jointSource).toContain('view: "fees"');
    expect(jointSource).not.toContain("組合の決算を見る");
    expect(jointSource).toMatch(/組合[^<\n]{0,20}料金[^<\n]{0,20}見る/);
  });

  it("gives business cards a usable target and at least four category tones", () => {
    const businessBlocks = [...cssSource.matchAll(/([^{}]*\.business[^{}]*)\{([^{}]*)\}/g)];
    const targetHeights = businessBlocks.flatMap(([, , declarations]) =>
      [...declarations.matchAll(/min-height:\s*(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]))
    );
    expect(targetHeights.some((height) => height >= 44)).toBe(true);

    const businessTones = new Set(
      [...cssSource.matchAll(/\.business[\w-]*\[data-tone="([^"]+)"\]/g)].map((match) => match[1])
    );
    expect(businessTones.size).toBeGreaterThanOrEqual(4);
  });
});
