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
      const matches = source.match(/border-(?:top|right|bottom|left)(?:-width)?:\s*(?:[2-9]|\d{2,})px\b/g) ?? [];
      return matches.map((match) => `${relative(projectRoot, file)}: ${match}`);
    });

    expect(violations).toEqual([]);
  });
});
