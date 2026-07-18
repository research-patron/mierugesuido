export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "算定不可";
  return `${value.toFixed(digits)}%`;
}

export function formatRevisionRate(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "算定不可";
  if (value <= 0) return "経費回収率100%以上";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatOfficialRevisionRate(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "未公表";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatYenPerM3(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "算定不可";
  return `${value.toFixed(digits)}円/m³`;
}

export function formatMoneyThousandYen(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "不明";
  const yen = value * 1000;
  if (Math.abs(yen) >= 100000000) return `${(yen / 100000000).toFixed(1)}億円`;
  if (Math.abs(yen) >= 1000000) return `${(yen / 1000000).toFixed(1)}百万円`;
  return `${Math.round(yen).toLocaleString("ja-JP")}円`;
}

export function formatVolume(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "不明";
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}百万m³`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}千m³`;
  return `${Math.round(value).toLocaleString("ja-JP")}m³`;
}

export function compactNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "不明";
  return value.toLocaleString("ja-JP");
}

export function formatSettlementFiscalLabel({
  surveyYear,
  fiscalYearLabel,
  style = "short"
}: {
  surveyYear?: number | null;
  fiscalYearLabel?: string | null;
  style?: "short" | "long";
}) {
  const parsed = shouldTreatLabelAsCatalogYear(fiscalYearLabel, surveyYear)
    ? null
    : parseReiwaYear(fiscalYearLabel);
  const reiwaYear = parsed ?? inferReiwaYearFromSurveyYear(surveyYear);
  if (reiwaYear == null) return "決算年度不明";
  return style === "long" ? `令和${reiwaYear}年度` : `R${reiwaYear}`;
}

function shouldTreatLabelAsCatalogYear(label?: string | null, surveyYear?: number | null) {
  if (!label || surveyYear == null) return false;
  const matched = label.match(/^\s*(20\d{2})\s*年度?\s*$/);
  return Boolean(matched && Number(matched[1]) === surveyYear);
}

function parseReiwaYear(label?: string | null) {
  if (!label) return null;
  const reiwa = label.match(/令和\s*(\d+)\s*年度?/);
  if (reiwa) return Number(reiwa[1]);
  const short = label.match(/\bR\s*(\d+)\b/i);
  if (short) return Number(short[1]);
  const western = label.match(/\b(20\d{2})\b/);
  if (western) return Number(western[1]) - 2018;
  return null;
}

function inferReiwaYearFromSurveyYear(surveyYear?: number | null) {
  if (surveyYear == null || !Number.isFinite(surveyYear)) return null;
  if (surveyYear >= 2020) return surveyYear - 2019;
  return null;
}
