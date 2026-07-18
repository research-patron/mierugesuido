import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";
import YAML from "yaml";
import {
  DEFAULT_YEARS,
  FIELD_LABELS,
  FIELD_MAPPING_FILE,
  GOVERNMENT_STAT_CODE,
  GOVERNMENT_STAT_NAME,
  MANUAL_REVISION_EVENTS,
  MANUAL_SOURCE_FILES,
  PROVIDED_STAT_NAME,
  RAW_ESTAT_DIR,
  STANDARD_FIELD_COLUMNS,
  TARGET_TABLES
} from "./constants";
import type { SourceFileInput, StandardFinancialRow } from "./types";
import {
  readKnownPositions,
  staleVerifiedMappingIds,
  VERIFIED_EXACT_MAPPING_FIELDS,
  YAML_FIELD_MAPPING_SOURCE
} from "./fieldMappings";
import {
  asArray,
  collectStrings,
  ensureDir,
  fetchWithRetry,
  fileExists,
  parseAccountingType,
  parseCsvObjects,
  parseTableNo,
  pickText,
  readCsvObjects,
  readNumber,
  readString,
  safeFileName,
  sha256Buffer,
  sha256File,
  toNumber,
  writeJson
} from "./utils";
import { upsertManualRevisionEvent } from "./manualRevisionEvents";
import { readEstatSurveyYear } from "./surveyYear";
import { calculateDiagnosis, calculateTreatmentCost } from "../../lib/calculations";

const prisma = new PrismaClient();

const SEWER_INDUSTRY_CODES = new Set(["17", "18"]);
const PREFECTURE_NAMES: Record<string, string> = {
  "01": "北海道",
  "02": "青森県",
  "03": "岩手県",
  "04": "宮城県",
  "05": "秋田県",
  "06": "山形県",
  "07": "福島県",
  "08": "茨城県",
  "09": "栃木県",
  "10": "群馬県",
  "11": "埼玉県",
  "12": "千葉県",
  "13": "東京都",
  "14": "神奈川県",
  "15": "新潟県",
  "16": "富山県",
  "17": "石川県",
  "18": "福井県",
  "19": "山梨県",
  "20": "長野県",
  "21": "岐阜県",
  "22": "静岡県",
  "23": "愛知県",
  "24": "三重県",
  "25": "滋賀県",
  "26": "京都府",
  "27": "大阪府",
  "28": "兵庫県",
  "29": "奈良県",
  "30": "和歌山県",
  "31": "鳥取県",
  "32": "島根県",
  "33": "岡山県",
  "34": "広島県",
  "35": "山口県",
  "36": "徳島県",
  "37": "香川県",
  "38": "愛媛県",
  "39": "高知県",
  "40": "福岡県",
  "41": "佐賀県",
  "42": "長崎県",
  "43": "熊本県",
  "44": "大分県",
  "45": "宮崎県",
  "46": "鹿児島県",
  "47": "沖縄県"
};

type EstatFieldMapping = {
  field: string;
  label: string;
  rowNo: string;
  colNo?: number;
  positiveColNo?: number;
  negativeColNo?: number;
  fromSurveyYear?: number;
  toSurveyYear?: number;
  unit?: string;
};

const ESTAT_HORIZONTAL_FIELD_MAP: Record<string, Record<number, EstatFieldMapping[]>> = {
  legal_applied: {
    10: [
      { field: "servicePopulation", label: "現在処理区域内人口", rowNo: "01", colNo: 11, unit: "people" },
      { field: "connectedPopulation", label: "現在水洗便所設置済人口", rowNo: "01", colNo: 12, unit: "people" },
      { field: "treatedVolume", label: "汚水処理水量", rowNo: "01", colNo: 50, unit: "cubic_meter" },
      { field: "annualBillableVolume", label: "年間有収水量", rowNo: "01", colNo: 52, unit: "cubic_meter" }
    ],
    20: [
      { field: "operatingRevenue", label: "営業収益", rowNo: "01", colNo: 2, unit: "thousand_yen" },
      { field: "sewerFeeRevenue", label: "下水道使用料収入", rowNo: "01", colNo: 3, unit: "thousand_yen" },
      { field: "operatingExpense", label: "営業費用", rowNo: "01", colNo: 26, unit: "thousand_yen" },
      { field: "ordinaryProfitLoss", label: "経常損益", rowNo: "01", positiveColNo: 46, negativeColNo: 47, unit: "thousand_yen" },
      { field: "netIncome", label: "当年度純損益", rowNo: "01", positiveColNo: 55, negativeColNo: 56, unit: "thousand_yen" }
    ],
    33: [
      { field: "householdFee20m3Yen", label: "一般家庭用20m³／月使用料", rowNo: "01", colNo: 13, unit: "yen_per_month_tax_included" }
    ],
    24: [{ field: "bondBalance", label: "企業債残高", rowNo: "01", colNo: 12, unit: "thousand_yen" }],
    32: [
      { field: "opexComponent", label: "汚水処理費（維持管理費分）", rowNo: "01", colNo: 44, unit: "thousand_yen" },
      { field: "capitalCostComponent", label: "汚水処理費（資本費分）", rowNo: "02", colNo: 8, unit: "thousand_yen" },
      { field: "wastewaterTreatmentCost", label: "汚水処理費（合計）", rowNo: "02", colNo: 16, unit: "thousand_yen" }
    ],
    40: [
      { field: "generalAccountTransfer", label: "他会計繰入金", rowNo: "01", colNo: 13, unit: "thousand_yen" },
      // The legal-applied table 40 layout widened in R5. The total stays on row
      // 02, but moves from column 37 (R2-R4) to column 57 (R5-R6).
      { field: "nonStandardTransfer", label: "基準外繰入合計", rowNo: "02", colNo: 37, toSurveyYear: 2022, unit: "thousand_yen" },
      { field: "nonStandardTransfer", label: "基準外繰入合計", rowNo: "02", colNo: 57, fromSurveyYear: 2023, unit: "thousand_yen" }
    ]
  },
  non_legal_applied: {
    10: [
      { field: "servicePopulation", label: "現在処理区域内人口", rowNo: "01", colNo: 11, unit: "people" },
      { field: "connectedPopulation", label: "現在水洗便所設置済人口", rowNo: "01", colNo: 12, unit: "people" },
      { field: "treatedVolume", label: "汚水処理水量", rowNo: "01", colNo: 50, unit: "cubic_meter" },
      { field: "annualBillableVolume", label: "年間有収水量", rowNo: "01", colNo: 52, unit: "cubic_meter" }
    ],
    24: [{ field: "bondBalance", label: "地方債残高", rowNo: "01", colNo: 12, unit: "thousand_yen" }],
    26: [
      { field: "totalRevenueNonLegal", label: "総収益", rowNo: "01", colNo: 1, unit: "thousand_yen" },
      { field: "sewerFeeRevenue", label: "下水道使用料収入", rowNo: "01", colNo: 3, unit: "thousand_yen" },
      { field: "totalExpenseNonLegal", label: "総費用", rowNo: "01", colNo: 12, unit: "thousand_yen" }
    ],
    32: [
      { field: "opexComponent", label: "汚水処理費（維持管理費分）", rowNo: "01", colNo: 44, unit: "thousand_yen" },
      { field: "capitalCostComponent", label: "汚水処理費（資本費分）", rowNo: "02", colNo: 8, unit: "thousand_yen" },
      { field: "wastewaterTreatmentCost", label: "汚水処理費（合計）", rowNo: "02", colNo: 16, unit: "thousand_yen" }
    ],
    33: [
      { field: "householdFee20m3Yen", label: "一般家庭用20m³／月使用料", rowNo: "01", colNo: 13, unit: "yen_per_month_tax_included" }
    ],
    40: [
      { field: "generalAccountTransfer", label: "他会計繰入金", rowNo: "01", colNo: 43, unit: "thousand_yen" },
      { field: "nonStandardTransfer", label: "基準外繰入合計", rowNo: "01", colNo: 57, unit: "thousand_yen" }
    ]
  }
};

