import { FREE_COLUMNS, FREE_COSTS, type FieldPosition } from "./freeDataset2020";

export type SourceField = FieldPosition & { accounting: string };
export const sourceFieldLabel = (field: FieldPosition) => `${field.label}（${field.unit}） [${field.id}]`;
export function freeSourceTaxBasis(field: FieldPosition, accounting: string) {
  if (field.id === "householdFee20m3Yen") return "税込";
  if (field.unit.startsWith("千円")) return accounting === "legal_applied" ? "税抜" : "税込";
  return "金額以外";
}

/** A human-readable dependency graph; formulas are documentation, never executable CSV cells. */
export function freeCalculationDefinitions(fields: SourceField[]) {
  const sourceFields = new Set(fields.map(f => f.id));
  return FREE_COLUMNS.map(column => {
    let inputs: string[] = [];
    let formula = column.definition;
    let conditions = "原資料の年度・団体・事業・会計を保持。異年度補完なし";
    let kind = "識別・状態";
    if (sourceFields.has(column.id)) {
      inputs = [column.id]; kind = "原値"; formula = "input-values.csv の同じ行識別子・項目IDを転記";
      conditions = "原資料の欠損記号・空欄は算定用CSVでは空欄。実際の0は0。法非適用の第20/21表内訳は対象外";
    }
    const ratio = {
      expenseRecoveryRate: ["sewerFeeRevenue", "wastewaterTreatmentCost", "100"],
      feeUnitPrice: ["sewerFeeRevenue", "annualBillableVolume", "1000"],
      treatmentCost: ["wastewaterTreatmentCost", "annualBillableVolume", "1000"],
    }[column.id];
    if (ratio) {
      inputs = ratio.slice(0, 2); kind = "算定";
      formula = `${ratio[0]} × ${ratio[2]} ÷ ${ratio[1]}`;
      conditions = "分子が0以上・分母が正の有限値の場合のみ。欠損・負の分子・0以下の分母は空欄。小数第4位まで丸める";
      conditions += "。原表の税区分を保持（法適用は税抜、法非適用は税込）。税区分を統一した単価比較ではない";
    }
    for (const cost of FREE_COSTS) {
      const suffix = column.id.slice(cost.id.length + 1);
      if (!column.id.startsWith(`${cost.id}_`)) continue;
      kind = "算定";
      const annual = `${cost.id}_annual`, unit = `${cost.id}_unit`, median = `${cost.id}_median`;
      const peerScope = "同県・2020年度・公共下水道・法適用・年間有収水量が正・当該単位費用が有限の事業会計を各1票（自事業を含む）";
      if (suffix === "annual") { inputs = [...cost.keys]; formula = cost.keys.join(" ＋ "); conditions = "全入力が存在するときだけ合計。欠損を0にしない。原資料の負値は保持"; }
      if (suffix === "unit") { inputs = [annual, "annualBillableVolume"]; formula = `${annual} × 1000 ÷ annualBillableVolume`; conditions = "年額が0以上・水量が正の場合のみ。欠損・負の年額・0以下の水量は空欄。丸めなし"; }
      if (suffix === "share") { inputs = [annual, cost.denominator]; formula = `${annual} ÷ ${cost.denominator} × 100`; conditions = "年額が0以上・分母が正の場合のみ。その他は空欄。丸めなし。目的別と性質別は合算不可"; }
      if (suffix === "median") { inputs = [unit, "prefectureCode", "comparisonEligible"]; formula = `MEDIAN(比較対象の ${unit})`; conditions = `${peerScope}。自身が比較対象外・比較件数0なら空欄`; }
      if (suffix === "difference") { inputs = [unit, median]; formula = `${unit} − ${median}`; conditions = "自身が比較対象・単位費用と中央値が両方存在する場合のみ。その他は空欄。平均との差ではない"; }
      if (suffix === "count") { inputs = [unit, "prefectureCode", "comparisonEligible"]; formula = `COUNT(比較対象の ${unit})`; conditions = `${peerScope}。自身が対象外でも県内の比較可能件数を表示。母集団0件は実数0`; }
      if (suffix === "state") { inputs = [...cost.keys, "annualBillableVolume", "accountingType"]; kind = "状態"; formula = "適用範囲 → 原値欠損 → 負値 → 水量不足 → 収録の順に判定"; conditions = column.definition; }
      if (cost.group !== "component") conditions += "。費用内訳の算定は法適用のみ";
    }
    const positions = inputs.flatMap(id => fields.filter(f => f.id === id).map(f => `${id}: ${f.accounting === "legal_applied" ? "法適用" : "法非適用"} 第${f.table}表 行番号${f.row} 列${String(f.col).padStart(3, "0")}`));
    return { "項目ID": column.id, "CSV列名": column.label, "種類": kind, "入力項目ID": inputs.join(" | "), "算定式・転記方法": formula, "算定条件・欠損・丸め": conditions, "原資料位置（直接入力）": positions.join(" / "), "追跡方法": "派生項目の入力IDはこの表を再参照。原値IDはinput-values.csvとsources.csvで照合。原表行の位置はsource-records.csv" };
  });
}
