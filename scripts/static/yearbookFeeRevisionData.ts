import { readdir } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import type {
  YearbookDateSnapshot,
  YearbookFeeSnapshot,
  YearbookTariffSystemSignals
} from "@/lib/yearbookFeeChanges";
import { getPrefectureName } from "@/lib/prefectures";

type AccountingType = "legal_applied" | "non_legal_applied";
type TargetSurveyYear = YearbookFeeSnapshot["surveyYear"];
type TargetBusinessCode = 1 | 4;

const TARGET_BUSINESS_CODES = new Set<TargetBusinessCode>([1, 4]);
const ACCOUNTING_TYPE_BY_OPERATION_CODE: Record<string, AccountingType> = {
  "46": "legal_applied",
  "47": "non_legal_applied"
};

const ERA_YEAR_OFFSET: Record<number, number> = {
  1: 1867,
  2: 1911,
  3: 1925,
  4: 1988,
  5: 2018
};

export type LoadYearbookFeeSnapshotsOptions = {
  /** `data/raw/e-stat`、その年度ディレクトリ、またはそれらを含む親ディレクトリ。 */
  rootDir: string;
  surveyYear: TargetSurveyYear;
};

export type ParseYearbookFeeWorksheetOptions = {
  worksheet: XLSX.WorkSheet;
  surveyYear: TargetSurveyYear;
  sourceFileName?: string;
  sheetName?: string;
};

/**
 * R5/R6のe-Stat第33表から、公共下水道・特定環境保全公共下水道の
 * 料金改定判定用スナップショットを読み込む。
 *
 * identityは `municipalityCode + businessKey` で決まり、accountingTypeを
 * businessKeyへ含めないため、法適用・法非適用間の移行も年度比較できる。
 */
export async function loadYearbookFeeSnapshots({
  rootDir,
  surveyYear
}: LoadYearbookFeeSnapshotsOptions): Promise<YearbookFeeSnapshot[]> {
  const sourceFiles = await discoverTable33Workbooks(rootDir, surveyYear);
  if (sourceFiles.length === 0) {
    throw new Error(`R${surveyYear - 2018}の第33表Excelが見つかりません: ${rootDir}`);
  }

  const byIdentity = new Map<string, YearbookFeeSnapshot>();
  for (const sourceFile of sourceFiles) {
    const workbook = XLSX.readFile(sourceFile, {
      cellDates: false,
      cellFormula: true,
      cellNF: true,
      cellText: true
    });
    for (const snapshot of parseYearbookFeeWorkbook({
      workbook,
      surveyYear,
      sourceFileName: path.basename(sourceFile)
    })) {
      insertUniqueSnapshot(byIdentity, snapshot, path.basename(sourceFile));
    }
  }

  return [...byIdentity.values()].sort((a, b) => (
    yearbookFeeSnapshotIdentity(a).localeCompare(yearbookFeeSnapshotIdentity(b), "ja")
  ));
}

export function parseYearbookFeeWorkbook({
  workbook,
  surveyYear,
  sourceFileName = "workbook"
}: {
  workbook: XLSX.WorkBook;
  surveyYear: TargetSurveyYear;
  sourceFileName?: string;
}): YearbookFeeSnapshot[] {
  const byIdentity = new Map<string, YearbookFeeSnapshot>();
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet?.["!ref"]) continue;
    for (const snapshot of parseYearbookFeeWorksheet({
      worksheet,
      surveyYear,
      sourceFileName,
      sheetName
    })) {
      insertUniqueSnapshot(byIdentity, snapshot, `${sourceFileName}/${sheetName}`);
    }
  }
  return [...byIdentity.values()];
}

