export type FieldDefinition = {
  label: string;
  meaning: string;
  unit: string;
  sourceTable: string;
  role: string;
};

export const fieldDefinitions: Record<string, FieldDefinition> = {
  sewerFeeRevenue: {
    label: "下水道使用料収入",
    meaning: "使用者から徴収した下水道使用料収入です。使用料単価と経費回収率の分子になります。",
    unit: "千円",
    sourceTable: "法適用: 損益計算書 / 法非適用: 歳入歳出決算に関する調",
    role: "使用料水準"
  },
  householdFee20m3Yen: {
    label: "一般家庭用20m³／月使用料",
    meaning: "一般家庭が1か月に20m³使用した場合の料金表上の税込使用料です。全利用者の実績平均である使用料単価とは別の指標です。",
    unit: "円／月（税込）",
    sourceTable: "経営分析に関する調（二）",
    role: "家庭用料金"
  },
  annualBillableVolume: {
    label: "年間有収水量",
    meaning: "使用料徴収の対象となった年間水量です。1m³あたり単価や原価を計算する分母になります。",
    unit: "m³",
    sourceTable: "施設及び業務概況に関する調",
    role: "水量"
  },
  wastewaterTreatmentCost: {
    label: "汚水処理費",
    meaning: "汚水処理に要した費用のうち、公費負担分等を除いて経費回収率の分母となる費用です。",
    unit: "千円",
    sourceTable: "経営分析に関する調（一）",
    role: "費用"
  },
  opexComponent: {
    label: "汚水処理費（維持管理費分）",
    meaning: "汚水処理費のうち、施設運転・維持管理など日常運営に係る費用です。",
    unit: "千円",
    sourceTable: "経営分析に関する調（一）",
    role: "費用内訳"
  },
  capitalCostComponent: {
    label: "汚水処理費（資本費分）",
    meaning: "汚水処理費のうち、減価償却費や企業債利息など資本費に係る費用です。",
    unit: "千円",
    sourceTable: "経営分析に関する調（一）",
    role: "費用内訳"
  },
  operatingRevenue: {
    label: "営業収益",
    meaning: "下水道事業の本来業務から生じる収益です。下水道使用料のほか、正当な公費負担である雨水処理負担金等も含み、営業費用との差が営業利益または営業損失になります。",
    unit: "千円",
    sourceTable: "損益計算書",
    role: "会計収益"
  },
  operatingExpense: {
    label: "営業費用",
    meaning: "下水道事業の本来業務に必要な費用です。営業収益との比較は営業損益を見る分析であり、使用料で賄うべき汚水処理費とは範囲が異なります。",
    unit: "千円",
    sourceTable: "損益計算書",
    role: "会計費用"
  },
  rainwaterBurdenRevenue: {
    label: "雨水処理負担金",
    meaning: "「雨水公費」の考え方に基づき、一般会計等が負担する雨水処理分です。損益計算書では営業収益に含まれます。",
    unit: "千円",
    sourceTable: "損益計算書",
    role: "公費負担"
  },
  otherAccountSubsidyRevenue: {
    label: "他会計補助金（営業外収益）",
    meaning: "損益計算書の営業外収益に計上される他会計からの補助金です。繰出基準内の補助も含み得るため、基準外繰入金や営業損失の直接の補填額とは一致しません。",
    unit: "千円",
    sourceTable: "損益計算書",
    role: "会計収益"
  },
  ordinaryRevenue: {
    label: "経常収益",
    meaning: "営業収益と営業外収益を含めた通常の事業活動による収益です。",
    unit: "千円",
    sourceTable: "損益計算書",
    role: "会計収益"
  },
  ordinaryExpense: {
    label: "経常費用",
    meaning: "営業費用と営業外費用を含めた通常の事業活動による費用です。",
    unit: "千円",
    sourceTable: "損益計算書",
    role: "会計費用"
  },
  ordinaryProfitLoss: {
    label: "経常損益",
    meaning: "経常収益から経常費用を差し引いた損益です。会計上の黒字・赤字判定に使います。",
    unit: "千円",
    sourceTable: "損益計算書",
    role: "会計収支"
  },
  netIncome: {
    label: "当年度純損益",
    meaning: "当年度の最終的な純利益または純損失です。",
    unit: "千円",
    sourceTable: "損益計算書",
    role: "会計収支"
  },
  accumulatedDeficit: {
    label: "累積欠損金",
    meaning: "過年度から積み上がった未処理欠損金です。財務余力の確認に使います。",
    unit: "千円",
    sourceTable: "貸借対照表",
    role: "財務状態"
  },
  totalRevenueNonLegal: {
    label: "総収益",
    meaning: "法非適用事業の収益的収入の合計です。",
    unit: "千円",
    sourceTable: "歳入歳出決算に関する調",
    role: "会計収益"
  },
  totalExpenseNonLegal: {
    label: "総費用",
    meaning: "法非適用事業の収益的支出の合計です。",
    unit: "千円",
    sourceTable: "歳入歳出決算に関する調",
    role: "会計費用"
  },
  realBalance: {
    label: "実質収支",
    meaning: "法非適用事業で、形式収支から翌年度へ繰り越すべき財源を除いた収支です。",
    unit: "千円",
    sourceTable: "歳入歳出決算に関する調",
    role: "会計収支"
  },
  revenueExpenditureRatio: {
    label: "収益的収支比率",
    meaning: "法非適用事業で、総費用と地方債償還金の合計に対する総収益の割合です。",
    unit: "%",
    sourceTable: "経営分析に関する調（一）",
    role: "会計収支"
  },
  generalAccountTransfer: {
    label: "一般会計繰入金（法非適用）",
    meaning: "法非適用事業について、一般会計から下水道事業会計へ繰り入れられた金額です。法適用事業の公開表示には使用しません。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  standardTransfer: {
    label: "基準内繰入金",
    meaning: "総務省の繰出基準に基づく一般会計繰入金です。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  nonStandardTransfer: {
    label: "基準外繰入金",
    meaning: "総務省の繰出基準に基づかない一般会計等からの繰入金です。使用料収入の不足額、営業損失、損益計算書の他会計補助金とは範囲が異なります。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  table40RainwaterBurden: {
    label: "雨水処理負担金（第40表・実額）",
    meaning: "総務省『繰入金に関する調』第40表の雨水処理負担金の実繰入額です。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  table40OtherAccountSubsidy: {
    label: "他会計補助金（第40表・実額）",
    meaning: "第40表の収益勘定における他会計補助金の実繰入額です。基準内・基準外の双方を含み得ます。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  table40CapitalOtherAccountSubsidy: {
    label: "資本勘定の他会計補助金（第40表・実額）",
    meaning: "第40表の資本勘定における他会計補助金の実繰入額です。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  table40RainwaterBurdenNonStandard: {
    label: "雨水処理負担金（第40表・基準外）",
    meaning: "第40表で雨水処理負担金に区分された基準外繰入額です。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  table40OtherAccountSubsidyNonStandard: {
    label: "他会計補助金（第40表・基準外）",
    meaning: "第40表で収益勘定の他会計補助金に区分された基準外繰入額です。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  table40CapitalOtherAccountSubsidyNonStandard: {
    label: "資本勘定の他会計補助金（第40表・基準外）",
    meaning: "第40表で資本勘定の他会計補助金に区分された基準外繰入額です。",
    unit: "千円",
    sourceTable: "繰入金に関する調",
    role: "繰入金"
  },
  bondBalance: {
    label: "企業債・地方債残高",
    meaning: "年度末時点で残っている企業債または地方債の未償還残高です。",
    unit: "千円",
    sourceTable: "企業債・地方債に関する調",
    role: "債務"
  },
  bondIssued: {
    label: "企業債・地方債発行額",
    meaning: "当年度に新たに発行した企業債または地方債の金額です。",
    unit: "千円",
    sourceTable: "企業債・地方債に関する調",
    role: "債務"
  },
  bondRedemption: {
    label: "企業債・地方債償還額",
    meaning: "当年度に償還した企業債または地方債の金額です。",
    unit: "千円",
    sourceTable: "企業債・地方債に関する調",
    role: "債務"
  },
  servicePopulation: {
    label: "処理区域内人口",
    meaning: "下水道で汚水処理を行える区域内の人口です。",
    unit: "人",
    sourceTable: "施設及び業務概況に関する調",
    role: "人口"
  },
  connectedPopulation: {
    label: "水洗便所設置済人口",
    meaning: "処理区域内で実際に水洗化されている人口です。水洗化率の分子になります。",
    unit: "人",
    sourceTable: "施設及び業務概況に関する調",
    role: "人口"
  },
  treatedVolume: {
    label: "汚水処理水量",
    meaning: "年間に処理した汚水量です。有収率などの確認に使います。",
    unit: "m³",
    sourceTable: "施設及び業務概況に関する調",
    role: "水量"
  }
};

export function getFieldDefinition(field: string) {
  return fieldDefinitions[field] ?? {
    label: field,
    meaning: "原資料から取り込んだ補助項目です。詳細は原資料の表名と項目名を確認してください。",
    unit: "不明",
    sourceTable: "原資料",
    role: "補助項目"
  };
}
