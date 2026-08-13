import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const publicSourcePattern = /基準外|non[_-]?standard[_-]?transfer|nonStandardTransfer|NonStandard|transferBasisBreakdown|transfer-dependency|transfer-amount/iu;
const publicPayloadPattern = /基準外|non[_-]?standard[_-]?transfer|nonStandardTransfer|NonStandard|transferBasisBreakdown|table40(?:RainwaterBurden|OtherAccountSubsidy|CapitalOtherAccountSubsidy)|revisionRisk(?:Score|Label)/iu;

describe("withdrawn non-standard-transfer feature", () => {
  it("does not remain in public application source", () => {
    const matches: string[] = [];
    for (const directory of ["app", "components", "lib"]) {
      for (const file of filesBelow(path.join(root, directory))) {
        if (!/\.(?:css|ts|tsx)$/u.test(file)) continue;
        const relative = path.relative(root, file);
        const source = readFileSync(file, "utf8");
        const match = source.match(publicSourcePattern);
        if (match) matches.push(`${relative}: ${match[0]}`);
      }
    }
    expect(matches).toEqual([]);
  });

  it("does not publish withdrawn values or derived risk scores in static payloads", () => {
    const matches: string[] = [];
    for (const directory of ["data/static/rankings", "public/data/static"]) {
      const absolute = path.join(root, directory);
      if (!existsSync(absolute)) continue;
      for (const file of filesBelow(absolute)) {
        if (!file.endsWith(".json")) continue;
        const match = readFileSync(file, "utf8").match(publicPayloadPattern);
        if (match) matches.push(`${path.relative(root, file)}: ${match[0]}`);
      }
    }
    expect(matches).toEqual([]);
  });
});

function filesBelow(rootDirectory: string): string[] {
  const files: string[] = [];
  const pending = [rootDirectory];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !existsSync(current)) continue;
    for (const name of readdirSync(current)) {
      const candidate = path.join(current, name);
      if (statSync(candidate).isDirectory()) pending.push(candidate);
      else files.push(candidate);
    }
  }
  return files;
}
