import { existsSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

type YearbookSource = {
  id: number;
  surveyYear: number;
  accountingType: string | null;
  tableNo: number | null;
  tableName: string | null;
  sourceUrl: string | null;
  localPath: string | null;
};

export type YearbookOriginalTable = {
  id: string;
  tableNo: number;
  tableName: string;
  sheetName: string;
  sourceUrl: string | null;
  columns: string[];
  rows: Array<Array<[number, string]>>;
};

export type YearbookOriginalBusiness = {
  businessKey: string;
  accountingType: "legal_applied" | "non_legal_applied";
  tables: YearbookOriginalTable[];
};

export type YearbookOriginalMunicipality = {
  fiscalYear: number;
  fiscalYearLabel: string;
  formatNote: string;
  businesses: YearbookOriginalBusiness[];
};

export type CompactYearbookOriginalTable = Omit<YearbookOriginalTable, "columns"> & {
  columnSetId: string;
};

export type CompactYearbookOriginalMunicipality = Omit<YearbookOriginalMunicipality, "businesses"> & {
  columnSets: Record<string, string[]>;
  businesses: Array<Omit<YearbookOriginalBusiness, "tables"> & {
    tables: CompactYearbookOriginalTable[];
  }>;
};

type MutableBusiness = Omit<YearbookOriginalBusiness, "tables"> & {
  tables: Map<string, YearbookOriginalTable>;
};

type MutableMunicipality = Map<string, MutableBusiness>;

export type YearbookOriginalDataIndex = {
  byMunicipality: Map<string, YearbookOriginalMunicipality>;
  sourceFilesRead: number;
  originalRows: number;
  warnings: string[];
};

const SEWER_INDUSTRY_CODES = new Set(["17", "18"]);

export function buildYearbookOriginalDataIndex(
  sources: YearbookSource[],
  fiscalYear: number,
  targetBusinessKeys?: ReadonlySet<string>
): YearbookOriginalDataIndex {
  const mutable = new Map<string, MutableMunicipality>();
  const warnings: string[] = [];
  let sourceFilesRead = 0;
  let originalRows = 0;

  for (const source of sources) {
    const accountingType = normalizeAccountingType(source.accountingType);
    if (!accountingType || source.tableNo == null || !source.localPath) continue;
    const tableNo = source.tableNo;
    const filePath = path.isAbsolute(source.localPath)
      ? source.localPath
      : path.resolve(process.cwd(), source.localPath);
    if (!existsSync(filePath)) {
      warnings.push(`source ${source.id}: original workbook is unavailable`);
      continue;
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.readFile(filePath, { cellDates: false });
    } catch {
      warnings.push(`source ${source.id}: original workbook could not be read`);
      continue;
    }
    sourceFilesRead += 1;

    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
        raw: false
      });
      if (rows.length === 0) return;
      const columns = Object.keys(rows[0]);
      const tableId = `${tableNo}-${source.id}-${sheetIndex}`;

      for (const row of rows) {
        if (toInteger(row["決算年度"]) !== fiscalYear) continue;
        if (toInteger(row["表番号"]) !== tableNo) continue;
        const municipalityCode = normalizeCode(row["団体コード"], 6);
        const industryCode = normalizeCode(row["業種コード"], 2);
        const businessCode = normalizeCode(row["事業コード"], 1);
        const facilityCode = normalizeCode(row["施設コード"], 3) || "000";
        if (!municipalityCode || !SEWER_INDUSTRY_CODES.has(industryCode) || !businessCode) continue;

        const businessKey = `${industryCode}-${businessCode}-${facilityCode}`;
        const targetKey = `${municipalityCode}|${businessKey}|${accountingType}`;
        if (targetBusinessKeys && !targetBusinessKeys.has(targetKey)) continue;
        const municipality = mutable.get(municipalityCode) ?? new Map<string, MutableBusiness>();
        const businessMapKey = `${businessKey}:${accountingType}`;
        const business = municipality.get(businessMapKey) ?? {
          businessKey,
          accountingType,
          tables: new Map<string, YearbookOriginalTable>()
        };
        const table: YearbookOriginalTable = business.tables.get(tableId) ?? {
          id: tableId,
          tableNo,
          tableName: source.tableName ?? `第${tableNo}表`,
          sheetName,
          sourceUrl: source.sourceUrl,
          columns,
          rows: []
        };
        table.rows.push(sparseOriginalRow(row, columns));
        business.tables.set(tableId, table);
        municipality.set(businessMapKey, business);
        mutable.set(municipalityCode, municipality);
        originalRows += 1;
      }
    });
  }

  return {
    byMunicipality: new Map(
      [...mutable.entries()].map(([municipalityCode, businesses]) => [
        municipalityCode,
        {
          fiscalYear,
          fiscalYearLabel: japaneseFiscalYearLabel(fiscalYear),
          formatNote: "列名・列順・値は、総務省・e-Stat公開Excelの原表形式を維持しています。",
          businesses: [...businesses.values()]
            .map((business) => ({
              businessKey: business.businessKey,
              accountingType: business.accountingType,
              tables: [...business.tables.values()].sort(compareTables)
            }))
            .sort((a, b) => `${a.businessKey}:${a.accountingType}`.localeCompare(`${b.businessKey}:${b.accountingType}`, "ja"))
        }
      ])
    ),
    sourceFilesRead,
    originalRows,
    warnings
  };
}

