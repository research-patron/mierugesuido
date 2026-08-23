import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertFundShortageStaticDataset,
  findFundShortageAssessment,
  type FundShortageAssessment,
  type FundShortageStaticDataset
} from "@/lib/fundShortage";

export const DEFAULT_FUND_SHORTAGE_DATASET_PATH = path.join(
  process.cwd(),
  "data",
  "static",
  "fund-shortage-r6.json"
);

const datasetPromises = new Map<string, Promise<FundShortageStaticDataset>>();

export function loadStaticFundShortageDataset(
  filePath = DEFAULT_FUND_SHORTAGE_DATASET_PATH
): Promise<FundShortageStaticDataset> {
  const resolvedPath = path.resolve(filePath);
  const cached = datasetPromises.get(resolvedPath);
  if (cached) return cached;

  const pending = readFile(resolvedPath, "utf8")
    .then((source) => JSON.parse(source) as unknown)
    .then((value) => {
      assertFundShortageStaticDataset(value);
      return value;
    })
    .catch((error) => {
      datasetPromises.delete(resolvedPath);
      throw error;
    });
  datasetPromises.set(resolvedPath, pending);
  return pending;
}

export async function getStaticFundShortageAssessment(input: {
  municipalityCode: string;
  businessKey: string;
  accountingType?: string | null;
}): Promise<FundShortageAssessment> {
  const dataset = await loadStaticFundShortageDataset();
  return findFundShortageAssessment(dataset, input);
}
