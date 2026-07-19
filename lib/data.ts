import { prisma } from "@/lib/prisma";
import { revisionPeriodLabel, revisionPeriodOrder } from "@/lib/revisionEvents";
import { matchesBusinessCategory } from "@/lib/businessDisplay";
import { getPrefectureName } from "@/lib/prefectures";
import type { RankingType } from "@/lib/rankings";
import {
  buildPrefecturePeerComparison,
  getPrefecturePeerBusinessKeys,
  PREFECTURE_PEER_COMPARISON_SURVEY_YEAR,
  PREFECTURE_PEER_INCOME_ITEM_CODES,
  type PrefecturePeerComparisonResult,
  type PrefecturePeerComparisonSurveyYear
} from "@/lib/prefecturePeerComparison";

type ComparableMapMunicipality = ReturnType<typeof toMapMunicipality>;

export async function getHomepageData(comparableInput?: ComparableMapMunicipality[]) {
  return withDatabaseFallback(async () => {
    const [latestFinancial, comparableMunicipalities] = await Promise.all([
      prisma.annualFinancial.findFirst({
        orderBy: [{ surveyYear: "desc" }, { fiscalYearLabel: "desc" }],
        select: { surveyYear: true, fiscalYearLabel: true }
      }),
      comparableInput ?? getMapMunicipalities()
    ]);
    const recoveryValues = comparableMunicipalities
      .map((item) => item.expenseRecoveryRate)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const feeUnitPriceValues = comparableMunicipalities
      .map((item) => item.feeUnitPriceYenPerM3)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const below100 = recoveryValues.filter((value) => value < 100).length;
    const lowRecovery = [...comparableMunicipalities]
      .filter((item) => item.expenseRecoveryRate != null)
      .sort((a, b) => nullsLast(a.expenseRecoveryRate, b.expenseRecoveryRate, "asc"))
      .slice(0, 5);
    const highRevision = [...comparableMunicipalities]
      .filter((item) => item.requiredRevisionRateTo100 != null)
      .sort((a, b) => nullsLast(a.requiredRevisionRateTo100, b.requiredRevisionRateTo100, "desc"))
      .slice(0, 5);

    return {
      municipalityCount: comparableMunicipalities.length,
      latestYear: latestFinancial?.surveyYear ?? null,
      latestFiscalYearLabel: latestFinancial?.fiscalYearLabel ?? null,
      averageExpenseRecoveryRate: average(recoveryValues),
      averageFeeUnitPriceYenPerM3: average(feeUnitPriceValues),
      below100Rate: recoveryValues.length > 0 ? (below100 / recoveryValues.length) * 100 : null,
      revisionEventCount: comparableMunicipalities.filter((item) => item.hasRevisionEvent).length,
      lowRecovery,
      highRevision
    };
  }, {
    municipalityCount: 0,
    latestYear: null,
    latestFiscalYearLabel: null,
    averageExpenseRecoveryRate: null,
    averageFeeUnitPriceYenPerM3: null,
    below100Rate: null,
    revisionEventCount: 0,
    lowRecovery: [],
    highRevision: []
  });
}

export async function getPrefectureSummaries(comparableInput?: ComparableMapMunicipality[]) {
  const comparableMunicipalities = comparableInput ?? await getMapMunicipalities();
  const byPrefecture = new Map<string, ComparableMapMunicipality[]>();
  for (const municipality of comparableMunicipalities) {
    const rows = byPrefecture.get(municipality.prefectureName) ?? [];
    rows.push(municipality);
    byPrefecture.set(municipality.prefectureName, rows);
  }

  return [...byPrefecture.entries()]
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB, "ja"))
    .map(([prefectureName, rows]) => ({
      prefectureName,
      municipalityCount: rows.length,
      averageExpenseRecoveryRate: average(
        rows
          .map((item) => item.expenseRecoveryRate)
          .filter((value): value is number => value != null && Number.isFinite(value))
      ),
      revisionEventCount: rows.filter((item) => item.hasRevisionEvent).length,
      excludedBusinessCount: 0
    }));
}

