import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PrefecturePeerComparison,
  nearestFeePeers
} from "@/components/municipality-detail/PrefecturePeerComparison";
import type {
  PrefecturePeerComparisonResult,
  PrefecturePeerComparisonRow
} from "@/lib/prefecturePeerComparison";

const componentSource = readFileSync(
  path.join(process.cwd(), "components/municipality-detail/PrefecturePeerComparison.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  path.join(process.cwd(), "components/municipality-detail/PrefecturePeerComparison.module.css"),
  "utf8"
);

describe("citizen-first prefecture comparison UI", () => {
  it("shows competition rank, total, median gap and nearest fee peers before the full list", () => {
    const model = comparisonModel([
      comparisonRow({ municipalityCode: "01001", municipalityName: "高額市", comparisonUnitKey: "01001:17-1-000", householdFee20m3Yen: 4_000 }),
      comparisonRow({ municipalityCode: "01002", municipalityName: "表示市", comparisonUnitKey: "01002:17-1-000", householdFee20m3Yen: 3_000, isCurrent: true }),
      comparisonRow({ municipalityCode: "01003", municipalityName: "同額町", comparisonUnitKey: "01003:17-4-000", householdFee20m3Yen: 3_000, businessKey: "17-4-000" }),
      comparisonRow({ municipalityCode: "01004", municipalityName: "近隣村", comparisonUnitKey: "01004:17-1-000", householdFee20m3Yen: 2_900 }),
      comparisonRow({ municipalityCode: "01005", municipalityName: "低額町", comparisonUnitKey: "01005:17-1-000", householdFee20m3Yen: 2_000 })
    ]);

    const markup = renderToStaticMarkup(createElement(PrefecturePeerComparison, {
      model,
      businessLabel: "公共下水道"
    }));

    expect(markup).toContain("同率2位 / 5事業体");
    expect(markup).toContain("中央値 3,000円");
    expect(markup).toContain("北海道の中央値と同額です");
    expect(markup).toContain("料金が近い事業体");
    expect(markup.indexOf("料金が近い事業体")).toBeLessThan(markup.indexOf("道内の全事業体と対象外の市町村"));
    expect(markup).toContain("道内の全事業体と対象外の市町村");
    expect(markup).not.toMatch(/<details[^>]*open/);
  });

  it("explains why a missing or ineligible current row has no rank", () => {
    const model = comparisonModel([
      comparisonRow({
        municipalityCode: "01002",
        municipalityName: "対象外町",
        comparisonUnitKey: "01002:17-1-000",
        eligible: false,
        householdFee20m3Yen: null,
        expenseRecoveryRate: null,
        operatingCoverageRatio: null,
        isCurrent: true,
        exclusionReason: { code: "legal_applied_not_found", label: "市町村単独の法適用公共下水道・特環決算なし" }
      })
    ]);

    const markup = renderToStaticMarkup(createElement(PrefecturePeerComparison, {
      model,
      businessLabel: "公共下水道"
    }));

    expect(markup).toContain("この条件では道内順位を算定できません");
    expect(markup).toContain("対象外町は比較対象外です");
    expect(markup).toContain("市町村単独の法適用公共下水道・特環決算なし");
    expect(markup).not.toContain("料金が高い方から");
  });

  it("selects three unique nearest comparison units and keeps joint-operation values unallocated", () => {
    const current = comparisonRow({ municipalityCode: "01001", municipalityName: "表示市", comparisonUnitKey: "01001:17-1-000", householdFee20m3Yen: 3_000, isCurrent: true });
    const joint = comparisonRow({
      municipalityCode: "01002",
      municipalityName: "甲町・乙村",
      comparisonUnitKey: "01999:17-1-000",
      detailMunicipalityCode: "01999",
      householdFee20m3Yen: 3_020,
      isJointOperation: true,
      operatorMunicipalityCode: "01999",
      operatorMunicipalityName: "甲乙事務組合",
      representedMunicipalityCodes: ["01002", "01003"],
      representedMunicipalityNames: ["甲町", "乙村"],
      representedMunicipalityCount: 2
    });
    const duplicateJoint = { ...joint };
    const rows = [
      current,
      joint,
      duplicateJoint,
      comparisonRow({ municipalityCode: "01004", municipalityName: "近隣町", comparisonUnitKey: "01004:17-1-000", householdFee20m3Yen: 2_950 }),
      comparisonRow({ municipalityCode: "01005", municipalityName: "次点市", comparisonUnitKey: "01005:17-1-000", householdFee20m3Yen: 3_100 }),
      comparisonRow({ municipalityCode: "01006", municipalityName: "遠方町", comparisonUnitKey: "01006:17-1-000", householdFee20m3Yen: 3_500 })
    ];

    const nearest = nearestFeePeers(rows, current.comparisonUnitKey, 3_000);

    expect(nearest.map((row) => row.comparisonUnitKey)).toEqual([
      "01999:17-1-000",
      "01004:17-1-000",
      "01005:17-1-000"
    ]);
    expect(new Set(nearest.map((row) => row.comparisonUnitKey)).size).toBe(3);

    const markup = renderToStaticMarkup(createElement(PrefecturePeerComparison, {
      model: comparisonModel(rows),
      businessLabel: "公共下水道"
    }));
    expect(markup).toContain("組合全体の料金");
    expect(markup).toContain("順位・中央値では1事業体として1回だけ数え、平均・合計にも1回だけ集計します");
  });

  it("never links a joint operator without a generated municipality detail", () => {
    const joint = comparisonRow({
      municipalityCode: "062120",
      municipalityName: "尾花沢市・大石田町",
      comparisonUnitKey: "069663:17-1-000",
      detailMunicipalityCode: "069663",
      isJointOperation: true,
      operatorMunicipalityCode: "069663",
      operatorMunicipalityName: "尾花沢市大石田町環境衛生事業組合",
      representedMunicipalityCodes: ["062120", "063410"],
      representedMunicipalityNames: ["尾花沢市", "大石田町"],
      representedMunicipalityCount: 2,
      isCurrent: true
    });
    const unavailableMarkup = renderToStaticMarkup(createElement(PrefecturePeerComparison, {
      model: comparisonModel([joint]),
      businessLabel: "公共下水道",
      availableMunicipalityDetailCodes: []
    }));
    expect(unavailableMarkup).not.toContain("/municipalities/069663");
    expect(unavailableMarkup).toContain("組合全体の詳細は当サイトでは未掲載");

    const availableMarkup = renderToStaticMarkup(createElement(PrefecturePeerComparison, {
      model: comparisonModel([joint]),
      businessLabel: "公共下水道",
      availableMunicipalityDetailCodes: ["069663"]
    }));
    expect(availableMarkup).toContain("/municipalities/069663?");
  });

  it("keeps the full list permanently visible and mobile controls at least 44px high", () => {
    expect(componentSource).toContain('<section className={styles.fullListSection} aria-labelledby="full-prefecture-fee-comparison-title">');
    expect(componentSource).toContain('<header className={styles.fullListHeading}>');
    expect(componentSource).not.toContain("<details className={styles.fullListDetails}");
    expect(componentSource).not.toContain(".fullListDetails");
    expect(cssSource).not.toContain(".fullListDetails");
    expect(cssSource).toMatch(/@media \(max-width: 720px\)[\s\S]*min-height:\s*44px/s);
    expect(cssSource).not.toContain("gradient(");
    expect(cssSource).toMatch(/@media \(max-width: 720px\)[\s\S]*\.tableScroll\s*\{\s*display:\s*none/s);
  });

  it("uses light semantic emphasis for the rank, difference, metrics, and selected municipality", () => {
    expect(componentSource).toContain('tone="rank"');
    expect(componentSource).toContain('tone="difference"');
    expect(componentSource).toContain('tone="fee"');
    expect(componentSource).toContain('tone="recovery"');
    expect(componentSource).toContain('data-tone={tone}');
    expect(cssSource).toMatch(/\.summaryCard\[data-tone="difference"\][^{]*\{[^}]*background:\s*var\(--peer-violet-soft\)/s);
    expect(cssSource).toMatch(/\.chartCard\[data-tone="recovery"\][^{]*\{[^}]*background:\s*var\(--peer-teal-soft\)/s);
    expect(cssSource).toMatch(/\.table thead th:nth-child\(2\)[^{]*\{[^}]*background:\s*#e7f3fa/s);
    expect(cssSource).toMatch(/\.table thead th:nth-child\(3\)[^{]*\{[^}]*background:\s*#e7f4f4/s);
    expect(cssSource).toMatch(/\.currentRow th,[\s\S]*?\.currentRow td\s*\{[^}]*background:\s*#e8f6f8/s);
    expect(componentSource).toContain("styles.currentBadge");
    expect(cssSource).toMatch(/\.currentBadge\s*\{[^}]*font-size:\s*9\.5px/s);
    expect(cssSource).not.toMatch(/\.mobileCurrent dl div:nth-child\(2\)[^{]*\{[^}]*(?:background|border-radius):/s);
    expect(cssSource).not.toContain("gradient(");
  });
});

function comparisonModel(rows: PrefecturePeerComparisonRow[]) {
  const eligibleRows = rows.filter((row) => row.eligible);
  return {
    prefectureCode: "01",
    prefectureName: "北海道",
    businessKey: "17-1-000",
    currentMunicipalityCode: rows.find((row) => row.isCurrent)?.municipalityCode ?? null,
    surveyYear: 2024,
    fiscalLabel: "R6",
    rows,
    summary: {
      totalMunicipalities: rows.reduce((total, row) => total + row.representedMunicipalityCount, 0),
      eligibleMunicipalities: eligibleRows.reduce((total, row) => total + row.representedMunicipalityCount, 0),
      eligibleComparisonUnits: eligibleRows.length,
      excludedMunicipalities: rows.filter((row) => !row.eligible).reduce((total, row) => total + row.representedMunicipalityCount, 0),
      exclusionCounts: {
        flow_sewer_excluded: 0,
        outside_public_sewer_comparison_scope: 0,
        same_business_not_found: 0,
        legal_applied_not_found: rows.filter((row) => row.exclusionReason?.code === "legal_applied_not_found").length,
        r6_data_not_found: 0
      },
      averages: { operatingCoverageRatio: 80 },
      positiveCounts: {
        expenseRecoveryAtLeast100: 0,
        operatingCoverageBelow100: eligibleRows.length,
        highRecoveryButOperatingCoverageBelow100: 0
      },
      missingCounts: { expenseRecoveryRate: 0, operatingCoverageRatio: 0 }
    }
  } as PrefecturePeerComparisonResult;
}

function comparisonRow(overrides: Partial<PrefecturePeerComparisonRow> = {}) {
  const municipalityCode = overrides.municipalityCode ?? "01001";
  return {
    municipalityCode,
    municipalityName: "例市",
    representedMunicipalityCodes: [municipalityCode],
    representedMunicipalityNames: ["例市"],
    representedMunicipalityCount: 1,
    prefectureName: "北海道",
    businessKey: "17-1-000",
    businessName: "公共下水道事業",
    businessType: "公共下水道",
    accountingType: "legal_applied",
    comparisonUnitKey: `${municipalityCode}:17-1-000`,
    detailMunicipalityCode: municipalityCode,
    isJointOperation: false,
    operatorMunicipalityCode: null,
    operatorMunicipalityName: null,
    jointOperationSourceUrl: null,
    jointOperationSourceLabel: null,
    isCurrent: false,
    eligible: true,
    exclusionReason: null,
    householdFee20m3Yen: 3_000,
    expenseRecoveryRate: 90,
    operatingRevenue: 90,
    operatingExpense: 100,
    operatingLoss: 10,
    operatingCoverageRatio: 90,
    servicePopulation: 10_000,
    connectedPopulation: 9_000,
    ...overrides
  } as PrefecturePeerComparisonRow;
}
