export type IntermunicipalServiceAreaSeed = {
  operatorMunicipalityCode: string;
  businessKey: string;
  servedMunicipalityCode: string;
  validFromSurveyYear: number | null;
  validToSurveyYear: number | null;
  sourceUrl: string;
  sourceLabel: string;
  sourceCheckedAt: string;
  notes: string;
};

const OBANAZAWA_OISHIDA_SOURCE = {
  sourceUrl: "https://www1.g-reiki.net/town.oishida.yamagata/reiki_honbun/c421RG00000656.html",
  sourceLabel: "尾花沢市大石田町環境衛生事業組合規約（大石田町例規集）",
  sourceCheckedAt: "2026-07-17",
  notes: "構成団体は尾花沢市・大石田町。組合公式サイトの上下水道案内 https://www.kankyo-e.net/waterworks/ と照合。"
} as const;

/**
 * Officially verified service-area links between a reporting sewer operator and
 * the municipalities it serves. Financial rows stay owned by the operator; the
 * links only describe service coverage and must never copy statement amounts.
 */
export const INTERMUNICIPAL_SEWER_SERVICE_AREAS: readonly IntermunicipalServiceAreaSeed[] = [
  ...["17-1-000", "17-4-000"].flatMap((businessKey) =>
    ["062120", "063410"].map((servedMunicipalityCode) => ({
      operatorMunicipalityCode: "069663",
      businessKey,
      servedMunicipalityCode,
      validFromSurveyYear: null,
      validToSurveyYear: null,
      ...OBANAZAWA_OISHIDA_SOURCE
    }))
  )
] as const;
