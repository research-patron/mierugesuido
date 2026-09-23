import { createHash } from "node:crypto";
import { groupRankingPopulation, type RankingCoverage } from "@/lib/rankingCoverage";

export const rankingDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildRankingCoverage(population: any[], published: any[]): RankingCoverage {
  if (!population.length || !published.length || rankingDigest(population.slice(0, published.length)) !== rankingDigest(published)) {
    throw new Error("Ranking population does not match the published snapshot; do not publish coverage");
  }
  const years = new Set(population.map(row => row.surveyYear));
  if (years.size !== 1) throw new Error("Mixed settlement years in ranking population");
  return {
    fiscalYear: population[0].surveyYear,
    populationCount: population.length,
    publishedCount: published.length,
    snapshotSha256: rankingDigest(published),
    populationSha256: rankingDigest(population),
    groups: groupRankingPopulation(population)
  };
}
