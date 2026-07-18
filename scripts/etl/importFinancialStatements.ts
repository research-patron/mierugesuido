import "./env";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";
import {
  FINANCIAL_STATEMENT_TABLES,
  mappingsForFinancialStatementTable,
  type FinancialStatementMapping,
  type FinancialStatementTableNo
} from "./statementMappings";
import { toNumber, valueForFlag } from "./utils";

const DEFAULT_SOURCE_YEARS = [2024, 2025] as const;
const SEWER_INDUSTRY_CODES = new Set(["17", "18"]);
const TARGET_ROW_NO = "01";
const WRITE_BATCH_SIZE = 500;

type WorkbookRow = Record<string, unknown> & { __sheetName: string };

type StatementItemInput = {
  annualFinancialId: number;
  sourceFileId: number;
  statementType: string;
  section: string;
  itemCode: string;
  label: string;
  amount: number;
  parentItemCode: string | null;
  displayOrder: number;
  tableNo: number;
  rowNo: number;
  colNo: number;
  unit: string;
  sourceTraceJson: string;
};

type AnnualLookup = Map<string, number>;

type SourceImportSummary = {
  sourceFileId: number;
  sourceSurveyYear: number;
  fiscalYears: number[];
  tableNo: number;
  statementType: string;
  filePath: string;
  targetRows: number;
  matchedAnnualRows: number;
  unmatchedAnnualRows: number;
  unmatchedExamples: string[];
  importedItems: number;
  missingMappedValues: number;
};

export async function importFinancialStatements(
  prisma: PrismaClient,
  sourceYears: number[] = [...DEFAULT_SOURCE_YEARS]
) {
  assertValidMappings();
  const years = uniqueSortedYears(sourceYears);
  if (years.length === 0) throw new Error("At least one source year is required.");

  const sources = await prisma.sourceFile.findMany({
    where: {
      surveyYear: { in: years },
      accountingType: "legal_applied",
      tableNo: { in: [...FINANCIAL_STATEMENT_TABLES] }
    },
    orderBy: [{ surveyYear: "asc" }, { tableNo: "asc" }, { id: "asc" }]
  });

  if (sources.length === 0) {
    throw new Error(`No legal-applied statement sources found for source years ${years.join(", ")}.`);
  }
  assertUniqueSourceSet(sources);

  const fiscalYears = uniqueSortedYears(sources.map((source) => source.surveyYear - 1));
  const annualLookup = await loadAnnualLookup(prisma, fiscalYears);
  const summaries: SourceImportSummary[] = [];

  for (const source of sources) {
    const tableNo = source.tableNo;
    if (tableNo == null) continue;
    const mappings = mappingsForFinancialStatementTable(tableNo);
    if (mappings.length === 0) continue;
    summaries.push(await importOneStatementSource(prisma, source, mappings, annualLookup));
  }

  const importedItems = summaries.reduce((sum, item) => sum + item.importedItems, 0);
  const matchedAnnualRows = summaries.reduce((sum, item) => sum + item.matchedAnnualRows, 0);
  const unmatchedAnnualRows = summaries.reduce((sum, item) => sum + item.unmatchedAnnualRows, 0);
  if (importedItems === 0) {
    throw new Error("Statement sources were found, but no financial statement items were imported.");
  }

  return {
    sourceYears: years,
    fiscalYears: uniqueSortedYears(summaries.flatMap((summary) => summary.fiscalYears)),
    sources: summaries.length,
    matchedAnnualRows,
    unmatchedAnnualRows,
    importedItems,
    summaries
  };
}

async function loadAnnualLookup(prisma: PrismaClient, fiscalYears: number[]): Promise<AnnualLookup> {
  const annuals = await prisma.annualFinancial.findMany({
    where: {
      surveyYear: { in: fiscalYears },
      accountingType: "legal_applied",
      sewerBusiness: { accountingType: "legal_applied" }
    },
    select: {
      id: true,
      surveyYear: true,
      sewerBusiness: {
        select: {
          businessKey: true,
          municipality: { select: { municipalityCode: true } }
        }
      }
    }
  });

  const lookup: AnnualLookup = new Map();
  for (const annual of annuals) {
    const municipalityCode = annual.sewerBusiness.municipality.municipalityCode;
    if (!municipalityCode) continue;
    const key = annualLookupKey(municipalityCode, annual.sewerBusiness.businessKey, annual.surveyYear);
    if (lookup.has(key)) throw new Error(`Duplicate annual financial lookup key: ${key}`);
    lookup.set(key, annual.id);
  }
  return lookup;
}

