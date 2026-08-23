export const FUND_SHORTAGE_SCHEMA_VERSION = 1 as const;
export const FUND_SHORTAGE_THRESHOLD_PERCENT = 20 as const;

export type FundShortageStatus = "shortage" | "no_shortage" | "unavailable";
export type FundShortageAccountingType = "legal_applied" | "non_legal_applied";
export type FundShortageWorkCode = "46" | "47";

export type FundShortageDatasetSources = {
  landingPageUrl: string;
  positiveListUrl: string;
  legalAppliedUniverseUrl: string;
  nonLegalAppliedUniverseUrl: string;
};

export type FundShortageUniverseRow = {
  fiscalYear: number;
  municipalityCode: string;
  municipalityName: string;
  prefectureCode: string;
  workCode: FundShortageWorkCode;
  accountingType: FundShortageAccountingType;
  accountUnit: string;
  businessKey: string;
};

export type OfficialPositiveFundShortageRow = {
  prefectureName: string;
  prefectureCode: string;
  municipalityName: string;
  accountName: string;
  amountThousandYen: number;
  ratioPercent: number;
};

export type FundShortageAccountRecord = {
  accountKey: string;
  municipalityCode: string;
  municipalityName: string;
  prefectureCode: string;
  workCode: FundShortageWorkCode;
  accountingType: FundShortageAccountingType;
  accountUnit: string;
  businessKeys: string[];
  accountName?: string;
  amountThousandYen?: number;
  ratioPercent?: number;
};

export type FundShortageStaticDataset = {
  schemaVersion: typeof FUND_SHORTAGE_SCHEMA_VERSION;
  fiscalYear: number;
  fiscalYearLabel: string;
  releaseLabel: string;
  thresholdPercent: typeof FUND_SHORTAGE_THRESHOLD_PERCENT;
  universeComplete: true;
  sources: FundShortageDatasetSources;
  accounts: FundShortageAccountRecord[];
};

export type FundShortageAssessment = {
  status: FundShortageStatus;
  fiscalYear: number;
  fiscalYearLabel: string;
  releaseLabel: string;
  municipalityCode: string;
  municipalityName: string | null;
  accountingType: FundShortageAccountingType | null;
  accountKey: string | null;
  accountName: string | null;
  accountUnit: string | null;
  ratioPercent: number | null;
  amountThousandYen: number | null;
  thresholdPercent: typeof FUND_SHORTAGE_THRESHOLD_PERCENT;
  isAtOrAboveManagementImprovementThreshold: boolean | null;
  sharedBusinessKeys: string[];
  unavailableReason: "account_not_found" | "ambiguous_account" | null;
  sourceUrls: {
    landingPage: string;
    positiveList: string;
    accountUniverse: string[];
  };
};

export type BuildFundShortageDatasetInput = {
  fiscalYear: number;
  fiscalYearLabel: string;
  releaseLabel: string;
  sources: FundShortageDatasetSources;
  universeRows: FundShortageUniverseRow[];
  positiveRows: OfficialPositiveFundShortageRow[];
};

export function fundShortageAssessmentSelectionKey(input: {
  businessKey: string;
  accountingType?: string | null;
}) {
  return `${input.businessKey}::${input.accountingType ?? "unknown"}`;
}