const municipalityCache = new Map<string, Awaited<ReturnType<typeof prisma.municipality.upsert>>>();
const businessCache = new Map<string, Awaited<ReturnType<typeof prisma.sewerBusiness.upsert>>>();
const annualCache = new Map<string, Awaited<ReturnType<typeof prisma.annualFinancial.findUnique>>>();

export async function runWithEtlLog(command: string, fn: () => Promise<unknown>) {
  const run = await prisma.etlRun.create({
    data: { command, status: "running" }
  });

  try {
    const result = await fn();
    await prisma.etlRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        logJson: JSON.stringify(result ?? {}, null, 2)
      }
    });
    return result;
  } catch (error) {
    await prisma.etlRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }).catch(() => undefined);
    throw error;
  }
}

export async function discoverSourceFiles(years = DEFAULT_YEARS, allowManualFallback = false) {
  await loadFieldMappings(years);
  const appId = process.env.ESTAT_APP_ID;

  if (!appId) {
    if (allowManualFallback && manualSourceFilesAvailable()) {
      const manual = await upsertManualSourceFiles();
      return {
        mode: "manual_fallback",
        message: "ESTAT_APP_ID is not set. Manual source files were registered instead.",
        sourceFiles: manual.length
      };
    }
    throw new Error(
      "ESTAT_APP_ID is not set. Set it in .env.local for e-Stat API discovery, or place files under data/raw/manual/{year}/ and define data/manual/source_files.csv, then run pnpm etl:import --manual."
    );
  }

  const discovered: SourceFileInput[] = [];
  for (const year of years) {
    discovered.push(...(await discoverFromStatsList(appId, year)));
    discovered.push(...(await discoverFromDataCatalog(appId, year)));
  }

  const filtered = dedupeSourceInputs(discovered).filter((source) => isTargetSource(source));
  for (const source of filtered) {
    await upsertSourceFile(source);
  }

  return {
    mode: "estat_api",
    years,
    discovered: filtered.length,
    warnings:
      filtered.length === 0
        ? [
            "No target sewerage files were discovered. e-Stat may expose this survey as downloadable Excel files only; place downloaded files under data/raw/manual and run pnpm etl:import --manual."
          ]
        : []
  };
}

