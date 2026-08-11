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
    expect(pageSource).toContain('revenueBreakdownValue(income, "rainwater-burden")');
    expect(pageSource).toContain('revenueBreakdownValue(income, "other-account-subsidy")');
  });

  it("shows fee and expense recovery first, with operating coverage behind disclosure", () => {
    expect(componentSource.match(/<MetricComparison\b/g)).toHaveLength(3);
    expect(componentSource).toContain("一般家庭用20m³の月額使用料");
    expect(componentSource).toContain("使用料で対象費用をどこまで賄えているか");
    expect(componentSource).toContain("下水道使用料収入を、公費負担分等を除く汚水処理費で割った公式指標");
    expect(componentSource).toContain("営業収支と公費・繰入の内訳");
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
      .toBeLessThan(componentSource.indexOf("営業収支と公費・繰入の内訳"));
    expect(componentSource.indexOf("営業収支と公費・繰入の内訳"))
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
    expect(componentSource).toMatch(
      /<th scope="col">経費回収率<\/th>\s*<th scope="col">基準外繰入金<\/th>/
    );
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

  it("uses the official non-standard transfer field instead of relabeling the income-statement subsidy", () => {
    expect(componentSource).toContain("row.transferBasisBreakdown");
    expect(componentSource).toContain("他会計補助金");
    expect(componentSource).toContain("営業外収益");
    expect(componentSource.match(/formatMoneyThousandYen\(row\.nonStandardTransfer\)/g)).toHaveLength(2);
    expect(componentSource).toContain("第40表で基準外に区分された一般会計等からの繰入額");
    expect(componentSource).toContain("この表では基準外繰入金の代わりに使っていません");
    expect(componentSource).toContain("公費・繰入の内訳");
    expect(componentSource).toContain("雨水処理負担金");
    expect(componentSource).toContain("資本勘定の他会計補助金");
    expect(componentSource).toContain("実額");
    expect(componentSource).toContain("基準内");
    expect(componentSource).toContain("基準外");
    expect(componentSource).toContain("基準外繰入金合計");
    expect(componentSource).toContain('`${Math.round(value).toLocaleString("ja-JP")}千円`');
    expect(componentSource).not.toContain("相当の規模");
    expect(componentSource).not.toContain("補填率");
  });

  it("adds exact-value mini bars with one shared scale and a visible 100-percent reference", () => {
    expect(componentSource).toContain("buildInlineComparisonScales(eligibleRows)");
    expect(componentSource).toContain("<InlineComparisonMetric");
    expect(componentSource).toContain("referenceValue={100}");
    expect(componentSource).toContain("経費回収率の濃い縦線は100%を示します");
    expect(componentSource).toContain("logarithmic");
    expect(componentSource).toContain("基準外繰入金だけ対数目盛");
    expect(componentSource).toContain("棒の長短だけで良否は判定できません");
    expect(componentSource).toContain('className={styles.inlineBarTrack} aria-hidden="true"');
    expect(cssSource).toContain(".inlineBarTrack");
    expect(cssSource).toMatch(/\.inlineBarFill\s*\{[\s\S]*?background:\s*#4789a8;[\s\S]*?\}/);

    expect(inlineComparisonBarWidth(null, 100)).toBe(0);
    expect(inlineComparisonBarWidth(0, 100)).toBe(0);
    expect(inlineComparisonBarWidth(50, 100)).toBe(50);
    expect(inlineComparisonBarWidth(150, 100)).toBe(100);
    expect(inlineComparisonBarWidth(100, 100, true)).toBe(100);
    expect(inlineComparisonBarWidth(10, 100, true)).toBeGreaterThan(10);
    expect(inlineComparisonBarWidth(10, 100, true)).toBeLessThan(100);
  });

  it("separates operating loss, official non-standard transfers, and fee recovery", () => {
    expect(componentSource).toContain("営業収益が営業費用を下回ることは会計上の営業損失を示します");
    expect(componentSource).toContain("その差額は基準外繰入金ではありません");
    expect(componentSource).toContain("減価償却費に対応する長期前受金戻入");
    expect(componentSource).toContain("この比率だけで基準外繰入金の有無や金額は判定できません");
    expect(componentSource).toContain("基準外繰入金は第40表の公式値");
    expect(componentSource).toContain("使用料による汚水処理費の回収状況は経費回収率で確認します");
    expect(componentSource).toContain("基準内額は、実額と基準外額をともに正常取得でき");
    expect(componentSource).toContain("資本勘定や他会計借入金が含まれる場合があります");
    expect(componentSource).toContain("https://www.mlit.go.jp/mizukokudo/sewerage/crd_sewerage_tk_000140.html");
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
