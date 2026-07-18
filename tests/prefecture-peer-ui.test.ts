import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pageSource = readFileSync(path.join(root, "app/municipalities/[municipalityCode]/page.tsx"), "utf8");
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
  it("adds a third URL-backed tab with prefecture-specific wording", () => {
    expect(pageSource).toContain('type DetailView = "fees" | "finance" | "prefecture"');
    expect(pageSource).toContain('href={detailHref(municipalityCode, selectedGroup.key, "prefecture")}');
    expect(pageSource).toContain('if (prefectureName === "北海道") return "道内市町村"');
    expect(pageSource).toContain('if (prefectureName === "東京都") return "都内市区町村"');
    expect(pageSource).toContain("getPrefecturePeerComparison({");
  });

  it("shows fee and operating coverage as two matching current-versus-median graphs", () => {
    expect(componentSource.match(/<MetricComparison\b/g)).toHaveLength(2);
    expect(componentSource).toContain("一般家庭用20m³の月額使用料");
    expect(componentSource).toContain("営業収益で営業費用を何％賄えているか（サイト算定）");
    expect(componentSource).toContain('referenceLabel="100%（全額）"');
    expect(componentSource).toContain('axisStartLabel="0%"');
    expect(componentSource).toContain("この割合＝営業収益÷営業費用×100");
    expect(componentSource).toContain('medianLabel={`${model.prefectureName} 中央値`}');
    expect(componentSource.match(/role="img"/g)).toHaveLength(1);
    expect(componentSource).toContain('aria-label={ariaLabel}');
    expect(componentSource).not.toContain("県内の分布");
    expect(componentSource).not.toContain("histogram");
    expect(cssSource).not.toContain("histogram");
  });

  it("puts the two differently scoped recovery indicators side by side and removes reverse-direction gaps", () => {
    expect(componentSource).not.toContain("100%までの差");
    expect(componentSource).not.toContain("営業収益の不足割合");
    expect(componentSource).not.toContain("経常収益100円あたりの他会計補助金");
    expect(componentSource).not.toContain("営業費用100円あたりの営業収益");
    expect(componentSource).toContain("営業収益で賄えている営業費用の割合");
    expect(componentSource).toContain("hasRecoveryCoverageMismatch");
    expect(componentSource).toContain("経費回収率100%以上でも全額未達");
    expect(componentSource).toMatch(
      /<th scope="col">経費回収率<\/th>\s*<th scope="col">営業収益÷営業費用（サイト算定）<\/th>/
    );
    expect(cssSource).toContain(".coverageStatusBadge");
    expect(componentSource).not.toContain("barGap");
    expect(cssSource).not.toContain(".barGap");
  });

  it("shows the direct percentage and marks only displayed values below 50 percent as critical", () => {
    expect(componentSource).toContain("OPERATING_COVERAGE_CRITICAL_THRESHOLD");
    expect(componentSource).toContain("value < criticalBelow");
    expect(componentSource).toContain("isOperatingCoverageCritical(row.operatingCoverageRatio)");
    expect(componentSource).toContain("data-critical={critical || undefined}");
    expect(componentSource).toContain("data-cleared={cleared || undefined}");
    expect(componentSource).toContain("半分未満");
    expect(componentSource).toContain("50%未満は赤、50%以上は緑で示します");
    expect(componentSource).toContain("50%未満");
    expect(componentSource).toContain("`${rounded.toFixed(1)}%`");
    expect(cssSource).toContain('.metricBar[data-critical] div > span { color: #b52f36; }');
    expect(cssSource).toContain('.metricBar[data-cleared] div > span { color: #15765d; }');
    expect(cssSource).toContain('.coverageValue[data-status="critical"] > strong { color: #b52f36; }');
    expect(componentSource).toContain('const status = critical ? "critical" : "cleared";');
    expect(cssSource).not.toContain('.coverageValue[data-status="partial"]');
  });

  it("uses the official non-standard transfer field instead of relabeling the income-statement subsidy", () => {
    expect(componentSource).not.toContain("row.otherAccountSubsidy");
    expect(componentSource).not.toContain("他会計補助金と基準外繰入金は別の分類です");
    expect(componentSource.match(/formatMoneyThousandYen\(row\.nonStandardTransfer\)/g)).toHaveLength(2);
    expect(componentSource).toContain("総務省の繰出基準に当たらない一般会計等からの繰入額");
    expect(componentSource).toContain("この表では基準外繰入金の代わりに使っていません");
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
    expect(componentSource).toContain("<MobileCards model={model} />");
    expect(cssSource).toMatch(/@media \(max-width: 720px\)[\s\S]*\.tableScroll\s*{\s*display:\s*none/s);
    expect(cssSource).toMatch(/@media \(max-width: 720px\)[\s\S]*\.mobileCards\s*{\s*display:\s*grid/s);
  });
});
