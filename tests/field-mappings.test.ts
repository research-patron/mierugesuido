import { readFileSync } from "node:fs";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import {
  readKnownPositions,
  staleVerifiedMappingIds,
  YAML_FIELD_MAPPING_SOURCE
} from "@/scripts/etl/fieldMappings";

describe("official R2-R6 field mappings", () => {
  it("records the same verified fee and cost coordinates for both accounting types", () => {
    const yaml = YAML.parse(readFileSync("03_FIELD_MAPPING.yml", "utf8"));
    const expected = {
      household_fee_20m3_yen: { tableNo: 33, rowNo: 1, colNo: 13 },
      opex_component: { tableNo: 32, rowNo: 1, colNo: 44 },
      capital_cost_component: { tableNo: 32, rowNo: 2, colNo: 8 },
      wastewater_treatment_cost: { tableNo: 32, rowNo: 2, colNo: 16 }
    };

    for (const [field, coordinate] of Object.entries(expected)) {
      for (const accountingType of ["legal_applied", "non_legal_applied"]) {
        const preferred = yaml.standard_fields[field].sources[accountingType].preferred;
        expect(Number(preferred.table_no)).toBe(coordinate.tableNo);
        expect(readKnownPositions(preferred)).toEqual([
          expect.objectContaining({ rowNo: coordinate.rowNo, colNo: coordinate.colNo })
        ]);
      }
    }
  });

  it("does not convert missing or invalid examples into 0/0 placeholders", () => {
    expect(readKnownPositions({ item_keywords: ["年間有収水量"] })).toEqual([]);
    expect(readKnownPositions({
      known_position_examples: [
        {},
        { row_no: 0, col_no: 44 },
        { row_no: 2 },
        { row_no: 2, col_no: 16 }
      ]
    })).toEqual([{ rowNo: 2, colNo: 16, sourceNote: undefined }]);
  });

  it("cleans only stale YAML rows for exact verified fields", () => {
    const rows = [
      { id: 1, standardField: "wastewater_treatment_cost", tableNo: 32, rowNo: 2, colNo: 16, mappingSource: YAML_FIELD_MAPPING_SOURCE },
      { id: 2, standardField: "wastewater_treatment_cost", tableNo: 32, rowNo: 2, colNo: 8, mappingSource: YAML_FIELD_MAPPING_SOURCE },
      { id: 3, standardField: "wastewater_treatment_cost", tableNo: 32, rowNo: 0, colNo: 0, mappingSource: YAML_FIELD_MAPPING_SOURCE },
      { id: 4, standardField: "wastewater_treatment_cost", tableNo: 32, rowNo: 9, colNo: 9, mappingSource: "manual_review" },
      { id: 5, standardField: "sewer_fee_revenue", tableNo: 26, rowNo: 2, colNo: 70, mappingSource: YAML_FIELD_MAPPING_SOURCE }
    ];

    expect(staleVerifiedMappingIds(
      rows,
      "wastewater_treatment_cost",
      32,
      [{ rowNo: 2, colNo: 16 }]
    )).toEqual([2, 3]);
    expect(staleVerifiedMappingIds(
      rows,
      "sewer_fee_revenue",
      26,
      [{ rowNo: 1, colNo: 3 }]
    )).toEqual([]);
  });
});