export function emptyYearbookOriginalData(fiscalYear: number): YearbookOriginalMunicipality {
  return {
    fiscalYear,
    fiscalYearLabel: japaneseFiscalYearLabel(fiscalYear),
    formatNote: "列名・列順・値は、総務省・e-Stat公開Excelの原表形式を維持しています。",
    businesses: []
  };
}

export function compactYearbookOriginalData(
  data: YearbookOriginalMunicipality
): CompactYearbookOriginalMunicipality {
  const columnSetIdByValue = new Map<string, string>();
  const columnSets: Record<string, string[]> = {};
  const businesses = data.businesses.map((business) => ({
    businessKey: business.businessKey,
    accountingType: business.accountingType,
    tables: business.tables.map((table) => {
      const key = JSON.stringify(table.columns);
      let columnSetId = columnSetIdByValue.get(key);
      if (!columnSetId) {
        columnSetId = `columns-${columnSetIdByValue.size + 1}`;
        columnSetIdByValue.set(key, columnSetId);
        columnSets[columnSetId] = table.columns;
      }
      const { columns: _columns, ...values } = table;
      return { ...values, columnSetId };
    })
  }));
  return {
    fiscalYear: data.fiscalYear,
    fiscalYearLabel: data.fiscalYearLabel,
    formatNote: data.formatNote,
    columnSets,
    businesses
  };
}

function compareTables(a: YearbookOriginalTable, b: YearbookOriginalTable) {
  return a.tableNo - b.tableNo || a.id.localeCompare(b.id, "ja");
}

function normalizeAccountingType(value: string | null) {
  if (value === "legal_applied" || value === "non_legal_applied") return value;
  return null;
}

function normalizeCode(value: unknown, width: number) {
  const text = value == null ? "" : String(value).trim().replace(/\.0+$/, "");
  return text ? text.padStart(width, "0") : "";
}

function toInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function originalCellText(value: unknown) {
  return value == null ? "" : String(value);
}

function sparseOriginalRow(row: Record<string, unknown>, columns: string[]) {
  return columns.flatMap((column, columnIndex): Array<[number, string]> => {
    const value = originalCellText(row[column]);
    return value === "" ? [] : [[columnIndex, value]];
  });
}

function japaneseFiscalYearLabel(year: number) {
  if (year >= 2019) return `R${year - 2018}`;
  return `${year}年度`;
}
