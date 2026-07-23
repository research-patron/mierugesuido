import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssSource = readFileSync(
  path.join(process.cwd(), "app/municipalities/[municipalityCode]/page.module.css"),
  "utf8"
);

describe("municipality detail visual rhythm", () => {
  it("stretches the four view tabs across the shared content width", () => {
    expect(cssSource).toMatch(/\.viewTabs\s*\{[^}]*width:\s*100%[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
    expect(cssSource).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.tabLabelDesktop\s*\{[^}]*display:\s*none/s);
    expect(cssSource).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.tabLabelMobile\s*\{[^}]*display:\s*inline/s);
  });

  it("uses larger spacing at major content boundaries than inside related groups", () => {
    expect(cssSource).toMatch(/\.kpiGrid\s*\{[^}]*margin-bottom:\s*14px/s);
    expect(cssSource).toMatch(/\.viewTabs\s*\{[^}]*margin-bottom:\s*8px/s);
    expect(cssSource).toMatch(/\.feeDecision \+ \.contentSection\s*\{[^}]*margin-top:\s*12px/s);
    expect(cssSource).toMatch(/\.contentSection \+ \.supportGrid,[\s\S]*?\.financeSection \+ \.supportGrid,[\s\S]*?\.yearbookView \+ \.supportGrid\s*\{[^}]*margin-top:\s*16px/s);
  });
});
