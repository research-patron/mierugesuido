import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INTERMUNICIPAL_SEWER_SERVICE_AREAS } from "@/scripts/db/intermunicipalServiceAreas";

describe("intermunicipal sewer service areas", () => {
  it("links the verified Obanazawa-Oishida public and tokkan operations to both member municipalities", () => {
    expect(INTERMUNICIPAL_SEWER_SERVICE_AREAS.map((area) => [
      area.operatorMunicipalityCode,
      area.businessKey,
      area.servedMunicipalityCode
    ])).toEqual([
      ["069663", "17-1-000", "062120"],
      ["069663", "17-1-000", "063410"],
      ["069663", "17-4-000", "062120"],
      ["069663", "17-4-000", "063410"]
    ]);
    expect(new Set(INTERMUNICIPAL_SEWER_SERVICE_AREAS.map((area) => area.sourceUrl))).toEqual(new Set([
      "https://www1.g-reiki.net/town.oishida.yamagata/reiki_honbun/c421RG00000656.html"
    ]));
  });

  it("stores the relationship by operator and business key instead of copying financial rows", () => {
    const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toContain("model SewerServiceMembership");
    expect(schema).toContain("operatorMunicipalityId");
    expect(schema).toContain("businessKey");
    expect(schema).toContain("servedMunicipalityId");
    expect(schema).toContain("metricScope");
    expect(schema).not.toContain("model SewerBusinessServiceArea");
  });
});