export async function downloadSourceFiles(years?: number[]) {
  const sources = await prisma.sourceFile.findMany({
    where: {
      sourceUrl: { not: null },
      ...(years?.length ? { surveyYear: { in: years } } : {})
    },
    orderBy: [{ surveyYear: "desc" }, { accountingType: "asc" }, { tableNo: "asc" }]
  });
  const downloaded: string[] = [];
  const skipped: string[] = [];

  for (const source of sources) {
    if (!source.sourceUrl || source.sourceUrl.startsWith("manual://")) {
      skipped.push(`manual:${source.id}`);
      continue;
    }
    if (source.localPath && fileExists(source.localPath) && source.sha256) {
      skipped.push(source.localPath);
      continue;
    }

    const response = await fetchWithRetry(source.sourceUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const headerFileName = fileNameFromContentDisposition(response.headers.get("content-disposition"));
    const extFromHeader = headerFileName ? path.extname(headerFileName).replace(".", "").toLowerCase() : "";
    const extFromUrl = path.extname(new URL(source.sourceUrl).pathname).replace(".", "").toLowerCase();
    const fileFormat = source.fileFormat === "download" ? "" : (source.fileFormat ?? "");
    const ext = fileFormat === "api" ? "json" : extFromHeader || extFromUrl || fileFormat || "xlsx";
    const account = source.accountingType ?? "unknown";
    const nameBase = headerFileName
      ? `${source.tableNo ?? "table"}_${headerFileName}`
      : `${source.tableNo ?? "table"}_${source.tableName ?? source.estatStatsDataId ?? source.id}.${ext}`;
    const fileName = safeFileName(nameBase);
    const localPath = path.join(RAW_ESTAT_DIR, String(source.surveyYear), account, fileName.endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`);
    ensureDir(localPath, true);

    writeFileSync(localPath, buffer);

    await prisma.sourceFile.update({
      where: { id: source.id },
      data: {
        localPath,
        fileFormat: ext,
        sha256: sha256Buffer(buffer),
        downloadedAt: new Date()
      }
    });
    downloaded.push(localPath);
  }

  return { downloaded, skipped };
}

function fileNameFromContentDisposition(header: string | null) {
  if (!header) return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  const quoted = header.match(/filename="([^"]+)"/i)?.[1];
  if (quoted) return quoted;
  const bare = header.match(/filename=([^;]+)/i)?.[1];
  return bare?.trim() ?? null;
}

export async function importSourceFiles(manualOnly = false, years = DEFAULT_YEARS) {
  await loadFieldMappings(years);
  // Manual fixtures are a fallback input, not an additive production source.
  // Registering them during a normal official e-Stat import can create duplicate
  // synthetic municipalities beside the six-digit official municipality codes.
  const manual = manualOnly ? await upsertManualSourceFiles() : [];
  const sources = await prisma.sourceFile.findMany({
    where: manualOnly
      ? { sourceUrl: { startsWith: "manual://" } }
      : {
          surveyYear: { in: years },
          localPath: { not: null },
          NOT: { sourceUrl: { startsWith: "manual://" } }
        },
    orderBy: [{ surveyYear: "asc" }, { id: "asc" }]
  });

  const importable = sources.filter((source) => fileExists(source.localPath));
  if (importable.length === 0) {
    throw new Error(
      "No importable files found. Download e-Stat files with pnpm etl:download or define manual files in data/manual/source_files.csv."
    );
  }

  let annualRows = 0;
  let rawCells = 0;
  const warnings: string[] = [];
  for (const source of importable) {
    const result = await importOneSourceFile(source);
    annualRows += result.annualRows;
    rawCells += result.rawCells;
    warnings.push(...result.warnings);
  }
  const revisionEvents = await importManualRevisionEvents();

  return {
    registeredManualFiles: manual.length,
    importedFiles: importable.length,
    annualRows,
    rawCells,
    revisionEvents,
    warnings
  };
}

export async function calculateAllDiagnosis(years = DEFAULT_YEARS) {
  const calculationYears = normalizeCalculationYears(years);
  const annuals = await prisma.annualFinancial.findMany({
    where: calculationYears.length ? { surveyYear: { in: calculationYears } } : undefined,
    include: {
      sewerBusiness: true
    },
    orderBy: [{ sewerBusinessId: "asc" }, { surveyYear: "asc" }]
  });
  const historiesByBusiness = new Map<number, typeof annuals>();
  for (const annual of annuals) {
    const history = historiesByBusiness.get(annual.sewerBusinessId) ?? [];
    history.push(annual);
    historiesByBusiness.set(annual.sewerBusinessId, history);
  }

  let calculated = 0;
  for (const annual of annuals) {
    const history = historiesByBusiness.get(annual.sewerBusinessId) ?? [];
    const trend = {
      treatmentCostYenPerM3: history.map((item) =>
        calculateTreatmentCost(item.wastewaterTreatmentCost, item.annualBillableVolume)
      ),
      annualBillableVolume: history.map((item) => item.annualBillableVolume)
    };
    const ordinaryProfitLoss =
      annual.ordinaryRevenue != null && annual.ordinaryExpense != null
        ? annual.ordinaryRevenue - annual.ordinaryExpense
        : annual.ordinaryProfitLoss;
    const revenueExpenditureRatio =
      annual.revenueExpenditureRatio ??
      (annual.totalRevenueNonLegal != null && annual.totalExpenseNonLegal != null
        ? (annual.totalRevenueNonLegal / (annual.totalExpenseNonLegal + (annual.bondRedemption ?? 0))) * 100
        : null);

    const diagnosis = calculateDiagnosis(
      {
        accountingType: annual.accountingType,
        sewerFeeRevenue: annual.sewerFeeRevenue,
        annualBillableVolume: annual.annualBillableVolume,
        wastewaterTreatmentCost: annual.wastewaterTreatmentCost,
        ordinaryRevenue: annual.ordinaryRevenue,
        ordinaryExpense: annual.ordinaryExpense,
        netIncome: annual.netIncome,
        accumulatedDeficit: annual.accumulatedDeficit,
        totalRevenueNonLegal: annual.totalRevenueNonLegal,
        totalExpenseNonLegal: annual.totalExpenseNonLegal,
        realBalance: annual.realBalance,
        revenueExpenditureRatio,
        generalAccountTransfer: annual.generalAccountTransfer,
        nonStandardTransfer: annual.nonStandardTransfer,
        bondRedemption: annual.bondRedemption,
        treatedVolume: annual.treatedVolume,
        servicePopulation: annual.servicePopulation,
        connectedPopulation: annual.connectedPopulation
      },
      trend
    );

    await prisma.annualFinancial.update({
      where: { id: annual.id },
      data: {
        ordinaryProfitLoss,
        revenueExpenditureRatio,
        dataQualityStatus: diagnosis.flags.length > 0 ? "warning" : "ok",
        flagsJson: JSON.stringify(diagnosis.flags, null, 2)
      }
    });

    await prisma.diagnosisResult.upsert({
      where: { annualFinancialId: annual.id },
      update: {
        sewerBusinessId: annual.sewerBusinessId,
        surveyYear: annual.surveyYear,
        feeUnitPriceYenPerM3: diagnosis.feeUnitPriceYenPerM3,
        treatmentCostYenPerM3: diagnosis.treatmentCostYenPerM3,
        expenseRecoveryRate: diagnosis.expenseRecoveryRate,
        requiredRevisionRateTo80: diagnosis.requiredRevisionRateTo80,
        requiredRevisionRateTo100: diagnosis.requiredRevisionRateTo100,
        requiredRevisionRateTo150yen: diagnosis.requiredRevisionRateTo150yen,
        accountingBalanceLabel: diagnosis.accountingBalanceLabel,
        feeAdequacyLabel: diagnosis.feeAdequacyLabel,
        revisionRiskScore: diagnosis.revisionRiskScore,
        revisionRiskLabel: diagnosis.revisionRiskLabel,
        diagnosisComment: diagnosis.diagnosisComment,
        calculationTraceJson: JSON.stringify(diagnosis.calculationTrace, null, 2)
      },
      create: {
        annualFinancialId: annual.id,
        sewerBusinessId: annual.sewerBusinessId,
        surveyYear: annual.surveyYear,
        feeUnitPriceYenPerM3: diagnosis.feeUnitPriceYenPerM3,
        treatmentCostYenPerM3: diagnosis.treatmentCostYenPerM3,
        expenseRecoveryRate: diagnosis.expenseRecoveryRate,
        requiredRevisionRateTo80: diagnosis.requiredRevisionRateTo80,
        requiredRevisionRateTo100: diagnosis.requiredRevisionRateTo100,
        requiredRevisionRateTo150yen: diagnosis.requiredRevisionRateTo150yen,
        accountingBalanceLabel: diagnosis.accountingBalanceLabel,
        feeAdequacyLabel: diagnosis.feeAdequacyLabel,
        revisionRiskScore: diagnosis.revisionRiskScore,
        revisionRiskLabel: diagnosis.revisionRiskLabel,
        diagnosisComment: diagnosis.diagnosisComment,
        calculationTraceJson: JSON.stringify(diagnosis.calculationTrace, null, 2)
      }
    });
    calculated += 1;
  }

  return { calculated };
}

function normalizeCalculationYears(years: number[]) {
  return [...new Set(years.flatMap((year) => [year, year - 1]).filter((year) => Number.isFinite(year) && year > 0))];
}

async function discoverFromStatsList(appId: string, surveyYear: number): Promise<SourceFileInput[]> {
  const url = new URL("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsList");
  url.search = new URLSearchParams({
    appId,
    lang: "J",
    statsCode: GOVERNMENT_STAT_CODE,
    searchKind: "1",
    collectArea: "1",
    searchWord: "地方公営企業決算状況調査 下水道事業",
    surveyYears: String(surveyYear)
  }).toString();
  const response = await fetchWithRetry(url.toString());
  const json = await response.json();
  const tables = asArray(json?.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF);

  return tables.map((table: unknown) => {
    const text = pickText(table);
    const statsDataId = pickFirstMatchingString(table, /^\d{8,}$/) ?? undefined;
    const tableNo = parseTableNo(text);
    const accountingType = parseAccountingType(text);
    const sourceUrl = statsDataId
      ? `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${encodeURIComponent(appId)}&lang=J&statsDataId=${encodeURIComponent(statsDataId)}`
      : url.toString();
    return {
      surveyYear,
      fiscalYearLabel: String(surveyYear),
      governmentStatCode: GOVERNMENT_STAT_CODE,
      governmentStatName: GOVERNMENT_STAT_NAME,
      providedStatName: PROVIDED_STAT_NAME,
      category1: "全国",
      category2: "調査表",
      tableNo,
      tableName: extractTitle(text, tableNo),
      accountingType,
      estatStatsDataId: statsDataId,
      sourceUrl,
      fileFormat: statsDataId ? "api" : "json"
    };
  });
}

async function discoverFromDataCatalog(appId: string, surveyYear: number): Promise<SourceFileInput[]> {
  const url = new URL("https://api.e-stat.go.jp/rest/3.0/app/json/getDataCatalog");
  url.search = new URLSearchParams({
    appId,
    lang: "J",
    statsCode: GOVERNMENT_STAT_CODE,
    searchWord: "地方公営企業決算状況調査",
    surveyYears: String(surveyYear),
    limit: "100"
  }).toString();

  try {
    const response = await fetchWithRetry(url.toString());
    const json = await response.json();
    const items = asArray(json?.GET_DATA_CATALOG?.DATA_CATALOG_LIST_INF?.DATA_CATALOG_INF);
    return items.flatMap((item: any) => {
      const dataset = item?.DATASET ?? {};
      const title = dataset?.TITLE ?? {};
      const datasetYear = Number(title?.SURVEY_DATE ?? surveyYear);
      if (Number.isFinite(datasetYear) && datasetYear !== surveyYear) return [];

      return asArray(item?.RESOURCES?.RESOURCE).map((resource: any) => {
        const resourceTitle = resource?.TITLE ?? {};
        const text = pickText([resourceTitle, resource]);
        const tableNo = toNumber(resourceTitle?.TABLE_NO) ?? parseTableNo(text);
        const accountingType = parseAccountingType(text);
        const sourceUrl = readString({ url: resource?.URL }, ["url"]);
        const estatStatInfid = sourceUrl.match(/statInfId=([^&]+)/)?.[1] ?? null;
        return {
          surveyYear,
          fiscalYearLabel: String(surveyYear),
          governmentStatCode: GOVERNMENT_STAT_CODE,
          governmentStatName: GOVERNMENT_STAT_NAME,
          providedStatName: PROVIDED_STAT_NAME,
          category1: title?.TABULATION_SUB_CATEGORY1 ?? "全国",
          category2: title?.TABULATION_SUB_CATEGORY2 ?? "調査表",
          tableNo,
          tableName: readString(resourceTitle, ["TABLE_NAME", "NAME"], extractTitle(text, tableNo)),
          accountingType,
          estatStatInfid,
          sourceUrl,
          fileFormat: "download",
          publishedAt: dataset?.RELEASE_DATE ?? dataset?.LAST_MODIFIED_DATE ?? null
        };
      });
    });
  } catch (error) {
    return [];
  }
}

function isTargetSource(source: SourceFileInput) {
  if (!source.accountingType || !source.tableNo) return false;
  if (source.tableName?.includes("上水道事業と簡易水道事業")) return false;
  if (source.tableName?.includes("企業債に関する調2")) return false;
  return (TARGET_TABLES[source.accountingType] as readonly number[]).includes(source.tableNo);
}

function dedupeSourceInputs(sources: SourceFileInput[]) {
  const map = new Map<string, SourceFileInput>();
  for (const source of sources) {
    const key = [
      source.surveyYear,
      source.accountingType,
      source.tableNo,
      source.estatStatsDataId,
      source.sourceUrl
    ].join("|");
    map.set(key, source);
  }
  return [...map.values()];
}

async function upsertSourceFile(input: SourceFileInput) {
  const existing = await prisma.sourceFile.findFirst({
    where: {
      surveyYear: input.surveyYear,
      accountingType: input.accountingType ?? undefined,
      tableNo: input.tableNo ?? undefined,
      OR: [
        { sourceUrl: input.sourceUrl ?? undefined },
        { localPath: input.localPath ?? undefined },
        { estatStatsDataId: input.estatStatsDataId ?? undefined }
      ].filter((item) => Object.values(item)[0] != null)
    }
  });

  const data = {
    surveyYear: input.surveyYear,
    fiscalYearLabel: input.fiscalYearLabel ?? String(input.surveyYear),
    governmentStatCode: input.governmentStatCode,
    governmentStatName: input.governmentStatName,
    providedStatName: input.providedStatName,
    category1: input.category1 ?? null,
    category2: input.category2 ?? null,
    tableNo: input.tableNo ?? null,
    tableName: input.tableName ?? null,
    accountingType: input.accountingType ?? null,
    estatStatInfid: input.estatStatInfid ?? null,
    estatStatsDataId: input.estatStatsDataId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    localPath: input.localPath ?? null,
    fileFormat: input.fileFormat ?? null,
    publishedAt: input.publishedAt ?? null,
    sha256: input.sha256 ?? null,
    downloadedAt: input.localPath && input.sha256 ? new Date() : null
  };

  if (existing) {
    return prisma.sourceFile.update({ where: { id: existing.id }, data });
  }
  return prisma.sourceFile.create({ data });
}

function manualSourceFilesAvailable() {
  if (!existsSync(MANUAL_SOURCE_FILES)) return false;
  return readCsvObjects(MANUAL_SOURCE_FILES).some((row) => fileExists(readString(row, ["local_path", "localPath"])));
}

async function upsertManualSourceFiles() {
  if (!existsSync(MANUAL_SOURCE_FILES)) return [];
  const rows = readCsvObjects(MANUAL_SOURCE_FILES);
  const results = [];
  for (const row of rows) {
    const localPath = readString(row, ["local_path", "localPath"]);
    if (!localPath) continue;
    const sha = fileExists(localPath) ? sha256File(localPath) : null;
    const source = await upsertSourceFile({
      surveyYear: Number(readString(row, ["survey_year", "surveyYear"], "0")),
      fiscalYearLabel: readString(row, ["fiscal_year_label", "fiscalYearLabel"]),
      governmentStatCode: readString(row, ["government_stat_code"], GOVERNMENT_STAT_CODE),
      governmentStatName: readString(row, ["government_stat_name"], GOVERNMENT_STAT_NAME),
      providedStatName: readString(row, ["provided_stat_name"], PROVIDED_STAT_NAME),
      category1: readString(row, ["category_1"], "手動配置"),
      category2: readString(row, ["category_2"], "標準化CSV"),
      tableNo: readNumber(row, ["table_no", "tableNo"]),
      tableName: readString(row, ["table_name", "tableName"]),
      accountingType: readString(row, ["accounting_type", "accountingType"]) as "legal_applied" | "non_legal_applied",
      sourceUrl: readString(row, ["source_url", "sourceUrl"], `manual://${localPath}`),
      localPath,
      fileFormat: readString(row, ["file_format", "fileFormat"], path.extname(localPath).replace(".", "")),
      publishedAt: readString(row, ["published_at", "publishedAt"]),
      sha256: sha
    });
    results.push(source);
  }
  return results;
}

