import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const copySource = readFileSync(path.join(root, "lib/copy.ts"), "utf8");
const dataSourcesSource = readFileSync(path.join(root, "app/data-sources/page.tsx"), "utf8");
const disclaimerSource = readFileSync(path.join(root, "app/disclaimer/page.tsx"), "utf8");
const fieldDefinitionsSource = readFileSync(path.join(root, "lib/fieldDefinitions.ts"), "utf8");

describe("public-enterprise accounting copy audit", () => {
  it("states the enterprise-income principle together with the public-expense exception", () => {
    expect(copySource).toContain("地方公営企業法第17条の2");
    expect(copySource).toContain("一般会計等が負担すべき経費を除き");
    expect(copySource).toContain("雨水公費・汚水私費");
    expect(copySource).toContain("100%未満は営業損失、100%以上は営業利益または収支均衡を示します");
    expect(copySource).toContain("この比率だけで基準外繰入金の有無や金額は判定できません");
    expect(copySource).toContain("受託工事収益・費用等を除いて算定する場合があるため");
    expect(copySource).toContain('title: "営業収支比率（簡易）"');
    expect(copySource).not.toContain("営業収益÷営業費用（サイト算定）");
  });

  it("documents the separate meanings of operating loss and transfers with official public sources", () => {
    expect(dataSourcesSource).toContain("すべての経費を使用料だけで賄う、という規定ではありません");
    expect(dataSourcesSource).toContain("営業損失と繰入金は同額ではない");
    expect(dataSourcesSource).toContain("営業損失への直接の補填割合とは断定できません");
    expect(dataSourcesSource).toContain("https://laws.e-gov.go.jp/law/327AC0000000292");
    expect(dataSourcesSource).toContain("https://laws.e-gov.go.jp/law/327M50000002073/");
    expect(dataSourcesSource).toContain("https://www.mlit.go.jp/mizukokudo/sewerage/crd_sewerage_tk_000140.html");
    expect(dataSourcesSource).toContain("吹田市 公営企業の営業収支比率の解説");
    expect(dataSourcesSource).toContain("営業損失は基準外繰入金で補填された額ですか？");
    expect(disclaimerSource).toContain("営業収支比率（簡易）の位置づけ");
  });

  it("limits nationwide map colors to expense recovery and confines the fee-unit split to prefecture context", () => {
    expect(dataSourcesSource).toContain("全国地図は経費回収率だけで色分け");
    expect(dataSourcesSource).toContain("使用料単価は地域性があるため、全国地図の評価には使いません");
    expect(dataSourcesSource).toContain("同一都道府県内の市町村マップでは");
  });

  it("defines operating income-statement fields without conflating them with fee recovery", () => {
    expect(fieldDefinitionsSource).toContain("正当な公費負担である雨水処理負担金等も含み");
    expect(fieldDefinitionsSource).toContain("使用料で賄うべき汚水処理費とは範囲が異なります");
    expect(fieldDefinitionsSource).toContain("損益計算書では営業収益に含まれます");
    expect(fieldDefinitionsSource).toContain("営業損失の直接の補填額とは一致しません");
    expect(fieldDefinitionsSource).toContain("使用料収入の不足額、営業損失、損益計算書の他会計補助金とは範囲が異なります");
  });
});
