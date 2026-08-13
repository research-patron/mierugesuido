import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getDataSources,
  getHomepageData,
  getMapMunicipalities,
  getMunicipalityDetail,
  getMunicipalityList,
  getPrefectureMapData,
  getPrefecturePeerComparison,
  getPrefectureSummaries,
  getPrefectures,
  getRankings,
  getRevisionEventSummary
} from "@/lib/data";
import { mapBusinessScopes, type MapBusinessScope } from "@/lib/data";
import { buildFinancialStoryModel } from "@/lib/financialStoryModel";
import { municipalitiesToCsv } from "@/lib/municipalityCsv";
import {
  addComparableUnchangedMunicipalities,
  buildMunicipalityFeeRevisionIndex,
  municipalityFeeRevisionStatus
} from "@/lib/municipalityFeeRevision";
import { getPrefectureCode, prefectures } from "@/lib/prefectures";
import { prisma } from "@/lib/prisma";
import { rankingLabels, type RankingType } from "@/lib/rankings";
import { assertMappedEvidenceMatchesOfficial } from "@/lib/yearbookEvidence";
import { buildYearbookFeeComparison } from "@/lib/yearbookFeeChanges";
import { loadYearbookFeeSnapshots } from "@/scripts/static/yearbookFeeRevisionData";
import {
  assertOfficialHeadlineValues,
  buildYearbookIndividualDataIndex,
  emptyYearbookIndividualData,
  prepareOfficialYearbookSources,
  type YearbookAccountingType,
  type YearbookIndividualData,
  type YearbookTarget
} from "@/scripts/static/yearbookOriginalData";

const sourceRoot = path.join(process.cwd(), "data", "static");
const publicRoot = path.join(process.cwd(), "public", "data", "static");
const rankingTypes = Object.keys(rankingLabels) as RankingType[];
const latestFiscalYear = 2024;

