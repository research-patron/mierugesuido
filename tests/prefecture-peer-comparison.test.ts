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

import { getPrefecturePeerComparison } from "@/lib/data";
import {
  buildPrefecturePeerComparison,
  isOperatingCoverageCritical,
  operatingCoverageDisplayValue,
  PREFECTURE_PEER_INCOME_ITEM_CODES,
  type PrefecturePeerAnnualInput,
  type PrefecturePeerBusinessInput,
  type PrefecturePeerMunicipalityInput
} from "@/lib/prefecturePeerComparison";

describe("buildPrefecturePeerComparison", () => {
  it("uses the raw operating-coverage percentage for the 50 percent threshold", () => {
    expect(operatingCoverageDisplayValue(49.94)).toBe(49.9);
    expect(isOperatingCoverageCritical(49.94)).toBe(true);
    expect(operatingCoverageDisplayValue(49.96)).toBe(50);
    expect(isOperatingCoverageCritical(49.96)).toBe(true);
    expect(isOperatingCoverageCritical(50)).toBe(false);
    expect(isOperatingCoverageCritical(0)).toBe(true);
    expect(isOperatingCoverageCritical(100)).toBe(false);
    expect(isOperatingCoverageCritical(null)).toBe(false);
  });

  it("keeps every municipality, explains exclusions, and sorts by official municipality code", () => {
    const result = buildPrefecturePeerComparison({
      prefectureCode: "01",
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      currentMunicipalityCode: "012025",
      municipalities: [
        municipality("019999", "テスト広域事務組合", []),
        municipality("015001", "法適用決算なし町", [business({ annuals: [annual({ year: 2023 })] })]),
        municipality("013005", "法非適用村", [business({ accountingType: "non_legal_applied", annuals: [annual({ accountingType: "non_legal_applied" })] })]),
        municipality("012025", "比較対象市", [business({ annuals: [annual({
          recovery: 105,
          operatingRevenue: 600,
          nonOperatingRevenue: 400,
          operatingExpense: 1_000,
          otherAccountSubsidy: 200,
          nonStandardTransfer: 10
        })] })]),
        municipality("010000", "テスト県", []),
        municipality("011011", "余剰区", [business({ annuals: [annual({
          recovery: 105,
          operatingRevenue: 1_100,
          nonOperatingRevenue: 100,
          operatingExpense: 1_000,
          otherAccountSubsidy: 0,
          nonStandardTransfer: 0
        })] })]),
        municipality("014001", "同種事業なし町", [business({ businessKey: "17-5-000" })])
      ]
    });

    expect(result.rows.map((row) => row.municipalityCode)).toEqual([
      "011011",
      "012025",
      "013005",
      "014001",
      "015001"
    ]);
    expect(result.rows.map((row) => row.exclusionReason?.code ?? "eligible")).toEqual([
      "eligible",
      "eligible",
      "legal_applied_not_found",
      "same_business_not_found",
      "r6_data_not_found"
    ]);

    const current = result.rows[1];
    expect(current).toMatchObject({
      isCurrent: true,
      eligible: true,
      expenseRecoveryRate: 105,
      operatingRevenue: 600,
      operatingExpense: 1_000,
      operatingCoverageRatio: 60,
      nonStandardTransfer: 10
    });
    expect(result.rows[0].operatingCoverageRatio).toBeCloseTo(110);
    expect(result.rows[0].nonStandardTransfer).toBe(0);

    expect(result.summary).toMatchObject({
      totalMunicipalities: 5,
      eligibleMunicipalities: 2,
      excludedMunicipalities: 3,
      averages: {
        operatingCoverageRatio: 85
      },
      totals: {
        nonStandardTransfer: 10
      },
      positiveCounts: {
        expenseRecoveryAtLeast100: 2,
        operatingCoverageBelow100: 1,
        highRecoveryButOperatingCoverageBelow100: 1,
        nonStandardTransfer: 1
      }
    });
  });

  it("returns null for missing or zero denominators instead of displaying a false zero rate", () => {
    const result = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      municipalities: [
        municipality("012025", "分母なし市", [business({ annuals: [annual({
          recovery: null,
          householdFee20m3Yen: 0,
          operatingRevenue: 0,
          nonOperatingRevenue: 0,
          operatingExpense: 0,
          otherAccountSubsidy: 0
        })] })])
      ]
    });

    expect(result.rows[0]).toMatchObject({
      householdFee20m3Yen: null,
      expenseRecoveryRate: null,
      operatingCoverageRatio: null
    });
    expect(result.summary.missingCounts).toEqual({
      expenseRecoveryRate: 1,
      operatingCoverageRatio: 1
    });
  });

  it("shows a joint operator once for all served municipalities without duplicating its financials", () => {
    const result = buildPrefecturePeerComparison({
      prefectureCode: "06",
      prefectureName: "山形県",
      businessKey: "17-1-000",
      currentMunicipalityCode: "063410",
      municipalities: [
        municipality("062120", "尾花沢市", [business({ businessKey: "17-5-000" })]),
        municipality("063410", "大石田町", [business({ businessKey: "17-5-000" })]),
        municipality("069663", "尾花沢市大石田町環境衛生事業組合（事業会計分）", [
          business({ businessKey: "17-1-000", annuals: [annual({
            recovery: 60.251,
            operatingRevenue: 114_839,
            operatingExpense: 321_076,
            nonStandardTransfer: 176_644
          })] }),
          business({ businessKey: "17-4-000", annuals: [annual({ operatingRevenue: 19_286 })] })
        ])
      ],
      jointOperations: [{
        operatorMunicipalityCode: "069663",
        operatorMunicipalityName: "尾花沢市大石田町環境衛生事業組合（事業会計分）",
        businessKey: "17-1-000",
        servedMunicipalities: [
          { municipalityCode: "062120", municipalityName: "尾花沢市" },
          { municipalityCode: "063410", municipalityName: "大石田町" }
        ],
        businesses: [business({
          businessKey: "17-1-000",
          annuals: [annual({
            recovery: 60.251,
            operatingRevenue: 114_839,
            operatingExpense: 321_076,
            nonStandardTransfer: 176_644
          })]
        })],
        sourceUrl: "https://example.test/rules",
        sourceLabel: "組合規約"
      }]
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      municipalityCode: "062120",
      municipalityName: "尾花沢市・大石田町",
      representedMunicipalityCodes: ["062120", "063410"],
      representedMunicipalityCount: 2,
      comparisonUnitKey: "069663:17-1-000",
      detailMunicipalityCode: "069663",
      operatorMunicipalityCode: "069663",
      isJointOperation: true,
      isCurrent: true,
      eligible: true,
      expenseRecoveryRate: 60.251,
      nonStandardTransfer: 176_644
    });
    expect(result.rows[0].operatingCoverageRatio).toBeCloseTo(35.7669, 3);
    expect(result.summary).toMatchObject({
      totalMunicipalities: 2,
      eligibleMunicipalities: 2,
      eligibleComparisonUnits: 1,
      excludedMunicipalities: 0,
      totals: { nonStandardTransfer: 176_644 }
    });
    expect(result.rows.some((row) => row.exclusionReason?.label.includes("公共下水道・特環なし"))).toBe(false);
  });

  it("keeps each joint operator's served municipalities scoped to the adopted business key", () => {
    const municipalities = [
      municipality("012025", "A市", [business({ businessKey: "17-5-000" })]),
      municipality("013005", "B村", [business({ businessKey: "17-5-000" })]),
      municipality("014001", "C町", [business({ businessKey: "17-5-000" })])
    ];
    const jointOperations = [
      {
        operatorMunicipalityCode: "019663",
        operatorMunicipalityName: "テスト広域企業団",
        businessKey: "17-1-000",
        servedMunicipalities: [
          { municipalityCode: "012025", municipalityName: "A市" },
          { municipalityCode: "013005", municipalityName: "B村" }
        ],
        businesses: [business({ businessKey: "17-1-000", annuals: [annual({ operatingRevenue: 700 })] })],
        sourceUrl: "https://example.test/public",
        sourceLabel: "公共下水道規約"
      },
      {
        operatorMunicipalityCode: "019663",
        operatorMunicipalityName: "テスト広域企業団",
        businessKey: "17-4-000",
        servedMunicipalities: [
          { municipalityCode: "014001", municipalityName: "C町" }
        ],
        businesses: [business({ businessKey: "17-4-000", annuals: [annual({ operatingRevenue: 900 })] })],
        sourceUrl: "https://example.test/tokkan",
        sourceLabel: "特環規約"
      }
    ];

    const publicResult = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      municipalities,
      jointOperations
    });
    const tokkanResult = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-4-000",
      municipalities,
      jointOperations
    });

    expect(publicResult.rows.filter((row) => row.isJointOperation)).toEqual([
      expect.objectContaining({
        businessKey: "17-1-000",
        representedMunicipalityCodes: ["012025", "013005"],
        operatingRevenue: 700,
        jointOperationSourceLabel: "公共下水道規約"
      })
    ]);
    expect(tokkanResult.rows.filter((row) => row.isJointOperation)).toEqual([
      expect.objectContaining({
        businessKey: "17-4-000",
        representedMunicipalityCodes: ["014001"],
        operatingRevenue: 900,
        jointOperationSourceLabel: "特環規約"
      })
    ]);
  });

  it("retains municipality rows but explicitly excludes a selected flow-sewer business", () => {
    const result = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-3-000",
      municipalities: [
        municipality("012025", "対象市", [business({ businessKey: "17-3-000" })]),
        municipality("013005", "対象村", [])
      ]
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((row) => !row.eligible)).toBe(true);
    expect(result.rows.every((row) => row.exclusionReason?.code === "flow_sewer_excluded")).toBe(true);
    expect(result.summary.exclusionCounts.flow_sewer_excluded).toBe(2);
  });

  it("includes a municipality with only public sewerage when tokkan is selected", () => {
    const result = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-4-000",
      municipalities: [
        municipality("012025", "公共のみ市", [business({ businessKey: "17-1-000" })])
      ]
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      eligible: true,
      businessKey: "17-1-000",
      businessName: "公共下水道",
      businessType: "公共下水道"
    });
  });

  it("includes a municipality with only tokkan when public sewerage is selected", () => {
    const result = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      municipalities: [
        municipality("013005", "特環のみ村", [business({ businessKey: "17-4-000" })])
      ]
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      eligible: true,
      businessKey: "17-4-000",
      businessName: "特定環境保全公共下水道",
      businessType: "特定環境保全公共下水道"
    });
  });

  it("prefers the selected business when both public sewerage and tokkan are available", () => {
    const municipalityWithBoth = municipality("012025", "両方市", [
      business({ businessKey: "17-1-000", annuals: [annual({ operatingRevenue: 700 })] }),
      business({ businessKey: "17-4-000", annuals: [annual({ operatingRevenue: 900 })] })
    ]);

    const publicResult = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      municipalities: [municipalityWithBoth]
    });
    const tokkanResult = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-4-000",
      municipalities: [municipalityWithBoth]
    });

    expect(publicResult.rows[0]).toMatchObject({ businessKey: "17-1-000", operatingRevenue: 700 });
    expect(tokkanResult.rows[0]).toMatchObject({ businessKey: "17-4-000", operatingRevenue: 900 });
  });

  it("falls back once to tokkan when selected public sewerage is non-legal-applied", () => {
    const result = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      municipalities: [municipality("012025", "法非適用公共市", [
        business({
          businessKey: "17-1-000",
          accountingType: "non_legal_applied",
          annuals: [annual({ accountingType: "non_legal_applied", operatingRevenue: 500 })]
        }),
        business({ businessKey: "17-4-000", annuals: [annual({ operatingRevenue: 900 })] })
      ])]
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      eligible: true,
      accountingType: "legal_applied",
      businessKey: "17-4-000",
      operatingRevenue: 900
    });
  });

  it("falls back once to tokkan when selected public sewerage has no R6 legal-applied annual", () => {
    const result = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      municipalities: [municipality("012025", "公共R6なし市", [
        business({ businessKey: "17-1-000", annuals: [annual({ year: 2023, operatingRevenue: 500 })] }),
        business({ businessKey: "17-4-000", annuals: [annual({ operatingRevenue: 900 })] })
      ])]
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      eligible: true,
      businessKey: "17-4-000",
      operatingRevenue: 900
    });
  });

  it("continues to require an exact business-key match outside the public sewerage family", () => {
    const result = buildPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-5-000",
      municipalities: [
        municipality("012025", "公共市", [business({ businessKey: "17-1-000" })]),
        municipality("013005", "特環村", [business({ businessKey: "17-4-000" })]),
        municipality("014001", "農集町", [business({ businessKey: "17-5-000" })])
      ]
    });

    expect(result.rows.map((row) => ({
      municipalityCode: row.municipalityCode,
      eligible: row.eligible,
      businessKey: row.businessKey,
      reason: row.exclusionReason?.code ?? null
    }))).toEqual([
      { municipalityCode: "012025", eligible: false, businessKey: "17-5-000", reason: "same_business_not_found" },
      { municipalityCode: "013005", eligible: false, businessKey: "17-5-000", reason: "same_business_not_found" },
      { municipalityCode: "014001", eligible: true, businessKey: "17-5-000", reason: null }
    ]);
  });
});