async function importOneStatementSource(
  prisma: PrismaClient,
  source: Awaited<ReturnType<PrismaClient["sourceFile"]["findMany"]>>[number],
  mappings: readonly FinancialStatementMapping[],
  annualLookup: AnnualLookup
): Promise<SourceImportSummary> {
  const tableNo = source.tableNo as FinancialStatementTableNo;
  const statementType = mappings[0].statementType;
  const filePath = resolveLocalPath(source.localPath);
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const rows = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils
      .sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
      .map((row): WorkbookRow => ({ ...row, __sheetName: sheetName }));
  });
  const targetRows = rows.filter((row) => isTargetStatementRow(row, tableNo));
  if (targetRows.length === 0) {
    throw new Error(`No table ${tableNo} row 01 sewer records found in ${filePath}.`);
  }

  const items: StatementItemInput[] = [];
  const matchedAnnualIds = new Set<number>();
  const matchedRowKeys = new Set<string>();
  const unmatchedExamples: string[] = [];
  let missingMappedValues = 0;
  let unmatchedAnnualRows = 0;

  for (const row of targetRows) {
    const municipalityCode = normalizeCode(row["団体コード"], 6);
    const businessKey = businessKeyFromRow(row);
    const fiscalYear = toNumber(row["決算年度"]);
    if (!municipalityCode || !businessKey || fiscalYear == null) {
      unmatchedAnnualRows += 1;
      pushExample(unmatchedExamples, `invalid identity: ${municipalityCode || "?"}/${businessKey || "?"}/${fiscalYear ?? "?"}`);
      continue;
    }

    const lookupKey = annualLookupKey(municipalityCode, businessKey, fiscalYear);
    const annualFinancialId = annualLookup.get(lookupKey);
    if (annualFinancialId == null) {
      unmatchedAnnualRows += 1;
      pushExample(unmatchedExamples, `${lookupKey} ${String(row["団体名"] ?? "").trim()}`.trim());
      continue;
    }

    matchedAnnualIds.add(annualFinancialId);
    matchedRowKeys.add(lookupKey);
    for (const mapping of mappings) {
      const columnKey = columnName(mapping.colNo);
      const amount = toNumber(row[columnKey]);
      if (amount == null) {
        missingMappedValues += 1;
        continue;
      }
      items.push({
        annualFinancialId,
        sourceFileId: source.id,
        statementType: mapping.statementType,
        section: mapping.section,
        itemCode: mapping.itemCode,
        label: mapping.label,
        amount,
        parentItemCode: mapping.parentItemCode ?? null,
        displayOrder: mapping.displayOrder,
        tableNo: mapping.tableNo,
        rowNo: mapping.rowNo,
        colNo: mapping.colNo,
        unit: mapping.unit,
        sourceTraceJson: JSON.stringify({
          sheetName: row.__sheetName,
          cellAddress: `R${TARGET_ROW_NO}C${String(mapping.colNo).padStart(3, "0")}`
        })
      });
    }
  }

  if (items.length === 0) {
    throw new Error(`Table ${tableNo} source ${source.id} matched no statement items.`);
  }
  assertNoDuplicateItems(items, source.id);

  const annualIds = [...matchedAnnualIds];
  await prisma.$transaction(
    async (transaction) => {
      await transaction.financialStatementItem.deleteMany({ where: { sourceFileId: source.id } });
      for (let index = 0; index < annualIds.length; index += WRITE_BATCH_SIZE) {
        await transaction.financialStatementItem.deleteMany({
          where: {
            annualFinancialId: { in: annualIds.slice(index, index + WRITE_BATCH_SIZE) },
            statementType
          }
        });
      }
      for (let index = 0; index < items.length; index += WRITE_BATCH_SIZE) {
        await transaction.financialStatementItem.createMany({
          data: items.slice(index, index + WRITE_BATCH_SIZE)
        });
      }
    },
    { maxWait: 30_000, timeout: 600_000 }
  );

  return {
    sourceFileId: source.id,
    sourceSurveyYear: source.surveyYear,
    fiscalYears: uniqueSortedYears(
      targetRows.map((row) => toNumber(row["決算年度"])).filter((year): year is number => year != null)
    ),
    tableNo,
    statementType,
    filePath,
    targetRows: targetRows.length,
    matchedAnnualRows: matchedRowKeys.size,
    unmatchedAnnualRows,
    unmatchedExamples,
    importedItems: items.length,
    missingMappedValues
  };
}