export function parseYearbookFeeWorksheet({
  worksheet,
  surveyYear,
  sourceFileName = "worksheet",
  sheetName = "sheet"
}: ParseYearbookFeeWorksheetOptions): YearbookFeeSnapshot[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: true
  });
  const snapshots: YearbookFeeSnapshot[] = [];

  rows.forEach((row, index) => {
    const sourceLabel = `${sourceFileName}/${sheetName}/${index + 2}行`;
    if (!isTargetRow(row, surveyYear)) return;

    const businessCode = requiredBusinessCode(row["事業コード"], sourceLabel);
    const municipalityCode = fixedWidthCode(row["団体コード"], 6, "団体コード", sourceLabel);
    const facilityCode = fixedWidthCode(row["施設コード"] ?? "000", 3, "施設コード", sourceLabel);
    const municipalityName = requiredText(row["団体名"], "団体名", sourceLabel);
    const accountingType = requiredAccountingType(row["業務コード"], sourceLabel);
    const prefectureName = getPrefectureName(municipalityCode.slice(0, 2));
    if (!prefectureName) {
      throw new Error(`${sourceLabel}: 団体コードから都道府県を特定できません (${municipalityCode})`);
    }
    const categoryCode = `17/${businessCode}`;
    const businessTypeName = businessCode === 1 ? "公共下水道" : "特定環境保全公共下水道";

    snapshots.push({
      surveyYear,
      municipalityCode,
      municipalityName,
      prefectureName,
      businessKey: `17-${businessCode}-${facilityCode}`,
      businessName: businessTypeName,
      businessType: businessTypeName,
      categoryCode,
      accountingType,
      currentUsageFeeEffectiveDate: parseJapaneseEraDate7(row["列011"], "列011", sourceLabel),
      previousUsageFeeRevisionDate: parseJapaneseEraDate7(row["列012"], "列012", sourceLabel),
      householdFee20m3Yen: integerOrNull(row["列013"], "列013", sourceLabel),
      businessFeesYen: {
        100: integerOrNull(row["列014"], "列014", sourceLabel),
        500: integerOrNull(row["列015"], "列015", sourceLabel),
        1000: integerOrNull(row["列016"], "列016", sourceLabel),
        5000: integerOrNull(row["列017"], "列017", sourceLabel),
        10000: integerOrNull(row["列018"], "列018", sourceLabel)
      },
      revisionRatesPercent: {
        household20m3: revisionRateOrNull(row["列032"], "列032", sourceLabel),
        average: revisionRateOrNull(row["列033"], "列033", sourceLabel)
      },
      tariffSystemSignals: tariffSystemSignals(row, sourceLabel)
    });
  });

  return snapshots;
}

export function parseJapaneseEraDate7(
  value: unknown,
  columnLabel = "和暦日付",
  sourceLabel = "第33表"
): YearbookDateSnapshot {
  if (value == null || String(value).trim() === "" || String(value).trim() === "0") {
    return { iso: null, raw: null };
  }
  const raw = typeof value === "number" && Number.isInteger(value)
    ? String(value)
    : String(value).trim();
  if (!/^\d{7}$/.test(raw)) {
    throw new Error(`${sourceLabel}: ${columnLabel}は7桁の和暦日付ではありません (${raw})`);
  }

  const eraCode = Number(raw.slice(0, 1));
  const eraYear = Number(raw.slice(1, 3));
  const month = Number(raw.slice(3, 5));
  const day = Number(raw.slice(5, 7));
  const yearOffset = ERA_YEAR_OFFSET[eraCode];
  if (yearOffset == null || eraYear < 1) {
    throw new Error(`${sourceLabel}: ${columnLabel}の元号または年が不正です (${raw})`);
  }

  const year = yearOffset + eraYear;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  const isRealGregorianDate = !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso;
  // e-Stat原表には4010101（平成元年1月1日）のように、改元日ではなく
  // 元号年を暦年単位で記録した値がある。公式値を欠落させないため、元号の
  // 開始・終了日では切らず、既知元号・年1以上・実在する月日の組合せを厳格に確認する。
  if (!isRealGregorianDate) {
    throw new Error(`${sourceLabel}: ${columnLabel}の和暦日付が不正です (${raw})`);
  }
  return { iso, raw };
}

export function yearbookFeeSnapshotIdentity(snapshot: YearbookFeeSnapshot) {
  return `${snapshot.municipalityCode ?? snapshot.municipalityName}:${snapshot.businessKey}`;
}

async function discoverTable33Workbooks(rootDir: string, surveyYear: TargetSurveyYear) {
  const matches: string[] = [];
  const expectedName = new RegExp(`^33_${surveyYear}(?:46|47)0003300(?:_\\d+)?\\.(?:xls|xlsx)$`, "i");

  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && expectedName.test(entry.name)) {
        matches.push(entryPath);
      }
    }));
  }

  await visit(rootDir);
  return matches.sort((a, b) => a.localeCompare(b, "ja"));
}

