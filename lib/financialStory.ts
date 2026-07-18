export type FinancialValue = number | null | undefined;

export type FinancialBreakdownGroup = "operating" | "non-operating" | "extraordinary";

export type FinancialBreakdownItem = {
  id?: string;
  label: string;
  value: FinancialValue;
  note?: string;
  group?: FinancialBreakdownGroup;
};

export type FinancialIncome = {
  totalRevenue: FinancialValue;
  totalExpense: FinancialValue;
  operatingRevenue: FinancialValue;
  nonOperatingRevenue?: FinancialValue;
  extraordinaryProfit?: FinancialValue;
  operatingExpense: FinancialValue;
  nonOperatingExpense?: FinancialValue;
  extraordinaryLoss?: FinancialValue;
  netIncome: FinancialValue;
  revenueBreakdown: FinancialBreakdownItem[];
  expenseBreakdown: FinancialBreakdownItem[];
};

export type FinancialBalance = {
  fixedAssets: FinancialValue;
  currentAssets: FinancialValue;
  deferredAssets: FinancialValue;
  totalAssets: FinancialValue;
  fixedLiabilities: FinancialValue;
  currentLiabilities: FinancialValue;
  deferredRevenue: FinancialValue;
  totalLiabilities: FinancialValue;
  capital: FinancialValue;
  surplus: FinancialValue;
  capitalSurplus?: FinancialValue;
  retainedEarnings?: FinancialValue;
  otherSecuritiesValuationDifference?: FinancialValue;
  totalNetAssets: FinancialValue;
  priorNetAssets: FinancialValue;
  priorCapital?: FinancialValue;
  priorSurplus?: FinancialValue;
  priorCapitalSurplus?: FinancialValue;
  priorRetainedEarnings?: FinancialValue;
  priorOtherSecuritiesValuationDifference?: FinancialValue;
};

export type FinancialStoryStatus = {
  state: "ready" | "partial" | "unavailable";
  label?: string;
  message?: string;
};

export type FinancialTraceItem = {
  id?: string;
  label: string;
  table?: string;
  sourceUrl?: string;
  note?: string;
};

export type FinancialStoryDisplayModel = {
  year: string | number;
  accountingType: string | null;
  income: FinancialIncome | null;
  balance: FinancialBalance | null;
  status?: FinancialStoryStatus | null;
  trace?: FinancialTraceItem[] | null;
};

export type MoneyScale = {
  divisor: 1 | 1_000 | 100_000;
  unit: "千円" | "百万円" | "億円";
  maximumFractionDigits: 0 | 1;
};

export type PreparedBreakdownItem = {
  id: string;
  label: string;
  value: number;
  share: number;
  note?: string;
  derived?: boolean;
};

export type PreparedBreakdown = {
  items: PreparedBreakdownItem[];
  state: "ready" | "partial" | "limited" | "invalid";
  messages: string[];
};

export type IncomeEquation = {
  total: number | null;
  left: PreparedBreakdownItem[];
  right: PreparedBreakdownItem[];
  leftTotal: number | null;
  rightTotal: number | null;
  difference: number | null;
  reconciled: boolean | null;
  resultSide: "left" | "right" | "none";
};

export type IncomeAnalysis = {
  available: boolean;
  visualizable: boolean;
  state: "ready" | "partial" | "limited" | "invalid" | "unavailable";
  totalRevenue: number | null;
  totalExpense: number | null;
  operatingRevenue: number | null;
  nonOperatingRevenue: number | null;
  extraordinaryProfit: number | null;
  operatingExpense: number | null;
  nonOperatingExpense: number | null;
  extraordinaryLoss: number | null;
  netIncome: number | null;
  gap: number | null;
  revenueCoverageRate: number | null;
  revenue: PreparedBreakdown;
  expense: PreparedBreakdown;
  majorRevenue: PreparedBreakdown;
  majorExpense: PreparedBreakdown;
  equation: IncomeEquation;
  scale: MoneyScale;
  messages: string[];
};

export type BalanceAnalysis = {
  available: boolean;
  visualizable: boolean;
  state: "ready" | "partial" | "limited" | "invalid" | "unavailable";
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalNetAssets: number | null;
  fundingTotal: number | null;
  balanceDifference: number | null;
  reconciled: boolean | null;
  debtRatio: number | null;
  netAssetsRatio: number | null;
  assets: PreparedBreakdown;
  liabilities: PreparedBreakdown;
  netAssets: PreparedBreakdown;
  scale: MoneyScale;
  messages: string[];
};

