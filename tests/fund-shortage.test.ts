import { readFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  buildFundShortageStaticDataset,
  findFundShortageAssessment,
  type FundShortageStaticDataset,
  type FundShortageUniverseRow,
  type OfficialPositiveFundShortageRow
} from "@/lib/fundShortage";
import {
  parseEstatFundShortageUniverseWorkbook,
  parseSoumuPositiveFundShortageWorkbook,
  R6_FUND_SHORTAGE_SOURCES
} from "@/scripts/static/fundShortageData";
import {
  getStaticFundShortageAssessment,
  loadStaticFundShortageDataset
} from "@/lib/staticFundShortageDataset";

const staticDatasetPath = path.join(process.cwd(), "data", "static", "fund-shortage-r6.json");

describe("資金不足比率の公式会計単位データ", () => {
  it("e-Stat第22/26表から行01の下水道事業（一）（二）だけを読む", () => {
    const workbook = workbookFromRows([
      estatRow({ 事業コード: 1, 条件8: 1 }),
      estatRow({ 事業コード: 4, 条件8: 1 }),
      estatRow({ 事業コード: 5, 条件8: 2 }),
      estatRow({ 業種コード: 18, 事業コード: 1, 条件8: 2 }),
      estatRow({ 行番号: "02", 事業コード: 6, 条件8: 2 }),
      estatRow({ 業種コード: 1, 事業コード: 0, 条件8: 3 })
    ]);

    expect(parseEstatFundShortageUniverseWorkbook({
      workbook,
      expectedTableNumber: 22,
      expectedWorkCode: "46"
    })).toEqual([
      universeRow({ businessKey: "17-1-000", accountUnit: "1" }),
      universeRow({ businessKey: "17-4-000", accountUnit: "1" }),
      universeRow({ businessKey: "17-5-000", accountUnit: "2" }),
      universeRow({ businessKey: "18-1-000", accountUnit: "2" })
    ]);
  });

  it("総務省確報から下水道関係行を読み、0.0%の正の資金不足行を残す", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["2. 資金不足額がある公営企業会計の資金不足比率（団体別）"],
      ["(2) 市区町村"],
      ["都道府県名", "市区町村名", "公営企業会計名", "資金不足額", "資金不足比率"],
      ["新潟県", "見本市", "下水道事業会計", "1,234", "0.0"],
      ["新潟県", "見本市", "病院事業会計", "9,999", "9.9"]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "2(２)");

    const [positive] = parseSoumuPositiveFundShortageWorkbook(workbook);
    expect(positive).toEqual({
      prefectureName: "新潟県",
      prefectureCode: "15",
      municipalityName: "見本市",
      accountName: "下水道事業会計",
      amountThousandYen: 1234,
      ratioPercent: 0
    });

    const dataset = mockDataset({
      universeRows: [universeRow({
        municipalityCode: "151002",
        municipalityName: "見本市",
        prefectureCode: "15"
      })],
      positiveRows: [positive]
    });
    expect(findFundShortageAssessment(dataset, {
      municipalityCode: "151002",
      businessKey: "17-1-000",
      accountingType: "legal_applied"
    })).toMatchObject({
      status: "shortage",
      ratioPercent: 0,
      amountThousandYen: 1234,
      isAtOrAboveManagementImprovementThreshold: false
    });
  });

  it("公式一覧見出しを必須とし、市区町村以外の下水道資金不足を黙って除外しない", () => {
    const missingHeading = workbookFromAoa([
      ["都道府県名", "市区町村名", "公営企業会計名", "資金不足額", "資金不足比率"],
      ["新潟県", "見本市", "下水道事業会計", 100, 1]
    ]);
    expect(() => parseSoumuPositiveFundShortageWorkbook(missingHeading)).toThrow("資金不足会計一覧見出し");

    const unsupportedWorksheet = XLSX.utils.aoa_to_sheet([
      ["2. 資金不足額がある公営企業会計の資金不足比率（団体別）"],
      ["都道府県名", "一部事務組合等名", "公営企業会計名", "資金不足額", "資金不足比率"],
      ["新潟県", "見本組合", "下水道事業会計", 100, 1]
    ]);
    const unsupportedWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(unsupportedWorkbook, unsupportedWorksheet, "2(3)");
    expect(() => parseSoumuPositiveFundShortageWorkbook(unsupportedWorkbook)).toThrow("市区町村以外の下水道関係資金不足会計");
  });

  it("会計を複数事業で共有し、資金不足・資金不足なし・照合不能を区別する", () => {
    const dataset = mockDataset({
      universeRows: [
        universeRow({ businessKey: "17-4-000", accountUnit: "1" }),
        universeRow({ businessKey: "17-5-000", accountUnit: "1" }),
        universeRow({ municipalityCode: "151002", municipalityName: "新潟市", prefectureCode: "15", businessKey: "17-1-000" })
      ],
      positiveRows: [positiveRow({ ratioPercent: 20, accountName: "農業集落排水事業会計" })]
    });

    const sharedA = findFundShortageAssessment(dataset, {
      municipalityCode: "121002",
      businessKey: "17-4-000",
      accountingType: "legal_applied"
    });
    const sharedB = findFundShortageAssessment(dataset, {
      municipalityCode: "121002",
      businessKey: "17/5/000",
      accountingType: "legal_applied"
    });
    expect(sharedA).toMatchObject({
      status: "shortage",
      ratioPercent: 20,
      isAtOrAboveManagementImprovementThreshold: true,
      sharedBusinessKeys: ["17-4-000", "17-5-000"]
    });
    expect(sharedB.accountKey).toBe(sharedA.accountKey);

    expect(findFundShortageAssessment(dataset, {
      municipalityCode: "151002",
      businessKey: "17-1-000",
      accountingType: "legal_applied"
    })).toMatchObject({
      status: "no_shortage",
      ratioPercent: null,
      amountThousandYen: null,
      isAtOrAboveManagementImprovementThreshold: false,
      sourceUrls: {
        positiveList: R6_FUND_SHORTAGE_SOURCES.positiveListUrl
      }
    });

    expect(findFundShortageAssessment(dataset, {
      municipalityCode: "999999",
      businessKey: "17-1-000",
      accountingType: "legal_applied"
    })).toMatchObject({
      status: "unavailable",
      unavailableReason: "account_not_found",
      isAtOrAboveManagementImprovementThreshold: null
    });
  });

  it("派生R6 JSONに公式の下水道関係4会計と会計単位の共有を保持する", () => {
    const dataset = JSON.parse(readFileSync(staticDatasetPath, "utf8")) as FundShortageStaticDataset;
    const shortages = dataset.accounts.filter((account) => account.accountName != null);
    expect(dataset).toMatchObject({
      schemaVersion: 1,
      fiscalYear: 2024,
      thresholdPercent: 20,
      universeComplete: true
    });
    expect(dataset.accounts).toHaveLength(1993);
    expect(shortages).toHaveLength(4);
    expect(shortages.map((account) => ({
      municipalityCode: account.municipalityCode,
      accountName: account.accountName,
      amountThousandYen: account.amountThousandYen,
      ratioPercent: account.ratioPercent,
      accountingType: account.accountingType,
      businessKeys: account.businessKeys
    }))).toEqual([
      {
        municipalityCode: "053279",
        accountName: "農業集落排水事業会計",
        amountThousandYen: 1226,
        ratioPercent: 8.5,
        accountingType: "legal_applied",
        businessKeys: ["17-4-000", "17-5-000", "18-1-000"]
      },
      {
        municipalityCode: "325252",
        accountName: "下水道事業会計",
        amountThousandYen: 1428,
        ratioPercent: 3,
        accountingType: "legal_applied",
        businessKeys: ["17-4-000", "17-6-000", "18-0-000"]
      },
      {
        municipalityCode: "352021",
        accountName: "農業集落排水事業特別会計",
        amountThousandYen: 25461,
        ratioPercent: 128.5,
        accountingType: "non_legal_applied",
        businessKeys: ["17-5-000", "18-0-000"]
      },
      {
        municipalityCode: "442071",
        accountName: "津久見市下水道事業会計",
        amountThousandYen: 5850,
        ratioPercent: 4.2,
        accountingType: "legal_applied",
        businessKeys: ["17-1-000"]
      }
    ]);

    expect(findFundShortageAssessment(dataset, {
      municipalityCode: "352021",
      businessKey: "17-1-000",
      accountingType: "legal_applied"
    }).status).toBe("no_shortage");
    expect(findFundShortageAssessment(dataset, {
      municipalityCode: "352021",
      businessKey: "17-5-000",
      accountingType: "non_legal_applied"
    })).toMatchObject({
      status: "shortage",
      ratioPercent: 128.5,
      thresholdPercent: 20,
      isAtOrAboveManagementImprovementThreshold: true
    });
  });

  it("型付き静的ローダーから会計単位の判定を返す", async () => {
    const dataset = await loadStaticFundShortageDataset();
    expect(dataset.accounts).toHaveLength(1993);
    await expect(getStaticFundShortageAssessment({
      municipalityCode: "352021",
      businessKey: "18-0-000",
      accountingType: "non_legal_applied"
    })).resolves.toMatchObject({
      status: "shortage",
      accountKey: "2024:352021:47:2",
      accountName: "農業集落排水事業特別会計",
      sharedBusinessKeys: ["17-5-000", "18-0-000"]
    });
  });
});