function isTargetRow(row: Record<string, unknown>, surveyYear: TargetSurveyYear) {
  const businessCode = finiteInteger(row["事業コード"]);
  return finiteInteger(row["決算年度"]) === surveyYear
    && finiteInteger(row["表番号"]) === 33
    && normalizeRowNumber(row["行番号"]) === "01"
    && finiteInteger(row["業種コード"]) === 17
    && businessCode != null
    && TARGET_BUSINESS_CODES.has(businessCode as TargetBusinessCode)
    && requiredAccountingType(row["業務コード"], "第33表対象行") != null;
}

function requiredBusinessCode(value: unknown, sourceLabel: string): TargetBusinessCode {
  const parsed = finiteInteger(value);
  if (parsed !== 1 && parsed !== 4) {
    throw new Error(`${sourceLabel}: 対象外または不正な事業コードです (${String(value)})`);
  }
  return parsed;
}

function requiredAccountingType(value: unknown, sourceLabel: string): AccountingType {
  const code = fixedWidthCode(value, 2, "業務コード", sourceLabel);
  const accountingType = ACCOUNTING_TYPE_BY_OPERATION_CODE[code];
  if (!accountingType) {
    throw new Error(`${sourceLabel}: 法適用・法非適用を判定できない業務コードです (${code})`);
  }
  return accountingType;
}

function tariffSystemSignals(
  row: Record<string, unknown>,
  sourceLabel: string
): YearbookTariffSystemSignals {
  return {
    systemCodeRaw: integerOrNull(row["列003"], "列003", sourceLabel),
    waterVolumeRankCount: integerOrNull(row["列004"], "列004", sourceLabel),
    minimumExcessUnitPriceYenPerM3: integerOrNull(row["列005"], "列005", sourceLabel),
    maximumExcessUnitPriceYenPerM3: integerOrNull(row["列006"], "列006", sourceLabel),
    progressivity: tenthUnitOrNull(row["列007"], "列007", sourceLabel)
  };
}

function tenthUnitOrNull(value: unknown, fieldLabel: string, sourceLabel: string) {
  const raw = integerOrNull(value, fieldLabel, sourceLabel);
  return raw == null ? null : raw / 10;
}

function insertUniqueSnapshot(
  byIdentity: Map<string, YearbookFeeSnapshot>,
  snapshot: YearbookFeeSnapshot,
  sourceLabel: string
) {
  const identity = yearbookFeeSnapshotIdentity(snapshot);
  const existing = byIdentity.get(identity);
  if (!existing) {
    byIdentity.set(identity, snapshot);
    return;
  }
  if (JSON.stringify(existing) !== JSON.stringify(snapshot)) {
    throw new Error(`同一年度の料金スナップショットの値が一致しません: ${identity} (${sourceLabel})`);
  }
}

function normalizeRowNumber(value: unknown) {
  const parsed = finiteInteger(value);
  return parsed == null ? "" : String(parsed).padStart(2, "0");
}

function fixedWidthCode(
  value: unknown,
  width: number,
  fieldLabel: string,
  sourceLabel: string
) {
  const normalized = typeof value === "number" && Number.isInteger(value)
    ? String(value)
    : String(value ?? "").trim();
  if (!/^\d+$/.test(normalized) || normalized.length > width) {
    throw new Error(`${sourceLabel}: ${fieldLabel}が不正です (${normalized || "空欄"})`);
  }
  return normalized.padStart(width, "0");
}

function requiredText(value: unknown, fieldLabel: string, sourceLabel: string) {
  const text = String(value ?? "").normalize("NFKC").trim();
  if (!text) throw new Error(`${sourceLabel}: ${fieldLabel}が空欄です`);
  return text;
}

function revisionRateOrNull(value: unknown, fieldLabel: string, sourceLabel: string) {
  const raw = integerOrNull(value, fieldLabel, sourceLabel);
  return raw == null || raw === 0 ? null : raw / 10;
}

function integerOrNull(value: unknown, fieldLabel: string, sourceLabel: string) {
  if (value == null || String(value).trim() === "" || String(value).trim() === "-") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${sourceLabel}: ${fieldLabel}が整数ではありません (${String(value)})`);
  }
  return parsed;
}

function finiteInteger(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
}
