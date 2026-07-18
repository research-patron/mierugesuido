import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  path.join(process.cwd(), "components/municipality-detail/FinancialStory.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  path.join(process.cwd(), "components/municipality-detail/FinancialStory.module.css"),
  "utf8"
);

describe("financial statement accounting-box UI", () => {
  it("uses the conventional debit-left and credit-right income equation", () => {
    expect(componentSource).toContain('const leftTitle = analysis.equation.resultSide === "left" ? "費用＋純利益" : "費用"');
    expect(componentSource).toContain('const rightTitle = analysis.equation.resultSide === "right" ? "収益＋純損失" : "収益"');
    expect(componentSource).toContain("<EquationColumn title={leftTitle}");
    expect(componentSource).toContain("<EquationColumn title={rightTitle}");
    expect(componentSource).toContain("incomeEquationCopy(analysis)");
    expect(componentSource).toContain("費用が${difference}上回っています");
    expect(componentSource).toContain("収益が${difference}上回っています");
  });

  it("keeps equal tall plots while moving every visible breakdown into its parent box", () => {
    expect(cssSource).toMatch(/\.equationPlot\s*{[^}]*align-items:\s*stretch/s);
    expect(cssSource).toMatch(/\.stackFrame\s*{[^}]*height:\s*560px/s);
    expect(cssSource).toContain("--stack-detailed-mobile-height, 650px");
    expect(cssSource).toMatch(/@media \(max-width: 760px\)[\s\S]*\.stackFrame\s*{[^}]*height:\s*360px/s);
    expect(cssSource).toMatch(/\.stack\s*{[^}]*height:\s*100%/s);
    expect(cssSource).toMatch(/\.segment\s*{[^}]*min-height:\s*62px/s);
    expect(componentSource).toContain("item.details && item.details.length > 0");
    expect(componentSource).toContain("<small>うち</small>");
    expect(componentSource).toContain("formatSourceThousandYen(detail.value)");
    expect(componentSource).toContain("大項目内 {formatShare(detail.value, item.value)}");
    expect(componentSource).toContain("大項目内${formatShare(detail.value, item.value)}");
    expect(componentSource).toContain("scale={analysis.scale} detailed frameHeights={detailedFrameHeights}");
    expect(componentSource).toContain('role="listitem"');
    expect(componentSource).not.toContain('className={styles.equationPlot} aria-hidden="true"');
    expect(componentSource).not.toContain("IncomeBreakdownNotes");
    expect(componentSource).not.toContain("BreakdownLegend");
    expect(cssSource).not.toMatch(/\.legend\s*\{/);
  });

  it("distinguishes the income-statement subsidy from non-standard transfers", () => {
    expect(componentSource).toContain("他会計補助金（営業外収益）");
    expect(componentSource).toContain("基準外繰入金とは一致しません");
    expect(componentSource).toContain("styles.accountingTermNote");
    expect(cssSource).toContain(".accountingTermNote");
  });

  it("keeps the three major balance boxes while showing each box's selected source breakdown", () => {
    const balanceSheetSource = componentSource.slice(
      componentSource.indexOf("function BalanceSheet("),
      componentSource.indexOf("function NetAssetsChange(")
    );
    expect(balanceSheetSource).toContain('title="貸借｜年度末の資産と財源"');
    expect(balanceSheetSource).toContain("<BalanceRelationship analysis={analysis} />");
    expect(balanceSheetSource).not.toContain("<EquationColumn");
    expect(componentSource).toContain('label="資産"');
    expect(componentSource).toContain('label="負債"');
    expect(componentSource).toContain('label="純資産"');
    expect(componentSource).toContain('items={analysis.assets.items}');
    expect(componentSource).toContain('items={analysis.liabilities.items}');
    expect(componentSource).toContain('items={analysis.netAssets.items}');
    expect(componentSource).toContain('<small>{label.prefix}</small>');
    expect(componentSource).toContain('data-balance-breakdown={tone}');
    expect(componentSource).toContain('data-balance-detail={item.id}');
    expect(componentSource).toContain('formatBalanceBreakdownAmount(item.value, scale)');
    expect(componentSource).toContain('{groupLabel}内 {formatBalancePercent((item.value / total) * 100)}');
    expect(componentSource).toContain("資産から負債を差し引いた残りです");
    expect(componentSource).toContain('data-balance-derived={item.derived ? "true" : undefined}');
    expect(componentSource).toContain("一部内訳未取得（0円とは扱いません）");
    expect(componentSource).toContain("相殺・不整合を含むため、内訳の割合は表示しません");
    expect(componentSource).toContain("返済予定額ではありません");
    expect(cssSource).toMatch(/\.balanceEquation\s*{[^}]*min-height:\s*460px[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 32px minmax\(0, 1fr\)/s);
    expect(cssSource).toMatch(/@media \(max-width: 760px\)\s*\{[\s\S]*?\.balanceEquation,\s*\.balanceDeficitEquation\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
    expect(componentSource).toContain('data-balance-frame="asset"');
    expect(componentSource).toContain('data-balance-frame="funding"');
    expect(componentSource).toContain("styles.balanceStackPlus");
    expect(cssSource).toMatch(/\.balanceBoxFrame\s*{[^}]*display:\s*flex[^}]*overflow:\s*hidden[^}]*border:/s);
    expect(cssSource).toMatch(/\.balanceFundingStack\s*{[^}]*flex-direction:\s*column/s);
    expect(cssSource).toMatch(/@media \(max-width: 760px\)\s*\{[\s\S]*?\.balanceEquation > \.balanceBoxFrame\s*\{[^}]*height:\s*540px/s);
    expect(cssSource).toMatch(/\.balanceBoxRegion\s*{[^}]*min-height:\s*0[^}]*color:\s*#fff/s);
    expect(cssSource).toMatch(/\.balanceNetAssets\s*{[^}]*box-shadow:\s*inset 0 2px/s);
    expect(componentSource).toContain("data-balance-callout");
    expect(componentSource).toContain("data-balance-mobile-compact");
    expect(componentSource).toContain('data-balance-callout-mode={mobileOnly ? "mobile" : "all"}');
    expect(componentSource).toContain("chooseBalanceBoxScale");
    expect(cssSource).toMatch(/\.balanceBoxDetails\s*{[^}]*border-top:/s);
    expect(cssSource).toMatch(/\.balanceBoxDetails li\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s);
    expect(cssSource).toMatch(/\.balanceCompactNote \.balanceBoxDetails\s*{[^}]*border-top-color:/s);
    expect(cssSource).toMatch(/\.balanceCompactNotesMobileOnly,\s*\.balanceCompactMobileOnly\s*{[^}]*display:\s*none/s);
    expect(cssSource).toMatch(/@media \(max-width: 760px\)[\s\S]*\[data-balance-mobile-compact\] \.balanceBoxDetails\s*{[^}]*display:\s*none/s);
    expect(cssSource).toMatch(/@media \(max-width: 760px\)[\s\S]*\.balanceCompactNotesMobileOnly,\s*\.balanceCompactMobileOnly\s*\{[^}]*display:\s*grid/s);
    expect(cssSource).toContain(".balanceReadingNote");
    expect(cssSource).toMatch(/\.balanceBoxTopline strong\s*{[^}]*color:\s*#fff/s);
    expect(cssSource).toMatch(/\.balanceBoxRegion p\s*{[^}]*color:\s*#fff/s);
    expect(cssSource).not.toContain(".balanceMajorBox");
    expect(cssSource).not.toContain(".balanceShareTrack");
  });

  it("balances debt excess explicitly instead of drawing negative equity as positive funding", () => {
    expect(componentSource).toContain("<BalanceDeficitRelationship analysis={analysis} />");
    expect(componentSource).toContain('label="純資産のマイナス分"');
    expect(componentSource).toContain('meaning={`債務超過額（差額）／純資産 ${formatAdaptiveAmount(analysis.totalNetAssets)}`}');
    expect(componentSource).toContain("資産{assetLabel}に債務超過額{deficitLabel}");
    expect(componentSource).toContain("(analysis.totalAssets ?? -1) >= 0");
    expect(componentSource).toContain("資金不足や返済能力を直接示す指標ではありません");
  });

  it("removes repeated equation strips and normal-state reconciliation noise", () => {
    expect(componentSource).not.toContain("styles.equationCaption");
    expect(componentSource).not.toContain("styles.proportionNote");
    expect(componentSource).not.toContain("styles.reconciliationBand");
    expect(componentSource).not.toContain("styles.identityNote");
    expect(componentSource).not.toContain("資産合計と負債・純資産合計が一致しています");
    expect(cssSource).not.toContain(".equationCaption");
    expect(cssSource).not.toContain(".proportionNote");
    expect(cssSource).not.toContain(".reconciliationBand");
    expect(cssSource).not.toContain(".identityNote");
  });

  it("keeps all balance-sheet accounts grouped behind an accessible disclosure", () => {
    expect(componentSource).toContain("勘定科目の内訳とデータ確認");
    expect(componentSource).toContain("資産の内訳（原表単位：千円）");
    expect(componentSource).toContain("負債の内訳（原表単位：千円）");
    expect(componentSource).toContain("純資産の内訳（原表単位：千円）");
    expect(cssSource).toMatch(/\.cardDetails summary,\s*\.traceDetails summary\s*{[^}]*min-height:\s*44px/s);
    expect(cssSource).toMatch(/\.netAssetsDetails summary\s*{[^}]*min-height:\s*44px/s);
    expect(cssSource).toMatch(/\.balanceDetailGrid\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  });

  it("teaches the four non-overlapping drivers of net-assets change", () => {
    expect(componentSource).toContain("純資産｜前年より増えたか");
    expect(componentSource).toContain("増減を動かした項目");
    expect(componentSource).toContain("4項目の残高・意味とデータ整合を見る");
    expect(componentSource).toContain("4項目の合計と前年差が一致");
    expect(componentSource).toContain("資本剰余金");
    expect(componentSource).toContain("利益剰余金");
    expect(componentSource).toContain("その他有価証券評価差額");
    expect(componentSource).toContain("各団体の剰余金計算書等で確認する必要があります");
    expect(componentSource).toContain("formatSourceThousandYen(analysis.prior)");
    expect(componentSource).toContain("formatSourceThousandYen(analysis.current)");
    expect(componentSource).not.toContain("丸め差の範囲");
    expect(componentSource).toContain("純資産総額と4項目の合計に差額があります");
    expect(componentSource).toContain("netAssets.componentsReconciled === false");
  });
});