export type NetAssetsChangeAnalysis = {
  available: boolean;
  prior: number | null;
  current: number | null;
  delta: number | null;
  percent: number | null;
  direction: "increase" | "decrease" | "flat" | "unknown";
  currentNetIncome: number | null;
  components: NetAssetsComponentChange[];
  componentDifference: number | null;
  priorComponentDifference: number | null;
  currentComponentDifference: number | null;
  componentsReconciled: boolean | null;
  scale: MoneyScale;
};

export type NetAssetsComponentChange = {
  id: "capital" | "capital-surplus" | "retained-earnings" | "valuation-difference";
  label: string;
  prior: number;
  current: number;
  delta: number;
};

export type FinancialStoryAnalysis = {
  income: IncomeAnalysis;
  balance: BalanceAnalysis;
  netAssetsChange: NetAssetsChangeAnalysis;
};

const DEFAULT_SCALE: MoneyScale = {
  divisor: 1,
  unit: "千円",
  maximumFractionDigits: 0
};

export function analyzeFinancialStory(model: FinancialStoryDisplayModel): FinancialStoryAnalysis {
  const income = analyzeIncome(model.income);
  const balance = analyzeBalance(model.balance);
  const netAssetsChange = analyzeNetAssetsChange(model.balance, model.income?.netIncome);
  return { income, balance, netAssetsChange };
}

export function chooseMoneyScale(values: FinancialValue[]): MoneyScale {
  const maximum = Math.max(
    0,
    ...values
      .map(toFiniteNumber)
      .filter((value): value is number => value != null)
      .map((value) => Math.abs(value))
  );

  if (maximum >= 100_000) {
    return { divisor: 100_000, unit: "億円", maximumFractionDigits: 1 };
  }
  if (maximum >= 1_000) {
    return { divisor: 1_000, unit: "百万円", maximumFractionDigits: 1 };
  }
  return DEFAULT_SCALE;
}

export function formatFinancialAmount(value: FinancialValue, scale: MoneyScale, withUnit = true) {
  const finite = toFiniteNumber(value);
  if (finite == null) return "取得できません";
  const scaled = finite / scale.divisor;
  const formatted = new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: scale.maximumFractionDigits
  }).format(scaled);
  return withUnit ? `${formatted}${scale.unit}` : formatted;
}

export function formatFinancialPercent(value: FinancialValue, digits = 1) {
  const finite = toFiniteNumber(value);
  if (finite == null) return "判定できません";
  return `${finite.toFixed(digits)}%`;
}