function mockDataset(input: {
  universeRows: FundShortageUniverseRow[];
  positiveRows: OfficialPositiveFundShortageRow[];
}) {
  return buildFundShortageStaticDataset({
    fiscalYear: 2024,
    fiscalYearLabel: "R6（2024年度）",
    releaseLabel: "令和6年度決算 確報",
    sources: R6_FUND_SHORTAGE_SOURCES,
    ...input
  });
}

function universeRow(overrides: Partial<FundShortageUniverseRow> = {}): FundShortageUniverseRow {
  return {
    fiscalYear: 2024,
    municipalityCode: "121002",
    municipalityName: "見本市",
    prefectureCode: "12",
    workCode: "46",
    accountingType: "legal_applied",
    accountUnit: "1",
    businessKey: "17-1-000",
    ...overrides
  };
}

function positiveRow(overrides: Partial<OfficialPositiveFundShortageRow> = {}): OfficialPositiveFundShortageRow {
  return {
    prefectureName: "千葉県",
    prefectureCode: "12",
    municipalityName: "見本市",
    accountName: "下水道事業会計",
    amountThousandYen: 100,
    ratioPercent: 10,
    ...overrides
  };
}

function workbookFromRows(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "2024460002200");
  return workbook;
}

function workbookFromAoa(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "2(2)");
  return workbook;
}

function estatRow(overrides: Record<string, unknown> = {}) {
  return {
    決算年度: 2024,
    業務コード: 46,
    業種コード: 17,
    事業コード: 1,
    団体コード: 121002,
    団体名: "見本市",
    施設コード: 0,
    表番号: 22,
    行番号: "01",
    条件8: 1,
    ...overrides
  };
}
