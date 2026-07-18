import { describe, expect, it } from "vitest";
import { parseAccountingType, parseCsvObjects, parseTableNo, toNumber } from "@/scripts/etl/utils";

describe("etl utilities", () => {
  it("parses csv with quoted commas", () => {
    const rows = parseCsvObjects('name,value\n"山形市,公共",1,200\n');
    expect(rows[0].name).toBe("山形市,公共");
    expect(rows[0].value).toBe("1");
  });

  it("normalizes numeric cells", () => {
    expect(toNumber("1,234")).toBe(1234);
    expect(toNumber("94.1%")).toBe(94.1);
    expect(toNumber("-")).toBeNull();
  });

  it("detects accounting type and table number from titles", () => {
    expect(parseAccountingType("下水道事業 法適用 20表 損益計算書")).toBe("legal_applied");
    expect(parseAccountingType("下水道事業 法非適用 26表 歳入歳出決算")).toBe("non_legal_applied");
    expect(parseTableNo("第32表 経営分析に関する調（一）")).toBe(32);
  });
});