export async function getMapMunicipalities() {
  return withDatabaseFallback(async () => {
    const municipalities = await prisma.municipality.findMany({
      orderBy: [{ prefectureCode: "asc" }, { municipalityCode: "asc" }],
      include: {
        revisionEvents: true,
        businesses: {
          include: {
            annualFinancials: {
              orderBy: { surveyYear: "desc" },
              take: 1,
              include: { diagnosisResult: true }
            }
          }
        }
      }
    });
    return municipalities
      .filter((municipality) => isAdministrativeMunicipality(municipality.municipalityName))
      .flatMap((municipality) => {
        const comparable = toComparableMapMunicipality(municipality);
        return comparable ? [comparable] : [];
      });
  }, []);
}

export async function getPrefectureMapData(prefectureCode: string) {
  const prefectureName = getPrefectureName(prefectureCode);
  if (!prefectureName) {
    return {
      prefecture: null,
      summaries: [],
      municipalities: []
    };
  }
  const mapData = await withDatabaseFallback(async () => {
      const rows = await prisma.municipality.findMany({
        where: { prefectureName },
        orderBy: [{ municipalityCode: "asc" }],
        include: {
          revisionEvents: true,
          businesses: {
            include: {
              annualFinancials: {
                orderBy: { surveyYear: "desc" },
                take: 1,
                include: { diagnosisResult: true }
              }
            }
          }
        }
      });
      const administrativeRows = rows.filter((row) => isAdministrativeMunicipality(row.municipalityName));
      const comparableMunicipalities = administrativeRows
        .flatMap((row) => {
          const municipality = toComparableMapMunicipality(row);
          return municipality ? [municipality] : [];
        });
      const excludedBusinessCount = administrativeRows.reduce(
        (count, row) => count + row.businesses.filter(isFlowSewerBusiness).length,
        0
      );

      return {
        municipalities: comparableMunicipalities,
        excludedBusinessCount
      };
  }, {
    municipalities: [],
    excludedBusinessCount: 0
  });
  const comparableMunicipalities = mapData.municipalities;
  const excludedBusinessCount = mapData.excludedBusinessCount;
  const comparableRecoveryRates = comparableMunicipalities
    .map((municipality) => municipality.expenseRecoveryRate)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const selectedSummary = {
    prefectureName,
    municipalityCount: comparableMunicipalities.length,
    averageExpenseRecoveryRate: average(comparableRecoveryRates),
    revisionEventCount: comparableMunicipalities.filter((municipality) => municipality.hasRevisionEvent).length,
    excludedBusinessCount
  };

  return {
    prefecture: {
      code: prefectureCode,
      name: prefectureName
    },
    summaries: [selectedSummary],
    municipalities: comparableMunicipalities
  };
}

export async function searchMunicipalities(query: string, limit = 10) {
  const q = query.trim();
  if (!q) return [];

  return withDatabaseFallback(async () => prisma.municipality.findMany({
    where: {
      AND: [
        {
          OR: [
            { municipalityName: { contains: q } },
            { municipalityNameKana: { contains: q } },
            { prefectureName: { contains: q } },
            { municipalityCode: { contains: q } }
          ]
        },
        {
          OR: [
            { municipalityName: { endsWith: "市" } },
            { municipalityName: { endsWith: "区" } },
            { municipalityName: { endsWith: "町" } },
            { municipalityName: { endsWith: "村" } }
          ]
        }
      ]
    },
    orderBy: [{ prefectureCode: "asc" }, { municipalityCode: "asc" }],
    take: limit,
    select: {
      municipalityCode: true,
      prefectureName: true,
      municipalityName: true
    }
  }), []);
}

