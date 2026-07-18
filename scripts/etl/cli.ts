import "./env";
import { PrismaClient } from "@prisma/client";
import { calculateAllDiagnosis, discoverSourceFiles, downloadSourceFiles, importSourceFiles, runWithEtlLog } from "./etl";
import { parseCliArgs } from "./utils";

const args = parseCliArgs(process.argv);
const prisma = new PrismaClient();

async function main() {
  const command = args.command;
  if (command === "discover") {
    return runWithEtlLog("discover", () => discoverSourceFiles(args.years, false));
  }
  if (command === "download") {
    return runWithEtlLog("download", () => downloadSourceFiles(args.years));
  }
  if (command === "import") {
    return runWithEtlLog("import", () => importSourceFiles(args.manual, args.years));
  }
  if (command === "calculate") {
    return runWithEtlLog("calculate", () => calculateAllDiagnosis(args.years));
  }
  if (command === "all") {
    return runWithEtlLog("all", async () => {
      const discover = await discoverSourceFiles(args.years, true);
      const download = discover.mode === "estat_api" ? await downloadSourceFiles(args.years) : { downloaded: [], skipped: [] };
      const imported = await importSourceFiles(discover.mode === "manual_fallback", args.years);
      const calculated = await calculateAllDiagnosis(args.years);
      return { discover, download, imported, calculated };
    });
  }
  throw new Error(`Unknown ETL command: ${command}`);
}

main()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
