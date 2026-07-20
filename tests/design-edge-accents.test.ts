import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function collectCssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectCssFiles(path);
    return entry.isFile() && entry.name.endsWith(".css") ? [path] : [];
  });
}

describe("card edge accents", () => {
  it("does not use a single thick edge as decorative card emphasis", () => {
    const cssFiles = ["app", "components"].flatMap((directory) => collectCssFiles(join(projectRoot, directory)));
    const violations = cssFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const directionalBorders = source.match(/border-(?:top|right|bottom|left)(?:-width)?:\s*(?:[2-9]|\d{2,})px\b/g) ?? [];
      const narrowColorColumns = source.match(/grid-template-columns:\s*[2-6](?:\.\d+)?px\b/g) ?? [];
      const directionalInsetShadows = [...source.matchAll(/inset\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+-?\d+(?:\.\d+)?px/g)]
        .filter((match) => Math.abs(Number(match[1])) >= 2 || Math.abs(Number(match[2])) >= 2)
        .map((match) => match[0]);
      return [...directionalBorders, ...narrowColorColumns, ...directionalInsetShadows]
        .map((match) => `${relative(projectRoot, file)}: ${match}`);
    });

    expect(violations).toEqual([]);
  });
});