export async function getMunicipalityList(params: {
  q?: string;
  municipalityNameQuery?: string;
  prefecture?: string;
  label?: string;
  sort?: string;
  page?: number;
  limit?: number;
  accountingType?: string;
  businessType?: string;
  hasRevisionEvent?: boolean;
  municipalityKind?: "city" | "town" | "village";
  all?: boolean;
}) {
  const page = Math.max(params.page ?? 1, 1);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const skip = (page - 1) * limit;
  const q = params.q?.trim();
  const municipalityNameQuery = params.municipalityNameQuery?.trim();

  return withDatabaseFallback(async () => {
    const where = {
      ...(municipalityNameQuery
        ? {
            OR: [
              { municipalityName: { contains: municipalityNameQuery } },
              { municipalityNameKana: { contains: municipalityNameQuery } }
            ]
          }
        : q
        ? {
            OR: [
              { municipalityName: { contains: q } },
              { municipalityNameKana: { contains: q } },
              { prefectureName: { contains: q } },
              { municipalityCode: { contains: q } }
            ]
          }
        : {}),
      ...(params.prefecture ? { prefectureName: params.prefecture } : {}),
      ...(params.hasRevisionEvent === true ? { revisionEvents: { some: {} } } : {}),
      ...(params.hasRevisionEvent === false ? { revisionEvents: { none: {} } } : {})
    };

    const municipalities = await prisma.municipality.findMany({
      where,
      orderBy: [{ prefectureCode: "asc" }, { municipalityCode: "asc" }],
      include: {
        revisionEvents: true,
        businesses: {
          include: {
            annualFinancials: {
              orderBy: { surveyYear: "desc" },
              take: 1,
              include: { diagnosisResult: true }
            }
          }
        }
      }
    });

    const matchingItems = municipalities
      .filter((municipality) => isAdministrativeMunicipality(municipality.municipalityName))
      .flatMap((municipality) => {
        const eligibleBusinesses = municipality.businesses.filter((business) =>
          !isFlowSewerBusiness(business) &&
          (!params.accountingType || business.accountingType === params.accountingType) &&
          matchesBusinessCategory(business, params.businessType)
        );

        if (eligibleBusinesses.length === 0) return [];

        const representative = eligibleBusinesses
          .map((business) => {
            const annual = business.annualFinancials[0] ?? null;
            return {
              business,
              annual,
              diagnosis: annual?.diagnosisResult ?? null
            };
          })
          .sort((a, b) => {
            return compareRepresentativeCandidates(a, b);
          })[0];

        const ambiguous = hasAmbiguousZeroFlag(representative.annual?.flagsJson);

        return [{
          municipalityCode: municipality.municipalityCode,
          prefectureName: municipality.prefectureName,
          municipalityName: municipality.municipalityName,
          businessKey: representative.business.businessKey,
          businessType: representative.business.businessType,
          businessName: representative.business.businessName,
          estatBusinessCategory: representative.business.estatBusinessCategory,
          businessCount: new Set(eligibleBusinesses.map((business) => business.businessKey)).size,
          latestYear: representative.annual?.surveyYear ?? null,
          accountingType: representative.business.accountingType,
          latestFiscalYearLabel: representative.annual?.fiscalYearLabel ?? null,
          dataQualityStatus: representative.annual?.dataQualityStatus ?? "unchecked",
          flags: parseJsonArray(representative.annual?.flagsJson ?? null),
          diagnosis: ambiguous ? sanitizeAmbiguousDiagnosis(representative.diagnosis) : representative.diagnosis,
          hasRevisionEvent: municipality.revisionEvents.length > 0
        }];
      })
      .filter((item) => !params.label || item.diagnosis?.feeAdequacyLabel === params.label)
      .filter((item) => matchesMunicipalityKind(item.municipalityName, params.municipalityKind))
      .sort((a, b) => sortListRows(a, b, params.sort));

    const total = matchingItems.length;
    const items = params.all ? matchingItems : matchingItems.slice(skip, skip + limit);

    return {
      items,
      total,
      page,
      limit
    };
  }, {
    items: [],
    total: 0,
    page,
    limit
  });
}

export async function getRevisionEventSummary() {
  return withDatabaseFallback(async () => {
    const events = await prisma.feeRevisionEvent.findMany({
      include: {
        municipality: true,
        sewerBusiness: true
      }
    });
    const byStatus = countBy(events.map((event) => event.status || "未分類"));
    const byPeriod = countBy(events.map((event) => revisionPeriodLabel(event.effectiveDate)));
    return {
      total: events.length,
      byStatus: [...byStatus.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja")),
      byPeriod: [...byPeriod.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || revisionPeriodOrder(a.label) - revisionPeriodOrder(b.label)),
      averageRevisionRate: average(events.map((event) => event.averageRevisionRate).filter((value): value is number => value != null))
    };
  }, {
    total: 0,
    byStatus: [],
    byPeriod: [],
    averageRevisionRate: null
  });
}

export async function getRevisionEventsList(params: {
  prefecture?: string;
  status?: string;
  period?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(params.page ?? 1, 1);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const skip = (page - 1) * limit;
  return withDatabaseFallback(async () => {
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.prefecture ? { municipality: { prefectureName: params.prefecture } } : {})
    };
    const rows = await prisma.feeRevisionEvent.findMany({
      where,
      orderBy: [{ effectiveDate: "asc" }, { announcedDate: "desc" }, { createdAt: "desc" }],
      include: {
        municipality: true,
        sewerBusiness: true
      }
    });
    const matchingRows = params.period
      ? rows.filter((row) => revisionPeriodLabel(row.effectiveDate) === params.period)
      : rows;
    return {
      total: matchingRows.length,
      page,
      limit,
      items: matchingRows.slice(skip, skip + limit)
    };
  }, {
    total: 0,
    page,
    limit,
    items: []
  });
}

