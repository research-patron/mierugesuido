import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildYearbookOriginalDataIndex,
  compactYearbookOriginalData,
  emptyYearbookOriginalData
} from "@/scripts/static/yearbookOriginalData";

const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("地方公営企業年鑑の元データ", () => {
  it("keeps the official column names, order, and cell text while selecting the matching R6 sewer row", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "yearbook-original-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "official.xlsx");
    const columns = [
      "決算年度", "業務コード", "業種コード", "事業コード", "団体コード", "団体名",
      "施設コード", "施設名", "表番号", "行番号", "条件1", "列001", "列002"
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([
      columns,
      ["2024", "46", "17", "1", "151009", "新潟市", "000", "", "20", "01", "", "000123", "0"],
      ["2023", "46", "17", "1", "151009", "新潟市", "000", "", "20", "01", "", "999", "0"],
      ["2024", "46", "06", "0", "151009", "新潟市", "001", "", "20", "01", "", "888", "0"]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "2024460002000");
    XLSX.writeFile(workbook, filePath);

    const result = buildYearbookOriginalDataIndex([{
      id: 24,
      surveyYear: 2025,
      accountingType: "legal_applied",
      tableNo: 20,
      tableName: "損益計算書",
      sourceUrl: "https://www.e-stat.go.jp/example",
      localPath: filePath
    }], 2024);
    const municipality = result.byMunicipality.get("151009");
    const table = municipality?.businesses[0]?.tables[0];

    expect(result.sourceFilesRead).toBe(1);
    expect(result.originalRows).toBe(1);
    expect(municipality?.fiscalYearLabel).toBe("R6");
    expect(municipality?.businesses[0]).toMatchObject({
      businessKey: "17-1-000",
      accountingType: "legal_applied"
    });
    expect(table?.columns).toEqual(columns);
    expect(table?.rows).toEqual([[
      [0, "2024"], [1, "46"], [2, "17"], [3, "1"], [4, "151009"], [5, "新潟市"],
      [6, "000"], [8, "20"], [9, "01"], [11, "000123"], [12, "0"]
    ]]);
    expect(JSON.stringify(municipality)).not.toContain(filePath);
    const compact = compactYearbookOriginalData(municipality!);
    expect(compact.columnSets).toEqual({ "columns-1": columns });
    expect(compact.businesses[0].tables[0]).toMatchObject({ columnSetId: "columns-1" });
    expect(compact.businesses[0].tables[0]).not.toHaveProperty("columns");
  });

  it("returns an explicit empty R6 payload when a municipality has no matching official row", () => {
    expect(emptyYearbookOriginalData(2024)).toEqual({
      fiscalYear: 2024,
      fiscalYearLabel: "R6",
      formatNote: "列名・列順・値は、総務省・e-Stat公開Excelの原表形式を維持しています。",
      businesses: []
    });
  });

  it("lazy-loads the raw file and exposes the exact-format viewer on every municipality detail page", () => {
    const detailSource = readFileSync("components/MunicipalityDetailClient.tsx", "utf8");
    const viewerSource = readFileSync("components/municipality-detail/YearbookOriginalData.tsx", "utf8");
    const generatorSource = readFileSync("scripts/static/generate.ts", "utf8");

    expect(detailSource).toContain("地方公営企業年鑑の元データ");
    expect(detailSource).toContain("enabled={yearbookOpen}");
    expect(viewerSource).toContain("/data/static/yearbook/${municipalityCode}.json");
    expect(viewerSource).toContain("列名・列順・値はe-Stat公開Excelのまま");
    expect(viewerSource).toContain("candidate.businessKey === businessKey && candidate.accountingType === accountingType");
    expect(generatorSource).toContain('path.join(publicRoot, "yearbook", `${item.municipalityCode}.json`)');
  });
});