describe("getPrefecturePeerComparison", () => {
  beforeEach(() => {
    prismaMocks.municipalityFindMany.mockReset();
  });

  it("queries the public-sewerage comparison family and R6 income items, then returns the UI-ready model", async () => {
    prismaMocks.municipalityFindMany.mockResolvedValue([
      municipality("012025", "比較対象市", [business({ annuals: [annual({ recovery: 90 })] })])
    ]);

    const result = await getPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      currentMunicipalityCode: "012025"
    });

    expect(prismaMocks.municipalityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([expect.objectContaining({ prefectureName: "テスト県" })])
      }),
      orderBy: { municipalityCode: "asc" },
      include: expect.objectContaining({
        businesses: expect.objectContaining({
          where: { businessKey: { in: ["17-1-000", "17-4-000"] } },
          include: {
            annualFinancials: expect.objectContaining({
              where: { surveyYear: 2024 },
              include: expect.objectContaining({
                financialStatementItems: expect.objectContaining({
                  where: {
                    statementType: "income_statement",
                    itemCode: { in: expect.arrayContaining([...PREFECTURE_PEER_INCOME_ITEM_CODES]) }
                  }
                })
              })
            })
          }
        }),
        operatedServiceMemberships: expect.objectContaining({
          include: expect.objectContaining({ servedMunicipality: expect.any(Object) })
        })
      })
    }));
    expect(result).toMatchObject({
      prefectureCode: "01",
      prefectureName: "テスト県",
      businessKey: "17-1-000",
      surveyYear: 2024,
      fiscalLabel: "R6",
      summary: { totalMunicipalities: 1, eligibleMunicipalities: 1 }
    });
    expect(PREFECTURE_PEER_INCOME_ITEM_CODES).toEqual(["operating_revenue", "operating_expense"]);
    expect(result.rows[0]).toMatchObject({ municipalityCode: "012025", isCurrent: true, operatingCoverageRatio: 80 });
  });

  it("queries only the exact key for business types outside the public-sewerage family", async () => {
    prismaMocks.municipalityFindMany.mockResolvedValue([
      municipality("014001", "農集町", [business({ businessKey: "17-5-000" })])
    ]);

    await getPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-5-000"
    });

    expect(prismaMocks.municipalityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        businesses: expect.objectContaining({
          where: { businessKey: { in: ["17-5-000"] } }
        })
      })
    }));
  });

  it("groups joint-service memberships by operator and business key before building rows", async () => {
    const municipalities = [
      municipality("012025", "A市", [business({ businessKey: "17-5-000" })]),
      municipality("013005", "B村", [business({ businessKey: "17-5-000" })]),
      municipality("014001", "C町", [business({ businessKey: "17-5-000" })]),
      {
        ...municipality("019663", "テスト広域企業団", [
          business({ businessKey: "17-1-000", annuals: [annual({ operatingRevenue: 700 })] }),
          business({ businessKey: "17-4-000", annuals: [annual({ operatingRevenue: 900 })] })
        ]),
        operatedServiceMemberships: [
          membership("17-1-000", "012025", "A市", "公共下水道規約"),
          membership("17-1-000", "013005", "B村", "公共下水道規約"),
          membership("17-4-000", "014001", "C町", "特環規約")
        ]
      }
    ];
    prismaMocks.municipalityFindMany.mockResolvedValue(municipalities);

    const publicResult = await getPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-1-000"
    });
    const tokkanResult = await getPrefecturePeerComparison({
      prefectureName: "テスト県",
      businessKey: "17-4-000"
    });

    expect(publicResult.rows.find((row) => row.isJointOperation)).toMatchObject({
      businessKey: "17-1-000",
      representedMunicipalityCodes: ["012025", "013005"],
      jointOperationSourceLabel: "公共下水道規約"
    });
    expect(tokkanResult.rows.find((row) => row.isJointOperation)).toMatchObject({
      businessKey: "17-4-000",
      representedMunicipalityCodes: ["014001"],
      jointOperationSourceLabel: "特環規約"
    });
  });
});