export async function getMunicipalityDetail(municipalityCode: string) {
  return withDatabaseFallback(async () => {
    const municipality = await prisma.municipality.findUnique({
      where: { municipalityCode },
      include: {
        revisionEvents: {
          orderBy: [{ announcedDate: "desc" }, { createdAt: "desc" }]
        },
        servedServiceMemberships: {
          where: {
            AND: [
              { OR: [{ validFromSurveyYear: null }, { validFromSurveyYear: { lte: 2024 } }] },
              { OR: [{ validToSurveyYear: null }, { validToSurveyYear: { gte: 2024 } }] }
            ]
          },
          orderBy: [{ operatorMunicipalityId: "asc" }, { businessKey: "asc" }],
          include: {
            operatorMunicipality: {
              select: {
                municipalityCode: true,
                municipalityName: true
              }
            }
          }
        },
        businesses: {
          orderBy: [{ businessType: "asc" }, { businessName: "asc" }],
          include: {
            annualFinancials: {
              orderBy: { surveyYear: "asc" },
              include: {
                diagnosisResult: true,
                financialStatementItems: {
                  orderBy: [{ statementType: "asc" }, { displayOrder: "asc" }],
                  include: { sourceFile: true }
                }
              }
            }
          }
        }
      }
    });

    if (!municipality) return null;
    return municipality;
  }, null);
}

export type GetPrefecturePeerComparisonParams = {
  prefectureName: string;
  businessKey: string;
  currentMunicipalityCode?: string | null;
  surveyYear?: PrefecturePeerComparisonSurveyYear;
};

