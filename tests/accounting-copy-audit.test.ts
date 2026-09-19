import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const copySource = readFileSync(path.join(root, "lib/copy.ts"), "utf8");
const dataSourcesSource = readFileSync(path.join(root, "app/data-sources/page.tsx"), "utf8");
const disclaimerSource = readFileSync(path.join(root, "app/disclaimer/page.tsx"), "utf8");
const fieldDefinitionsSource = readFileSync(path.join(root, "lib/fieldDefinitions.ts"), "utf8");

describe("public-enterprise accounting copy audit", () => {
  it("states the enterprise-income principle on the source page and explains the two ratios", () => {
    expect(dataSourcesSource).toContain("地方公営企業法第17条の2");
    expect(dataSourcesSource).toContain("公費で負担する経費を除き");
    expect(dataSourcesSource).toContain("雨水公費・汚水私費");
    expect(copySource).toContain("営業収益÷営業費用×100");
    expect(copySource).toContain("経費回収率は使用料収入÷汚水処理費×100");
    expect(copySource).toContain('title: "営業収支比率（簡易）"');
    expect(copySource).not.toContain("100%未満は営業損失");
  });

  it("documents operating loss and fee recovery as different scopes with official public sources", () => {
    expect(dataSourcesSource).toContain("公費で負担する経費を除き、経営に伴う収入で費用を賄う");
    expect(dataSourcesSource).toContain("営業損益と経費回収率は範囲が異なる");
    expect(dataSourcesSource).toContain("使用料で汚水処理費をどれだけ賄えているかは、経費回収率に表れます");
    expect(dataSourcesSource).toContain("https://laws.e-gov.go.jp/law/327AC0000000292");
    expect(dataSourcesSource).toContain("https://laws.e-gov.go.jp/law/327M50000002073/");
    expect(dataSourcesSource).toContain("https://www.mlit.go.jp/mizukokudo/sewerage/crd_sewerage_tk_000140.html");
    expect(dataSourcesSource).toContain("吹田市 公営企業の営業収支比率の解説");
    expect(disclaimerSource).toContain("営業収支比率（簡易）の位置づけ");
    expect(copySource).not.toContain("基準外");
    expect(dataSourcesSource).not.toContain("基準外");
  });

  it("limits nationwide map colors to expense recovery and confines the fee-unit split to prefecture context", () => {
    expect(dataSourcesSource).toContain("全国地図は経費回収率だけで色分け");
    expect(dataSourcesSource).toContain("最新年度の経費回収率を都道府県ごとに単純平均");
    expect(dataSourcesSource).toContain("同一都道府県内の市町村マップでは");
  });

  it("separates the household tariff average from the business-wide realized unit price", () => {
    expect(copySource).toContain("家庭用料金表に記載された税込月額");
    expect(dataSourcesSource).toContain("整数に丸めた表示");
    expect(dataSourcesSource).toContain("使用料単価に20を掛けても家庭用20m³月額にはなりません");
  });

  it("documents the table 33 evidence hierarchy for fee revisions", () => {
    expect(dataSourcesSource).toContain("現行使用料施行年月日");
    expect(dataSourcesSource).toContain("前回使用料改定年月日");
    expect(dataSourcesSource).toContain("実質使用料改定率");
    expect(dataSourcesSource).toContain("『現行使用料施行年月日』が年度間で変わった事業だけを掲載します");
    expect(dataSourcesSource).toContain("20m³月額などの金額差だけでは一覧に含めません");
  });

  it("defines operating income-statement fields without conflating them with fee recovery", () => {
    expect(fieldDefinitionsSource).toContain("正当な公費負担である雨水処理負担金等も含み");
    expect(fieldDefinitionsSource).toContain("使用料で賄うべき汚水処理費とは範囲が異なります");
    expect(fieldDefinitionsSource).toContain("損益計算書では営業収益に含まれます");
    expect(fieldDefinitionsSource).toContain("営業損益には含まれず");
    expect(fieldDefinitionsSource).toContain("経常損益を構成します");
    expect(fieldDefinitionsSource).not.toContain("基準外");
  });
});