async function importOneSourceFile(source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number]) {
  await prisma.rawStatCell.deleteMany({ where: { sourceFileId: source.id } });
  const filePath = source.localPath;
  if (!filePath) return { annualRows: 0, rawCells: 0, warnings: [`source_file ${source.id} has no local_path`] };

  const ext = path.extname(filePath).toLowerCase();
  if (isUnmappedEstatWorkbook(source, ext)) {
    return { annualRows: 0, rawCells: 0, warnings: [`${filePath} was skipped because no public diagnosis fields are mapped from this source.`] };
  }
  if (ext === ".csv") {
    const rows = parseCsvObjects(readFileSync(filePath, "utf8"));
    if (looksLikeStandardRows(rows)) {
      const result = await importStandardRows(source, rows);
      return { ...result, warnings: [] };
    }
    const rawCells = await importGenericCsvCells(source, rows);
    return { annualRows: 0, rawCells, warnings: [`${filePath} was imported as raw cells only.`] };
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const sheetRows = workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const objects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      return objects.map((row) => ({ ...row, __sheetName: sheetName }));
    });
    if (looksLikeStandardRows(sheetRows)) {
      const result = await importStandardRows(source, sheetRows);
      return { ...result, warnings: [] };
    }
    if (looksLikeEstatHorizontalRows(sheetRows)) {
      const result = await importEstatHorizontalRows(source, sheetRows);
      return { ...result, warnings: result.annualRows > 0 ? [] : [`${filePath} had e-Stat rows but no target sewerage fields for this source.`] };
    }
    const rawCells = await importWorkbookCells(source, workbook);
    return { annualRows: 0, rawCells, warnings: [`${filePath} was imported as raw workbook cells only.`] };
  }

  if (ext === ".json") {
    const rawCells = await importEstatJsonCells(source, JSON.parse(readFileSync(filePath, "utf8")));
    return { annualRows: 0, rawCells, warnings: [`${filePath} was imported as generic e-Stat JSON cells.`] };
  }

  return { annualRows: 0, rawCells: 0, warnings: [`Unsupported file format: ${filePath}`] };
}