export async function getPrefecturePeerComparison({
  prefectureName,
  businessKey,
  currentMunicipalityCode = null,
  surveyYear = PREFECTURE_PEER_COMPARISON_SURVEY_YEAR
}: GetPrefecturePeerComparisonParams): Promise<PrefecturePeerComparisonResult> {
  const comparisonBusinessKeys = getPrefecturePeerBusinessKeys(businessKey);
  const emptyResult = buildPrefecturePeerComparison({
    prefectureName,
    businessKey,
    currentMunicipalityCode,
    surveyYear,
    municipalities: []
  });

  return withDatabaseFallback(async () => {
    const municipalities = await prisma.municipality.findMany({
      where: {
        OR: [
          {
            prefectureName,
            OR: [
              { municipalityName: { endsWith: "市" } },
              { municipalityName: { endsWith: "区" } },
              { municipalityName: { endsWith: "町" } },
              { municipalityName: { endsWith: "村" } }
            ]
          },
          {
            operatedServiceMemberships: {
              some: {
                businessKey: { in: comparisonBusinessKeys },
                metricScope: "consolidated",
                servedMunicipality: { prefectureName },
                AND: [
                  { OR: [{ validFromSurveyYear: null }, { validFromSurveyYear: { lte: surveyYear } }] },
                  { OR: [{ validToSurveyYear: null }, { validToSurveyYear: { gte: surveyYear } }] }
                ]
              }
            }
          }
        ]
      },
      orderBy: { municipalityCode: "asc" },
      include: {
        businesses: {
          where: { businessKey: { in: comparisonBusinessKeys } },
          include: {
            annualFinancials: {
              where: { surveyYear },
              include: {
                diagnosisResult: true,
                financialStatementItems: {
                  where: {
                    statementType: "income_statement",
                    itemCode: { in: [...PREFECTURE_PEER_INCOME_ITEM_CODES] }
                  },
                  orderBy: { displayOrder: "asc" }
                }
              }
            }
          }
        },
        operatedServiceMemberships: {
          where: {
            businessKey: { in: comparisonBusinessKeys },
            metricScope: "consolidated",
            servedMunicipality: { prefectureName },
            AND: [
              { OR: [{ validFromSurveyYear: null }, { validFromSurveyYear: { lte: surveyYear } }] },
              { OR: [{ validToSurveyYear: null }, { validToSurveyYear: { gte: surveyYear } }] }
            ]
          },
          include: {
            servedMunicipality: {
              select: {
                municipalityCode: true,
                municipalityName: true
              }
            }
          }
        }
      }
    });

    const jointOperations = municipalities.flatMap((operator) => {
      const memberships = operator.operatedServiceMemberships ?? [];
      const operatorMunicipalityCode = operator.municipalityCode;
      if (memberships.length === 0 || !operatorMunicipalityCode) return [];
      const membershipsByBusinessKey = new Map<string, typeof memberships>();
      for (const membership of memberships) {
        const grouped = membershipsByBusinessKey.get(membership.businessKey) ?? [];
        grouped.push(membership);
        membershipsByBusinessKey.set(membership.businessKey, grouped);
      }

      return [...membershipsByBusinessKey.entries()].flatMap(([operationBusinessKey, businessMemberships]) => {
        const businesses = operator.businesses.filter((business) => business.businessKey === operationBusinessKey);
        if (businesses.length === 0) return [];
        const servedMunicipalities = [...new Map(businessMemberships.flatMap((membership) => {
          const code = membership.servedMunicipality.municipalityCode;
          if (!code) return [];
          return [[code, {
            municipalityCode: code,
            municipalityName: membership.servedMunicipality.municipalityName
          }] as const];
        })).values()];
        const provenance = businessMemberships[0];
        return [{
          operatorMunicipalityCode,
          operatorMunicipalityName: operator.municipalityName,
          businessKey: operationBusinessKey,
          servedMunicipalities,
          businesses,
          sourceUrl: provenance.sourceUrl,
          sourceLabel: provenance.sourceLabel
        }];
      });
    });

    return buildPrefecturePeerComparison({
      prefectureCode: municipalities.find((municipality) =>
        municipality.prefectureName === prefectureName
        && /(?:市|区|町|村)$/u.test(municipality.municipalityName)
      )?.prefectureCode ?? null,
      prefectureName,
      businessKey,
      currentMunicipalityCode,
      surveyYear,
      municipalities,
      jointOperations
    });
  }, emptyResult);
}

export async function getRankings(type: RankingType, limit = 30) {
  return withDatabaseFallback(async () => {
    const latest = await prisma.annualFinancial.findFirst({
      orderBy: [{ surveyYear: "desc" }, { fiscalYearLabel: "desc" }],
      select: { surveyYear: true }
    });
    if (!latest) return [];

    const results = await prisma.diagnosisResult.findMany({
      where: { surveyYear: latest.surveyYear },
      include: {
        annualFinancial: true,
        sewerBusiness: {
          include: {
            municipality: true
          }
        }
      }
    });

    return results
      .filter((item) => !isFlowSewerBusiness(item.sewerBusiness))
      .filter((item) => item.sewerBusiness.municipality.municipalityName !== item.sewerBusiness.municipality.prefectureName)
      .filter((item) => !hasAmbiguousZeroFlag(item.annualFinancial.flagsJson))
      .filter((item) => {
        if (type === "expense-recovery-low") return item.expenseRecoveryRate != null;
        if (type === "required-revision-high") return item.requiredRevisionRateTo100 != null;
        if (type === "fee-unit-low") return item.feeUnitPriceYenPerM3 != null;
        if (type === "treatment-cost-high") return item.treatmentCostYenPerM3 != null;
        return item.sewerBusiness.accountingType === "legal_applied"
          && item.annualFinancial.nonStandardTransfer != null;
      })
      .sort((a, b) => sortRanking(a, b, type))
      .slice(0, limit)
      .map((item) => ({
        municipalityCode: item.sewerBusiness.municipality.municipalityCode,
        prefectureName: item.sewerBusiness.municipality.prefectureName,
        municipalityName: item.sewerBusiness.municipality.municipalityName,
        entityType: isAdministrativeMunicipality(item.sewerBusiness.municipality.municipalityName) ? "municipality" : "joint_operator",
        businessKey: item.sewerBusiness.businessKey,
        businessName: item.sewerBusiness.businessName,
        businessType: item.sewerBusiness.businessType,
        accountingType: item.sewerBusiness.accountingType,
        surveyYear: item.surveyYear,
        feeUnitPriceYenPerM3: item.feeUnitPriceYenPerM3,
        treatmentCostYenPerM3: item.treatmentCostYenPerM3,
        expenseRecoveryRate: item.expenseRecoveryRate,
        requiredRevisionRateTo100: item.requiredRevisionRateTo100,
        nonStandardTransfer: item.annualFinancial.nonStandardTransfer,
        feeAdequacyLabel: item.feeAdequacyLabel,
        revisionRiskScore: item.revisionRiskScore,
        revisionRiskLabel: item.revisionRiskLabel,
        flags: parseJsonArray(item.annualFinancial.flagsJson)
      }));
  }, []);
}

