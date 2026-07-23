import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";

export const YEARBOOK_SOURCE_PAGE =
  "https://www.soumu.go.jp/main_sosiki/c-zaisei/kouei_R06/index_ge.html";

export type YearbookAccountingType = "legal_applied" | "non_legal_applied";

export type YearbookTarget = {
  municipalityCode: string;
  municipalityName: string;
  prefectureName: string;
  businessKey: string;
  accountingType: YearbookAccountingType;
};

export type YearbookOfficialSource = {
  id: string;
  groupNo: number;
  groupTitle: string;
  accountingType: YearbookAccountingType;
  businessCategoryCode: string;
  businessTypeName: string;
  sourceUrl: string;
  localPath?: string;
};

export type YearbookIndividualRow = {
  rowNumber: number;
  labelCells: string[];
  valueText: string;
  kind: "data" | "heading" | "note";
};

export type YearbookIndividualGroup = {
  id: string;
  title: string;
  businessTypeName: string;
  workbookUrl: string;
  sheetName: string;
  rows: YearbookIndividualRow[];
};

export type YearbookIndividualBusiness = {
  businessKey: string;
  accountingType: YearbookAccountingType;
  operatorName: string;
  groups: YearbookIndividualGroup[];
};

export type YearbookIndividualData = {
  fiscalYear: number;
  sourcePageUrl: string;
  businesses: YearbookIndividualBusiness[];
};

export type YearbookIndividualDataIndex = {
  byMunicipality: Map<string, YearbookIndividualData>;
  sourceFilesRead: number;
  originalRows: number;
  matchedBusinessCount: number;
  warnings: string[];
};

export type YearbookHeadlineValues = {
  businessKey: string;
  accountingType: YearbookAccountingType;
  householdFee20m3Yen: number | null;
  expenseRecoveryRate: number | null;
};

const BUSINESS_CATEGORY_BY_LABEL: Record<string, string> = {
  公共下水道: "17/1",
  特定公共下水道: "17/2",
  流域下水道: "17/3",
  特定環境保全公共下水道: "17/4",
  農業集落排水施設: "17/5",
  漁業集落排水施設: "17/6",
  林業集落排水施設: "17/7",
  簡易排水施設: "17/8",
  小規模集合排水処理施設: "17/9",
  特定地域生活排水処理施設: "18/0",
  個別排水処理施設: "18/1"
};

export function discoverOfficialYearbookSources(
  html: string,
  sourcePageUrl = YEARBOOK_SOURCE_PAGE
): YearbookOfficialSource[] {
  const normalized = html.normalize("NFKC");
  const start = normalized.search(/<h2>\s*12[.．]\s*個表\s*<\/h2>/i);
  const end = normalized.search(/<h2>\s*13[.．]\s*付表\s*<\/h2>/i);
  if (start < 0 || end <= start) throw new Error("総務省ページの「12．個表」を確認できませんでした");

  const sources: YearbookOfficialSource[] = [];
  let groupNo: number | null = null;
  let groupTitle = "";
  for (const line of normalized.slice(start, end).split(/\r?\n/)) {
    const text = htmlText(line);
    const groupMatch = text.match(/^\(([1-8])\)\s*(.+)$/);
    if (groupMatch && !line.includes("href=")) {
      groupNo = Number(groupMatch[1]);
      groupTitle = groupMatch[2].trim();
      continue;
    }
    if (groupNo == null) continue;
    const anchor = line.match(/<a\s+href="([^"]+\.xls)">([\s\S]*?)<img\b/i);
    if (!anchor) continue;
    const businessTypeName = normalizeBusinessTypeName(htmlText(anchor[2]));
    const businessCategoryCode = BUSINESS_CATEGORY_BY_LABEL[businessTypeName];
    if (!businessCategoryCode) continue;
    const sourceUrl = new URL(anchor[1], sourcePageUrl).toString();
    if (new URL(sourceUrl).hostname !== "www.soumu.go.jp") {
      throw new Error(`想定外の個表URLです: ${sourceUrl}`);
    }
    const fileName = path.basename(new URL(sourceUrl).pathname);
    sources.push({
      id: `${groupNo}-${fileName}`,
      groupNo,
      groupTitle,
      accountingType: groupNo <= 5 ? "legal_applied" : "non_legal_applied",
      businessCategoryCode,
      businessTypeName,
      sourceUrl
    });
  }
  if (sources.length === 0) throw new Error("総務省ページから個表Excelを抽出できませんでした");
  return sources;
}