function isUnmappedEstatWorkbook(source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number], ext: string) {
  if (ext !== ".xlsx" && ext !== ".xls") return false;
  if (!source.sourceUrl?.startsWith("http")) return false;
  const accountingType = source.accountingType === "non_legal_applied" ? "non_legal_applied" : "legal_applied";
  const tableNo = source.tableNo ?? 0;
  if (source.tableName?.includes("企業債に関する調2")) return true;
  return (ESTAT_HORIZONTAL_FIELD_MAP[accountingType]?.[tableNo] ?? []).length === 0;
}

function looksLikeStandardRows(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return false;
  const headers = new Set(Object.keys(rows[0]));
  return headers.has("municipality_code") && (headers.has("sewer_fee_revenue") || headers.has("下水道使用料収入"));
}

function looksLikeEstatHorizontalRows(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return false;
  const headers = new Set(Object.keys(rows[0]));
  return headers.has("団体コード") && headers.has("業種コード") && headers.has("表番号") && headers.has("行番号") && headers.has("列001");
}

async function importEstatHorizontalRows(
  source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number],
  rows: Record<string, unknown>[]
) {
  const accountingType = source.accountingType === "non_legal_applied" ? "non_legal_applied" : "legal_applied";
  const tableNo = source.tableNo ?? toNumber(rows[0]?.["表番号"]) ?? 0;
  const mappings = ESTAT_HORIZONTAL_FIELD_MAP[accountingType]?.[tableNo] ?? [];
  if (mappings.length === 0) return { annualRows: 0, rawCells: 0 };

  let annualRows = 0;
  let rawCells = 0;
  const targetRows = rows.filter((row) => isTargetEstatRow(row, tableNo));
  const rawCellRows: Array<{
    sourceFileId: number;
    surveyYear: number;
    municipalityCode: string;
    municipalityName: string;
    prefectureName: string;
    businessKey: string;
    businessName: string;
    businessType: string;
    accountingType: string;
    tableNo: number;
    rowNo: number | null;
    colNo: number | null;
    itemNameOriginal: string;
    valueRaw: string | null;
    valueNumeric: number | null;
    unit: string | null;
    sheetName: string | null;
    cellAddress: string;
  }> = [];
  for (const row of targetRows) {
    const values = extractEstatMappedValues(row, mappings);
    if (Object.keys(values.data).length === 0) continue;

    await upsertAnnualFromEstatRow(source, row, accountingType, tableNo, values.data, values.trace);
    rawCellRows.push(
      ...values.rawCells.map((cell) => ({
        sourceFileId: source.id,
        surveyYear: cell.surveyYear,
        municipalityCode: cell.municipalityCode,
        municipalityName: cell.municipalityName,
        prefectureName: cell.prefectureName,
        businessKey: cell.businessKey,
        businessName: cell.businessName,
        businessType: cell.businessType,
        accountingType,
        tableNo,
        rowNo: cell.rowNo,
        colNo: cell.colNo,
        itemNameOriginal: cell.itemNameOriginal,
        valueRaw: cell.valueRaw,
        valueNumeric: cell.valueNumeric,
        unit: cell.unit,
        sheetName: cell.sheetName,
        cellAddress: cell.cellAddress
      }))
    );
    rawCells += values.rawCells.length;
    annualRows += 1;
  }
  for (let index = 0; index < rawCellRows.length; index += 1000) {
    await prisma.rawStatCell.createMany({ data: rawCellRows.slice(index, index + 1000) });
  }
  return { annualRows, rawCells };
}

function isTargetEstatRow(row: Record<string, unknown>, tableNo: number) {
  const rowTableNo = toNumber(row["表番号"]);
  const industryCode = normalizeCode(row["業種コード"], 2);
  if (rowTableNo !== tableNo) return false;
  return SEWER_INDUSTRY_CODES.has(industryCode);
}

function extractEstatMappedValues(row: Record<string, unknown>, mappings: EstatFieldMapping[]) {
  const data: Record<string, number> = {};
  const trace: Record<string, Record<string, unknown>> = {};
  const rawCells: Array<{
    surveyYear: number;
    municipalityCode: string;
    municipalityName: string;
    prefectureName: string;
    businessKey: string;
    businessName: string;
    businessType: string;
    rowNo: number | null;
    colNo: number | null;
    itemNameOriginal: string;
    valueRaw: string | null;
    valueNumeric: number | null;
    unit: string | null;
    sheetName: string | null;
    cellAddress: string;
  }> = [];
  const rowNo = normalizeCode(row["行番号"], 2);
  const surveyYear = readEstatSurveyYear(row);
  const municipalityCode = readString(row, ["団体コード"]);
  const municipalityName = readString(row, ["団体名"]);
  const prefectureCode = municipalityCode.slice(0, 2);
  const prefectureName = PREFECTURE_NAMES[prefectureCode] ?? "不明";
  const businessInfo = estatBusinessInfo(row);

  for (const mapping of mappings) {
    if (!mappingAppliesToSurveyYear(mapping, surveyYear)) continue;
    if (mapping.rowNo !== rowNo) continue;
    const extracted = readMappedEstatValue(row, mapping);
    if (extracted.value == null) continue;
    data[mapping.field] = extracted.value;
    trace[mapping.field] = {
      tableNo: toNumber(row["表番号"]),
      tableName: mapping.label,
      rowNo,
      colNo: extracted.colNo,
      itemNameOriginal: mapping.label,
      unit: mapping.unit ?? unitForField(mapping.field),
      value: extracted.value
    };
    rawCells.push({
      surveyYear,
      municipalityCode,
      municipalityName,
      prefectureName,
      businessKey: businessInfo.businessKey,
      businessName: businessInfo.businessName,
      businessType: businessInfo.businessType,
      rowNo: Number(rowNo),
      colNo: extracted.colNo,
      itemNameOriginal: mapping.label,
      valueRaw: extracted.valueRaw,
      valueNumeric: extracted.value,
      unit: mapping.unit ?? unitForField(mapping.field),
      sheetName: readString(row, ["__sheetName"]),
      cellAddress: `R${rowNo}C${extracted.colNo ?? ""}`
    });
  }

  return { data, trace, rawCells };
}

function mappingAppliesToSurveyYear(mapping: EstatFieldMapping, surveyYear: number) {
  if (mapping.fromSurveyYear != null && surveyYear < mapping.fromSurveyYear) return false;
  if (mapping.toSurveyYear != null && surveyYear > mapping.toSurveyYear) return false;
  return true;
}