async function main() {
  await Promise.all([
    rm(sourceRoot, { recursive: true, force: true }),
    rm(publicRoot, { recursive: true, force: true })
  ]);
  await Promise.all([mkdir(sourceRoot, { recursive: true }), mkdir(publicRoot, { recursive: true })]);

  const mapMunicipalities = await getMapMunicipalities();
  const scopeEntries = await Promise.all(
    (Object.keys(mapBusinessScopes) as MapBusinessScope[]).map(async (scope) => {
      const scopedMunicipalities = await getMapMunicipalities(scope);
      const [scopedOverview, scopedSummaries] = await Promise.all([
        getHomepageData(scopedMunicipalities),
        getPrefectureSummaries(scopedMunicipalities)
      ]);
      return [scope, {
        key: scope,
        ...mapBusinessScopes[scope],
        overview: scopedOverview,
        mapMunicipalities: scopedMunicipalities,
        prefectureSummaries: scopedSummaries
      }] as const;
    })
  );
  const mapScopes = Object.fromEntries(scopeEntries);
  const defaultMapScope = "public" as const;
  const defaultMapData = mapScopes[defaultMapScope];
  const revisionSourceRoot = path.join(process.cwd(), "data", "raw", "e-stat");
  const yearbookFeeSnapshots = (await Promise.all([
    loadYearbookFeeSnapshots({ rootDir: revisionSourceRoot, surveyYear: 2023 }),
    loadYearbookFeeSnapshots({ rootDir: revisionSourceRoot, surveyYear: 2024 })
  ])).flat();
  const yearbookFeeComparison = buildYearbookFeeComparison(yearbookFeeSnapshots);
  if (yearbookFeeComparison.items.some((item) => (
    !item.currentUsageFeeEffectiveDate.changed
    || item.currentUsageFeeEffectiveDate.r5.iso === item.currentUsageFeeEffectiveDate.r6.iso
  ))) {
    throw new Error("料金改定一覧に現行使用料施行年月日が変わっていない事業が含まれています");
  }
  const { items: _yearbookFeeChangeItems, ...yearbookFeeChangeSummary } = yearbookFeeComparison;
  const [prefectureNames, municipalityList, searchOverview] = await Promise.all([
    getPrefectures(),
    getMunicipalityList({ all: true, sort: "municipality-code" }),
    getHomepageData(mapMunicipalities)
  ]);
  const feeRevisionIndex = addComparableUnchangedMunicipalities(
    buildMunicipalityFeeRevisionIndex(yearbookFeeComparison.items),
    yearbookFeeSnapshots
  );
  const municipalitySearchItems = municipalityList.items.map((item) => ({
    ...compactListItem(item),
    municipalityNameKana: mapMunicipalities.find((candidate) => candidate.municipalityCode === item.municipalityCode)?.municipalityNameKana ?? null,
    feeRevisionComparison: item.municipalityCode
      ? feeRevisionIndex.get(item.municipalityCode) ?? null
      : null
  }));
  const feeRevisionMunicipalityCount = municipalitySearchItems.filter(
    (item) => municipalityFeeRevisionStatus(item.feeRevisionComparison) === "changed"
  ).length;

  await writeJson(path.join(sourceRoot, "home.json"), {
    defaultMapScope,
    mapScopes,
    overview: defaultMapData.overview,
    mapMunicipalities: defaultMapData.mapMunicipalities,
    prefectureSummaries: defaultMapData.prefectureSummaries,
    yearbookFeeChangeSummary,
    prefectures: prefectureNames
  });
  await writeJson(path.join(publicRoot, "municipalities.json"), {
    items: municipalitySearchItems,
    overview: {
      ...searchOverview,
      feeRevisionMunicipalityCount
    },
    prefectures: prefectureNames
  });
  await writeJson(path.join(publicRoot, "search-index.json"), mapMunicipalities.map((item) => ({
    municipalityCode: item.municipalityCode,
    prefectureName: item.prefectureName,
    municipalityName: item.municipalityName,
    municipalityNameKana: item.municipalityNameKana
  })));

  await Promise.all(rankingTypes.map(async (type) => {
    await writeJson(path.join(sourceRoot, "rankings", `${type}.json`), await getRankings(type, 50));
  }));

  await Promise.all(prefectures.map(async (prefecture) => {
    const data = await getPrefectureMapData(prefecture.code);
    await writeJson(path.join(sourceRoot, "prefectures", `${prefecture.code}.json`), data);
    const rows = municipalitySearchItems
      .filter((item) => item.prefectureName === prefecture.name)
      .sort((a, b) => nullsLast(a.diagnosis?.expenseRecoveryRate, b.diagnosis?.expenseRecoveryRate, "desc"));
    await writeText(path.join(publicRoot, "csv", "prefectures", `${prefecture.code}.csv`), municipalitiesToCsv(rows));
  }));

  const revisionRows = await prisma.feeRevisionEvent.findMany({
    orderBy: [{ effectiveDate: "asc" }, { announcedDate: "desc" }, { createdAt: "desc" }],
    include: { municipality: true, sewerBusiness: true }
  });
  const revisions = {
    summary: await getRevisionEventSummary(),
    items: revisionRows.map(compactRevisionEvent),
    prefectures: prefectureNames,
    yearbookFeeComparison
  };
  await Promise.all([
    writeJson(path.join(sourceRoot, "revisions.json"), revisions),
    writeJson(path.join(publicRoot, "revisions.json"), revisions)
  ]);

  const sources = await getDataSources();
  await writeJson(path.join(sourceRoot, "data-sources.json"), sources.map((source) => ({
    id: source.id,
    surveyYear: source.surveyYear,
    fiscalYearLabel: source.fiscalYearLabel,
    accountingType: source.accountingType,
    tableNo: source.tableNo,
    tableName: source.tableName,
    sourceUrl: source.sourceUrl,
    available: Boolean(source.downloadedAt || source.localPath)
  })));

  const yearbookBusinesses = await prisma.sewerBusiness.findMany({
    where: { annualFinancials: { some: { surveyYear: latestFiscalYear } } },
    select: {
      businessKey: true,
      accountingType: true,
      municipality: {
        select: {
          municipalityCode: true,
          municipalityName: true,
          prefectureName: true
        }
      }
    }
  });
  const yearbookTargets = yearbookBusinesses.flatMap((business): YearbookTarget[] => {
    const municipalityCode = business.municipality.municipalityCode;
    if (!municipalityCode || !isYearbookAccountingType(business.accountingType)) return [];
    return [{
      municipalityCode,
      municipalityName: business.municipality.municipalityName,
      prefectureName: business.municipality.prefectureName,
      businessKey: business.businessKey,
      accountingType: business.accountingType
    }];
  });
  const yearbookSources = await prepareOfficialYearbookSources({
    cacheDirectory: path.join(process.cwd(), "data", "raw", "soumu-yearbook-r6"),
    targetBusinessKeys: new Set(yearbookTargets.map((target) => target.businessKey))
  });
  const yearbookIndex = buildYearbookIndividualDataIndex(
    yearbookSources,
    yearbookTargets,
    latestFiscalYear
  );
  process.stdout.write(
    `yearbook individual tables: ${yearbookIndex.originalRows} rows reconciled with ${yearbookIndex.sourceFilesRead} official workbooks`
      + `${yearbookIndex.warnings.length ? ` (${yearbookIndex.warnings.length} warnings)` : ""}\n`
  );
  if (yearbookIndex.reconciledRows !== yearbookIndex.originalRows) {
    throw new Error(
      `個表の全行照合件数が一致しません: 抽出=${yearbookIndex.originalRows}, 照合=${yearbookIndex.reconciledRows}`
    );
  }
  const unmatchedYearbookWarnings = yearbookIndex.warnings.filter((warning) => warning.startsWith("個表に一致する団体列がありません"));
  if (unmatchedYearbookWarnings.length) {
    process.stderr.write(
      `yearbook unmatched business columns: ${unmatchedYearbookWarnings.length}\n`
        + `${unmatchedYearbookWarnings.slice(0, 40).join("\n")}\n`
    );
  }

  const peerPairs = new Set<string>();
  await mapConcurrent(mapMunicipalities, 10, async (item, index) => {
    if (!item.municipalityCode) return;
    const detail = await getMunicipalityDetail(item.municipalityCode);
    if (!detail) return;
    const yearbookData = yearbookIndex.byMunicipality.get(item.municipalityCode)
      ?? emptyYearbookIndividualData(latestFiscalYear);
    for (const business of detail.businesses) {
      if (!isYearbookAccountingType(business.accountingType)) continue;
      const annual = business.annualFinancials.find((candidate: any) => candidate.surveyYear === latestFiscalYear);
      if (!annual || (annual.householdFee20m3Yen == null && annual.diagnosisResult?.expenseRecoveryRate == null)) continue;
      const hasOfficialBusiness = yearbookData.businesses.some((candidate) => (
        candidate.businessKey === business.businessKey
        && candidate.accountingType === business.accountingType
      ));
      if (!hasOfficialBusiness) continue;
      const exactExpenseRecoveryRate = annual.sewerFeeRevenue != null
        && annual.wastewaterTreatmentCost != null
        && annual.sewerFeeRevenue > 0
        && annual.wastewaterTreatmentCost > 0
        ? annual.sewerFeeRevenue / annual.wastewaterTreatmentCost * 100
        : null;
      try {
        assertOfficialHeadlineValues(yearbookData, {
          businessKey: business.businessKey,
          accountingType: business.accountingType,
          householdFee20m3Yen: annual.householdFee20m3Yen != null && annual.householdFee20m3Yen > 0
            ? annual.householdFee20m3Yen
            : null,
          expenseRecoveryRate: exactExpenseRecoveryRate
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${detail.prefectureName}/${detail.municipalityName}/${item.municipalityCode}/${business.businessKey}: ${message}`
        );
      }
    }
    for (const business of detail.businesses) {
      if (business.annualFinancials.length === 0 || isFlowSewerBusiness(business)) continue;
      peerPairs.add(`${detail.prefectureName}\t${business.businessKey}`);
    }
    await writeJson(
      path.join(publicRoot, "municipalities", `${item.municipalityCode}.json`),
      compactMunicipalityDetail(detail, yearbookData)
    );
    await writeJson(
      path.join(publicRoot, "yearbook", `${item.municipalityCode}.json`),
      yearbookData
    );
    if ((index + 1) % 100 === 0 || index + 1 === mapMunicipalities.length) {
      process.stdout.write(`static details: ${index + 1}/${mapMunicipalities.length}\n`);
    }
  });

  const pairs = [...peerPairs].map((value) => {
    const [prefectureName, businessKey] = value.split("\t");
    return { prefectureName, businessKey };
  });
  await mapConcurrent(pairs, 8, async ({ prefectureName, businessKey }, index) => {
    const prefectureCode = getPrefectureCode(prefectureName);
    if (!prefectureCode) return;
    const comparison = await getPrefecturePeerComparison({ prefectureName, businessKey });
    await writeJson(
      path.join(publicRoot, "peers", prefectureCode, `${encodeURIComponent(businessKey)}.json`),
      comparison
    );
    if ((index + 1) % 50 === 0 || index + 1 === pairs.length) {
      process.stdout.write(`static comparisons: ${index + 1}/${pairs.length}\n`);
    }
  });

  await writeJson(path.join(sourceRoot, "manifest.json"), {
    municipalityCodes: mapMunicipalities.flatMap((item) => item.municipalityCode ? [item.municipalityCode] : []),
    prefectureCodes: prefectures.map((item) => item.code),
    rankingTypes
  });
  await writeText(path.join(sourceRoot, "README.md"), sourceReadme());
  await prisma.$disconnect();
}

function compactMunicipalityDetail(detail: any, yearbookData: YearbookIndividualData) {
  const businesses = detail.businesses.map((business: any) => {
    const sameKey = detail.businesses.filter((candidate: any) => candidate.businessKey === business.businessKey);
    const financialAnnual = findAnnual(sameKey, 2024, business.accountingType);
    const previousFinancialAnnual = findAnnual(sameKey, 2023, business.accountingType);
    const latest = [...business.annualFinancials].sort((a: any, b: any) => b.surveyYear - a.surveyYear)[0] ?? null;
    const evidenceEntries = compactEvidence(latest?.sourceTraceJson, business.accountingType);
    const officialBusiness = yearbookData.businesses.find((candidate) => (
      candidate.businessKey === business.businessKey
      && candidate.accountingType === business.accountingType
    ));
    if (!isFlowSewerBusiness(business)) {
      try {
        assertMappedEvidenceMatchesOfficial(officialBusiness, evidenceEntries);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${detail.prefectureName}/${detail.municipalityName}/${business.businessKey}/${business.accountingType}: ${message}`
        );
      }
    }
    return {
      businessKey: business.businessKey,
      businessName: business.businessName,
      businessType: business.businessType,
      estatBusinessCategory: business.estatBusinessCategory,
      accountingType: business.accountingType,
      financialStory: buildFinancialStoryModel(financialAnnual ?? {
        businessKey: business.businessKey,
        surveyYear: 2024,
        fiscalYearLabel: "R6",
        accountingType: business.accountingType,
        financialStatementItems: []
      }, previousFinancialAnnual),
      financialStatementsReady: Boolean(financialAnnual?.financialStatementItems.length),
      evidenceEntries,
      annualFinancials: business.annualFinancials.map(compactAnnual)
    };
  });

  return {
    municipalityCode: detail.municipalityCode,
    municipalityName: detail.municipalityName,
    municipalityNameKana: detail.municipalityNameKana,
    prefectureCode: detail.prefectureCode,
    prefectureName: detail.prefectureName,
    businesses,
    revisionEvents: detail.revisionEvents.map(compactRevisionEvent),
    servedServiceMemberships: detail.servedServiceMemberships.map((membership: any) => ({
      businessKey: membership.businessKey,
      sourceUrl: membership.sourceUrl,
      sourceLabel: membership.sourceLabel,
      operatorMunicipality: membership.operatorMunicipality
    }))
  };
}

function compactAnnual(annual: any) {
  const {
    id: _id,
    sewerBusinessId: _sewerBusinessId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    sourceTraceJson: _sourceTraceJson,
    financialStatementItems: _financialStatementItems,
    generalAccountTransfer,
    nonStandardTransfer: _nonStandardTransfer,
    table40RainwaterBurden: _table40RainwaterBurden,
    table40OtherAccountSubsidy: _table40OtherAccountSubsidy,
    table40CapitalOtherAccountSubsidy: _table40CapitalOtherAccountSubsidy,
    table40RainwaterBurdenNonStandard: _table40RainwaterBurdenNonStandard,
    table40OtherAccountSubsidyNonStandard: _table40OtherAccountSubsidyNonStandard,
    table40CapitalOtherAccountSubsidyNonStandard: _table40CapitalOtherAccountSubsidyNonStandard,
    diagnosisResult,
    ...values
  } = annual;
  return {
    ...values,
    ...(annual.accountingType === "legal_applied" ? {} : { generalAccountTransfer }),
    diagnosisResult: compactDiagnosis(diagnosisResult)
  };
}

function compactDiagnosis(diagnosis: any) {
  if (!diagnosis) return null;
  const {
    id: _id,
    annualFinancialId: _annualFinancialId,
    sewerBusinessId: _sewerBusinessId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    calculationTraceJson: _calculationTraceJson,
    revisionRiskScore: _revisionRiskScore,
    revisionRiskLabel: _revisionRiskLabel,
    ...values
  } = diagnosis;
  return {
    ...values,
    requiredRevisionRateTo100: values.requiredRevisionRateTo100 == null
      ? null
      : Math.max(values.requiredRevisionRateTo100, 0)
  };
}

function compactListItem(item: any) {
  return { ...item, diagnosis: compactDiagnosis(item.diagnosis) };
}

function compactRevisionEvent(event: any) {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    status: event.status,
    targetBusiness: event.targetBusiness,
    averageRevisionRate: event.averageRevisionRate,
    announcedDate: event.announcedDate,
    effectiveDate: event.effectiveDate,
    sourceUrl: event.sourceUrl,
    sourceLabel: event.sourceLabel,
    municipality: event.municipality ? {
      municipalityCode: event.municipality.municipalityCode,
      municipalityName: event.municipality.municipalityName,
      prefectureName: event.municipality.prefectureName
    } : undefined,
    sewerBusiness: event.sewerBusiness ? {
      businessKey: event.sewerBusiness.businessKey,
      businessName: event.sewerBusiness.businessName,
      businessType: event.sewerBusiness.businessType,
      estatBusinessCategory: event.sewerBusiness.estatBusinessCategory
    } : undefined
  };
}

