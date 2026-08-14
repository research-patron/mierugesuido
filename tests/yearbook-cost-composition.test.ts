import { describe, expect, it } from "vitest";

import type { FinancialCostComposition } from "@/lib/financialStory";
import {
  assertCostCompositionMatchesOfficial,
  resolveOfficialCostCompositionReference,
  type OfficialYearbookBusiness
} from "@/lib/yearbookEvidence";

const COMPOSITION: FinancialCostComposition = {
  total: 1_000,
  items: [
    { id: "personnel", label: "職員給与費", value: 100 },
    { id: "interest", label: "支払利息", value: 50 },
    { id: "depreciation", label: "減価償却費", value: 300 },
    { id: "power", label: "動力費", value: 100 },
    { id: "utilities", label: "光熱水費", value: 10 },
    { id: "communications", label: "通信運搬費", value: 10 },
    { id: "repair", label: "修繕費", value: 50 },
    { id: "materials", label: "材料費", value: 10 },
    { id: "chemicals", label: "薬品費", value: 10 },
    { id: "road-restoration", label: "路面復旧費", value: 10 },
    { id: "outsourcing", label: "委託料", value: 200 },
    { id: "regional-sewerage-contribution", label: "流域下水道管理運営費負担金", value: 0 },
    { id: "other", label: "その他", value: 150 }
  ]
};

const OFFICIAL_BUSINESS: OfficialYearbookBusiness = {
  accountingType: "legal_applied",
  groups: [{
    id: "2-official.xls-№1",
    title: "業務概況（その2）及び費用構成に関する調（法適用企業）",
    workbookUrl: "https://www.soumu.go.jp/main_content/official.xls",
    sheetName: "№1",
    rows: [
      row(42, "（６）計（千円）", "100"),
      row(43, "２．支払利息（千円）", "50"),
      row(48, "３．減価償却費（千円）", "300"),
      row(49, "４．動力費（千円）", "100"),
      row(50, "５．光熱水費（千円）", "10"),
      row(51, "６．通信運搬費（千円）", "10"),
      row(52, "７．修繕費（千円）", "50"),
      row(53, "８．材料費（千円）", "10"),
      row(54, "９．薬品費（千円）", "10"),
      row(55, "10．路面復旧費（千円）", "10"),
      row(56, "11．委託料（千円）", "200"),
      row(57, "12．流域下水道管理運営費負担金（千円）", "-"),
      row(58, "13．その他（千円）", "150"),
      row(59, "14．費用合計（千円）", "1,000")
    ]
  }]
};

describe("R6費用構成と地方公営企業年鑑個表の照合", () => {
  it("maps all 13 expense rows and the Table 21 total to exact individual-table rows", () => {
    expect(resolveOfficialCostCompositionReference(OFFICIAL_BUSINESS, "personnel")).toMatchObject({
      rowNumber: 42,
      valueText: "100"
    });
    expect(resolveOfficialCostCompositionReference(OFFICIAL_BUSINESS, "utilities")).toMatchObject({
      rowNumber: 50,
      label: "５．光熱水費（千円）"
    });
    expect(resolveOfficialCostCompositionReference(OFFICIAL_BUSINESS, "total")).toMatchObject({
      rowNumber: 59,
      valueText: "1,000"
    });

    expect(assertCostCompositionMatchesOfficial(OFFICIAL_BUSINESS, COMPOSITION)).toEqual({
      checked: 14,
      groupTitle: "業務概況（その2）及び費用構成に関する調（法適用企業）",
      workbookUrl: "https://www.soumu.go.jp/main_content/official.xls",
      sheetName: "№1"
    });
  });

  it("accepts an official dash only as zero and stops generation on a real mismatch", () => {
    expect(() => assertCostCompositionMatchesOfficial(OFFICIAL_BUSINESS, COMPOSITION)).not.toThrow();
    expect(() => assertCostCompositionMatchesOfficial(OFFICIAL_BUSINESS, {
      ...COMPOSITION,
      items: COMPOSITION.items.map((item) => item.id === "outsourcing" ? { ...item, value: 201 } : item)
    })).toThrow("outsourcing: 第21表の値と公式個表が一致しません");
  });

  it("does not claim individual-table verification when a business-specific layout omits a row", () => {
    const withoutRegionalContribution = {
      ...OFFICIAL_BUSINESS,
      groups: OFFICIAL_BUSINESS.groups.map((group) => ({
        ...group,
        rows: group.rows.filter((candidate) => candidate.rowNumber !== 57)
      }))
    };

    expect(assertCostCompositionMatchesOfficial(withoutRegionalContribution, COMPOSITION)).toBeNull();
  });
});

function row(rowNumber: number, label: string, valueText: string) {
  return { rowNumber, labelCells: [label], valueText, kind: "data" as const };
}