export function analyzeIncome(income: FinancialIncome | null): IncomeAnalysis {
  const totalRevenue = toFiniteNumber(income?.totalRevenue);
  const totalExpense = toFiniteNumber(income?.totalExpense);
  const operatingRevenue = toFiniteNumber(income?.operatingRevenue);
  const extraordinaryProfit = toFiniteNumber(income?.extraordinaryProfit);
  const nonOperatingRevenue = coalesceStatementSubtotal(
    income?.nonOperatingRevenue,
    totalRevenue,
    operatingRevenue,
    extraordinaryProfit
  );
  const operatingExpense = toFiniteNumber(income?.operatingExpense);
  const extraordinaryLoss = toFiniteNumber(income?.extraordinaryLoss);
  const nonOperatingExpense = coalesceStatementSubtotal(
    income?.nonOperatingExpense,
    totalExpense,
    operatingExpense,
    extraordinaryLoss
  );
  const netIncome = toFiniteNumber(income?.netIncome);
  const available = totalRevenue != null && totalExpense != null;
  const gap = available ? totalRevenue - totalExpense : null;
  const revenueCoverageRate = totalExpense != null && totalExpense > 0 && totalRevenue != null
    ? (totalRevenue / totalExpense) * 100
    : null;
  const scale = chooseMoneyScale([
    totalRevenue,
    totalExpense,
    operatingRevenue,
    nonOperatingRevenue,
    extraordinaryProfit,
    operatingExpense,
    nonOperatingExpense,
    extraordinaryLoss,
    netIncome,
    ...(income?.revenueBreakdown.map((item) => item.value) ?? []),
    ...(income?.expenseBreakdown.map((item) => item.value) ?? [])
  ]);

  const revenue = prepareBreakdown(totalRevenue, income?.revenueBreakdown ?? [], "収益合計");
  const expense = prepareBreakdown(totalExpense, income?.expenseBreakdown ?? [], "費用合計");
  const majorRevenue = prepareBreakdown(totalRevenue, [
    { id: "operating-revenue", label: "営業収益", value: operatingRevenue },
    { id: "non-operating-revenue", label: "営業外収益", value: nonOperatingRevenue },
    { id: "extraordinary-profit", label: "特別利益", value: extraordinaryProfit }
  ], "総収益");
  const majorExpense = prepareBreakdown(totalExpense, [
    { id: "operating-expense", label: "営業費用", value: operatingExpense },
    { id: "non-operating-expense", label: "営業外費用", value: nonOperatingExpense },
    { id: "extraordinary-loss", label: "特別損失", value: extraordinaryLoss }
  ], "総費用");
  const equation = buildIncomeEquation({
    totalRevenue,
    totalExpense,
    netIncome: netIncome ?? gap,
    majorRevenue,
    majorExpense
  });
  const messages = [
    ...revenue.messages,
    ...expense.messages,
    ...majorRevenue.messages,
    ...majorExpense.messages
  ];

  if (!available) {
    messages.unshift("総収益または総費用が未取得のため、損益の比較を表示できません。");
  } else if (Math.max(totalRevenue, totalExpense) <= 0 || totalRevenue < 0 || totalExpense < 0) {
    messages.unshift("総収益・総費用が負数またはともに0のため、勘定式の図を表示できません。");
  }

  if (available && netIncome != null && gap != null) {
    if (gap !== netIncome) {
      messages.push("総収益−総費用と当年度純損益が一致しません。原表の区分または丸め差を確認してください。");
    }
  }

  if (equation.reconciled === false) {
    messages.push("費用・損益の左列と収益・損益の右列が一致しません。勘定式の図を停止しました。");
  }

  const visualizable = Boolean(
    available &&
    totalRevenue >= 0 &&
    totalExpense >= 0 &&
    Math.max(totalRevenue, totalExpense) > 0 &&
    equation.reconciled === true
  );

  const state = !available
    ? "unavailable"
    : revenue.state === "invalid"
      || expense.state === "invalid"
      || majorRevenue.state === "invalid"
      || majorExpense.state === "invalid"
      || messages.some((message) => message.includes("一致しません"))
      ? "invalid"
      : !visualizable
        || revenue.state === "limited"
        || expense.state === "limited"
        || majorRevenue.state === "limited"
        || majorExpense.state === "limited"
        ? "limited"
        : revenue.state === "partial"
          || expense.state === "partial"
          || majorRevenue.state === "partial"
          || majorExpense.state === "partial"
        ? "partial"
        : "ready";

  return {
    available,
    visualizable,
    state,
    totalRevenue,
    totalExpense,
    operatingRevenue,
    nonOperatingRevenue,
    extraordinaryProfit,
    operatingExpense,
    nonOperatingExpense,
    extraordinaryLoss,
    netIncome,
    gap,
    revenueCoverageRate,
    revenue,
    expense,
    majorRevenue,
    majorExpense,
    equation,
    scale,
    messages: unique(messages)
  };
}

function coalesceStatementSubtotal(
  explicit: FinancialValue,
  total: number | null,
  primary: number | null,
  extraordinary: number | null
) {
  const provided = toFiniteNumber(explicit);
  if (provided != null) return provided;
  if (total == null || primary == null || extraordinary == null) return null;
  return total - primary - extraordinary;
}