function compactEvidence(
  sourceTraceJson?: string | null,
  accountingType?: string | null
): Array<[string, any]> {
  const trace = parseJson(sourceTraceJson);
  return Object.entries(trace)
    .filter(([, item]: [string, any]) => item?.value != null)
    .filter(([field]) => accountingType !== "legal_applied" || field !== "generalAccountTransfer")
    .filter(([field]) => field !== "nonStandardTransfer" && !field.startsWith("table40"))
    .sort(([a], [b]) => evidenceOrder(a) - evidenceOrder(b))
    .slice(0, 14)
    .map(([field, item]: [string, any]) => [field, {
      value: item.value,
      unit: item.unit,
      tableNo: item.tableNo,
      tableName: item.tableName,
      sourceUrl: item.sourceUrl
    }]);
}

function findAnnual(businesses: any[], year: number, preferredAccountingType?: string | null) {
  return businesses
    .flatMap((business) => business.annualFinancials
      .filter((annual: any) => annual.surveyYear === year)
      .map((annual: any) => ({ business, annual })))
    .sort((a, b) => {
      const aPreferred = preferredAccountingType && a.business.accountingType === preferredAccountingType ? 1 : 0;
      const bPreferred = preferredAccountingType && b.business.accountingType === preferredAccountingType ? 1 : 0;
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      return accountingPriority(b.business.accountingType) - accountingPriority(a.business.accountingType);
    })[0]?.annual;
}

