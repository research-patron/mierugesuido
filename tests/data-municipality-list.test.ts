import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  municipalityFindMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    municipality: {
      findMany: prismaMocks.municipalityFindMany
    }
  }
}));

import { getMunicipalityList } from "@/lib/data";

const FLOW_BUSINESS_TYPE = "下水道事業（一） 事業コード3";
const PUBLIC_BUSINESS_TYPE = "下水道事業（一） 事業コード1";
const RURAL_BUSINESS_TYPE = "下水道事業（一） 事業コード5";

describe("getMunicipalityList", () => {
  beforeEach(() => {
    prismaMocks.municipalityFindMany.mockReset();
  });

  it("excludes flow-sewer businesses before counting and pagination", async () => {
    const rows = [
      municipality("090000", "流域のみ市", [
        business({
          businessKey: "17-3-000",
          businessType: "別名管理事業",
          risk: 100
        })
      ]),
      municipality("010001", "複数事業市", [
        business({ businessType: FLOW_BUSINESS_TYPE, risk: 100 }),
        business({ businessType: PUBLIC_BUSINESS_TYPE, risk: 20 })
      ]),
      municipality("020001", "公共下水道市", [
        business({ businessType: PUBLIC_BUSINESS_TYPE, risk: 10 })
      ])
    ];
    prismaMocks.municipalityFindMany.mockResolvedValue(rows);

    const firstPage = await getMunicipalityList({ page: 1, limit: 1 });
    const secondPage = await getMunicipalityList({ page: 2, limit: 1 });

    expect(firstPage).toMatchObject({ total: 2, page: 1, limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0]).toMatchObject({
      municipalityName: "複数事業市",
      businessType: PUBLIC_BUSINESS_TYPE
    });
    expect(secondPage).toMatchObject({ total: 2, page: 2, limit: 1 });
    expect(secondPage.items[0].municipalityName).toBe("公共下水道市");
    expect([...firstPage.items, ...secondPage.items].some((item) => item.businessType === FLOW_BUSINESS_TYPE)).toBe(false);

    const query = prismaMocks.municipalityFindMany.mock.calls[0][0];
    expect(query).not.toHaveProperty("skip");
    expect(query).not.toHaveProperty("take");
  });

  it("selects the representative only from businesses matching both business filters", async () => {
    prismaMocks.municipalityFindMany.mockResolvedValue([
      municipality("010001", "条件一致市", [
        business({
          businessType: PUBLIC_BUSINESS_TYPE,
          accountingType: "legal_applied",
          risk: 99,
          label: "重点監視"
        }),
        business({
          businessType: RURAL_BUSINESS_TYPE,
          accountingType: "non_legal_applied",
          risk: 5,
          label: "適正水準"
        })
      ]),
      municipality("010002", "会計不一致市", [
        business({ businessType: RURAL_BUSINESS_TYPE, accountingType: "legal_applied", risk: 80 })
      ]),
      municipality("010003", "事業不一致市", [
        business({ businessType: PUBLIC_BUSINESS_TYPE, accountingType: "non_legal_applied", risk: 70 })
      ])
    ]);

    const result = await getMunicipalityList({
      businessType: RURAL_BUSINESS_TYPE,
      accountingType: "non_legal_applied"
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      municipalityName: "条件一致市",
      businessType: RURAL_BUSINESS_TYPE,
      accountingType: "non_legal_applied",
      diagnosis: {
        feeAdequacyLabel: "適正水準",
        revisionRiskScore: 5
      }
    });
  });

  it("selects the latest survey year before considering revision risk", async () => {
    prismaMocks.municipalityFindMany.mockResolvedValue([
      municipality("010001", "最新年度市", [
        business({ businessType: "旧高リスク事業", year: 2023, risk: 99, recovery: 60 }),
        business({ businessType: "R6事業", year: 2024, risk: 5, recovery: 105 })
      ])
    ]);

    const result = await getMunicipalityList({});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      municipalityName: "最新年度市",
      businessType: "R6事業",
      latestYear: 2024,
      diagnosis: {
        expenseRecoveryRate: 105,
        revisionRiskScore: 5
      }
    });
  });

  it("filters diagnosis labels and sorts the complete result before counting and pagination", async () => {
    const rows = [
      municipality("010001", "対象外市", [
        business({ label: "適正水準", recovery: 10, risk: 90 })
      ]),
      municipality("010002", "回収率90市", [
        business({ label: "重点監視", recovery: 90, risk: 80 })
      ]),
      municipality("010003", "回収率70市", [
        business({ label: "重点監視", recovery: 70, risk: 70 })
      ]),
      municipality("010004", "別の対象外市", [
        business({ label: "やや不足", recovery: 5, risk: 60 })
      ])
    ];
    prismaMocks.municipalityFindMany.mockResolvedValue(rows);

    const firstPage = await getMunicipalityList({
      label: "重点監視",
      sort: "expense-recovery-low",
      page: 1,
      limit: 1
    });
    const secondPage = await getMunicipalityList({
      label: "重点監視",
      sort: "expense-recovery-low",
      page: 2,
      limit: 1
    });

    expect(firstPage.total).toBe(2);
    expect(firstPage.items.map((item) => item.municipalityName)).toEqual(["回収率70市"]);
    expect(secondPage.total).toBe(2);
    expect(secondPage.items.map((item) => item.municipalityName)).toEqual(["回収率90市"]);
  });

  it("exports every matching municipality while excluding aggregate rows and honoring map filters", async () => {
    const aggregate = municipality("000000", "テスト県", [business({ recovery: 999 })]);
    const cities = Array.from({ length: 105 }, (_, index) => municipality(
      String(index + 1).padStart(6, "0"),
      `対象${index + 1}市`,
      [business({ recovery: index + 1 })]
    ));
    const towns = Array.from({ length: 5 }, (_, index) => municipality(
      String(index + 501).padStart(6, "0"),
      `対象${index + 1}町`,
      [business({ recovery: 500 + index })]
    ));
    prismaMocks.municipalityFindMany.mockResolvedValue([aggregate, ...cities, ...towns]);

    const result = await getMunicipalityList({
      all: true,
      limit: 100,
      municipalityKind: "city",
      sort: "expense-recovery-high"
    });

    expect(result.total).toBe(105);
    expect(result.items).toHaveLength(105);
    expect(result.items[0].municipalityName).toBe("対象105市");
    expect(result.items.at(-1)?.municipalityName).toBe("対象1市");
    expect(result.items.some((item) => item.municipalityName === "テスト県")).toBe(false);
    expect(result.items.some((item) => item.municipalityName.endsWith("町"))).toBe(false);
  });
});

