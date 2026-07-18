export const BUSINESS_CODE_LABELS: Record<string, string> = {
  "17/1": "公共下水道",
  "17/2": "特定公共下水道",
  "17/3": "流域下水道",
  "17/4": "特定環境保全公共下水道",
  "17/5": "農業集落排水",
  "17/6": "漁業集落排水",
  "17/7": "林業集落排水",
  "17/8": "簡易排水",
  "17/9": "小規模集合排水処理施設",
  "18/0": "特定地域生活排水処理施設",
  "18/1": "個別排水処理施設"
};

export const BUSINESS_CATEGORY_OPTIONS = Object.entries(BUSINESS_CODE_LABELS)
  .filter(([value]) => value !== "17/3")
  .map(([value, label]) => ({ value, label }));

const INTERNAL_BUSINESS_PATTERN = /下水道事業[（(][一二１２][）)]\s*事業コード\s*(\d+)/;

export function accountingTypeLabel(accountingType?: string | null) {
  if (accountingType === "legal_applied") return "法適用";
  if (accountingType === "non_legal_applied") return "法非適用";
  return "区分不明";
}

export function displayBusinessName({
  businessKey,
  businessType,
  businessName,
  estatBusinessCategory
}: {
  businessKey?: string | null;
  businessType?: string | null;
  businessName?: string | null;
  estatBusinessCategory?: string | null;
}) {
  const categoryLabel = BUSINESS_CODE_LABELS[businessCategoryCode({ businessKey, businessType, businessName, estatBusinessCategory }) ?? ""];
  if (categoryLabel) return categoryLabel;

  const typeLabel = labelFromInternalName(businessType);
  if (typeLabel) return typeLabel;

  const nameLabel = labelFromInternalName(businessName);
  if (nameLabel) return nameLabel;

  return cleanBusinessName(businessType) ?? cleanBusinessName(businessName) ?? "下水道事業";
}

export function businessCategoryCode({
  businessKey,
  businessType,
  businessName,
  estatBusinessCategory
}: {
  businessKey?: string | null;
  businessType?: string | null;
  businessName?: string | null;
  estatBusinessCategory?: string | null;
}) {
  const direct = normalizeBusinessCategory(estatBusinessCategory) ?? normalizeBusinessCategory(businessKey);
  if (direct) return direct;

  for (const value of [businessType, businessName]) {
    if (!value) continue;
    const match = value.match(INTERNAL_BUSINESS_PATTERN);
    if (!match) continue;
    const industryCode = value.includes("（二）") || value.includes("(二)") ? "18" : "17";
    return `${industryCode}/${Number(match[1])}`;
  }
  return null;
}

export function matchesBusinessCategory(
  business: Parameters<typeof displayBusinessName>[0],
  requested?: string | null
) {
  const value = requested?.trim();
  if (!value) return true;
  const requestedCategory = normalizeBusinessCategory(value);
  if (requestedCategory) return businessCategoryCode(business) === requestedCategory;

  // Keep old bookmarked URLs usable while the UI now emits official category codes.
  return value === business.businessType
    || value === business.businessName
    || value === displayBusinessName(business);
}

function labelFromEstatCategory(category?: string | null) {
  const normalized = normalizeBusinessCategory(category);
  return normalized ? BUSINESS_CODE_LABELS[normalized] ?? null : null;
}

function labelFromInternalName(value?: string | null) {
  if (!value) return null;
  const match = value.match(INTERNAL_BUSINESS_PATTERN);
  if (!match) return null;
  const category = value.includes("（二）") || value.includes("(二)") ? "18" : "17";
  return BUSINESS_CODE_LABELS[`${category}/${match[1]}`] ?? "下水道事業";
}

function cleanBusinessName(value?: string | null) {
  const text = value?.trim();
  if (!text || INTERNAL_BUSINESS_PATTERN.test(text)) return null;
  return text;
}

function normalizeBusinessCategory(value?: string | null) {
  const match = value?.trim().match(/^(17|18)[\/-](\d+)(?:[\/-]|$)/);
  return match ? `${match[1]}/${Number(match[2])}` : null;
}
