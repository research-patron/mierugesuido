import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildR6FundShortageDatasetFromFiles } from "@/scripts/static/fundShortageData";

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const dataset = buildR6FundShortageDatasetFromFiles({
    positiveListPath: args.positiveList,
    legalAppliedTable22Path: path.join(args.estatRoot, "2025", "legal_applied", "22_2024460002200.xlsx"),
    nonLegalAppliedTable26Path: path.join(args.estatRoot, "2025", "non_legal_applied", "26_2024470002600.xlsx")
  });
  const outputPath = path.resolve(args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(dataset), "utf8");
  const positiveCount = dataset.accounts.filter((account) => account.accountName != null).length;
  console.log(`fund-shortage dataset: ${dataset.accounts.length} accounts, ${positiveCount} shortages -> ${outputPath}`);
}

function parseArguments(argv: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error("引数は --positive-list PATH --estat-root PATH --output PATH の形式で指定してください");
    }
    values.set(key.slice(2), value);
  }
  const positiveList = values.get("positive-list");
  const estatRoot = values.get("estat-root");
  const output = values.get("output");
  if (!positiveList || !estatRoot || !output) {
    throw new Error("--positive-list、--estat-root、--output は必須です");
  }
  return { positiveList, estatRoot, output };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
