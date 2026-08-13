import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layoutSource = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
const globalsSource = readFileSync(path.join(root, "app/globals.css"), "utf8");
const fidelitySource = readFileSync(path.join(root, "app/ui-fidelity.css"), "utf8");

describe("site-wide Kiwi Maru font contract", () => {
  it("loads the supported native weights through next/font", () => {
    expect(layoutSource).toContain('import { Kiwi_Maru } from "next/font/google"');
    expect(layoutSource).toContain('weight: ["400", "500"]');
    expect(layoutSource).toContain('style: "normal"');
    expect(layoutSource).toContain('display: "swap"');
    expect(layoutSource).toContain("preload: false");
    expect(layoutSource).toContain("adjustFontFallback: false");
    expect(layoutSource).toContain('variable: "--font-kiwi-maru"');
    expect(layoutSource).toContain("className={kiwiMaru.variable}");
  });

  it("uses the shared font variable across document and SVG text", () => {
    const styleSources = `${globalsSource}\n${fidelitySource}`;
    const familyDeclarations = styleSources.match(/font-family:[^;]+;/g) ?? [];

    expect(familyDeclarations.length).toBeGreaterThan(0);
    expect(familyDeclarations.every((declaration) => declaration.includes("var(--font-kiwi-maru)"))).toBe(true);
    expect(styleSources).not.toContain("Noto Sans JP");
    expect(styleSources).not.toContain("Zen Maru Gothic");
    expect(styleSources).not.toContain("fonts.googleapis.com");
  });

  it("keeps native Kiwi Maru outlines instead of synthesizing unavailable heavy weights", () => {
    expect(fidelitySource).toMatch(/body\s*\{[^}]*font-synthesis:\s*none;/s);
  });
});