function membership(
  businessKey: string,
  municipalityCode: string,
  municipalityName: string,
  sourceLabel: string
) {
  return {
    businessKey,
    sourceUrl: `https://example.test/${businessKey}`,
    sourceLabel,
    servedMunicipality: { municipalityCode, municipalityName }
  };
}

function municipality(
  municipalityCode: string,
  municipalityName: string,
  businesses: PrefecturePeerBusinessInput[]
): PrefecturePeerMunicipalityInput {
  return {
    municipalityCode,
    prefectureCode: municipalityCode.slice(0, 2),
    prefectureName: "テスト県",
    municipalityName,
    businesses
  };
}

function business({
  businessKey = "17-1-000",
  accountingType = "legal_applied",
  annuals = [annual()]
}: {
  businessKey?: string;
  accountingType?: string;
  annuals?: PrefecturePeerAnnualInput[];
} = {}): PrefecturePeerBusinessInput {
  return {
    businessKey,
    businessName: businessName(businessKey),
    businessType: businessName(businessKey),
    accountingType,
    annualFinancials: annuals
  };
}

function businessName(businessKey: string) {
  if (businessKey === "17-1-000") return "公共下水道";
  if (businessKey === "17-4-000") return "特定環境保全公共下水道";
  return "別事業";
}