export async function getDataSources() {
  return withDatabaseFallback(async () => prisma.sourceFile.findMany({
    orderBy: [{ surveyYear: "desc" }, { accountingType: "asc" }, { tableNo: "asc" }],
    take: 500
  }), []);
}

export async function getPrefectures() {
  return withDatabaseFallback(async () => {
    const rows = await prisma.municipality.findMany({
      distinct: ["prefectureName"],
      orderBy: { prefectureCode: "asc" },
      select: { prefectureName: true }
    });
    return rows.map((row) => row.prefectureName);
  }, []);
}

function sortListRows(
  a: { diagnosis: any; latestYear: number | null; municipalityCode?: string | null },
  b: { diagnosis: any; latestYear: number | null; municipalityCode?: string | null },
  sort?: string
) {
  if (sort === "expense-recovery-high") {
    return nullsLast(a.diagnosis?.expenseRecoveryRate, b.diagnosis?.expenseRecoveryRate, "desc");
  }
  if (sort === "expense-recovery-low") {
    return nullsLast(a.diagnosis?.expenseRecoveryRate, b.diagnosis?.expenseRecoveryRate, "asc");
  }
  if (sort === "required-revision-high") {
    return nullsLast(a.diagnosis?.requiredRevisionRateTo100, b.diagnosis?.requiredRevisionRateTo100, "desc");
  }
  if (sort === "fee-unit-low") {
    return nullsLast(a.diagnosis?.feeUnitPriceYenPerM3, b.diagnosis?.feeUnitPriceYenPerM3, "asc");
  }
  if (sort === "municipality-code") {
    return (a.municipalityCode ?? "").localeCompare(b.municipalityCode ?? "", "ja");
  }
  return (b.latestYear ?? 0) - (a.latestYear ?? 0);
}

function matchesMunicipalityKind(name: string, kind?: "city" | "town" | "village") {
  if (kind === "city") return name.endsWith("市") || name.endsWith("区");
  if (kind === "town") return name.endsWith("町");
  if (kind === "village") return name.endsWith("村");
  return true;
}

function isFlowSewerBusiness(business: {
  businessKey?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  estatBusinessCategory?: string | null;
}) {
  if (isFlowSewerBusinessCode(business.businessKey) || isFlowSewerBusinessCode(business.estatBusinessCategory)) {
    return true;
  }

  return [business.businessType, business.businessName].some((value) => {
    const normalized = value?.normalize("NFKC").replace(/\s+/g, "") ?? "";
    return normalized.includes("流域下水道") || normalized === "下水道事業(一)事業コード3";
  });
}

function isFlowSewerBusinessCode(value?: string | null) {
  const [industryCode, businessCode] = value?.trim().split(/[-/]/) ?? [];
  return industryCode === "17" && Number(businessCode) === 3;
}

function sortRanking(a: any, b: any, type: RankingType) {
  if (type === "expense-recovery-low") return nullsLast(a.expenseRecoveryRate, b.expenseRecoveryRate, "asc");
  if (type === "required-revision-high") {
    return nullsLast(a.requiredRevisionRateTo100, b.requiredRevisionRateTo100, "desc");
  }
  if (type === "fee-unit-low") return nullsLast(a.feeUnitPriceYenPerM3, b.feeUnitPriceYenPerM3, "asc");
  if (type === "treatment-cost-high") return nullsLast(a.treatmentCostYenPerM3, b.treatmentCostYenPerM3, "desc");
  return nullsLast(a.annualFinancial.nonStandardTransfer, b.annualFinancial.nonStandardTransfer, "desc");
}

