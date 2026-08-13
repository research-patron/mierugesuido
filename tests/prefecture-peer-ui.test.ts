import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inlineComparisonBarWidth } from "@/components/municipality-detail/PrefecturePeerComparison";

const root = process.cwd();
const pageSource = readFileSync(path.join(root, "components/MunicipalityDetailClient.tsx"), "utf8");
const componentSource = readFileSync(
  path.join(root, "components/municipality-detail/PrefecturePeerComparison.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  path.join(root, "components/municipality-detail/PrefecturePeerComparison.module.css"),
  "utf8"
);
const detailCssSource = readFileSync(
  path.join(root, "app/municipalities/[municipalityCode]/page.module.css"),
  "utf8"
);

describe("prefecture peer comparison UI", () => {
  it("keeps prefecture comparison as the third URL-backed tab with prefecture-specific wording", () => {
    expect(pageSource).toContain('type DetailView = "fees" | "finance" | "prefecture" | "yearbook"');
    expect(pageSource).toContain('href={detailHref(municipalityCode, selectedGroup.key, "prefecture")}');
    expect(pageSource).toContain('href={detailHref(municipalityCode, selectedGroup.key, "yearbook")}');
    expect(pageSource).toContain('if (prefectureName === "北海道") return "道内市町村"');
    expect(pageSource).toContain('if (prefectureName === "東京都") return "都内市区町村"');
    expect(pageSource).toContain("/data/static/peers/");
    expect(pageSource).toContain("row.representedMunicipalityCodes.includes(municipality.municipalityCode)");
    expect(pageSource).toContain("buildCurrentFundingContext(selectedGroup)");
    expect(pageSource).toContain("operatingRevenue: context.operatingRevenue");
    expect(pageSource).toContain("operatingExpense: context.operatingExpense");
  });

  it("shows fee and expense recovery first, with operating coverage behind disclosure", () => {
    expect(componentSource.match(/<MetricComparison\b/g)).toHaveLength(3);
    expect(componentSource).toContain("一般家庭用20m³の月額使用料");
    expect(componentSource).toContain("使用料で対象費用をどこまで賄えているか");
    expect(componentSource).toContain("下水道使用料収入を、公費負担分等を除く汚水処理費で割った公式指標");
    expect(componentSource).toContain("営業収支も確認する");
    expect(componentSource).toContain("<details className={styles.financialDetails}>");
    expect(componentSource).toContain("営業収益で営業費用をどこまで賄えているか");
    expect(componentSource).toContain('referenceLabel="100%（全額）"');
    expect(componentSource).toContain('axisStartLabel="0%"');
    expect(componentSource).toContain("営業収支比率は一般に（営業収益−受託工事収益等）÷（営業費用−受託工事費等）×100");
    expect(componentSource).toContain("本データでは受託工事収益を別掲できない");
    expect(componentSource).not.toContain("（サイト算定）");
    expect(componentSource).toContain('medianLabel={`${model.prefectureName} 中央値`}');
    expect(componentSource.match(/role="img"/g)).toHaveLength(1);
    expect(componentSource).toContain('aria-label={ariaLabel}');
    expect(componentSource).not.toContain("県内の分布");
    expect(componentSource).not.toContain("histogram");
    expect(cssSource).not.toContain("histogram");
    expect(componentSource.indexOf("使用料で対象費用をどこまで賄えているか"))
      .toBeLessThan(componentSource.indexOf("営業収支も確認する"));
    expect(componentSource.indexOf("営業収支も確認する"))
      .toBeLessThan(componentSource.indexOf("営業収益で営業費用をどこまで賄えているか"));
  });

  it("keeps operating coverage out of the default table and explains the different scopes", () => {
    expect(componentSource).not.toContain("100%までの差");
    expect(componentSource).not.toContain("営業収益の不足割合");
    expect(componentSource).not.toContain("経常収益100円あたりの他会計補助金");
    expect(componentSource).not.toContain("営業費用100円あたりの営業収益");
    expect(componentSource).toContain("営業収益で営業費用をどこまで賄えているか");
    expect(componentSource).toContain("hasRecoveryCoverageMismatch");
    expect(componentSource).toContain("経費回収率は100%以上ですが");
    expect(componentSource).toContain("50%以上・全額未達");
    expect(componentSource).toContain("全額を賄う");
    expect(componentSource).toMatch(/<th scope="col">20m³使用料（月額）<\/th>\s*<th scope="col">経費回収率<\/th>/);
    expect(componentSource).toContain("<td colSpan={2}");
    expect(componentSource).not.toContain('<th scope="col">営業収支比率（簡易）</th>');
    expect(cssSource).toContain(".financialDetails");
    expect(cssSource).not.toContain(".coverageStatusBadge");
    expect(componentSource).not.toContain("barGap");
    expect(cssSource).not.toContain(".barGap");
  });

  it("shows the direct percentage and marks only displayed values below 50 percent as critical", () => {
    expect(componentSource).toContain("OPERATING_COVERAGE_CRITICAL_THRESHOLD");
    expect(componentSource).toContain("value < criticalBelow");
    expect(componentSource).toContain("data-critical={critical || undefined}");
    expect(componentSource).toContain("data-cleared={cleared || undefined}");
    expect(componentSource).toContain("半分未満");
    expect(componentSource).toContain("50%未満は赤、50%以上は緑で区別します");
    expect(componentSource).toContain("50%は表示上の注意区分で十分性の基準ではありません");
    expect(componentSource).toContain("半分未満・全額未達");
    expect(componentSource).toContain("`${rounded.toFixed(1)}%`");
    expect(cssSource).toContain('.metricBar[data-critical] div > span { color: #b52f36; }');
    expect(cssSource).toContain('.metricBar[data-cleared] div > span { color: #15765d; }');
    expect(cssSource).not.toContain(".coverageValue");
    expect(componentSource).not.toContain('const status = critical ? "critical" : "cleared";');
    expect(cssSource).not.toContain('.coverageValue[data-status="partial"]');
  });

  it("keeps the public peer summary and table limited to the retained comparison measures", () => {
    expect(componentSource.match(/<SummaryCard\b/g)).toHaveLength(2);
    expect(componentSource).not.toContain("transferBasisBreakdown");
    expect(componentSource).not.toContain("formatMoneyThousandYen");
    expect(componentSource).not.toContain("OperatingFundingContext");
    expect(componentSource).toContain("20m³使用料（月額）");
    expect(componentSource).toContain("経費回収率");
  });

  it("adds exact-value mini bars with one shared scale and a visible 100-percent reference", () => {
    expect(componentSource).toContain("buildInlineComparisonScales(eligibleRows)");
    expect(componentSource).toContain("<InlineComparisonMetric");
    expect(componentSource).toContain("referenceValue={100}");
    expect(componentSource).toContain("経費回収率の濃い縦線は100%を示します");
    expect(componentSource).not.toContain("logarithmic");
    expect(componentSource).toContain("数値に加えて棒の長さでも比較できます");
    expect(componentSource).toContain('className={styles.inlineBarTrack} aria-hidden="true"');
    expect(cssSource).toContain(".inlineBarTrack");
    expect(cssSource).toMatch(/\.inlineBarFill\s*\{[\s\S]*?background:\s*#4789a8;[\s\S]*?\}/);

    expect(inlineComparisonBarWidth(null, 100)).toBe(0);
    expect(inlineComparisonBarWidth(0, 100)).toBe(0);
    expect(inlineComparisonBarWidth(50, 100)).toBe(50);
    expect(inlineComparisonBarWidth(150, 100)).toBe(100);
  });

  it("separates operating results from fee recovery", () => {
    expect(componentSource).toContain("営業損益を見る比率です");
    expect(componentSource).toContain("料金表上の20m³月額とは別の決算指標です");
    expect(componentSource).toContain("使用料による費用回収とは対象範囲が異なります");
    expect(componentSource).toContain("営業収益には雨水処理負担金など正当な公費負担も含まれる");
    expect(componentSource).toContain("両指標は対象範囲が異なります");
  });

  it("compares legal-applied public and special-environment businesses and labels each adopted type", () => {
    expect(componentSource).toContain("本サイト独自に都道府県内で横並び比較します");
    expect(componentSource).toContain("公式類似団体区分では公共下水道と特環は別区分です");
    expect(componentSource).toContain('const scopeLabel = comparesPublicAndTokkan ? "公共＋特環" : businessLabel');
    expect(componentSource).toContain('`R6に地方公営企業法を適用する「${businessLabel}」を同じ事業種別で比較します。`');
    expect(componentSource).toContain("R6・法適用・{scopeLabel}");
    expect(componentSource.match(/<BusinessTypeBadge row=\{row\} \/>/g)).toHaveLength(2);
    expect(componentSource).toContain('return "特環"');
    expect(componentSource).toContain('return "公共"');
    expect(componentSource).toContain("PREFECTURE_PEER_TOKKAN_BUSINESS_KEY");
    expect(componentSource).toContain("PREFECTURE_PEER_PUBLIC_SEWER_BUSINESS_KEY");
  });

  it("shows verified joint operations without presenting operator totals as municipality-level allocations", () => {
    expect(pageSource).toContain("<JointOperationLinks municipality={municipality} />");
    expect(pageSource).toContain("組合運営の関連下水道があります");
    expect(pageSource).toContain("組合全体の決算で、市町村別の配分額ではありません");
    expect(pageSource).toContain("sewerBusinessKeyLabel(membership.businessKey)");
    expect(componentSource).toContain("<JointOperationBadge row={row} />");
    expect(componentSource).toContain("組合全体の決算 · 運営:");
    expect(componentSource).toContain("平均・合計にも1回だけ集計します");
    expect(componentSource).not.toContain("公共下水道・特環なし");
    expect(detailCssSource).toContain(".jointOperationCard");
    expect(cssSource).toContain(".jointOperationBadge");
  });

  it("keeps the administrative-order table and mobile cards without a wide mobile table", () => {
    expect(componentSource).toContain("一覧は自治体コード順です");
    expect(componentSource).toContain("<caption>");
    expect(componentSource).toContain('scope="row"');
    expect(componentSource).toContain("20m³使用料（月額）");
    expect(componentSource).toContain("<MobileCards model={model} scales={comparisonScales} />");
    expect(cssSource).toMatch(/@media \(max-width: 720px\)[\s\S]*\.tableScroll\s*{\s*display:\s*none/s);
    expect(cssSource).toMatch(/@media \(max-width: 720px\)[\s\S]*\.mobileCards\s*{\s*display:\s*grid/s);
  });
});