function accountingPriority(value?: string | null) {
  return value === "legal_applied" ? 2 : value === "non_legal_applied" ? 1 : 0;
}

function isYearbookAccountingType(value: string): value is YearbookAccountingType {
  return value === "legal_applied" || value === "non_legal_applied";
}

function isFlowSewerBusiness(business: any) {
  if (/^17[-/]3(?:[-/]|$)/.test(business.businessKey) || /^17\/3(?:\/|$)/.test(business.estatBusinessCategory ?? "")) return true;
  const normalized = [business.businessName, business.businessType].filter(Boolean).join(" ").normalize("NFKC").replace(/\s+/g, "");
  return normalized.includes("流域下水道") || normalized.includes("下水道事業(一)事業コード3");
}

function parseJson(value?: string | null): Record<string, any> {
  if (!value) return {};
  try { return JSON.parse(value); } catch { return {}; }
}

function evidenceOrder(field: string) {
  const order = [
    "householdFee20m3Yen", "sewerFeeRevenue", "annualBillableVolume", "wastewaterTreatmentCost", "opexComponent", "capitalCostComponent",
    "ordinaryRevenue", "ordinaryExpense", "ordinaryProfitLoss", "netIncome", "totalRevenueNonLegal",
    "totalExpenseNonLegal", "realBalance", "generalAccountTransfer", "standardTransfer",
    "bondBalance", "servicePopulation", "connectedPopulation", "treatedVolume"
  ];
  const index = order.indexOf(field);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function nullsLast(a: number | null | undefined, b: number | null | undefined, direction: "asc" | "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

async function mapConcurrent<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await worker(items[index], index);
    }
  }));
}

async function writeJson(file: string, value: unknown) {
  await writeText(file, JSON.stringify(value));
}

async function writeText(file: string, value: string) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value, "utf8");
}

function sourceReadme() {
  return `# Static publication data\n\nThis directory is generated by \`pnpm static:data\` from the local development database. It contains only public-source display data needed by the static site. The local database, source download paths, hashes, environment variables, and credentials are intentionally excluded.\n\nPrimary provenance remains attached to the displayed values and links to e-Stat, the Ministry of Internal Affairs and Communications, MLIT, and municipality publications. Regenerate and review the complete diff before publication.\n`;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