function selectMapMunicipalityRepresentative(municipality: any) {
  return municipality.businesses
    .filter((business: any) => !isFlowSewerBusiness(business))
    .flatMap((business: any) =>
      business.annualFinancials.map((annual: any) => ({
        business,
        annual,
        diagnosis: annual.diagnosisResult
      }))
    )
    .sort((a: any, b: any) => compareRepresentativeCandidates(a, b))[0];
}

function toComparableMapMunicipality(municipality: any) {
  const representative = selectMapMunicipalityRepresentative(municipality);
  if (!representative) return null;
  return toMapMunicipality(municipality, representative);
}

function toMapMunicipality(municipality: any, representative = selectMapMunicipalityRepresentative(municipality)) {
  const flags = parseJsonArray(representative?.annual?.flagsJson ?? null);
  const ambiguous = hasAmbiguousZeroFlag(representative?.annual?.flagsJson);
  return {
    municipalityCode: municipality.municipalityCode,
    prefectureName: municipality.prefectureName,
    municipalityName: municipality.municipalityName,
    municipalityNameKana: municipality.municipalityNameKana,
    latestYear: representative?.annual?.surveyYear ?? null,
    businessKey: representative?.business?.businessKey ?? null,
    businessType: representative?.business?.businessType ?? representative?.business?.businessName ?? null,
    businessName: representative?.business?.businessName ?? null,
    estatBusinessCategory: representative?.business?.estatBusinessCategory ?? null,
    businessCount: new Set(
      municipality.businesses
        .filter((business: any) => !isFlowSewerBusiness(business) && business.annualFinancials.length > 0)
        .map((business: any) => business.businessKey)
    ).size,
    accountingType: representative?.business?.accountingType ?? null,
    dataQualityStatus: representative?.annual?.dataQualityStatus ?? "unchecked",
    flags,
    expenseRecoveryRate: ambiguous ? null : representative?.diagnosis?.expenseRecoveryRate ?? null,
    feeUnitPriceYenPerM3: ambiguous ? null : representative?.diagnosis?.feeUnitPriceYenPerM3 ?? null,
    treatmentCostYenPerM3: ambiguous ? null : representative?.diagnosis?.treatmentCostYenPerM3 ?? null,
    requiredRevisionRateTo100: ambiguous ? null : representative?.diagnosis?.requiredRevisionRateTo100 ?? null,
    feeAdequacyLabel: ambiguous ? null : representative?.diagnosis?.feeAdequacyLabel ?? null,
    hasRevisionEvent: municipality.revisionEvents.length > 0
  };
}

function nullsLast(a: number | null | undefined, b: number | null | undefined, direction: "asc" | "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function compareRepresentativeCandidates(a: any, b: any) {
  const yearA = a.annual?.surveyYear ?? 0;
  const yearB = b.annual?.surveyYear ?? 0;
  if (yearA !== yearB) return yearB - yearA;
  const qualityA = hasAmbiguousZeroFlag(a.annual?.flagsJson) ? 0 : 1;
  const qualityB = hasAmbiguousZeroFlag(b.annual?.flagsJson) ? 0 : 1;
  if (qualityA !== qualityB) return qualityB - qualityA;
  const scoreA = a.diagnosis?.revisionRiskScore ?? -1;
  const scoreB = b.diagnosis?.revisionRiskScore ?? -1;
  return scoreB - scoreA;
}

function hasAmbiguousZeroFlag(flagsJson?: string | null) {
  return parseJsonArray(flagsJson ?? null).some((flag) => typeof flag === "string" && flag.includes("0または欠損"));
}

function sanitizeAmbiguousDiagnosis(diagnosis: any) {
  if (!diagnosis) return null;
  return {
    ...diagnosis,
    feeUnitPriceYenPerM3: null,
    treatmentCostYenPerM3: null,
    expenseRecoveryRate: null,
    requiredRevisionRateTo80: null,
    requiredRevisionRateTo100: null,
    requiredRevisionRateTo150Yen: null,
    feeAdequacyLabel: null,
    revisionRiskScore: null,
    revisionRiskLabel: null
  };
}

function average(values: number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function isAdministrativeMunicipality(name: string) {
  return /(?:市|区|町|村)$/u.test(name);
}

function countBy(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

function parseJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function withDatabaseFallback<T>(fn: () => Promise<T>, fallback: T) {
  try {
    return await fn();
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Database query failed. Returning empty state.", error);
    }
    return fallback;
  }
}