function annual({
  year = 2024,
  accountingType = "legal_applied",
  recovery = 95,
  householdFee20m3Yen = 3_000,
  operatingRevenue = 800,
  nonOperatingRevenue = 200,
  operatingExpense = 1_000,
  otherAccountSubsidy = 100,
  nonStandardTransfer = 25
}: {
  year?: number;
  accountingType?: string;
  recovery?: number | null;
  householdFee20m3Yen?: number | null;
  operatingRevenue?: number;
  nonOperatingRevenue?: number;
  operatingExpense?: number;
  otherAccountSubsidy?: number;
  nonStandardTransfer?: number;
} = {}): PrefecturePeerAnnualInput {
  return {
    surveyYear: year,
    fiscalYearLabel: year === 2024 ? "R6" : "R5",
    accountingType,
    householdFee20m3Yen,
    nonStandardTransfer,
    servicePopulation: 10_000,
    connectedPopulation: 9_000,
    diagnosisResult: { expenseRecoveryRate: recovery },
    financialStatementItems: [
      { itemCode: "operating_revenue", amount: operatingRevenue },
      { itemCode: "non_operating_revenue", amount: nonOperatingRevenue },
      { itemCode: "operating_expense", amount: operatingExpense },
      { itemCode: "other_account_subsidy_revenue", amount: otherAccountSubsidy }
    ]
  };
}