function readMappedEstatValue(row: Record<string, unknown>, mapping: EstatFieldMapping) {
  if (mapping.colNo != null) {
    const key = estatColumnKey(mapping.colNo);
    const value = toNumber(row[key]);
    return { value, valueRaw: row[key] == null ? null : String(row[key]), colNo: mapping.colNo };
  }

  const positive = mapping.positiveColNo != null ? toNumber(row[estatColumnKey(mapping.positiveColNo)]) ?? 0 : 0;
  const negative = mapping.negativeColNo != null ? toNumber(row[estatColumnKey(mapping.negativeColNo)]) ?? 0 : 0;
  if (mapping.positiveColNo == null && mapping.negativeColNo == null) return { value: null, valueRaw: null, colNo: null };
  return {
    value: positive - negative,
    valueRaw: `${positive}-${negative}`,
    colNo: mapping.positiveColNo ?? mapping.negativeColNo ?? null
  };
}

async function upsertAnnualFromEstatRow(
  source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number],
  row: Record<string, unknown>,
  accountingType: "legal_applied" | "non_legal_applied",
  tableNo: number,
  data: Record<string, number>,
  trace: Record<string, Record<string, unknown>>
) {
  const municipalityCode = readString(row, ["団体コード"]);
  const municipalityName = readString(row, ["団体名"]);
  if (!municipalityCode || !municipalityName) return;

  const prefectureCode = municipalityCode.slice(0, 2);
  const prefectureName = PREFECTURE_NAMES[prefectureCode] ?? "不明";
  const businessInfo = estatBusinessInfo(row);
  const surveyYear = readEstatSurveyYear(row);

  let municipality = municipalityCache.get(municipalityCode);
  if (!municipality) {
    municipality = await prisma.municipality.upsert({
      where: { municipalityCode },
      update: { prefectureCode, prefectureName, municipalityName },
      create: { municipalityCode, prefectureCode, prefectureName, municipalityName }
    });
    municipalityCache.set(municipalityCode, municipality);
  }

  const businessCacheKey = `${municipality.id}|${businessInfo.businessKey}|${accountingType}`;
  let business = businessCache.get(businessCacheKey);
  if (!business) {
    business = await prisma.sewerBusiness.upsert({
      where: {
        municipalityId_businessKey_accountingType: {
          municipalityId: municipality.id,
          businessKey: businessInfo.businessKey,
          accountingType
        }
      },
      update: {
        businessName: businessInfo.businessName,
        businessType: businessInfo.businessType,
        estatBusinessCategory: businessInfo.estatBusinessCategory
      },
      create: {
        municipalityId: municipality.id,
        businessKey: businessInfo.businessKey,
        businessName: businessInfo.businessName,
        businessType: businessInfo.businessType,
        accountingType,
        estatBusinessCategory: businessInfo.estatBusinessCategory
      }
    });
    businessCache.set(businessCacheKey, business);
  }

  const annualCacheKey = `${business.id}|${surveyYear}`;
  let existing = annualCache.get(annualCacheKey);
  if (existing === undefined) {
    existing = await prisma.annualFinancial.findUnique({
      where: {
        sewerBusinessId_surveyYear: {
          sewerBusinessId: business.id,
          surveyYear
        }
      }
    });
    annualCache.set(annualCacheKey, existing);
  }

  const mergedTrace = {
    ...(parseJsonObject(existing?.sourceTraceJson) ?? {}),
    ...Object.fromEntries(
      Object.entries(trace).map(([field, value]) => [
        field,
        {
          sourceFileId: source.id,
          sourceUrl: source.sourceUrl,
          surveyYear,
          tableNo,
          tableName: source.tableName,
          ...value
        }
      ])
    )
  };
  const updateData = {
    fiscalYearLabel: japaneseFiscalYearLabel(surveyYear),
    accountingType,
    ...data,
    sourceTraceJson: JSON.stringify(mergedTrace, null, 2)
  };

  if (existing) {
    const updated = await prisma.annualFinancial.update({
      where: { id: existing.id },
      data: updateData
    });
    annualCache.set(annualCacheKey, updated);
    return;
  }

  const created = await prisma.annualFinancial.create({
    data: {
      sewerBusinessId: business.id,
      surveyYear,
      ...updateData
    }
  });
  annualCache.set(annualCacheKey, created);
}

function estatBusinessInfo(row: Record<string, unknown>) {
  const industryCode = normalizeCode(row["業種コード"], 2);
  const businessCode = normalizeCode(row["事業コード"], 1);
  const facilityCode = normalizeCode(row["施設コード"], 3);
  const category = industryCode === "18" ? "下水道事業（二）" : "下水道事業（一）";
  const businessType = `${category} 事業コード${businessCode}`;
  const facilityName = readString(row, ["施設名"]);
  const businessName = facilityName || businessType;
  return {
    businessKey: `${industryCode}-${businessCode}-${facilityCode || "000"}`,
    businessName,
    businessType,
    estatBusinessCategory: `${industryCode}/${businessCode}/${facilityCode || "000"}`
  };
}

function japaneseFiscalYearLabel(year: number) {
  if (year >= 2019) return `令和${year - 2018}年度`;
  if (year >= 1989) return `平成${year - 1988}年度`;
  return `${year}年度`;
}

function normalizeCode(value: unknown, width: number) {
  const text = value == null ? "" : String(value).trim();
  return text ? text.padStart(width, "0") : "";
}

