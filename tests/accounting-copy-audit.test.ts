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
    expect(copySource).toContain("使用料の十分性とは分けて読む必要があります");
    expect(copySource).toContain("使用料による汚水処理費の回収状況は経費回収率で確認します");
    expect(copySource).toContain("受託工事収益・費用等を除いて算定する場合があるため");
    expect(copySource).toContain('title: "営業収支比率（簡易）"');
    expect(copySource).not.toContain("営業収益÷営業費用（サイト算定）");
  });

  it("documents operating loss and fee recovery as different scopes with official public sources", () => {
    expect(dataSourcesSource).toContain("すべての経費を使用料だけで賄う、という規定ではありません");
    expect(dataSourcesSource).toContain("営業損益と経費回収率は範囲が異なる");
    expect(dataSourcesSource).toContain("使用料による汚水処理費の回収状況は、別の指標である経費回収率で確認します");
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
    expect(dataSourcesSource).toContain("使用料単価は地域性があるため、全国地図の評価には使いません");
    expect(dataSourcesSource).toContain("同一都道府県内の市町村マップでは");
  });

  it("separates the household tariff average from the business-wide realized unit price", () => {
    expect(copySource).toContain("その1m³平均使用料");
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
