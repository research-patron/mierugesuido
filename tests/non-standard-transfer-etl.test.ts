import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const etlSource = readFileSync(path.join(process.cwd(), "scripts/etl/etl.ts"), "utf8");

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
});