export async function prepareOfficialYearbookSources({
  cacheDirectory,
  targetBusinessKeys,
  fetchImpl = fetch
}: {
  cacheDirectory: string;
  targetBusinessKeys: ReadonlySet<string>;
  fetchImpl?: typeof fetch;
}) {
  const pageResponse = await fetchImpl(YEARBOOK_SOURCE_PAGE);
  if (!pageResponse.ok) throw new Error(`総務省の個表一覧を取得できませんでした (${pageResponse.status})`);
  const pageHtml = new TextDecoder("shift_jis").decode(await pageResponse.arrayBuffer());
  const targetCategories = new Set([...targetBusinessKeys].map(businessCategoryFromBusinessKey));
  const sources = discoverOfficialYearbookSources(pageHtml)
    .filter((source) => targetCategories.has(source.businessCategoryCode));
  if (sources.length === 0) throw new Error("表示対象事業に対応する総務省個表がありません");

  await mkdir(cacheDirectory, { recursive: true });
  await mapConcurrent(sources, 4, async (source) => {
    const fileName = path.basename(new URL(source.sourceUrl).pathname);
    const localPath = path.join(cacheDirectory, fileName);
    if (!await isUsableWorkbook(localPath)) {
      const response = await fetchImpl(source.sourceUrl);
      if (!response.ok) throw new Error(`総務省個表を取得できませんでした: ${source.sourceUrl}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 1024) throw new Error(`総務省個表のファイルサイズが不正です: ${source.sourceUrl}`);
      await writeFile(localPath, bytes);
    }
    source.localPath = localPath;
  });
  return sources;
}

export function buildYearbookIndividualDataIndex(
  sources: YearbookOfficialSource[],
  targets: YearbookTarget[],
  fiscalYear: number
): YearbookIndividualDataIndex {
  const byMunicipality = new Map<string, YearbookIndividualData>();
  const warnings: string[] = [];
  const matchedTargets = new Set<string>();
  const targetsByMatchKey = new Map<string, YearbookTarget[]>();
  const targetsByOperatorKey = new Map<string, YearbookTarget[]>();
  for (const target of targets) {
    const key = targetMatchKey(
      target.prefectureName,
      target.municipalityName,
      businessCategoryFromBusinessKey(target.businessKey),
      target.accountingType
    );
    const matches = targetsByMatchKey.get(key) ?? [];
    matches.push(target);
    targetsByMatchKey.set(key, matches);
    const operatorKey = targetOperatorKey(
      target.municipalityName,
      businessCategoryFromBusinessKey(target.businessKey),
      target.accountingType
    );
    const operatorMatches = targetsByOperatorKey.get(operatorKey) ?? [];
    operatorMatches.push(target);
    targetsByOperatorKey.set(operatorKey, operatorMatches);
  }

  let sourceFilesRead = 0;
  let originalRows = 0;
  for (const source of sources) {
    if (!source.localPath) {
      warnings.push(`${source.id}: 個表ファイルがありません`);
      continue;
    }
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.readFile(source.localPath, {
        cellDates: false,
        cellFormula: true,
        cellNF: true,
        cellText: true
      });
    } catch {
      warnings.push(`${source.id}: 個表ファイルを読み取れませんでした`);
      continue;
    }
    sourceFilesRead += 1;

    for (const sheetName of workbook.SheetNames) {
      if (sheetName.toLowerCase() === "index") continue;
      const worksheet = workbook.Sheets[sheetName];
      const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]!) : null;
      if (!range) continue;
      const marker = findMarkerCell(worksheet, 8, "団体名", range);
      if (!marker) {
        warnings.push(`${source.id}/${sheetName}: 団体名行を確認できませんでした`);
        continue;
      }
      const workbookTitle = displayedCellText(worksheet, 2, 1) || source.groupTitle;
      const workbookBusinessType = normalizeBusinessTypeName(displayedCellText(worksheet, 3, 1)) || source.businessTypeName;
      let prefectureName = "";
      for (let column = marker.c + 1; column <= range.e.c; column += 1) {
        const directPrefecture = displayedCellText(worksheet, 8, column);
        if (directPrefecture) prefectureName = directPrefecture;
        const operatorName = displayedCellText(worksheet, 9, column);
        if (!operatorName) continue;
        const matchingTargets = prefectureName
          ? targetsByMatchKey.get(targetMatchKey(
            prefectureName,
            operatorName,
            source.businessCategoryCode,
            source.accountingType
          )) ?? []
          : targetsByOperatorKey.get(targetOperatorKey(
            operatorName,
            source.businessCategoryCode,
            source.accountingType
          )) ?? [];
        if (matchingTargets.length > 1) {
          throw new Error(
            `個表の団体列が複数の自治体に一致しました: ${prefectureName || "都道府県表示なし"}/${operatorName}/${source.businessTypeName}`
          );
        }
        const target = matchingTargets[0];
        if (!target) continue;
        matchedTargets.add(targetIdentity(target));
        const rows = extractIndividualRows(worksheet, column, marker.c, range.e.r);
        originalRows += rows.length;
        const data = byMunicipality.get(target.municipalityCode) ?? emptyYearbookIndividualData(fiscalYear);
        const business = data.businesses.find((candidate) => (
          candidate.businessKey === target.businessKey
          && candidate.accountingType === target.accountingType
        )) ?? {
          businessKey: target.businessKey,
          accountingType: target.accountingType,
          operatorName,
          groups: []
        };
        business.groups.push({
          id: `${source.id}-${sheetName}`,
          title: workbookTitle,
          businessTypeName: workbookBusinessType,
          workbookUrl: source.sourceUrl,
          sheetName,
          rows
        });
        if (!data.businesses.includes(business)) data.businesses.push(business);
        byMunicipality.set(target.municipalityCode, data);
      }
    }
  }

  for (const target of targets) {
    if (!matchedTargets.has(targetIdentity(target))) {
      warnings.push(
        `個表に一致する団体列がありません: ${target.prefectureName}/${target.municipalityName}/${target.businessKey}/${target.accountingType}`
      );
    }
  }

  for (const data of byMunicipality.values()) {
    data.businesses.sort((a, b) => `${a.businessKey}:${a.accountingType}`.localeCompare(`${b.businessKey}:${b.accountingType}`, "ja"));
    for (const business of data.businesses) {
      business.groups.sort((a, b) => groupNumber(a.id) - groupNumber(b.id) || a.id.localeCompare(b.id, "ja"));
    }
  }

  return {
    byMunicipality,
    sourceFilesRead,
    originalRows,
    matchedBusinessCount: matchedTargets.size,
    warnings
  };
}

export function emptyYearbookIndividualData(fiscalYear: number): YearbookIndividualData {
  return { fiscalYear, sourcePageUrl: YEARBOOK_SOURCE_PAGE, businesses: [] };
}

export function assertOfficialHeadlineValues(
  data: YearbookIndividualData,
  expected: YearbookHeadlineValues
) {
  const business = data.businesses.find((candidate) => (
    candidate.businessKey === expected.businessKey
    && candidate.accountingType === expected.accountingType
  ));
  if (!business) {
    throw new Error(`照合対象の公式個表がありません: ${expected.businessKey}/${expected.accountingType}`);
  }

  assertOfficialValue({
    business,
    fieldLabel: "一般家庭用20m³／月",
    pattern: /一般家庭用20m3.*月.*(?:使用料|円)/,
    expected: expected.householdFee20m3Yen,
    officialPrecision: 0
  });
  assertOfficialValue({
    business,
    fieldLabel: "経費回収率",
    pattern: /汚水処理費に対する使用料の割合/,
    expected: expected.expenseRecoveryRate,
    officialPrecision: 1
  });
}

function extractIndividualRows(
  worksheet: XLSX.WorkSheet,
  valueColumn: number,
  labelEndColumn: number,
  lastRow: number
): YearbookIndividualRow[] {
  const rows: YearbookIndividualRow[] = [];
  for (let row = 10; row <= lastRow; row += 1) {
    const labelCells = Array.from(
      { length: Math.max(labelEndColumn, 1) },
      (_, index) => displayedCellText(worksheet, row, index + 1)
    ).filter(Boolean);
    const valueText = displayedCellText(worksheet, row, valueColumn);
    const labelText = labelCells.filter(Boolean).join(" ");
    if (!labelText && !valueText) continue;
    rows.push({
      rowNumber: row + 1,
      labelCells,
      valueText,
      kind: /^(\(?注\)?|（注）)/.test(labelText)
        ? "note"
        : valueText === ""
          ? "heading"
          : "data"
    });
  }
  return rows;
}

function assertOfficialValue({
  business,
  fieldLabel,
  pattern,
  expected,
  officialPrecision
}: {
  business: YearbookIndividualBusiness;
  fieldLabel: string;
  pattern: RegExp;
  expected: number | null;
  officialPrecision: number;
}) {
  if (expected == null) return;
  const candidates = business.groups.flatMap((group) => group.rows)
    .filter((row) => pattern.test(normalizedRowLabel(row)));
  if (candidates.length !== 1) {
    throw new Error(
      `${fieldLabel}の公式行を一意に確認できません: ${business.operatorName}/${business.businessKey} (${candidates.length}件)`
    );
  }
  const official = parseOfficialNumber(candidates[0].valueText);
  if (official == null) {
    throw new Error(`${fieldLabel}の公式値が数値ではありません: ${business.operatorName}/${business.businessKey}`);
  }
  const expectedAtPrecision = roundTo(expected, officialPrecision);
  const officialAtPrecision = roundTo(official, officialPrecision);
  if (expectedAtPrecision !== officialAtPrecision) {
    throw new Error(
      `${fieldLabel}が公式個表と一致しません: ${business.operatorName}/${business.businessKey} `
        + `(計算用=${expectedAtPrecision}, 公式個表=${officialAtPrecision})`
    );
  }
}

function normalizedRowLabel(row: YearbookIndividualRow) {
  return row.labelCells.join("").normalize("NFKC").replace(/[\s　]/g, "");
}

function parseOfficialNumber(value: string) {
  const normalized = value.normalize("NFKC").replace(/[,，%％円]/g, "").trim();
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function findMarkerCell(
  worksheet: XLSX.WorkSheet,
  row: number,
  expected: string,
  range: XLSX.Range
) {
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    if (displayedCellText(worksheet, row, column) === expected) return { r: row, c: column };
  }
  return null;
}

function displayedCellText(worksheet: XLSX.WorkSheet, row: number, column: number) {
  const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })] as XLSX.CellObject | undefined;
  if (!cell || cell.v == null) return "";
  return String(cell.w ?? cell.v).trim();
}

function businessCategoryFromBusinessKey(businessKey: string) {
  const [industryCode, businessCode] = businessKey.trim().split(/[-/]/);
  return `${industryCode}/${Number(businessCode)}`;
}

function normalizeBusinessTypeName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/^\([ァ-ヶア-ン]\)\s*/, "")
    .replace(/\s+/g, "")
    .replace(/[12]$/, "")
    .trim();
}

function targetMatchKey(
  prefectureName: string,
  operatorName: string,
  businessCategoryCode: string,
  accountingType: YearbookAccountingType
) {
  return [
    normalizeName(prefectureName),
    normalizeName(operatorName),
    businessCategoryCode,
    accountingType
  ].join("|");
}

function targetIdentity(target: YearbookTarget) {
  return `${target.municipalityCode}|${target.businessKey}|${target.accountingType}`;
}

function targetOperatorKey(
  operatorName: string,
  businessCategoryCode: string,
  accountingType: YearbookAccountingType
) {
  return [normalizeName(operatorName), businessCategoryCode, accountingType].join("|");
}

function normalizeName(value: string) {
  return value.normalize("NFKC").replace(/[\s　]/g, "").trim();
}

function htmlText(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function groupNumber(id: string) {
  const value = Number(id.split("-")[0]);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

async function isUsableWorkbook(filePath: string) {
  try {
    return (await stat(filePath)).size >= 1024;
  } catch {
    return false;
  }
}

async function mapConcurrent<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      await worker(item);
    }
  }));
}