function municipality(municipalityCode: string, municipalityName: string, businesses: ReturnType<typeof business>[]) {
  return {
    municipalityCode,
    prefectureCode: municipalityCode.slice(0, 2),
    prefectureName: "テスト県",
    municipalityName,
    revisionEvents: [],
    businesses
  };
}

function business({
  businessKey = "17-1-000",
  businessType = PUBLIC_BUSINESS_TYPE,
  accountingType = "legal_applied",
  estatBusinessCategory,
  label = "やや不足",
  recovery = 95,
  risk = 50,
  year = 2023
}: {
  businessKey?: string;
  businessType?: string;
  accountingType?: string;
  estatBusinessCategory?: string;
  label?: string;
  recovery?: number;
  risk?: number;
  year?: number;
}) {
  return {
    businessKey,
    businessName: businessType,
    businessType,
    accountingType,
    estatBusinessCategory,
    annualFinancials: [{
      surveyYear: year,
      fiscalYearLabel: `令和${year - 2018}年度`,
      diagnosisResult: {
        feeAdequacyLabel: label,
        expenseRecoveryRate: recovery,
        feeUnitPriceYenPerM3: 150,
        treatmentCostYenPerM3: 160,
        requiredRevisionRateTo100: 0.1,
        revisionRiskScore: risk
      }
    }]
  };
}
