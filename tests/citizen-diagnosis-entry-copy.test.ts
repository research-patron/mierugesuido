import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { displayBusinessName } from "@/lib/businessDisplay";
import { municipalityDetailHref } from "@/lib/municipalityLinks";

const root = process.cwd();
const municipalitySearchSource = readFileSync(path.join(root, "app/municipalities/page.tsx"), "utf8");
const municipalityTableSource = readFileSync(path.join(root, "components/MunicipalityTable.tsx"), "utf8");
const rankingOverviewSource = readFileSync(path.join(root, "app/rankings/page.tsx"), "utf8");
const rankingTypeSource = readFileSync(path.join(root, "app/rankings/[type]/page.tsx"), "utf8");
const rankingComparisonSource = readFileSync(path.join(root, "components/RankingComparison.tsx"), "utf8");
const rankingTableSource = readFileSync(path.join(root, "components/RankingTable.tsx"), "utf8");

describe("citizen diagnosis entry copy", () => {
  it("tells search users what municipality links open and labels every search-result entry point", () => {
    expect(municipalitySearchSource).toContain("自治体名を選ぶと「このまちの診断」を開きます。");
    expect(municipalitySearchSource).toContain("aria-label={`${item.prefectureName} ${item.municipalityName}のこのまちの診断を見る`}");
    expect(municipalityTableSource.match(/のこのまちの診断を見る/g)).toHaveLength(3);
    expect(municipalityTableSource).toContain('<span className="sr-only">このまちの診断</span>');
    expect(municipalityTableSource).toContain("・診断で事業切替");
    expect(municipalityTableSource).not.toContain("・詳細で事業切替");
    expect(municipalityDetailHref("011002", "17-1-000")).toBe("/municipalities/011002?view=fees&business=17-1-000");
    for (const source of [municipalitySearchSource, municipalityTableSource]) {
      expect(source).toContain("href={municipalityDetailHref(item.municipalityCode, item.businessKey)}");
    }
  });

  it("keeps ranking links compact while making their destination explicit", () => {
    const instruction = "自治体・運営団体名を選ぶと「このまちの診断」を開きます。";
    const accessibleLabel = "aria-label={`${item.prefectureName} ${item.municipalityName}・${displayBusinessName(item)}のこのまちの診断を見る`}";
    expect(rankingOverviewSource).toContain(instruction);
    expect(rankingTypeSource).toContain(instruction);

    expect(rankingComparisonSource.match(/のこのまちの診断を見る/g)).toHaveLength(1);
    expect(rankingTableSource.match(/のこのまちの診断を見る/g)).toHaveLength(2);
    for (const source of [rankingComparisonSource, rankingTableSource]) {
      expect(source).toContain(accessibleLabel);
      expect(source).toContain("href={municipalityDetailHref(item.municipalityCode, item.businessKey)}");
    }
  });

  it("distinguishes multiple businesses of the same municipality in ranking link names", () => {
    const items = [
      {
        prefectureName: "北海道",
        municipalityName: "札幌市",
        municipalityCode: "011002",
        businessKey: "17-1-000",
        accountingType: "legal_applied",
        expenseRecoveryRate: 101,
        flags: []
      },
      {
        prefectureName: "北海道",
        municipalityName: "札幌市",
        municipalityCode: "011002",
        businessKey: "17-4-000",
        accountingType: "legal_applied",
        expenseRecoveryRate: 99,
        flags: []
      }
    ];
    const labels = items.map((item) => (
      `${item.prefectureName} ${item.municipalityName}・${displayBusinessName(item)}のこのまちの診断を見る`
    ));

    expect(labels).toEqual([
      "北海道 札幌市・公共下水道のこのまちの診断を見る",
      "北海道 札幌市・特定環境保全公共下水道のこのまちの診断を見る"
    ]);
    expect(new Set(labels).size).toBe(items.length);
  });
});
