import { describe, expect, it } from "vitest";
import {
  buildMunicipalityFeeRevisionStaticIndex,
  municipalityFeeRevisionFromStaticIndex
} from "@/lib/municipalityFeeRevisionStatic";

describe("municipality fee revision static index", () => {
  it("keeps strict changed and comparable unchanged states without inventing unavailable rows", () => {
    const index = buildMunicipalityFeeRevisionStaticIndex([
      {
        municipalityCode: "011002",
        feeRevisionComparison: {
          status: "changed",
          comparableBusinessCount: 2,
          changedBusinessCount: 1,
          changes: [{
            businessKey: "17-1-000",
            businessName: "公共下水道",
            r5EffectiveDate: "1996-04-01",
            r6EffectiveDate: "1997-04-01"
          }]
        }
      },
      {
        municipalityCode: "151009",
        feeRevisionComparison: {
          status: "unchanged",
          comparableBusinessCount: 1,
          changedBusinessCount: 0,
          changes: []
        }
      },
      { municipalityCode: "352021", feeRevisionComparison: null },
      { municipalityCode: null, feeRevisionComparison: null }
    ]);

    expect(Object.keys(index).sort()).toEqual(["151009", "011002"].sort());
    expect(municipalityFeeRevisionFromStaticIndex(index, "011002")?.status).toBe("changed");
    expect(municipalityFeeRevisionFromStaticIndex(index, "151009")?.status).toBe("unchanged");
    expect(municipalityFeeRevisionFromStaticIndex(index, "352021")).toBeNull();
  });
});
