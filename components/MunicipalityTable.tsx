import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import { Badge } from "@/components/Badge";
import { accountingTypeLabel, displayBusinessName } from "@/lib/businessDisplay";
import { formatPercent, formatRevisionRate, formatYenPerM3 } from "@/lib/format";
import { municipalityDetailHref } from "@/lib/municipalityLinks";

export function MunicipalityTable({ items }: { items: any[] }) {
  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <article key={`${item.municipalityCode}-card`} className="municipality-mobile-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-muted">{item.prefectureName}</div>
                <Link href={municipalityDetailHref(item.municipalityCode, item.businessKey)} className="mt-1 inline-flex items-center gap-1 text-lg font-black text-blue hover:underline">
                  {item.municipalityName}
                  <ChevronRight size={14} />
                </Link>
                <p className="mt-1 text-sm text-slate-600">{item.businessType ? displayBusinessName(item) : "未取込"}{item.businessCount > 1 ? "・複数事業あり" : ""}</p>
                <p className="mt-1 text-xs font-bold text-muted">{accountingTypeLabel(item.accountingType)}{item.accountingType === "non_legal_applied" ? "・料金指標は参考" : ""}</p>
                {item.flags?.length ? <p className="mt-1 text-xs font-bold text-amber-700" title={item.flags.join("、")}>データ要確認（{item.flags.length}）</p> : null}
              </div>
            <span><span className="sr-only">診断: </span><Badge>{item.diagnosis?.feeAdequacyLabel ?? "判定不可"}</Badge></span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <MobileMetric label="経費回収率" value={formatPercent(item.diagnosis?.expenseRecoveryRate)} strong />
              <MobileMetric label="100%相当の増収率" value={formatRevisionRate(item.diagnosis?.requiredRevisionRateTo100)} strong />
              <MobileMetric label="使用料単価" value={formatYenPerM3(item.diagnosis?.feeUnitPriceYenPerM3)} />
              <MobileMetric label="汚水処理原価" value={formatYenPerM3(item.diagnosis?.treatmentCostYenPerM3)} />
            </div>
            <div className="mt-3 rounded-md bg-panel px-3 py-2 text-xs font-bold text-slate-600">
              公式改定情報: {revisionStatusLabel(item.hasRevisionEvent)}
            </div>
          </article>
        ))}
      </div>
      <div className="search-table-shell hidden overflow-x-auto md:block">
        <table className="data-table min-w-[980px]">
          <thead>
            <tr>
              <th scope="col">都道府県</th>
              <th scope="col">自治体名</th>
              <th scope="col">表示事業</th>
              <MetricHeader
                label="経費回収率"
                help="汚水処理費（公費負担分等を除く）に対する下水道使用料収入の割合です"
              />
              <MetricHeader
                label="使用料単価"
                unit="（円/m³）"
                help="有収水量1m³あたりの使用料収入です"
              />
              <MetricHeader
                label="汚水処理原価"
                unit="（円/m³）"
                help="有収水量1m³あたりの汚水処理費です"
              />
              <MetricHeader
                label="100%相当の増収率"
                unit="（%）"
                help="費用や有収水量が変わらない仮定で、経費回収率100%相当となる下水道使用料収入の増加率を単純試算した値です"
              />
              <th scope="col">診断</th>
              <th scope="col">公式改定情報</th>
              <th scope="col"><span className="sr-only">詳細</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const businessLabel = item.businessType ? displayBusinessName(item) : "未取込";
              return (
              <tr key={item.municipalityCode}>
                <td className="text-slate-600">{item.prefectureName}</td>
                <td>
                  <Link href={municipalityDetailHref(item.municipalityCode, item.businessKey)} className="municipality-link">
                    {item.municipalityName}
                  </Link>
                </td>
                <td className="text-sm text-slate-600">
                  <details className="business-type-cell">
                    <summary>{businessLabel}</summary>
                    <span>{businessLabel}<small className="mt-1 block font-bold text-muted">{accountingTypeLabel(item.accountingType)}{item.accountingType === "non_legal_applied" ? "・料金指標は参考" : ""}{item.businessCount > 1 ? "・詳細で事業切替" : ""}{item.flags?.length ? `・データ要確認（${item.flags.length}）` : ""}</small></span>
                  </details>
                </td>
                <td className={recoveryClass(item.diagnosis?.expenseRecoveryRate)}>
                  <span className="table-metric-with-badge">
                    {formatPercent(item.diagnosis?.expenseRecoveryRate)}
                    <Badge>{item.diagnosis?.feeAdequacyLabel ?? "判定不可"}</Badge>
                  </span>
                </td>
                <td className="metric-plain">{formatYenNumber(item.diagnosis?.feeUnitPriceYenPerM3)}</td>
                <td>{formatYenNumber(item.diagnosis?.treatmentCostYenPerM3)}</td>
                <td className={revisionClass(item.diagnosis?.requiredRevisionRateTo100)}>{formatRevisionRate(item.diagnosis?.requiredRevisionRateTo100)}</td>
                <td><Badge>{item.diagnosis?.feeAdequacyLabel ?? "判定不可"}</Badge></td>
                <td><Badge>{revisionStatusLabel(item.hasRevisionEvent)}</Badge></td>
                <td>
                  <Link href={municipalityDetailHref(item.municipalityCode, item.businessKey)} className="row-chevron" aria-label={`${item.municipalityName}の${businessLabel}の詳細へ`}>
                    <ChevronRight size={20} />
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {items.length === 0 ? <div className="p-6 text-sm text-muted">条件に一致する自治体がありません。</div> : null}
    </div>
  );
}

function MetricHeader({ label, unit, help }: { label: string; unit?: string; help: string }) {
  return (
    <th scope="col">
      <span className="inline-flex flex-col items-center justify-center gap-0.5 leading-tight">
        <span className="table-head-label">
          {label}
          <details className="table-head-help">
            <summary aria-label={`${label}の説明`}>
              <Info size={13} strokeWidth={2.25} aria-hidden="true" />
            </summary>
            <span role="note">{help}</span>
          </details>
        </span>
        {unit ? <span className="text-[10px] font-bold text-slate-500">{unit}</span> : null}
      </span>
    </th>
  );
}

function formatYenNumber(value: number | null | undefined) {
  return formatYenPerM3(value).replace("円/m³", "");
}

function MobileMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md bg-panel p-3">
      <div className="text-[11px] font-bold text-muted">{label}</div>
      <div className={strong ? "mt-1 text-base font-bold text-ink" : "mt-1 font-semibold text-ink"}>{value}</div>
    </div>
  );
}

function recoveryClass(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "metric-muted";
  if (value >= 100) return "metric-positive";
  if (value >= 75) return "metric-teal";
  return "metric-warning";
}

function revisionClass(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "metric-muted";
  if (value <= 0) return "metric-positive";
  if (value >= 0.15) return "metric-alert";
  return "metric-warning";
}

function revisionStatusLabel(hasRevisionEvent: boolean) {
  return hasRevisionEvent ? "登録あり" : "未登録";
}