function buildIncomeEquation({
  totalRevenue,
  totalExpense,
  netIncome,
  majorRevenue,
  majorExpense
}: {
  totalRevenue: number | null;
  totalExpense: number | null;
  netIncome: number | null;
  majorRevenue: PreparedBreakdown;
  majorExpense: PreparedBreakdown;
}): IncomeEquation {
  if (totalRevenue == null || totalExpense == null || netIncome == null) {
    return {
      total: null,
      left: [],
      right: [],
      leftTotal: null,
      rightTotal: null,
      difference: null,
      reconciled: null,
      resultSide: "none"
    };
  }

  const resultItem = {
    id: netIncome >= 0 ? "net-profit" : "net-loss",
    label: netIncome >= 0 ? "当年度純利益" : "当年度純損失",
    value: Math.abs(netIncome),
    share: 0
  } satisfies PreparedBreakdownItem;
  const left = [...majorExpense.items];
  const right = [...majorRevenue.items];
  const resultSide = netIncome > 0 ? "left" : netIncome < 0 ? "right" : "none";
  if (resultSide === "left") left.push(resultItem);
  if (resultSide === "right") right.push(resultItem);

  const leftTotal = left.reduce((sum, item) => sum + item.value, 0);
  const rightTotal = right.reduce((sum, item) => sum + item.value, 0);
  const total = Math.max(leftTotal, rightTotal, totalRevenue, totalExpense);
  const withShare = (items: PreparedBreakdownItem[]) => items.map((item) => ({
    ...item,
    share: total > 0 ? item.value / total : 0
  }));

  return {
    total,
    left: withShare(left),
    right: withShare(right),
    leftTotal,
    rightTotal,
    difference: leftTotal - rightTotal,
    reconciled: leftTotal === rightTotal,
    resultSide
  };
}

export function analyzeBalance(balance: FinancialBalance | null): BalanceAnalysis {
  const totalAssets = toFiniteNumber(balance?.totalAssets);
  const totalLiabilities = toFiniteNumber(balance?.totalLiabilities);
  const totalNetAssets = toFiniteNumber(balance?.totalNetAssets);
  const available = totalAssets != null && totalLiabilities != null && totalNetAssets != null;
  const fundingTotal = available ? totalLiabilities + totalNetAssets : null;
  const balanceDifference = totalAssets != null && fundingTotal != null ? totalAssets - fundingTotal : null;
  const reconciled = available ? balanceDifference === 0 : null;
  const hasNetAssetsDeficit = Boolean(available && reconciled && totalNetAssets < 0 && totalAssets >= 0 && totalLiabilities >= 0);
  const visualizable = Boolean(
    available &&
    reconciled === true &&
    totalAssets >= 0 &&
    totalLiabilities >= 0 &&
    totalNetAssets >= 0 &&
    totalAssets > 0 &&
    (fundingTotal ?? 0) > 0
  );

  const assets = prepareBreakdown(totalAssets, [
    { id: "fixed-assets", label: "固定資産", value: balance?.fixedAssets },
    { id: "current-assets", label: "流動資産", value: balance?.currentAssets },
    { id: "deferred-assets", label: "繰延資産", value: balance?.deferredAssets }
  ], "資産合計");
  const liabilities = prepareBreakdown(totalLiabilities, [
    { id: "fixed-liabilities", label: "固定負債", value: balance?.fixedLiabilities },
    { id: "current-liabilities", label: "流動負債", value: balance?.currentLiabilities },
    { id: "deferred-revenue", label: "繰延収益", value: balance?.deferredRevenue }
  ], "負債合計");
  const netAssets = prepareBreakdown(totalNetAssets, [
    { id: "capital", label: "資本金", value: balance?.capital },
    { id: "surplus", label: "剰余金", value: balance?.surplus },
    { id: "valuation-difference", label: "その他有価証券評価差額", value: balance?.otherSecuritiesValuationDifference }
  ], "純資産合計");

  const messages = [...assets.messages, ...liabilities.messages, ...netAssets.messages];
  if (!available) {
    messages.unshift("資産・負債・純資産のいずれかが未取得のため、貸借の比較を表示できません。");
  } else if (reconciled === false) {
    messages.unshift("資産合計と「負債＋純資産」が一致しません。原表または取込値を確認してください。");
  } else if (hasNetAssetsDeficit) {
    messages.unshift("純資産がマイナスで、負債が資産を上回っています。債務超過として別の図で示します。");
  } else if (!visualizable) {
    messages.unshift("負数または0を含むため、標準的な金額比例のボックス図では貸借を表示できません。数値表で確認してください。");
  }

  const state = !available
    ? "unavailable"
    : reconciled === false
      ? "invalid"
      : hasNetAssetsDeficit
        || !visualizable
        || assets.state === "limited"
        || liabilities.state === "limited"
        || netAssets.state === "limited"
        || assets.state === "invalid"
        || liabilities.state === "invalid"
        || netAssets.state === "invalid"
        ? "limited"
        : assets.state === "partial" || liabilities.state === "partial" || netAssets.state === "partial"
        ? "partial"
        : "ready";

  const scale = chooseMoneyScale([
    totalAssets,
    totalLiabilities,
    totalNetAssets,
    fundingTotal,
    balanceDifference,
    balance?.fixedAssets,
    balance?.currentAssets,
    balance?.deferredAssets,
    balance?.fixedLiabilities,
    balance?.currentLiabilities,
    balance?.deferredRevenue,
    balance?.capital,
    balance?.surplus,
    balance?.otherSecuritiesValuationDifference,
    balance?.priorNetAssets
  ]);

  return {
    available,
    visualizable,
    state,
    totalAssets,
    totalLiabilities,
    totalNetAssets,
    fundingTotal,
    balanceDifference,
    reconciled,
    debtRatio: totalAssets != null && totalAssets > 0 && totalLiabilities != null ? (totalLiabilities / totalAssets) * 100 : null,
    netAssetsRatio: totalAssets != null && totalAssets > 0 && totalNetAssets != null ? (totalNetAssets / totalAssets) * 100 : null,
    assets,
    liabilities,
    netAssets,
    scale,
    messages: unique(messages)
  };
}

