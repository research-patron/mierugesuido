import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  municipalityFindMany: vi.fn(),
  municipalityGroupBy: vi.fn(),
  diagnosisFindMany: vi.fn(),
  revisionFindMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    municipality: {
      findMany: prismaMocks.municipalityFindMany,
      groupBy: prismaMocks.municipalityGroupBy
    },
    diagnosisResult: {
      findMany: prismaMocks.diagnosisFindMany
    },
    feeRevisionEvent: {
      findMany: prismaMocks.revisionFindMany
    }
  }
}));

import { getMapMunicipalities, getPrefectureMapData } from "@/lib/data";

const FLOW_BUSINESS_TYPE = "下水道事業（一） 事業コード3";
const PUBLIC_BUSINESS_TYPE = "公共下水道";

describe("getPrefectureMapData", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMocks)) mock.mockReset();

    prismaMocks.municipalityGroupBy.mockResolvedValue([
      { prefectureName: "新潟県", _count: { _all: 5 } }
    ]);
    prismaMocks.diagnosisFindMany.mockResolvedValue([]);
    prismaMocks.revisionFindMany.mockResolvedValue([]);
  });

  it("returns only comparable municipalities and aligns the selected prefecture summary", async () => {
    prismaMocks.municipalityFindMany.mockResolvedValue([
      municipality("150002", "新潟県", [
        business({ businessKey: "17-3-prefecture", businessType: FLOW_BUSINESS_TYPE, risk: 100, recovery: 250 })
      ]),
      municipality("151009", "新潟市", [
        business({ businessKey: "17-3-city", businessType: "別名管理事業", risk: 99, recovery: 210 }),
        business({ businessKey: "17-1-city", businessType: PUBLIC_BUSINESS_TYPE, risk: 20, recovery: 80 })
      ], true),
      municipality("152021", "長岡市", [
        business({ businessKey: "17-1-nagaoka", businessType: PUBLIC_BUSINESS_TYPE, risk: 10, recovery: 100 })
      ]),
      municipality("159001", "流域のみ市", [
        business({ businessKey: "17/3/flow", businessType: "流域管理", risk: 80, recovery: 180 })
      ]),
      municipality("159002", "未取込村", [
        business({ businessKey: "17-1-empty", businessType: PUBLIC_BUSINESS_TYPE, annual: false })
      ]),
      municipality("159990", "新潟広域下水道組合", [
        business({ businessKey: "17-1-joint", businessType: PUBLIC_BUSINESS_TYPE, risk: 5, recovery: 120 })
      ])
    ]);

    const result = await getPrefectureMapData("15");

    expect(result.prefecture).toEqual({ code: "15", name: "新潟県" });
    expect(result.municipalities.map((item) => item.municipalityName)).toEqual([
      "新潟市",
      "長岡市"
    ]);
    expect(result.municipalities[0]).toMatchObject({
      municipalityCode: "151009",
      businessType: PUBLIC_BUSINESS_TYPE,
      expenseRecoveryRate: 80,
      hasRevisionEvent: true
    });
    expect(result.municipalities.some((item) => item.businessType === FLOW_BUSINESS_TYPE)).toBe(false);

    expect(result.summaries).toEqual([
      {
        prefectureName: "新潟県",
        municipalityCount: 2,
        averageExpenseRecoveryRate: 90,
        revisionEventCount: 1,
        excludedBusinessCount: 2
      }
    ]);
    expect(prismaMocks.municipalityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { prefectureName: "新潟県" }
    }));
  });

  it("uses the newest annual value to break equal representative-risk scores", async () => {
    prismaMocks.municipalityFindMany.mockResolvedValue([
      municipality("151009", "新潟市", [
        business({ businessKey: "17-1-old", businessType: "旧事業", year: 2022, risk: 50, recovery: 70 }),
        business({ businessKey: "17-1-new", businessType: "新事業", year: 2023, risk: 50, recovery: 95 })
      ])
    ]);

    const result = await getPrefectureMapData("15");

    expect(result.municipalities).toHaveLength(1);
    expect(result.municipalities[0]).toMatchObject({
      latestYear: 2023,
      businessType: "新事業",
      expenseRecoveryRate: 95
    });
  });

  it("uses the latest survey year even when an older business has higher risk", async () => {
    prismaMocks.municipalityFindMany.mockResolvedValue([
      municipality("151009", "新潟市", [
        business({ businessKey: "17-1-old-risk", businessType: "旧高リスク事業", year: 2023, risk: 99, recovery: 60 }),
        business({ businessKey: "17-1-r6", businessType: "R6事業", year: 2024, risk: 5, recovery: 105 })
      ])
    ]);

    const result = await getPrefectureMapData("15");

    expect(result.municipalities).toHaveLength(1);
    expect(result.municipalities[0]).toMatchObject({
      latestYear: 2024,
      businessType: "R6事業",
      expenseRecoveryRate: 105
    });
  });

  it("returns the unchanged empty public shape for an unknown prefecture code", async () => {
    await expect(getPrefectureMapData("99")).resolves.toEqual({
      prefecture: null,
      summaries: [],
      municipalities: []
    });
    expect(prismaMocks.municipalityFindMany).not.toHaveBeenCalled();
  });

  it("does not pass Array.map indexes as municipality representatives", async () => {
    prismaMocks.municipalityFindMany.mockResolvedValue([
      municipality("151009", "新潟市", [
        business({ businessKey: "17-1-city", businessType: PUBLIC_BUSINESS_TYPE, year: 2023, recovery: 95 })
      ]),
      municipality("159990", "新潟広域下水道組合", [
        business({ businessKey: "17-1-joint", businessType: PUBLIC_BUSINESS_TYPE, year: 2024, recovery: 120 })
      ])
    ]);

    const result = await getMapMunicipalities();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      municipalityName: "新潟市",
      latestYear: 2023,
      businessType: PUBLIC_BUSINESS_TYPE,
      expenseRecoveryRate: 95
    });
  });
});

function municipality(
  municipalityCode: string,
  municipalityName: string,
  businesses: ReturnType<typeof business>[],
  hasRevisionEvent = false
) {
  return {
    municipalityCode,
    prefectureCode: municipalityCode.slice(0, 2),
    prefectureName: "新潟県",
    municipalityName,
    municipalityNameKana: null,
    revisionEvents: hasRevisionEvent ? [{ id: `${municipalityCode}-revision` }] : [],
    businesses
  };
}

function business({
  businessKey,
  businessType,
  year = 2023,
  risk = 50,
  recovery = 95,
  annual = true
}: {
  businessKey: string;
  businessType: string;
  year?: number;
  risk?: number;
  recovery?: number;
  annual?: boolean;
}) {
  return {
    businessKey,
    businessName: businessType,
    businessType,
    accountingType: "legal_applied",
    estatBusinessCategory: null,
    annualFinancials: annual ? [{
      surveyYear: year,
      fiscalYearLabel: `令和${year - 2018}年度`,
      diagnosisResult: {
        feeAdequacyLabel: recovery >= 100 ? "適正水準" : "やや不足",
        expenseRecoveryRate: recovery,
        feeUnitPriceYenPerM3: 150,
        treatmentCostYenPerM3: 160,
        requiredRevisionRateTo100: 0.1,
        revisionRiskScore: risk
      }
    }] : []
  };
}
