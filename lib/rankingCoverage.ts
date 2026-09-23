import { businessCategoryCode } from "@/lib/businessDisplay";

export type RankingCoverage = {
  fiscalYear: number;
  populationCount: number;
  publishedCount: number;
  snapshotSha256: string;
  populationSha256: string;
  groups: Array<{ businessType: string; accountingType: string; prefecture: string; count: number }>;
};

export function countRankingPopulation(coverage: RankingCoverage, params: URLSearchParams) {
  if (params.has("fiscalYear") && Number(params.get("fiscalYear")) !== coverage.fiscalYear) return 0;
  return coverage.groups.filter(group => ["businessType", "accountingType", "prefecture"].every(key => !params.get(key) || params.get(key) === group[key as keyof typeof group]))
    .reduce((sum, group) => sum + group.count, 0);
}

export function groupRankingPopulation(rows: any[]) {
  const groups = new Map<string, RankingCoverage["groups"][number]>();
  const identities = new Set<string>();
  for (const row of rows) {
    const identity = [row.municipalityCode, row.businessKey, row.accountingType, row.surveyYear].join(":");
    if (identities.has(identity)) throw new Error("Duplicate ranking business identity");
    identities.add(identity);
    const group = { businessType: businessCategoryCode(row) ?? "unknown", accountingType: row.accountingType, prefecture: row.prefectureName, count: 0 };
    const key = JSON.stringify(group);
    const existing = groups.get(key) ?? group;
    existing.count++;
    groups.set(key, existing);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
}
