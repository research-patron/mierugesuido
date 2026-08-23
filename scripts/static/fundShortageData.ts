import XLSX from "xlsx";
import { getPrefectureCode } from "@/lib/prefectures";
import {
  buildFundShortageStaticDataset,
  type FundShortageAccountingType,
  type FundShortageDatasetSources,
  type FundShortageStaticDataset,
  type FundShortageUniverseRow,
  type FundShortageWorkCode,
  type OfficialPositiveFundShortageRow
} from "@/lib/fundShortage";

export const R6_FUND_SHORTAGE_SOURCES: FundShortageDatasetSources = {
  landingPageUrl: "https://www.soumu.go.jp/menu_news/s-news/01zaisei07_02000434.html",
  positiveListUrl: "https://www.soumu.go.jp/main_content/001041366.xlsx",
  legalAppliedUniverseUrl: "https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040327230",
  nonLegalAppliedUniverseUrl: "https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040327284"
};

export function buildR6FundShortageDatasetFromFiles(input: {
  positiveListPath: string;
  legalAppliedTable22Path: string;
  nonLegalAppliedTable26Path: string;
}): FundShortageStaticDataset {
  const universeRows = [
    ...parseEstatFundShortageUniverseWorkbook({
      workbook: XLSX.readFile(input.legalAppliedTable22Path, { cellDates: false }),
      expectedTableNumber: 22,
      expectedWorkCode: "46"
    }),
    ...parseEstatFundShortageUniverseWorkbook({
      workbook: XLSX.readFile(input.nonLegalAppliedTable26Path, { cellDates: false }),
      expectedTableNumber: 26,
      expectedWorkCode: "47"
    })
  ];
  const positiveRows = parseSoumuPositiveFundShortageWorkbook(
    XLSX.readFile(input.positiveListPath, { cellDates: false })
  );

  return buildFundShortageStaticDataset({
    fiscalYear: 2024,
    fiscalYearLabel: "R6（2024年度）",
    releaseLabel: "令和6年度決算 確報",
    sources: R6_FUND_SHORTAGE_SOURCES,
    universeRows,
    positiveRows
  });
}

export function parseEstatFundShortageUniverseWorkbook(input: {
  workbook: XLSX.WorkBook;
  expectedTableNumber: 22 | 26;
  expectedWorkCode: FundShortageWorkCode;
}): FundShortageUniverseRow[] {
  const accountingType: FundShortageAccountingType = input.expectedWorkCode === "46"
    ? "legal_applied"
    : "non_legal_applied";
  const rows: FundShortageUniverseRow[] = [];

  for (const sheetName of input.workbook.SheetNames) {
    const worksheet = input.workbook.Sheets[sheetName];
    if (!worksheet?.["!ref"]) continue;
    const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: true
    });
    sourceRows.forEach((row, index) => {
      if (finiteInteger(row["決算年度"]) !== 2024) return;
      if (fixedWidthCode(row["業務コード"], 2) !== input.expectedWorkCode) return;
      if (finiteInteger(row["表番号"]) !== input.expectedTableNumber) return;
      if (normalizeRowNumber(row["行番号"]) !== "01") return;
      const industryCode = finiteInteger(row["業種コード"]);
      if (industryCode !== 17 && industryCode !== 18) return;

      const sourceLabel = `${sheetName}/${index + 2}行`;
      const municipalityCode = requiredFixedWidthCode(row["団体コード"], 6, "団体コード", sourceLabel);
      const municipalityName = requiredText(row["団体名"], "団体名", sourceLabel);
      const businessCode = requiredInteger(row["事業コード"], "事業コード", sourceLabel);
      const facilityCode = requiredFixedWidthCode(row["施設コード"] ?? 0, 3, "施設コード", sourceLabel);
      const accountUnit = String(requiredInteger(row["条件8"], "条件8", sourceLabel));
      rows.push({
        fiscalYear: 2024,
        municipalityCode,
        municipalityName,
        prefectureCode: municipalityCode.slice(0, 2),
        workCode: input.expectedWorkCode,
        accountingType,
        accountUnit,
        businessKey: `${industryCode}-${businessCode}-${facilityCode}`
      });
    });
  }

  if (rows.length === 0) {
    throw new Error(`e-Stat第${input.expectedTableNumber}表にR6下水道会計行がありません`);
  }
  return rows;
}

