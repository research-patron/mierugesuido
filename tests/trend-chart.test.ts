import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrendChart, type TrendPoint } from "@/components/TrendChart";

describe("TrendChart", () => {
  it("treats negative source values as unavailable and never emits negative SVG bar heights", () => {
    const points: TrendPoint[] = [
      {
        year: 2023,
        fiscalYearLabel: "R5",
        accountingType: "legal_applied",
        expenseRecoveryRate: -722.1118,
        householdFee20m3Yen: -3_000,
        feeUnitPriceYenPerM3: -191.15,
        treatmentCostYenPerM3: -26.4718,
        annualBillableVolume: -479_038
      },
      {
        year: 2024,
        fiscalYearLabel: "R6",
        accountingType: "legal_applied",
        expenseRecoveryRate: 62.5,
        householdFee20m3Yen: 3_300,
        feeUnitPriceYenPerM3: 150,
        treatmentCostYenPerM3: 240,
        annualBillableVolume: 500_000
      }
    ];

    const markup = renderToStaticMarkup(createElement(TrendChart, { points }));

    expect(markup).toContain("62.5%");
    expect(markup).toContain("240.0円/m³");
    expect(markup).toContain("算定不可");
    expect(markup).not.toContain("-722.1%");
    expect(markup).not.toContain("-26.5円/m³");
    expect(markup).not.toMatch(/height="-/);
    expect(markup.match(/data-chart-trigger="true"/g)).toHaveLength(4);
    expect(markup.match(/aria-haspopup="dialog"/g)).toHaveLength(4);
    expect(markup).toContain("経費回収率の推移（%）を拡大表示");
    expect(markup).toContain("拡大");
  });
});