function estatColumnKey(colNo: number) {
  return `列${String(colNo).padStart(3, "0")}`;
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function importStandardRows(source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number], rows: Record<string, unknown>[]) {
  let annualRows = 0;
  let rawCells = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const standard = toStandardFinancialRow(rows[index], source);
    if (!standard) continue;

    const municipality = await prisma.municipality.upsert({
      where: { municipalityCode: standard.municipalityCode },
      update: {
        prefectureCode: standard.prefectureCode,
        prefectureName: standard.prefectureName,
        municipalityName: standard.municipalityName,
        municipalityNameKana: standard.municipalityNameKana
      },
      create: {
        municipalityCode: standard.municipalityCode,
        prefectureCode: standard.prefectureCode,
        prefectureName: standard.prefectureName,
        municipalityName: standard.municipalityName,
        municipalityNameKana: standard.municipalityNameKana
      }
    });

    const business = await prisma.sewerBusiness.upsert({
      where: {
        municipalityId_businessKey_accountingType: {
          municipalityId: municipality.id,
          businessKey: standard.businessKey,
          accountingType: standard.accountingType
        }
      },
      update: {
        businessName: standard.businessName,
        businessType: standard.businessType
      },
      create: {
        municipalityId: municipality.id,
        businessKey: standard.businessKey,
        businessName: standard.businessName,
        businessType: standard.businessType,
        accountingType: standard.accountingType
      }
    });

    const sourceTrace = buildSourceTrace(source, standard);
    await prisma.annualFinancial.upsert({
      where: {
        sewerBusinessId_surveyYear: {
          sewerBusinessId: business.id,
          surveyYear: standard.surveyYear
        }
      },
      update: {
        fiscalYearLabel: standard.fiscalYearLabel,
        accountingType: standard.accountingType,
        sewerFeeRevenue: standard.sewerFeeRevenue,
        householdFee20m3Yen: standard.householdFee20m3Yen,
        annualBillableVolume: standard.annualBillableVolume,
        wastewaterTreatmentCost: standard.wastewaterTreatmentCost,
        opexComponent: standard.opexComponent,
        capitalCostComponent: standard.capitalCostComponent,
        operatingRevenue: standard.operatingRevenue,
        operatingExpense: standard.operatingExpense,
        ordinaryRevenue: standard.ordinaryRevenue,
        ordinaryExpense: standard.ordinaryExpense,
        netIncome: standard.netIncome,
        accumulatedDeficit: standard.accumulatedDeficit,
        totalRevenueNonLegal: standard.totalRevenueNonLegal,
        totalExpenseNonLegal: standard.totalExpenseNonLegal,
        realBalance: standard.realBalance,
        revenueExpenditureRatio: standard.revenueExpenditureRatio,
        generalAccountTransfer: standard.generalAccountTransfer,
        standardTransfer: standard.standardTransfer,
        nonStandardTransfer: standard.nonStandardTransfer,
        bondBalance: standard.bondBalance,
        bondIssued: standard.bondIssued,
        bondRedemption: standard.bondRedemption,
        servicePopulation: standard.servicePopulation,
        connectedPopulation: standard.connectedPopulation,
        treatedVolume: standard.treatedVolume,
        sourceTraceJson: JSON.stringify(sourceTrace, null, 2)
      },
      create: {
        sewerBusinessId: business.id,
        surveyYear: standard.surveyYear,
        fiscalYearLabel: standard.fiscalYearLabel,
        accountingType: standard.accountingType,
        sewerFeeRevenue: standard.sewerFeeRevenue,
        householdFee20m3Yen: standard.householdFee20m3Yen,
        annualBillableVolume: standard.annualBillableVolume,
        wastewaterTreatmentCost: standard.wastewaterTreatmentCost,
        opexComponent: standard.opexComponent,
        capitalCostComponent: standard.capitalCostComponent,
        operatingRevenue: standard.operatingRevenue,
        operatingExpense: standard.operatingExpense,
        ordinaryRevenue: standard.ordinaryRevenue,
        ordinaryExpense: standard.ordinaryExpense,
        netIncome: standard.netIncome,
        accumulatedDeficit: standard.accumulatedDeficit,
        totalRevenueNonLegal: standard.totalRevenueNonLegal,
        totalExpenseNonLegal: standard.totalExpenseNonLegal,
        realBalance: standard.realBalance,
        revenueExpenditureRatio: standard.revenueExpenditureRatio,
        generalAccountTransfer: standard.generalAccountTransfer,
        standardTransfer: standard.standardTransfer,
        nonStandardTransfer: standard.nonStandardTransfer,
        bondBalance: standard.bondBalance,
        bondIssued: standard.bondIssued,
        bondRedemption: standard.bondRedemption,
        servicePopulation: standard.servicePopulation,
        connectedPopulation: standard.connectedPopulation,
        treatedVolume: standard.treatedVolume,
        sourceTraceJson: JSON.stringify(sourceTrace, null, 2)
      }
    });

    const fieldEntries = Object.entries(FIELD_LABELS)
      .map(([field, label], colIndex) => ({
        field,
        label,
        value: (standard as unknown as Record<string, number | string | null | undefined>)[field],
        colIndex
      }))
      .filter((entry) => typeof entry.value === "number");

    await prisma.rawStatCell.createMany({
      data: fieldEntries.map((entry) => ({
        sourceFileId: source.id,
        surveyYear: standard.surveyYear,
        municipalityCode: standard.municipalityCode,
        municipalityName: standard.municipalityName,
        prefectureName: standard.prefectureName,
        businessKey: standard.businessKey,
        businessName: standard.businessName,
        businessType: standard.businessType,
        accountingType: standard.accountingType,
        tableNo: source.tableNo ?? 0,
        rowNo: index + 2,
        colNo: entry.colIndex + 1,
        itemNameOriginal: entry.label,
        valueRaw: String(entry.value),
        valueNumeric: entry.value as number,
        unit: unitForField(entry.field),
        sheetName: "standard_rows",
        cellAddress: `R${index + 2}C${entry.colIndex + 1}`
      }))
    });

    rawCells += fieldEntries.length;
    annualRows += 1;
  }
  return { annualRows, rawCells };
}

function toStandardFinancialRow(row: Record<string, unknown>, source: { surveyYear: number; accountingType: string | null }) {
  const municipalityCode = readString(row, ["municipality_code", "municipalityCode", "団体コード"]);
  const prefectureName = readString(row, ["prefecture_name", "prefectureName", "都道府県"]);
  const municipalityName = readString(row, ["municipality_name", "municipalityName", "自治体名", "団体名"]);
  if (!municipalityCode || !prefectureName || !municipalityName) return null;

  const accountingType = readString(row, ["accounting_type", "accountingType", "会計区分"], source.accountingType ?? "legal_applied");
  const standard: StandardFinancialRow = {
    municipalityCode,
    prefectureCode: readString(row, ["prefecture_code", "prefectureCode", "都道府県コード"]),
    prefectureName,
    municipalityName,
    municipalityNameKana: readString(row, ["municipality_name_kana", "municipalityNameKana", "自治体名かな"]),
    businessKey: readString(row, ["business_key", "businessKey", "事業キー"], "sewerage"),
    businessName: readString(row, ["business_name", "businessName", "事業名"], "下水道事業"),
    businessType: readString(row, ["business_type", "businessType", "事業種別"], "公共下水道"),
    accountingType: accountingType === "non_legal_applied" ? "non_legal_applied" : "legal_applied",
    surveyYear: Number(readString(row, ["survey_year", "surveyYear", "年度"], String(source.surveyYear))),
    fiscalYearLabel: readString(row, ["fiscal_year_label", "fiscalYearLabel", "会計年度"], String(source.surveyYear))
  };

  for (const [column, field] of Object.entries(STANDARD_FIELD_COLUMNS)) {
    const value = toNumber(row[column]);
    if (value != null) {
      (standard as unknown as Record<string, number>)[field] = value;
    }
  }
  return standard;
}

function buildSourceTrace(source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number], row: StandardFinancialRow) {
  return Object.fromEntries(
    Object.entries(FIELD_LABELS).map(([field, label]) => [
      field,
      {
        sourceFileId: source.id,
        sourceUrl: source.sourceUrl,
        surveyYear: row.surveyYear,
        tableNo: source.tableNo,
        tableName: source.tableName,
        itemNameOriginal: label,
        unit: unitForField(field),
        value: (row as unknown as Record<string, unknown>)[field]
      }
    ])
  );
}

async function importGenericCsvCells(source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number], rows: Record<string, unknown>[]) {
  let count = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const entries = Object.entries(row);
    await prisma.rawStatCell.createMany({
      data: entries.map(([key, value], colIndex) => ({
        sourceFileId: source.id,
        surveyYear: source.surveyYear,
        accountingType: source.accountingType ?? "legal_applied",
        tableNo: source.tableNo ?? 0,
        rowNo: rowIndex + 2,
        colNo: colIndex + 1,
        itemNameOriginal: key,
        valueRaw: value == null ? null : String(value),
        valueNumeric: toNumber(value),
        sheetName: "csv",
        cellAddress: `R${rowIndex + 2}C${colIndex + 1}`
      }))
    });
    count += entries.length;
  }
  return count;
}

