export const COST_COMPOSITION_ITEM_DEFINITIONS = [
  { id: "personnel", label: "職員給与費", sourceKey: "personnelCost", note: "職員の給与・手当・退職給付費・法定福利費など" },
  { id: "interest", label: "支払利息", sourceKey: "interestCost", note: "企業債などの資金調達に伴う利息" },
  { id: "depreciation", label: "減価償却費", sourceKey: "depreciationCost", note: "施設・設備の取得額を使用年数に分けて計上した費用。今期の現金支出とは限りません" },
  { id: "power", label: "動力費", sourceKey: "powerCost", note: "ポンプや処理設備を動かす電力・燃料など" },
  { id: "utilities", label: "光熱水費", sourceKey: "utilitiesCost", note: "事業所などの照明・水道・冷暖房など" },
  { id: "communications", label: "通信運搬費", sourceKey: "communicationsCost", note: "通信や物品の運搬にかかる費用" },
  { id: "repair", label: "修繕費", sourceKey: "repairCost", note: "施設・設備を維持するための修理費用" },
  { id: "materials", label: "材料費", sourceKey: "materialCost", note: "維持修繕に使う材料の費用" },
  { id: "chemicals", label: "薬品費", sourceKey: "chemicalCost", note: "処理場・ポンプ場で使う薬品の費用" },
  { id: "road-restoration", label: "路面復旧費", sourceKey: "roadRestorationCost", note: "管渠工事などに伴う道路の復旧費用" },
  { id: "outsourcing", label: "委託料", sourceKey: "outsourcingCost", note: "維持管理・点検・汚泥処分などを外部へ委託した費用" },
  { id: "regional-sewerage-contribution", label: "流域下水道管理運営費負担金", sourceKey: "flowSewerBurdenCost", note: "流域下水道を利用するための管理運営費負担金" },
  { id: "other", label: "その他", sourceKey: "otherCost", note: "上記の費目に含まれない費用" }
] as const;
