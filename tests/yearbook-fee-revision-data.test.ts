import { existsSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  loadYearbookFeeSnapshots,
  parseJapaneseEraDate7,
  parseYearbookFeeWorkbook,
  parseYearbookFeeWorksheet,
  yearbookFeeSnapshotIdentity
} from "@/scripts/static/yearbookFeeRevisionData";

const officialWorkbookRoot = process.env.YEARBOOK_FEE_TEST_SOURCE_ROOT?.trim()
  || path.join(process.cwd(), "data/raw/e-stat");
const officialWorkbookPaths = [
  "2024/legal_applied/33_2023460003300.xlsx",
  "2024/non_legal_applied/33_2023470003300.xlsx",
  "2025/legal_applied/33_2024460003300.xlsx",
  "2025/non_legal_applied/33_2024470003300.xlsx"
].map((relativePath) => path.join(officialWorkbookRoot, relativePath));
const hasOfficialWorkbookCache = officialWorkbookPaths.every((filePath) => existsSync(filePath));

describe("地方公営企業決算状況調査 第33表の料金改定データ", () => {
  it("行01・業種17・事業1/4だけを意味付きスナップショットへ変換する", () => {
    const worksheet = mockWorksheet([
      rawRow({
        決算年度: 2024,
        業務コード: 46,
        事業コード: 1,
        団体コード: 121002,
        団体名: "千葉市",
        施設コード: 0,
        列003: 23050,
        列004: 10,
        列005: 16,
        列006: 416,
        列007: 48,
        列011: 5060401,
        列012: 4260401,
        列013: 2140,
        列014: 21599,
        列015: 145679,
        列016: 145679,
        列017: 1951879,
        列018: 4036379,
        列032: 52,
        列033: 54
      }),
      rawRow({ 団体コード: 121003, 団体名: "対象外行", 行番号: "02" }),
      rawRow({ 団体コード: 121004, 団体名: "対象外業種", 業種コード: 18 }),
      rawRow({ 団体コード: 121005, 団体名: "対象外事業", 事業コード: 5 })
    ]);

    const snapshots = parseYearbookFeeWorksheet({ worksheet, surveyYear: 2024 });

    expect(snapshots).toEqual([{
      surveyYear: 2024,
      municipalityCode: "121002",
      municipalityName: "千葉市",
      prefectureName: "千葉県",
      businessKey: "17-1-000",
      businessName: "公共下水道",
      businessType: "公共下水道",
      categoryCode: "17/1",
      accountingType: "legal_applied",
      currentUsageFeeEffectiveDate: { iso: "2024-04-01", raw: "5060401" },
      previousUsageFeeRevisionDate: { iso: "2014-04-01", raw: "4260401" },
      householdFee20m3Yen: 2140,
      businessFeesYen: {
        100: 21599,
        500: 145679,
        1000: 145679,
        5000: 1951879,
        10000: 4036379
      },
      revisionRatesPercent: { household20m3: 5.2, average: 5.4 },
      tariffSystemSignals: {
        systemCodeRaw: 23050,
        waterVolumeRankCount: 10,
        minimumExcessUnitPriceYenPerM3: 16,
        maximumExcessUnitPriceYenPerM3: 416,
        progressivity: 4.8
      }
    }]);
  });

  it("列032/033のraw 0を未記載扱いにし、料金の0は原値として保持する", () => {
    const [snapshot] = parseYearbookFeeWorksheet({
      worksheet: mockWorksheet([rawRow({
        団体コード: "013331",
        団体名: "知内町",
        事業コード: 4,
        列011: 5060401,
        列012: 0,
        列013: 0,
        列014: 0,
        列032: 0,
        列033: 0
      })]),
      surveyYear: 2024
    });

    expect(snapshot.currentUsageFeeEffectiveDate).toEqual({ iso: "2024-04-01", raw: "5060401" });
    expect(snapshot.previousUsageFeeRevisionDate).toEqual({ iso: null, raw: null });
    expect(snapshot.householdFee20m3Yen).toBe(0);
    expect(snapshot.businessFeesYen[100]).toBe(0);
    expect(snapshot.revisionRatesPercent).toEqual({ household20m3: null, average: null });
  });

  it("7桁和暦を既知元号・年1以上・実在日に限定してISOへ変換する", () => {
    expect(parseJapaneseEraDate7(4260401)).toEqual({ iso: "2014-04-01", raw: "4260401" });
    expect(parseJapaneseEraDate7("5010501")).toEqual({ iso: "2019-05-01", raw: "5010501" });
    expect(parseJapaneseEraDate7(0)).toEqual({ iso: null, raw: null });
    expect(() => parseJapaneseEraDate7(5060230)).toThrow("和暦日付が不正");
    expect(() => parseJapaneseEraDate7(5000501)).toThrow("元号または年が不正");
    expect(() => parseJapaneseEraDate7(6010101)).toThrow("元号または年が不正");
    expect(() => parseJapaneseEraDate7("506401")).toThrow("7桁");
  });

  it("同一年度・同一identityの重複値が異なれば生成エラーにする", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, mockWorksheet([
      rawRow({ 団体コード: 121002, 団体名: "千葉市", 列011: 5060401, 列013: 2140 })
    ]), "sheet-1");
    XLSX.utils.book_append_sheet(workbook, mockWorksheet([
      rawRow({ 団体コード: 121002, 団体名: "千葉市", 列011: 5060401, 列013: 2200 })
    ]), "sheet-2");

    expect(() => parseYearbookFeeWorkbook({ workbook, surveyYear: 2024 }))
      .toThrow("同一年度の料金スナップショットの値が一致しません");
  });

  it("identityから会計区分を外し、法適用から法非適用への年度移行を比較可能にする", () => {
    const legal = parseYearbookFeeWorksheet({
      worksheet: mockWorksheet([rawRow({
        決算年度: 2023,
        業務コード: 46,
        団体コード: 121002,
        団体名: "千葉市",
        列011: 4260401
      })]),
      surveyYear: 2023
    })[0];
    const nonLegal = parseYearbookFeeWorksheet({
      worksheet: mockWorksheet([rawRow({
        決算年度: 2024,
        業務コード: 47,
        団体コード: 121002,
        団体名: "千葉市",
        列011: 5060401
      })]),
      surveyYear: 2024
    })[0];

    expect(legal.accountingType).toBe("legal_applied");
    expect(nonLegal.accountingType).toBe("non_legal_applied");
    expect(yearbookFeeSnapshotIdentity(legal)).toBe(yearbookFeeSnapshotIdentity(nonLegal));
  });

  it.runIf(hasOfficialWorkbookCache)("R5/R6公式ファイルから千葉市と知内町の表33原値を固定確認する", async () => {
    const [r5, r6] = await Promise.all([
      loadYearbookFeeSnapshots({ rootDir: officialWorkbookRoot, surveyYear: 2023 }),
      loadYearbookFeeSnapshots({ rootDir: officialWorkbookRoot, surveyYear: 2024 })
    ]);
    const r5Chiba = findSnapshot(r5, "121002", "17-1-000", "legal_applied");
    const r6Chiba = findSnapshot(r6, "121002", "17-1-000", "legal_applied");
    const r5Shiriuchi = findSnapshot(r5, "013331", "17-4-000", "legal_applied");
    const r6Shiriuchi = findSnapshot(r6, "013331", "17-4-000", "legal_applied");

    expect(r5Chiba).toMatchObject({
      currentUsageFeeEffectiveDate: { iso: "2014-04-01", raw: "4260401" },
      householdFee20m3Yen: 2035
    });
    expect(r6Chiba).toMatchObject({
      previousUsageFeeRevisionDate: { iso: "2014-04-01", raw: "4260401" },
      currentUsageFeeEffectiveDate: { iso: "2024-04-01", raw: "5060401" },
      householdFee20m3Yen: 2140,
      revisionRatesPercent: { household20m3: 5.2, average: 5.4 }
    });
    expect(r5Shiriuchi).toMatchObject({
      currentUsageFeeEffectiveDate: { iso: "2014-08-01", raw: "4260801" },
      householdFee20m3Yen: 2685
    });
    expect(r6Shiriuchi).toMatchObject({
      previousUsageFeeRevisionDate: { iso: "2014-08-01", raw: "4260801" },
      currentUsageFeeEffectiveDate: { iso: "2024-04-01", raw: "5060401" },
      householdFee20m3Yen: 3300,
      revisionRatesPercent: { household20m3: 26, average: 26 }
    });
    expect(new Set(r6.map((snapshot) => snapshot.accountingType)))
      .toEqual(new Set(["legal_applied", "non_legal_applied"]));
  });
});

function rawRow(overrides: Record<string, unknown> = {}) {
  return {
    決算年度: 2024,
    業務コード: 46,
    業種コード: 17,
    事業コード: 1,
    団体コード: 121002,
    団体名: "千葉市",
    施設コード: 0,
    表番号: 33,
    行番号: "01",
    列003: 0,
    列004: 0,
    列005: 0,
    列006: 0,
    列007: 0,
    列011: 0,
    列012: 0,
    列013: 0,
    列014: 0,
    列015: 0,
    列016: 0,
    列017: 0,
    列018: 0,
    列032: 0,
    列033: 0,
    ...overrides
  };
}

function mockWorksheet(rows: Array<Record<string, unknown>>) {
  return XLSX.utils.json_to_sheet(rows);
}

function findSnapshot(
  snapshots: Awaited<ReturnType<typeof loadYearbookFeeSnapshots>>,
  municipalityCode: string,
  businessKey: string,
  accountingType: string
) {
  const snapshot = snapshots.find((candidate) => (
    candidate.municipalityCode === municipalityCode
    && candidate.businessKey === businessKey
    && candidate.accountingType === accountingType
  ));
  expect(snapshot).toBeDefined();
  return snapshot!;
}
