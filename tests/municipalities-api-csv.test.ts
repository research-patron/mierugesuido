import { beforeEach, describe, expect, it, vi } from "vitest";

const getMunicipalityListMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/data", () => ({
  getMunicipalityList: getMunicipalityListMock
}));

import { GET } from "@/app/api/municipalities/route";

describe("municipality CSV API", () => {
  beforeEach(() => {
    getMunicipalityListMock.mockReset();
  });

  it("requests the complete filtered result instead of the paginated 100-row slice", async () => {
    const items = Array.from({ length: 173 }, (_, index) => ({
      prefectureName: "北海道",
      municipalityName: `自治体${index + 1}`,
      municipalityCode: String(index + 1).padStart(6, "0"),
      businessType: "公共下水道",
      latestYear: 2024,
      latestFiscalYearLabel: "令和6年度",
      diagnosis: null,
      hasRevisionEvent: false
    }));
    getMunicipalityListMock.mockResolvedValue({ items, total: items.length, page: 1, limit: 100 });

    const response = await GET(new Request(
      "http://localhost/api/municipalities?prefecture=%E5%8C%97%E6%B5%B7%E9%81%93&format=csv&kind=town&nameQuery=%E7%94%BA&sort=expense-recovery-high"
    ));
    const csv = await response.text();

    expect(getMunicipalityListMock).toHaveBeenCalledWith(expect.objectContaining({
      prefecture: "北海道",
      municipalityNameQuery: "町",
      municipalityKind: "town",
      sort: "expense-recovery-high",
      all: true
    }));
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(csv.trim().split("\n")).toHaveLength(174);
    expect(csv).toContain("100%相当の増収率（%・単純試算）");
  });

  it("keeps JSON requests paginated", async () => {
    getMunicipalityListMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });

    await GET(new Request("http://localhost/api/municipalities?prefecture=%E5%8C%97%E6%B5%B7%E9%81%93&limit=100"));

    expect(getMunicipalityListMock).toHaveBeenCalledWith(expect.objectContaining({ all: false }));
  });

  it("exports an internal 0.25 revision fraction as 25.0 percent", async () => {
    getMunicipalityListMock.mockResolvedValue({
      items: [{
        prefectureName: "新潟県",
        municipalityName: "検証市",
        municipalityCode: "150001",
        businessKey: "17-1-000",
        businessType: "公共下水道",
        accountingType: "legal_applied",
        latestYear: 2024,
        latestFiscalYearLabel: "R6",
        diagnosis: {
          requiredRevisionRateTo100: 0.25,
          expenseRecoveryRate: 80,
          feeUnitPriceYenPerM3: 120,
          treatmentCostYenPerM3: 150,
          feeAdequacyLabel: "要注意"
        },
        hasRevisionEvent: false,
        dataQualityStatus: "ok",
        flags: []
      }],
      total: 1,
      page: 1,
      limit: 100
    });

    const response = await GET(new Request("http://localhost/api/municipalities?format=csv"));
    const csv = await response.text();

    expect(csv).toContain('"25.0"');
    expect(csv).not.toContain('"0.25"');
  });
});