export function analyzeNetAssetsChange(
  balance: FinancialBalance | null,
  currentNetIncomeInput?: FinancialValue
): NetAssetsChangeAnalysis {
  const prior = toFiniteNumber(balance?.priorNetAssets);
  const current = toFiniteNumber(balance?.totalNetAssets);
  const available = prior != null && current != null;
  const delta = available ? current - prior : null;
  const percent = available && prior > 0 ? ((current - prior) / prior) * 100 : null;
  const direction = delta == null
    ? "unknown"
    : delta === 0
      ? "flat"
      : delta > 0
        ? "increase"
        : "decrease";
  const components = netAssetsComponentChanges(balance);
  const componentTotal = components.length === 4
    ? components.reduce((sum, component) => sum + component.delta, 0)
    : null;
  const componentDifference = delta != null && componentTotal != null ? delta - componentTotal : null;
  const priorComponentTotal = components.length === 4
    ? components.reduce((sum, component) => sum + component.prior, 0)
    : null;
  const currentComponentTotal = components.length === 4
    ? components.reduce((sum, component) => sum + component.current, 0)
    : null;
  const priorComponentDifference = prior != null && priorComponentTotal != null ? prior - priorComponentTotal : null;
  const currentComponentDifference = current != null && currentComponentTotal != null ? current - currentComponentTotal : null;
  const reconciliationDifferences = [componentDifference, priorComponentDifference, currentComponentDifference];
  const currentNetIncome = toFiniteNumber(currentNetIncomeInput);

  return {
    available,
    prior,
    current,
    delta,
    percent,
    direction,
    currentNetIncome,
    components,
    componentDifference,
    priorComponentDifference,
    currentComponentDifference,
    componentsReconciled: reconciliationDifferences.some((difference) => difference == null)
      ? null
      : reconciliationDifferences.every((difference) => difference === 0),
    scale: chooseMoneyScale([
      prior,
      current,
      delta,
      currentNetIncome,
      ...components.flatMap((component) => [component.prior, component.current, component.delta])
    ])
  };
}

function netAssetsComponentChanges(balance: FinancialBalance | null): NetAssetsComponentChange[] {
  const definitions = [
    {
      id: "capital" as const,
      label: "資本金",
      prior: balance?.priorCapital,
      current: balance?.capital
    },
    {
      id: "capital-surplus" as const,
      label: "資本剰余金",
      prior: balance?.priorCapitalSurplus,
      current: balance?.capitalSurplus
    },
    {
      id: "retained-earnings" as const,
      label: "利益剰余金",
      prior: balance?.priorRetainedEarnings,
      current: balance?.retainedEarnings
    },
    {
      id: "valuation-difference" as const,
      label: "その他有価証券評価差額",
      prior: balance?.priorOtherSecuritiesValuationDifference,
      current: balance?.otherSecuritiesValuationDifference
    }
  ];

  const components = definitions.map((definition) => {
    const priorValue = toFiniteNumber(definition.prior);
    const currentValue = toFiniteNumber(definition.current);
    if (priorValue == null || currentValue == null) return null;
    return {
      id: definition.id,
      label: definition.label,
      prior: priorValue,
      current: currentValue,
      delta: currentValue - priorValue
    } satisfies NetAssetsComponentChange;
  });

  return components.every((component) => component != null)
    ? components as NetAssetsComponentChange[]
    : [];
}

