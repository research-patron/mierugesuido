export type DatasetProduct = {
  productId: string; slug: string; title: string;
  status: "draft" | "preview" | "published" | "retired";
  fiscalYear: number; regions: string[]; businessType: "17/1" | "17/4";
  accountingType: "legal_applied" | "non_legal_applied" | null;
  rowUnit: "municipality"; sampleSize: number;
  priceJpy: number | null; noteUrl: string | null; verifiedNoteCustomOrigin: string | null;
  sellerName: string | null; contactUrl: string | null; sellerDisclosureUrl: string | null;
  licenseSummary: string | null; correctionPolicy: string | null; newEditionPolicy: string | null;
  refundSummary: string | null; deliverySummary: string | null;
  sourcesReviewed: boolean; sellerTermsReviewed: boolean; deliveryReviewed: boolean; publicationApproved: boolean;
  reviewedDataVersion: string | null;
  corrections: Array<{ date: string; dataVersion: string; description: string }>;
};
export function safeHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.hash
      && !/(^|\.)(example\.(com|org|net)|localhost|example|test|invalid)$/.test(u.hostname);
  } catch { return false; }
}
export function validNoteUrl(product: DatasetProduct) {
  if (!safeHttpsUrl(product.noteUrl)) return false;
  const url = new URL(product.noteUrl);
  const noteArticle = url.hostname === "note.com" && /^\/[^/]+\/n\/n[0-9a-f]+\/?$/.test(url.pathname);
  const customArticle = safeHttpsUrl(product.verifiedNoteCustomOrigin)
    && url.origin === new URL(product.verifiedNoteCustomOrigin).origin && /^\/n\/n[0-9a-f]+\/?$/.test(url.pathname);
  return (noteArticle || customArticle) && !url.search;
}
export function purchaseBlockers(product: DatasetProduct, dataVersion: string, filesReady: boolean): string[] {
  const blockers = [];
  if (product.status !== "published") blockers.push("販売開始前または販売終了");
  if (!Number.isSafeInteger(product.priceJpy) || (product.priceJpy ?? 0) <= 0) blockers.push("価格未確定");
  if (!validNoteUrl(product)) blockers.push("note販売記事未設定");
  if (!product.sellerName?.trim() || !safeHttpsUrl(product.contactUrl) || !safeHttpsUrl(product.sellerDisclosureUrl)) blockers.push("販売者・問い合わせ情報未確認");
  if (![product.licenseSummary, product.correctionPolicy, product.newEditionPolicy, product.refundSummary, product.deliverySummary].every(value => value?.trim())) blockers.push("販売・利用条件未確定");
  if (![product.sourcesReviewed, product.sellerTermsReviewed, product.deliveryReviewed, product.publicationApproved].every(Boolean)) blockers.push("運営者による確認・承認待ち");
  if (product.reviewedDataVersion !== dataVersion) blockers.push("このデータ版の確認待ち");
  if (!filesReady) blockers.push("提供ファイルの検証待ち");
  return blockers;
}
export const canPurchase = (product: DatasetProduct, version: string, filesReady: boolean) => purchaseBlockers(product, version, filesReady).length === 0;