export function buildFundShortageStaticDataset({
  fiscalYear,
  fiscalYearLabel,
  releaseLabel,
  sources,
  universeRows,
  positiveRows
}: BuildFundShortageDatasetInput): FundShortageStaticDataset {
  const accountMap = new Map<string, FundShortageAccountRecord>();

  for (const row of universeRows) {
    if (row.fiscalYear !== fiscalYear) continue;
    const accountKey = fundShortageAccountKey(row);
    const existing = accountMap.get(accountKey);
    if (existing) {
      if (
        existing.municipalityName !== row.municipalityName
        || existing.prefectureCode !== row.prefectureCode
        || existing.accountingType !== row.accountingType
      ) {
        throw new Error(`e-Stat会計キーの属性が一致しません: ${accountKey}`);
      }
      if (!existing.businessKeys.includes(row.businessKey)) {
        existing.businessKeys.push(row.businessKey);
      }
      continue;
    }

    accountMap.set(accountKey, {
      accountKey,
      municipalityCode: row.municipalityCode,
      municipalityName: row.municipalityName,
      prefectureCode: row.prefectureCode,
      workCode: row.workCode,
      accountingType: row.accountingType,
      accountUnit: row.accountUnit,
      businessKeys: [row.businessKey]
    });
  }

  const accounts = [...accountMap.values()];
  for (const positive of positiveRows) {
    const matched = matchPositiveAccount(accounts, positive);
    if (matched.accountName != null) {
      throw new Error(`総務省の資金不足会計が重複しています: ${matched.accountKey}`);
    }
    matched.accountName = positive.accountName;
    matched.amountThousandYen = positive.amountThousandYen;
    // 0.0% is an official rounded value for a positive shortage row and must be retained.
    matched.ratioPercent = positive.ratioPercent;
  }

  for (const account of accounts) {
    account.businessKeys.sort((a, b) => a.localeCompare(b, "ja"));
  }
  accounts.sort((a, b) => a.accountKey.localeCompare(b.accountKey, "ja"));

  return {
    schemaVersion: FUND_SHORTAGE_SCHEMA_VERSION,
    fiscalYear,
    fiscalYearLabel,
    releaseLabel,
    thresholdPercent: FUND_SHORTAGE_THRESHOLD_PERCENT,
    universeComplete: true,
    sources,
    accounts
  };
}

export function findFundShortageAssessment(
  dataset: FundShortageStaticDataset,
  input: {
    municipalityCode: string;
    businessKey: string;
    accountingType?: string | null;
  }
): FundShortageAssessment {
  const municipalityCode = normalizeMunicipalityCode(input.municipalityCode);
  const businessKey = normalizeBusinessKey(input.businessKey);
  const accountingType = normalizeAccountingType(input.accountingType);
  const candidates = dataset.accounts.filter((account) => (
    account.municipalityCode === municipalityCode
    && account.businessKeys.includes(businessKey)
    && (accountingType == null || account.accountingType === accountingType)
  ));

  if (candidates.length !== 1) {
    return unavailableAssessment(
      dataset,
      municipalityCode,
      accountingType,
      candidates.length === 0 ? "account_not_found" : "ambiguous_account"
    );
  }

  const account = candidates[0];
  const hasShortage = account.accountName != null
    && account.amountThousandYen != null
    && account.ratioPercent != null;
  const accountUniverse = account.accountingType === "legal_applied"
    ? dataset.sources.legalAppliedUniverseUrl
    : dataset.sources.nonLegalAppliedUniverseUrl;

  return {
    status: hasShortage ? "shortage" : "no_shortage",
    fiscalYear: dataset.fiscalYear,
    fiscalYearLabel: dataset.fiscalYearLabel,
    releaseLabel: dataset.releaseLabel,
    municipalityCode: account.municipalityCode,
    municipalityName: account.municipalityName,
    accountingType: account.accountingType,
    accountKey: account.accountKey,
    accountName: account.accountName ?? null,
    accountUnit: account.accountUnit,
    ratioPercent: account.ratioPercent ?? null,
    amountThousandYen: account.amountThousandYen ?? null,
    thresholdPercent: dataset.thresholdPercent,
    isAtOrAboveManagementImprovementThreshold: hasShortage
      ? account.ratioPercent! >= dataset.thresholdPercent
      : false,
    sharedBusinessKeys: [...account.businessKeys],
    unavailableReason: null,
    sourceUrls: {
      landingPage: dataset.sources.landingPageUrl,
      positiveList: dataset.sources.positiveListUrl,
      accountUniverse: [accountUniverse]
    }
  };
}

export function assertFundShortageStaticDataset(value: unknown): asserts value is FundShortageStaticDataset {
  if (!value || typeof value !== "object") {
    throw new Error("資金不足比率データがオブジェクトではありません");
  }
  const dataset = value as Partial<FundShortageStaticDataset>;
  if (
    dataset.schemaVersion !== FUND_SHORTAGE_SCHEMA_VERSION
    || !Number.isInteger(dataset.fiscalYear)
    || typeof dataset.fiscalYearLabel !== "string"
    || typeof dataset.releaseLabel !== "string"
    || dataset.thresholdPercent !== FUND_SHORTAGE_THRESHOLD_PERCENT
    || dataset.universeComplete !== true
    || !dataset.sources
    || !Array.isArray(dataset.accounts)
  ) {
    throw new Error("資金不足比率データの形式が不正です");
  }
  for (const account of dataset.accounts) {
    if (
      !account
      || typeof account.accountKey !== "string"
      || typeof account.municipalityCode !== "string"
      || typeof account.accountUnit !== "string"
      || !Array.isArray(account.businessKeys)
      || (account.accountingType !== "legal_applied" && account.accountingType !== "non_legal_applied")
    ) {
      throw new Error("資金不足比率データの会計レコードが不正です");
    }
  }
}

