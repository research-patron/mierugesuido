import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import XLSX from "xlsx";
import { afterEach, describe, expect, it } from "vitest";
import {
  YEARBOOK_SOURCE_PAGE,
  assertOfficialHeadlineValues,
  buildYearbookIndividualDataIndex,
  discoverOfficialYearbookSources,
  emptyYearbookIndividualData,
  type YearbookOfficialSource,
  type YearbookTarget
} from "@/scripts/static/yearbookOriginalData";

const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("地方公営企業年鑑『個表』の自治体別抜粋", () => {
  it("discovers the official R6 individual-table workbooks and accounting categories", () => {
    const sources = discoverOfficialYearbookSources(`
      <h2>12．個表</h2>
      <li>（1）施設及び業務概況に関する調（法適用企業）</li>
      <li><a href="/main_content/001065539.xls">（ア）公共下水道<img alt="Excel"></a></li>
      <li>（6）施設及び業務概況に関する調（法非適用企業）</li>
      <li><a href="/main_content/001065584.xls">（ア）公共下水道1<img alt="Excel"></a></li>
      <h2>13．付表</h2>
    `);

    expect(sources).toEqual([
      expect.objectContaining({
        groupNo: 1,
        accountingType: "legal_applied",
        businessCategoryCode: "17/1",
        businessTypeName: "公共下水道",
        sourceUrl: "https://www.soumu.go.jp/main_content/001065539.xls"
      }),
      expect.objectContaining({
        groupNo: 6,
        accountingType: "non_legal_applied",
        businessCategoryCode: "17/1",
        businessTypeName: "公共下水道",
        sourceUrl: "https://www.soumu.go.jp/main_content/001065584.xls"
      })
    ]);
  });

  it("keeps official row order, hierarchy, row numbers, display text, dashes, blanks, and notes", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "yearbook-individual-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "official.xlsx");
    const rows: unknown[][] = Array.from({ length: 15 }, () => []);
    rows[2][1] = "（2）業務概況（その2）及び費用構成に関する調（法適用企業）";
    rows[3][1] = "（ア）公共下水道";
    rows[8][4] = "団体名";
    rows[8][5] = "新潟県";
    rows[9][1] = "項目";
    rows[9][5] = "新潟市";
    rows[10][1] = "使用料等";
    rows[10][2] = "一般家庭用20m3／月（円）";
    rows[10][5] = 2640;
    rows[11][1] = "費用構成";
    rows[12][2] = "汚水処理費に対する使用料の割合（％）";
    rows[12][5] = 104;
    rows[13][2] = "該当なし";
    rows[13][5] = "-";
    rows[14][1] = "（注）数値は表示単位未満を四捨五入している。";

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "№2");
    XLSX.writeFile(workbook, filePath);

    const source: YearbookOfficialSource = {
      id: "2-001065555.xls",
      groupNo: 2,
      groupTitle: "業務概況（その2）及び費用構成に関する調（法適用企業）",
      accountingType: "legal_applied",
      businessCategoryCode: "17/1",
      businessTypeName: "公共下水道",
      sourceUrl: "https://www.soumu.go.jp/main_content/001065555.xls",
      localPath: filePath
    };
    const target: YearbookTarget = {
      municipalityCode: "151009",
      municipalityName: "新潟市",
      prefectureName: "新潟県",
      businessKey: "17-1-000",
      accountingType: "legal_applied"
    };

    const result = buildYearbookIndividualDataIndex([source], [target], 2024);
    const municipality = result.byMunicipality.get("151009");
    const business = municipality?.businesses[0];
    const group = business?.groups[0];

    expect(result.sourceFilesRead).toBe(1);
    expect(result.matchedBusinessCount).toBe(1);
    expect(business).toMatchObject({
      businessKey: "17-1-000",
      accountingType: "legal_applied",
      operatorName: "新潟市"
    });
    expect(group).toMatchObject({
      id: "2-001065555.xls-№2",
      sheetName: "№2",
      businessTypeName: "公共下水道",
      workbookUrl: source.sourceUrl
    });
    expect(group?.rows).toEqual([
      { rowNumber: 11, labelCells: ["使用料等", "一般家庭用20m3／月（円）"], valueText: "2640", kind: "data" },
      { rowNumber: 12, labelCells: ["費用構成"], valueText: "", kind: "heading" },
      { rowNumber: 13, labelCells: ["汚水処理費に対する使用料の割合（％）"], valueText: "104", kind: "data" },
      { rowNumber: 14, labelCells: ["該当なし"], valueText: "-", kind: "data" },
      { rowNumber: 15, labelCells: ["（注）数値は表示単位未満を四捨五入している。"], valueText: "", kind: "note" }
    ]);
    expect(JSON.stringify(municipality)).not.toContain(filePath);
    expect(() => assertOfficialHeadlineValues(municipality!, {
      businessKey: "17-1-000",
      accountingType: "legal_applied",
      householdFee20m3Yen: 2640,
      expenseRecoveryRate: 103.9923
    })).not.toThrow();
    expect(() => assertOfficialHeadlineValues(municipality!, {
      businessKey: "17-1-000",
      accountingType: "legal_applied",
      householdFee20m3Yen: 2910,
      expenseRecoveryRate: 103.9923
    })).toThrow("一般家庭用20m³／月が公式個表と一致しません");
  });

  it("returns an explicit empty official payload when no workbook column matches", () => {
    expect(emptyYearbookIndividualData(2024)).toEqual({
      fiscalYear: 2024,
      sourcePageUrl: YEARBOOK_SOURCE_PAGE,
      businesses: []
    });
  });

  it("places the official extraction in a dedicated URL-backed tab and progressively reveals all rows", () => {
    const detailSource = readFileSync("components/MunicipalityDetailClient.tsx", "utf8");
    const viewerSource = readFileSync("components/municipality-detail/YearbookOriginalData.tsx", "utf8");
    const generatorSource = readFileSync("scripts/static/generate.ts", "utf8");

    expect(detailSource).toContain("地方公営企業年鑑「個表」");
    expect(detailSource).toContain('href={detailHref(municipalityCode, selectedGroup.key, "yearbook")}');
    expect(detailSource).toContain('enabled={view === "yearbook"}');
    expect(detailSource).toContain("年鑑・根拠データ");
    expect(detailSource).not.toContain("setYearbookOpen");
    expect(detailSource).not.toContain("yearbookDisclosure");
    expect(viewerSource).toContain("/data/static/yearbook/${municipalityCode}.json");
    expect(viewerSource).toContain("公式個表の全項目を見る");
    expect(viewerSource).toContain("公式の項目順・階層・表示値");
    expect(viewerSource).not.toContain("e-Stat公開Excelのまま");
    expect(viewerSource).not.toContain("yearbookTableScroll");
    expect(viewerSource).toContain("candidate.businessKey === businessKey && candidate.accountingType === accountingType");
    expect(generatorSource).toContain('path.join(publicRoot, "yearbook", `${item.municipalityCode}.json`)');
  });
});
