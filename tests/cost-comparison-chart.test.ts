import { describe, expect, it } from "vitest";
import { buildCostComparisonChart } from "@/lib/costComparisonChart";
import type { PrefecturePeerComparisonRow } from "@/lib/prefecturePeerComparison";

function row(key: string, volumeMillionM3: number | null, costMillionYen: number | null,
  overrides: Partial<PrefecturePeerComparisonRow> = {}) {
  return {comparisonUnitKey: key, municipalityName: key, detailMunicipalityCode: key,
    businessKey: "17-1-000", eligible: true,
    annualBillableVolume: volumeMillionM3 == null ? null : volumeMillionM3 * 1_000_000,
    costCompositionShares: [{id:"depreciation", label:"減価償却費", sharePercent:30,
      yenPerM3: costMillionYen == null ? null : costMillionYen / (volumeMillionM3 || 1)}],
    ...overrides} as PrefecturePeerComparisonRow;
}

describe("prefecture individual-cost scatter calculations", () => {
  it("fits expense to volume in millions without changing source rows", () => {
    const input = [1,2,3,4,5].map(x => row(String(x),x,2*x+100));
    const original = structuredClone(input);
    const result = buildCostComparisonChart(input,"nature:depreciation");
    expect(result.fit?.slope).toBeCloseTo(2);
    expect(result.fit?.intercept).toBeCloseTo(100);
    expect(result.fit?.rSquared).toBeCloseTo(1);
    expect(result.points.every(point=>Math.abs(point.residual!) < 1e-10 && !point.distant)).toBe(true);
    expect(result.points[0]).toMatchObject({x:1,y:102,yenPerM3:102});
    expect(input).toEqual(original);
  });
  it("does not depend on household tariffs or the aggregate treatment cost", () => {
    const input = [1,2,3].map(x=>row(String(x),x,50*x));
    const changed = input.map((item,index)=>({...item, householdFee20m3Yen:index === 0 ? null : 99_999,
      treatmentCostYenPerM3:index * 1_000}));
    expect(buildCostComparisonChart(input,"nature:depreciation")).toEqual(buildCostComparisonChart(changed,"nature:depreciation"));
  });
  it("marks large standardized residuals and retains every observation", () => {
    const input = Array.from({length:12},(_,index)=>row(String(index),index+1,index===5?3000:2*(index+1)+100));
    const result = buildCostComparisonChart(input,"nature:depreciation");
    expect(result.points).toHaveLength(12);
    expect(result.points.find(point=>point.key==="5")?.distant).toBe(true);
    expect(result.points.filter(point=>point.distant)).toHaveLength(1);
  });
  it("counts shared operations once, retains zero expense and excludes invalid observations", () => {
    const input = [row("shared",2,300),row("shared",2,300),row("excluded",1,200,{eligible:false}),
      row("missing-cost",1,null),row("missing-volume",null,200),row("nan",NaN,200),
      row("infinite",2,Infinity),row("zero-volume",0,200),row("negative-cost",2,-1),row("zero-cost",3,0)];
    expect(buildCostComparisonChart(input,"nature:depreciation").points.map(point=>point.key)).toEqual(["shared","zero-cost"]);
  });
  it("keeps Table 20 and 21 costs distinct and never substitutes missing items", () => {
    const input = [row("a",2,100,{purposeCostItems:[{id:"pipeline",label:"管渠費",yenPerM3:25}]})];
    expect(buildCostComparisonChart(input,"purpose:pipeline").points[0]).toMatchObject({x:2,y:50,yenPerM3:25});
    expect(buildCostComparisonChart(input,"nature:depreciation").points[0].y).toBe(100);
    expect(buildCostComparisonChart(input,"nature:repair").points).toEqual([]);
  });
  it("does not fit fewer than three observations or a constant volume", () => {
    expect(buildCostComparisonChart([row("a",1,200),row("b",2,300)],"nature:depreciation").fit).toBeNull();
    expect(buildCostComparisonChart([row("a",1,200),row("b",1,300),row("c",1,500)],"nature:depreciation").fit).toBeNull();
  });
  it("does not divide by zero when all expenses are zero", () => {
    const result=buildCostComparisonChart([1,2,3,4,5].map(x=>row(String(x),x,0)),"nature:depreciation");
    expect(result.fit).toEqual({slope:0,intercept:0,rSquared:null});
    expect(result.points.every(point=>!point.distant && point.standardizedResidual===null)).toBe(true);
  });
  it("supports a negative fitted slope and does not flag a sample smaller than five", () => {
    const result=buildCostComparisonChart([1,2,3,4].map(x=>row(String(x),x,500-50*x)),"nature:depreciation");
    expect(result.fit?.slope).toBe(-50);
    expect(result.points.every(point=>point.standardizedResidual===null)).toBe(true);
  });
});