export function fundShortageAccountKey(row: Pick<FundShortageUniverseRow, "fiscalYear" | "municipalityCode" | "workCode" | "accountUnit">) {
  return `${row.fiscalYear}:${row.municipalityCode}:${row.workCode}:${row.accountUnit}`;
}

function matchPositiveAccount(
  accounts: FundShortageAccountRecord[],
  positive: OfficialPositiveFundShortageRow
) {
  let candidates = accounts.filter((account) => (
    account.prefectureCode === positive.prefectureCode
    && account.municipalityName === positive.municipalityName
  ));
  const preferredBusinessCode = businessCodeFromAccountName(positive.accountName);
  if (preferredBusinessCode) {
    candidates = candidates.filter((account) => account.businessKeys.some((businessKey) => (
      businessKey.startsWith(`17-${preferredBusinessCode}-`)
    )));
  }
  if (positive.accountName.includes("特別会計")) {
    candidates = candidates.filter((account) => account.accountingType === "non_legal_applied");
  }
  if (candidates.length !== 1) {
    const detail = candidates.map((account) => `${account.accountKey}[${account.businessKeys.join(",")}]`).join("; ");
    throw new Error(
      `総務省の資金不足会計をe-Stat会計単位に一意に照合できません: `
      + `${positive.prefectureName}/${positive.municipalityName}/${positive.accountName} (${detail || "候補なし"})`
    );
  }
  return candidates[0];
}

function businessCodeFromAccountName(accountName: string) {
  if (accountName.includes("農業集落排水")) return "5";
  if (accountName.includes("漁業集落排水")) return "6";
  if (accountName.includes("林業集落排水")) return "7";
  if (accountName.includes("特定環境保全公共下水道")) return "4";
  if (accountName.includes("公共下水道")) return "1";
  return null;
}

function unavailableAssessment(
  dataset: FundShortageStaticDataset,
  municipalityCode: string,
  accountingType: FundShortageAccountingType | null,
  unavailableReason: "account_not_found" | "ambiguous_account"
): FundShortageAssessment {
  const universeUrls = accountingType === "legal_applied"
    ? [dataset.sources.legalAppliedUniverseUrl]
    : accountingType === "non_legal_applied"
      ? [dataset.sources.nonLegalAppliedUniverseUrl]
      : [dataset.sources.legalAppliedUniverseUrl, dataset.sources.nonLegalAppliedUniverseUrl];
  return {
    status: "unavailable",
    fiscalYear: dataset.fiscalYear,
    fiscalYearLabel: dataset.fiscalYearLabel,
    releaseLabel: dataset.releaseLabel,
    municipalityCode,
    municipalityName: null,
    accountingType,
    accountKey: null,
    accountName: null,
    accountUnit: null,
    ratioPercent: null,
    amountThousandYen: null,
    thresholdPercent: dataset.thresholdPercent,
    isAtOrAboveManagementImprovementThreshold: null,
    sharedBusinessKeys: [],
    unavailableReason,
    sourceUrls: {
      landingPage: dataset.sources.landingPageUrl,
      positiveList: dataset.sources.positiveListUrl,
      accountUniverse: universeUrls
    }
  };
}

function normalizeMunicipalityCode(value: string) {
  const digits = value.trim().replace(/\D/g, "");
  return digits.padStart(6, "0");
}

function normalizeBusinessKey(value: string) {
  const match = value.trim().match(/^(17|18)[\/-](\d+)(?:[\/-](\d+))?$/);
  if (!match) return value.trim();
  return `${match[1]}-${Number(match[2])}-${String(match[3] ?? "000").padStart(3, "0")}`;
}

function normalizeAccountingType(value?: string | null): FundShortageAccountingType | null {
  if (value === "legal_applied" || value === "non_legal_applied") return value;
  return null;
}
