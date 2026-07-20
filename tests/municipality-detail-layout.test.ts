import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssSource = readFileSync(
  path.join(process.cwd(), "app/municipalities/[municipalityCode]/page.module.css"),
  "utf8"
);

describe("municipality detail visual rhythm", () => {
  it("stretches the three view tabs across the shared content width", () => {
    expect(cssSource).toMatch(/\.viewTabs\s*\{[^}]*width:\s*100%[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  });

  it("uses larger spacing at major content boundaries than inside related groups", () => {
    expect(cssSource).toMatch(/\.kpiGrid\s*\{[^}]*margin-bottom:\s*14px/s);
    expect(cssSource).toMatch(/\.viewTabs\s*\{[^}]*margin-bottom:\s*8px/s);
    expect(cssSource).toMatch(/\.feeDecision \+ \.contentSection\s*\{[^}]*margin-top:\s*12px/s);
    expect(cssSource).toMatch(/\.contentSection \+ \.supportGrid,[\s\S]*?\.financeSection \+ \.supportGrid\s*\{[^}]*margin-top:\s*16px/s);
  });
});