function isTargetStatementRow(row: WorkbookRow, tableNo: FinancialStatementTableNo) {
  return (
    toNumber(row["表番号"]) === tableNo &&
    normalizeCode(row["行番号"], 2) === TARGET_ROW_NO &&
    SEWER_INDUSTRY_CODES.has(normalizeCode(row["業種コード"], 2))
  );
}

function businessKeyFromRow(row: WorkbookRow) {
  const industryCode = normalizeCode(row["業種コード"], 2);
  const businessCode = normalizeCode(row["事業コード"], 1);
  const facilityCode = normalizeCode(row["施設コード"], 3) || "000";
  if (!SEWER_INDUSTRY_CODES.has(industryCode) || !businessCode) return null;
  return `${industryCode}-${businessCode}-${facilityCode}`;
}

function annualLookupKey(municipalityCode: string, businessKey: string, fiscalYear: number) {
  return `${normalizeCode(municipalityCode, 6)}|${businessKey}|${fiscalYear}`;
}

function normalizeCode(value: unknown, width: number) {
  const text = value == null ? "" : String(value).trim();
  return text ? text.padStart(width, "0") : "";
}

function columnName(colNo: number) {
  return `列${String(colNo).padStart(3, "0")}`;
}

function resolveLocalPath(localPath: string | null) {
  if (!localPath) throw new Error("Statement source has no local_path.");
  const resolved = path.isAbsolute(localPath) ? localPath : path.resolve(localPath);
  if (!existsSync(resolved)) throw new Error(`Statement source file does not exist: ${resolved}`);
  if (![".xlsx", ".xls"].includes(path.extname(resolved).toLowerCase())) {
    throw new Error(`Statement source must be an Excel workbook: ${resolved}`);
  }
  return resolved;
}

function assertValidMappings() {
  for (const tableNo of FINANCIAL_STATEMENT_TABLES) {
    const mappings = mappingsForFinancialStatementTable(tableNo);
    if (mappings.length === 0) throw new Error(`Table ${tableNo} has no financial statement mappings.`);
    const statementTypes = new Set(mappings.map((mapping) => mapping.statementType));
    const itemCodes = new Set(mappings.map((mapping) => mapping.itemCode));
    const columns = new Set(mappings.map((mapping) => mapping.colNo));
    if (statementTypes.size !== 1) throw new Error(`Table ${tableNo} maps to multiple statement types.`);
    if (itemCodes.size !== mappings.length) throw new Error(`Table ${tableNo} has duplicate item codes.`);
    if (columns.size !== mappings.length) throw new Error(`Table ${tableNo} has duplicate mapped columns.`);
  }
}

function assertUniqueSourceSet(sources: Array<{ id: number; surveyYear: number; tableNo: number | null }>) {
  const seen = new Map<string, number>();
  for (const source of sources) {
    const key = `${source.surveyYear}|${source.tableNo ?? "?"}`;
    const existing = seen.get(key);
    if (existing != null) {
      throw new Error(`Ambiguous statement sources for ${key}: source_file ${existing} and ${source.id}.`);
    }
    seen.set(key, source.id);
  }
}

function assertNoDuplicateItems(items: StatementItemInput[], sourceFileId: number) {
  const keys = new Set<string>();
  for (const item of items) {
    const key = `${item.annualFinancialId}|${item.statementType}|${item.itemCode}`;
    if (keys.has(key)) throw new Error(`Duplicate statement item in source_file ${sourceFileId}: ${key}`);
    keys.add(key);
  }
}

function pushExample(examples: string[], value: string) {
  if (examples.length < 20) examples.push(value);
}

function uniqueSortedYears(years: number[]) {
  return [...new Set(years.filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100))].sort(
    (left, right) => left - right
  );
}

function parseSourceYears(argv: string[]) {
  const raw =
    valueForFlag(argv, "--source-years") ??
    valueForFlag(argv, "--source-year") ??
    valueForFlag(argv, "--years") ??
    DEFAULT_SOURCE_YEARS.join(",");
  return uniqueSortedYears(
    raw
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value))
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await importFinancialStatements(prisma, parseSourceYears(process.argv));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