async function importWorkbookCells(source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number], workbook: XLSX.WorkBook) {
  let count = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
    const batch = [];
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellAddress];
        if (!cell) continue;
        batch.push({
          sourceFileId: source.id,
          surveyYear: source.surveyYear,
          accountingType: source.accountingType ?? "legal_applied",
          tableNo: source.tableNo ?? 0,
          rowNo: row + 1,
          colNo: col + 1,
          itemNameOriginal: null,
          valueRaw: cell.v == null ? null : String(cell.v),
          valueNumeric: toNumber(cell.v),
          sheetName,
          cellAddress
        });
      }
    }
    for (let index = 0; index < batch.length; index += 500) {
      await prisma.rawStatCell.createMany({ data: batch.slice(index, index + 500) });
    }
    count += batch.length;
  }
  return count;
}

async function importEstatJsonCells(source: Awaited<ReturnType<typeof prisma.sourceFile.findMany>>[number], json: unknown) {
  const values = findEstatValues(json);
  if (values.length === 0) return 0;
  for (let index = 0; index < values.length; index += 500) {
    await prisma.rawStatCell.createMany({
      data: values.slice(index, index + 500).map((value, valueIndex) => ({
        sourceFileId: source.id,
        surveyYear: source.surveyYear,
        accountingType: source.accountingType ?? "legal_applied",
        tableNo: source.tableNo ?? 0,
        rowNo: index + valueIndex + 1,
        colNo: 1,
        itemNameOriginal: collectStrings(value).slice(0, 8).join(" "),
        valueRaw: value.$ ?? value["@value"] ?? null,
        valueNumeric: toNumber(value.$ ?? value["@value"]),
        sheetName: "e-stat-json",
        cellAddress: `VALUE_${index + valueIndex + 1}`
      }))
    });
  }
  return values.length;
}

function findEstatValues(value: unknown): Array<Record<string, string>> {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => findEstatValues(item));
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if ("VALUE" in object) return findEstatValues(object.VALUE);
    if ("$" in object || "@value" in object) return [object as Record<string, string>];
    return Object.values(object).flatMap((item) => findEstatValues(item));
  }
  return [];
}

export async function loadFieldMappings(years: number[]) {
  if (!existsSync(FIELD_MAPPING_FILE)) return;
  const parsed = YAML.parse(readFileSync(FIELD_MAPPING_FILE, "utf8"));
  const fields = parsed?.standard_fields ?? {};

  // Spreadsheet coordinates are one-based. Older keyword-only definitions
  // were once persisted as 0/0 placeholders; they are not evidence and must
  // not remain in the provenance ledger even for fields that are not part of
  // the four exact R2-R6 fee/cost mappings below.
  await prisma.fieldMapping.deleteMany({
    where: {
      mappingSource: YAML_FIELD_MAPPING_SOURCE,
      OR: [
        { rowNo: null },
        { colNo: null },
        { rowNo: { lte: 0 } },
        { colNo: { lte: 0 } }
      ]
    }
  });

  for (const [standardField, config] of Object.entries<Record<string, any>>(fields)) {
    for (const accountingType of ["legal_applied", "non_legal_applied"] as const) {
      const preferred = config.sources?.[accountingType]?.preferred;
      if (!preferred) continue;
      const examples = readKnownPositions(preferred);
      // A keyword-only definition is useful documentation, but it is not a
      // physical spreadsheet coordinate and must never become a 0/0 mapping.
      if (examples.length === 0) continue;
      for (const year of years) {
        for (const example of examples) {
          await prisma.fieldMapping.upsert({
            where: {
              surveyYear_accountingType_standardField_tableNo_rowNo_colNo: {
                surveyYear: year,
                accountingType,
                standardField,
                tableNo: Number(preferred.table_no ?? 0),
                rowNo: example.rowNo,
                colNo: example.colNo
              }
            },
            update: {
              tableName: preferred.table_name,
              itemNameOriginal: config.label,
              unit: config.unit,
              confidence: 0.85,
              mappingSource: YAML_FIELD_MAPPING_SOURCE,
              notes: example.sourceNote ?? "verified coordinate from 03_FIELD_MAPPING.yml"
            },
            create: {
              surveyYear: year,
              accountingType,
              standardField,
              tableNo: Number(preferred.table_no ?? 0),
              tableName: preferred.table_name,
              rowNo: example.rowNo,
              colNo: example.colNo,
              itemNameOriginal: config.label,
              unit: config.unit,
              confidence: 0.85,
              mappingSource: YAML_FIELD_MAPPING_SOURCE,
              notes: example.sourceNote ?? "verified coordinate from 03_FIELD_MAPPING.yml"
            }
          });
        }

        if (VERIFIED_EXACT_MAPPING_FIELDS.has(standardField)) {
          const existing = await prisma.fieldMapping.findMany({
            where: { surveyYear: year, accountingType, standardField },
            select: {
              id: true,
              standardField: true,
              tableNo: true,
              rowNo: true,
              colNo: true,
              mappingSource: true
            }
          });
          const staleIds = staleVerifiedMappingIds(
            existing,
            standardField,
            Number(preferred.table_no ?? 0),
            examples
          );
          if (staleIds.length > 0) {
            await prisma.fieldMapping.deleteMany({ where: { id: { in: staleIds } } });
          }
        }
      }
    }
  }
  ensureDir("data/processed/layout_diff");
  for (const year of years) {
    writeJson(`data/processed/layout_diff/${year}.json`, {
      surveyYear: year,
      status: "initial_mapping_loaded",
      note: "Layout parser seeds only positive row/column coordinates verified in 03_FIELD_MAPPING.yml; keyword-only definitions are not stored as placeholder mappings."
    });
  }
}

async function importManualRevisionEvents() {
  if (!existsSync(MANUAL_REVISION_EVENTS)) return 0;
  const rows = readCsvObjects(MANUAL_REVISION_EVENTS);
  let count = 0;
  for (const row of rows) {
    const municipalityCode = readString(row, ["municipality_code"]);
    const sourceUrl = readString(row, ["source_url"]);
    if (!municipalityCode || !sourceUrl) continue;
    const municipality = await prisma.municipality.findUnique({ where: { municipalityCode } });
    if (!municipality) continue;
    await upsertManualRevisionEvent(prisma.feeRevisionEvent, {
      municipalityId: municipality.id,
      status: readString(row, ["status"], "confirmed"),
      effectiveDate: readString(row, ["effective_date"]),
      announcedDate: readString(row, ["announced_date"]),
      averageRevisionRate: readNumber(row, ["average_revision_rate"]),
      targetBusiness: readString(row, ["target_business"]),
      title: readString(row, ["title"]),
      summary: readString(row, ["summary"]),
      sourceUrl,
      extractionConfidence: readNumber(row, ["extraction_confidence"]) ?? 1,
      checkedAt: readString(row, ["checked_at"])
    });
    count += 1;
  }
  return count;
}

function unitForField(field: string) {
  if (field === "householdFee20m3Yen") return "yen_per_month_tax_included";
  if (/volume|treated/i.test(field)) return "cubic_meter";
  if (/population/i.test(field)) return "people";
  if (/ratio/i.test(field)) return "percent";
  return "thousand_yen";
}

function extractTitle(text: string, tableNo: number | null) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!tableNo) return cleaned.slice(0, 80);
  const tableMatch = cleaned.match(new RegExp(`.{0,20}${tableNo}.{0,60}`));
  return (tableMatch?.[0] ?? cleaned).slice(0, 100);
}

function pickFirstMatchingString(value: unknown, pattern: RegExp) {
  return collectStrings(value).find((text) => pattern.test(text));
}
