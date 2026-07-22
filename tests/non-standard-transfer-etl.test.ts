import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const etlSource = readFileSync(path.join(process.cwd(), "scripts/etl/etl.ts"), "utf8");
const staticSource = readFileSync(path.join(process.cwd(), "scripts/static/generate.ts"), "utf8");

describe("legal-applied non-standard-transfer mapping", () => {
  it("uses the official year-specific table 40 coordinates across R2-R6", () => {
    expect(etlSource).toContain(
      '{ field: "nonStandardTransfer", label: "基準外繰入合計", rowNo: "02", colNo: 37, toSurveyYear: 2022'
    );
    expect(etlSource).toContain(
      '{ field: "nonStandardTransfer", label: "基準外繰入合計", rowNo: "02", colNo: 57, fromSurveyYear: 2023'
    );
    expect(etlSource).not.toContain(
      '{ field: "nonStandardTransfer", label: "基準外繰入合計", rowNo: "01", colNo: 57, toSurveyYear: 2022'
    );
  });

  it("filters a mapping by fiscal year before matching its row", () => {
    expect(etlSource).toContain("if (!mappingAppliesToSurveyYear(mapping, surveyYear)) continue;");
    expect(etlSource).toContain("if (mapping.fromSurveyYear != null && surveyYear < mapping.fromSurveyYear) return false;");
    expect(etlSource).toContain("if (mapping.toSurveyYear != null && surveyYear > mapping.toSurveyYear) return false;");
  });

  it("maps the R6 table 40 actual and non-standard amounts by exact account title", () => {
    expect(etlSource).toContain(
      '{ field: "table40RainwaterBurden", label: "雨水処理負担金（実繰入額）", rowNo: "01", colNo: 2, fromSurveyYear: 2024, toSurveyYear: 2024'
    );
    expect(etlSource).toContain(
      '{ field: "table40OtherAccountSubsidy", label: "他会計補助金（実繰入額）", rowNo: "01", colNo: 13, fromSurveyYear: 2024, toSurveyYear: 2024'
    );
    expect(etlSource).toContain(
      '{ field: "table40CapitalOtherAccountSubsidy", label: "資本勘定の他会計補助金（実繰入額）", rowNo: "02", colNo: 8, fromSurveyYear: 2024, toSurveyYear: 2024'
    );
    expect(etlSource).toContain('field: "table40RainwaterBurdenNonStandard"');
    expect(etlSource).toContain('rowNo: "02", colNo: 44, fromSurveyYear: 2024, toSurveyYear: 2024');
    expect(etlSource).toContain('field: "table40OtherAccountSubsidyNonStandard"');
    expect(etlSource).toContain('rowNo: "02", colNo: 46, fromSurveyYear: 2024, toSurveyYear: 2024');
    expect(etlSource).toContain('field: "table40CapitalOtherAccountSubsidyNonStandard"');
    expect(etlSource).toContain('rowNo: "02", colNo: 51, fromSurveyYear: 2024, toSurveyYear: 2024');
    expect(etlSource).not.toContain(
      '{ field: "generalAccountTransfer", label: "他会計繰入金", rowNo: "01", colNo: 13'
    );
  });

  it("does not publish the ambiguous legacy field for legal-applied annual data", () => {
    expect(staticSource).toContain('annual.accountingType === "legal_applied" ? {} : { generalAccountTransfer }');
  });
});
