import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getMapMunicipalities,
  getMunicipalityDetail,
  getPrefecturePeerComparison
} from "@/lib/data";
import {
  buildMunicipalityFeeRevisionStaticIndex,
  type MunicipalityFeeRevisionStaticSource
} from "@/lib/municipalityFeeRevisionStatic";
import { prisma } from "@/lib/prisma";

const publicRoot = path.join(process.cwd(), "public", "data", "static");
const sourceRoot = path.join(process.cwd(), "data", "static");

async function main() {
  const peerPairs = await loadPeerPairs();
  await rm(path.join(publicRoot, "citizen-peers"), { recursive: true, force: true });
  await mapConcurrent(peerPairs, 8, async ({ prefectureCode, prefectureName, businessKey }, index) => {
    const comparison = await getPrefecturePeerComparison({ prefectureName, businessKey });
    if (comparison.rows.length === 0) {
      throw new Error(`県内比較データを生成できません: ${prefectureName}/${businessKey}`);
    }
    await writeJson(
      path.join(publicRoot, "citizen-peers", prefectureCode, `${encodeURIComponent(businessKey)}.json`),
      comparison
    );
    if ((index + 1) % 50 === 0 || index + 1 === peerPairs.length) {
      process.stdout.write(`citizen peers: ${index + 1}/${peerPairs.length}\n`);
    }
  });

  const municipalityList = await readJson<{ items?: MunicipalityFeeRevisionStaticSource[] }>(
    path.join(publicRoot, "municipalities.json")
  );
  if (!Array.isArray(municipalityList.items)) {
    throw new Error("自治体検索の静的JSONにitemsがありません");
  }
  const revisionIndex = buildMunicipalityFeeRevisionStaticIndex(municipalityList.items);
  await Promise.all([
    writeJson(path.join(sourceRoot, "municipality-fee-revisions.json"), revisionIndex),
    writeJson(path.join(publicRoot, "municipality-fee-revisions.json"), revisionIndex)
  ]);
  process.stdout.write(`municipality revision index: ${Object.keys(revisionIndex).length}\n`);
  await prisma.$disconnect();
}

async function loadPeerPairs() {
  const municipalities = await getMapMunicipalities();
  const pairs = new Map<string, {
    prefectureCode: string;
    prefectureName: string;
    businessKey: string;
  }>();
  await mapConcurrent(municipalities, 10, async (municipality) => {
    if (!municipality.municipalityCode) return;
    const detail = await getMunicipalityDetail(municipality.municipalityCode);
    if (!detail?.prefectureCode) return;
    for (const business of detail.businesses) {
      if (business.annualFinancials.length === 0 || isFlowSewerBusinessKey(business.businessKey)) continue;
      const pair = {
        prefectureCode: detail.prefectureCode,
        prefectureName: detail.prefectureName,
        businessKey: business.businessKey
      };
      pairs.set(`${pair.prefectureName}\u0000${pair.businessKey}`, pair);
    }
  });
  return [...pairs.values()].sort((left, right) => (
    left.prefectureCode.localeCompare(right.prefectureCode, "ja")
    || left.businessKey.localeCompare(right.businessKey, "ja")
  ));
}

function isFlowSewerBusinessKey(value: string) {
  const [industryCode, businessCode] = value.trim().split(/[-/]/);
  return industryCode === "17" && Number(businessCode) === 3;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), "utf8");
}

async function mapConcurrent<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

main().catch(async (error) => {
  await prisma.$disconnect().catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
});
