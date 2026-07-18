import { toNumber } from "./utils";

const R2_TO_R6_SURVEY_YEARS = new Set([2020, 2021, 2022, 2023, 2024]);

export function readEstatSurveyYear(row: Record<string, unknown>) {
  const rawYear = row["決算年度"];
  const surveyYear = toNumber(rawYear);

  if (surveyYear == null) {
    throw new Error("e-Stat row is missing a numeric 決算年度; expected R2-R6 (2020-2024).");
  }
  if (!Number.isInteger(surveyYear) || !R2_TO_R6_SURVEY_YEARS.has(surveyYear)) {
    throw new RangeError(`Unsupported e-Stat 決算年度 ${String(rawYear)}; expected R2-R6 (2020-2024).`);
  }
  return surveyYear;
}
