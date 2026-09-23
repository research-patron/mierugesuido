import { isStaticRevisionDataset } from "@/lib/staticRevisionDataset";
import { createHash } from "node:crypto";
import type { RankingCoverage } from "@/lib/rankingCoverage";
import { normalizeHomeComparison } from "@/lib/comparison";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MunicipalityFeeRevisionStaticIndex } from "@/lib/municipalityFeeRevisionStatic";
import type { RankingType } from "@/lib/rankings";

export type StaticMunicipalityDetail = any;

async function readJson<T>(...segments: string[]): Promise<T> {
  const file = path.join(process.cwd(), ...segments);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export const getStaticManifest = cache(() => readJson<{
  municipalityCodes: string[];
  prefectureCodes: string[];
  rankingTypes: RankingType[];
}>("data", "static", "manifest.json"));

export const getStaticHomeData = cache(async () => {
  const source = await readJson<any>("data", "static", "home.json");
  return { ...normalizeHomeComparison(source), comparisonVersion: createHash("sha256").update(JSON.stringify(source)).digest("hex") };
});
export const getStaticDataSources = cache(async () => {
  const sources = await readJson<any[]>("data", "static", "data-sources.json");
  const provenance = await readJson<{ items: any[] }>("data", "static", "source-provenance.json");
  return sources.map(source => {
    const record = provenance.items.find(item => item.id === source.id && item.sourceUrl === source.sourceUrl && item.catalogYear === source.surveyYear);
    return { ...source, publishedAt: record?.publishedAt ?? null, downloadedAt: record?.downloadedAt ?? null };
  });
});

export const getStaticMunicipalityDetail = cache((municipalityCode: string) =>
  readJson<StaticMunicipalityDetail>("public", "data", "static", "municipalities", `${municipalityCode}.json`)
);

export const getStaticMunicipalityFeeRevisionIndex = cache(() =>
  readJson<MunicipalityFeeRevisionStaticIndex>("data", "static", "municipality-fee-revisions.json")
);

export const getStaticPrefectureMapData = cache((prefectureCode: string) =>
  readJson<any>("data", "static", "prefectures", `${prefectureCode}.json`)
);

export const getStaticRankings = cache((type: RankingType) =>
  readJson<any[]>("data", "static", "rankings", `${type}.json`)
);

export const getStaticSearchDataset = cache(async () => {
  const dataset = await readJson<any>("public", "data", "static", "municipalities.json");
  const home = await getStaticHomeData();
  const index = new Map(dataset.items.map((item: any) => [item.municipalityCode, item]));
  const scopeItems = Object.fromEntries(Object.values(home.mapScopes).map((scope: any) => [
    scope.categoryCode, scope.mapMunicipalities.map((item: any) => ({
      ...(index.get(item.municipalityCode) as any), ...item,
      latestFiscalYearLabel: `令和${item.latestYear - 2018}年度`,
      diagnosis: { expenseRecoveryRate: item.expenseRecoveryRate, feeUnitPriceYenPerM3: item.feeUnitPriceYenPerM3,
        treatmentCostYenPerM3: item.treatmentCostYenPerM3, requiredRevisionRateTo100: item.requiredRevisionRateTo100,
        feeAdequacyLabel: item.feeAdequacyLabel }
    }))
  ]));
  return { ...dataset, scopeItems };
});

export const getStaticCostComposition = cache(async (municipalityCode: string) => {
  try { return await readJson<any>("public", "data", "static", "cost-composition", `${municipalityCode}.json`); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
});

export const getStaticRankingCoverage = cache(async (type: RankingType) => {
  const coverage = (await readJson<{ rankings: Record<RankingType, RankingCoverage> }>("data", "static", "ranking-coverage.json")).rankings[type];
  const rows = await getStaticRankings(type);
  const digest = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  if (!coverage || coverage.snapshotSha256 !== digest) throw new Error("Ranking coverage is stale; regenerate from the matching source edition");
  return coverage;
});

export const getStaticRevisions = cache(async () => {
  const dataset = await readJson<unknown>("data", "static", "revisions.json");
  if (!isStaticRevisionDataset(dataset)) throw new Error("Revision dataset invalid");
  return dataset;
});