export function parseSoumuPositiveFundShortageWorkbook(
  workbook: XLSX.WorkBook
): OfficialPositiveFundShortageRow[] {
  const sheets = workbook.SheetNames.flatMap((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet?.["!ref"]) return [];
    return [{
      sheetName,
      values: XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: null,
        raw: true
      })
    }];
  });
  const hasOfficialSectionHeading = sheets.some(({ values }) => values.some((row) => (
    row.some((cell) => normalizeText(cell).includes("資金不足額がある公営企業会計の資金不足比率"))
  )));
  if (!hasOfficialSectionHeading) {
    throw new Error("総務省確報の資金不足会計一覧見出しを確認できません");
  }

  const rows: OfficialPositiveFundShortageRow[] = [];
  for (const { sheetName, values } of sheets) {
    const headerIndex = values.findIndex((row) => row.some((cell) => normalizeText(cell) === "公営企業会計名"));
    if (headerIndex < 0) continue;
    const headers = values[headerIndex].map(normalizeText);
    const prefectureIndex = headers.indexOf("都道府県名");
    const municipalityIndex = headers.findIndex((value) => value.includes("市区町村名"));
    const accountNameIndex = headers.indexOf("公営企業会計名");
    const amountIndex = headers.indexOf("資金不足額");
    const ratioIndex = headers.indexOf("資金不足比率");

    if (municipalityIndex < 0) {
      const unsupportedSewerRow = values.slice(headerIndex + 1).find((row) => (
        isSewerAccountName(normalizeText(row[accountNameIndex]))
      ));
      if (unsupportedSewerRow) {
        throw new Error(`${sheetName}: 市区町村以外の下水道関係資金不足会計には未対応です`);
      }
      continue;
    }
    if (prefectureIndex < 0 || accountNameIndex < 0 || amountIndex < 0 || ratioIndex < 0) {
      throw new Error(`${sheetName}: 総務省確報の資金不足会計一覧の列見出しが不正です`);
    }

    values.slice(headerIndex + 1).forEach((row, offset) => {
      const accountName = normalizeText(row[accountNameIndex]);
      if (!isSewerAccountName(accountName)) return;
      const sourceLabel = `${sheetName}/${headerIndex + offset + 2}行`;
      const prefectureName = requiredText(row[prefectureIndex], "都道府県名", sourceLabel);
      const prefectureCode = getPrefectureCode(prefectureName);
      if (!prefectureCode) {
        throw new Error(`${sourceLabel}: 都道府県名を特定できません (${prefectureName})`);
      }
      rows.push({
        prefectureName,
        prefectureCode,
        municipalityName: requiredText(row[municipalityIndex], "市区町村名", sourceLabel),
        accountName,
        amountThousandYen: requiredNumber(row[amountIndex], "資金不足額", sourceLabel),
        ratioPercent: requiredNumber(row[ratioIndex], "資金不足比率", sourceLabel)
      });
    });
  }

  if (rows.length === 0) {
    throw new Error("総務省確報に下水道関係の資金不足会計がありません");
  }
  return rows;
}

function isSewerAccountName(value: string) {
  return value.includes("下水道") || value.includes("集落排水");
}

function finiteInteger(value: unknown) {
  const number = finiteNumber(value);
  return number != null && Number.isInteger(number) ? number : null;
}

function requiredInteger(value: unknown, fieldLabel: string, sourceLabel: string) {
  const number = finiteInteger(value);
  if (number == null) throw new Error(`${sourceLabel}: ${fieldLabel}が整数ではありません`);
  return number;
}

function finiteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = normalizeText(value).replace(/,/g, "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function requiredNumber(value: unknown, fieldLabel: string, sourceLabel: string) {
  const number = finiteNumber(value);
  if (number == null) throw new Error(`${sourceLabel}: ${fieldLabel}が数値ではありません`);
  return number;
}

function fixedWidthCode(value: unknown, width: number) {
  const text = normalizeText(value);
  if (!/^\d+$/.test(text)) return null;
  return text.padStart(width, "0");
}

function requiredFixedWidthCode(value: unknown, width: number, fieldLabel: string, sourceLabel: string) {
  const code = fixedWidthCode(value, width);
  if (!code) throw new Error(`${sourceLabel}: ${fieldLabel}が不正です`);
  return code;
}

function normalizeRowNumber(value: unknown) {
  const number = finiteInteger(value);
  return number == null ? normalizeText(value) : String(number).padStart(2, "0");
}

function requiredText(value: unknown, fieldLabel: string, sourceLabel: string) {
  const text = normalizeText(value);
  if (!text) throw new Error(`${sourceLabel}: ${fieldLabel}が空です`);
  return text;
}

function normalizeText(value: unknown) {
  return value == null ? "" : String(value).replace(/[\s　]+/g, " ").trim();
}
