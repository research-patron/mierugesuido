import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(
  path.join(process.cwd(), "app/municipalities/[municipalityCode]/page.tsx"),
  "utf8"
);
const etlSource = readFileSync(
  path.join(process.cwd(), "scripts/etl/etl.ts"),
  "utf8"
);

describe("household 20m3 fee and recovery-story UI", () => {
  it("keeps the official household tariff separate from the average unit price", () => {
    expect(detailSource).toContain('label="一般家庭用20m³／月"');
    expect(detailSource).toContain("料金表データ未取得");
    expect(detailSource).toContain("料金表上の月額と、決算から算定する経費回収率を分けて確認します");
    expect(detailSource).toContain("一般家庭用20m³月額</strong>は料金表上の税込月額");
  });

  it("uses the official fee-recovery cost boundary instead of gross operating expense", () => {
    expect(detailSource).toContain("汚水処理費（公費負担分等を除く）");
    expect(detailSource).toContain("維持管理費分");
    expect(detailSource).toContain("資本費分");
    expect(detailSource).toContain("営業費用と、経費回収率の対象となる汚水処理費は同じ範囲ではありません");
    expect(detailSource).toContain("経費回収率が100%以上のため、引下げ額は試算しません");
    expect(detailSource).toContain("100%相当額との差");
    expect(detailSource).not.toContain("改定リスクスコア");
  });

  it("removes the repeated reading note and misleading shorthand from every detail tab", () => {
    expect(detailSource).not.toContain("readingNote");
    expect(detailSource).not.toContain("20m³の負担");
    expect(detailSource).not.toContain("使用料で賄う範囲");
    expect(detailSource).not.toContain("必要改定率");
    expect(detailSource).not.toContain("料金の適正性");
  });

  it("maps R2-R6 official e-Stat table coordinates correctly", () => {
    expect(etlSource).toContain('{ field: "householdFee20m3Yen", label: "一般家庭用20m³／月使用料", rowNo: "01", colNo: 13');
    expect(etlSource).toContain('{ field: "opexComponent", label: "汚水処理費（維持管理費分）", rowNo: "01", colNo: 44');
    expect(etlSource).toContain('{ field: "capitalCostComponent", label: "汚水処理費（資本費分）", rowNo: "02", colNo: 8');
    expect(etlSource).toContain('{ field: "wastewaterTreatmentCost", label: "汚水処理費（合計）", rowNo: "02", colNo: 16');
    expect(etlSource).not.toContain('{ field: "wastewaterTreatmentCost", label: "汚水処理費", rowNo: "01", colNo: 44');
  });
});