export function prepareBreakdown(
  totalInput: FinancialValue,
  sourceItems: FinancialBreakdownItem[],
  fallbackLabel: string
): PreparedBreakdown {
  const total = toFiniteNumber(totalInput);
  if (total == null) {
    return {
      items: [],
      state: "invalid",
      messages: [`${fallbackLabel}が未取得のため、内訳を表示できません。`]
    };
  }
  if (total < 0) {
    return {
      items: [],
      state: "limited",
      messages: [`${fallbackLabel}がマイナスのため、通常の積み上げ図では表示しません。`]
    };
  }

  const messages: string[] = [];
  const provided = sourceItems.filter((item) => item.label.trim().length > 0);
  const invalidItems = provided.filter((item) => {
    const value = toFiniteNumber(item.value);
    return value == null || value < 0;
  });
  const hasNegativeItems = invalidItems.some((item) => (toFiniteNumber(item.value) ?? 0) < 0);
  const hasMissingItems = invalidItems.some((item) => toFiniteNumber(item.value) == null);
  const validItems = provided
    .map((item, index) => ({ ...item, id: item.id ?? `${fallbackLabel}-${index}`, value: toFiniteNumber(item.value) }))
    .filter((item): item is FinancialBreakdownItem & { id: string; value: number } => item.value != null && item.value >= 0)
    .filter((item) => item.value > 0);

  if (hasMissingItems) messages.push("未取得の内訳は金額比例のボックス図に積み上げていません。");
  if (hasNegativeItems) messages.push("マイナスの調整項目があるため、内訳は総額だけを表示します。");

  const knownTotal = validItems.reduce((sum, item) => sum + item.value, 0);
  const tolerance = reconciliationTolerance(total);
  if (knownTotal > total + tolerance) {
    return {
      items: total > 0 ? [{ id: `${fallbackLabel}-total`, label: fallbackLabel, value: total, share: 1, derived: true }] : [],
      state: hasNegativeItems ? "limited" : "invalid",
      messages: unique([
        ...messages,
        hasNegativeItems
          ? "マイナス調整後の総額と正の内訳を同じ積み上げ図にできないため、総額だけを示しています。"
          : "内訳の合計が総額を上回るため、総額だけを表示しています。"
      ])
    };
  }

  const remainder = Math.max(0, total - knownTotal);
  const visualItems: PreparedBreakdownItem[] = validItems.map((item) => ({
    id: item.id,
    label: item.label,
    value: item.value,
    share: total > 0 ? item.value / total : 0,
    note: item.note
  }));

  if (remainder > tolerance) {
    const hasUnclassifiedMissingValues = invalidItems.length > 0;
    visualItems.push({
      id: `${fallbackLabel}-other`,
      label: validItems.length === 0
        ? "内訳未取得"
        : hasUnclassifiedMissingValues
          ? "その他・未取得分"
          : "その他",
      value: remainder,
      share: total > 0 ? remainder / total : 0,
      derived: true
    });
    if (hasUnclassifiedMissingValues) {
      messages.push("総額と取得済み内訳の差額を「その他・未取得分」として示しています。");
    }
  }

  if (total > 0 && visualItems.length === 0) {
    visualItems.push({ id: `${fallbackLabel}-total`, label: "内訳未取得", value: total, share: 1, derived: true });
    messages.push("総額のみ取得済みで、内訳は未取得です。");
  }

  return {
    items: visualItems,
    state: hasNegativeItems ? "limited" : messages.length > 0 ? "partial" : "ready",
    messages: unique(messages)
  };
}

export function reconciliationTolerance(_base: number) {
  return 0;
}

function toFiniteNumber(value: FinancialValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
