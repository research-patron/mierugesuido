export function revisionPeriodLabel(value: string | null | undefined) {
  const fiscalYear = effectiveFiscalYear(value);
  if (fiscalYear == null) return "未定";
  if (fiscalYear <= 2024) return "2024年度内";
  if (fiscalYear === 2025) return "2025年度";
  if (fiscalYear === 2026) return "2026年度";
  return "2027年度以降";
}

export function revisionPeriodOrder(label: string) {
  return ["2024年度内", "2025年度", "2026年度", "2027年度以降", "未定"].indexOf(label);
}

export function effectiveFiscalYear(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;

  const separatedDate = normalized.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?(?:T.*)?$/);
  const japaneseDate = normalized.match(/^(\d{4})年(\d{1,2})月(?:\d{1,2}日)?$/);
  const yearOnly = normalized.match(/^(\d{4})(?:年|年度)?$/);
  const match = separatedDate ?? japaneseDate;

  if (!match) return yearOnly ? Number(yearOnly[1]) : null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return month <= 3 ? year - 1 : year;
}
