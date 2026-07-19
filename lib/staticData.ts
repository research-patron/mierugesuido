import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

export const getStaticHomeData = cache(() => readJson<any>("data", "static", "home.json"));
export const getStaticDataSources = cache(() => readJson<any[]>("data", "static", "data-sources.json"));

export const getStaticMunicipalityDetail = cache((municipalityCode: string) =>
  readJson<StaticMunicipalityDetail>("public", "data", "static", "municipalities", `${municipalityCode}.json`)
);

export const getStaticPrefectureMapData = cache((prefectureCode: string) =>
  readJson<any>("data", "static", "prefectures", `${prefectureCode}.json`)
);

export const getStaticRankings = cache((type: RankingType) =>
  readJson<any[]>("data", "static", "rankings", `${type}.json`)
);
