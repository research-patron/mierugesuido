import Link from "next/link";
import { Badge } from "@/components/Badge";
import { accountingTypeLabel, displayBusinessName } from "@/lib/businessDisplay";
import type { RankingType } from "@/lib/data";
import { municipalityDetailHref } from "@/lib/municipalityLinks";
import { formatRankingMetric, rankingMetricLabels } from "@/lib/rankingDisplay";

export function RankingTable({ items, type }: { items: any[]; type: RankingType }) {
  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {items.map((item, index) => (
          <article key={`${item.municipalityCode}-${item.businessName}-${index}-card`} className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-muted">順位 {index + 1}</div>
                <Link href={municipalityDetailHref(item.municipalityCode, item.businessKey)} className="mt-1 block text-base font-bold text-blue hover:underline">
                  {item.prefectureName} {item.municipalityName}
                </Link>
                <p className="mt-1 text-sm text-slate-600">{displayBusinessName(item)}</p>
                <p className="mt-1 text-xs font-bold text-muted">{item.entityType === "joint_operator" ? "組合等の運営団体・" : ""}{accountingTypeLabel(item.accountingType)}{item.accountingType === "non_legal_applied" ? "・料金指標は参考" : ""}</p>
              </div>
              <Badge>{item.feeAdequacyLabel ?? "判定不可"}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <MobileMetric label={rankingMetricLabels[type]} value={formatRankingMetric(item, type)} strong />
              <QualityNote flags={item.flags} />
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-md border border-line bg-white md:block">
        <table className="data-table min-w-[860px]">
          <thead>
            <tr>
              <th>順位</th>
              <th>自治体・運営団体</th>
              <th>事業</th>
              <th>{rankingMetricLabels[type]}</th>
              <th>データ品質</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.municipalityCode}-${item.businessName}-${index}`}>
                <td className="font-bold text-muted">{index + 1}</td>
                <td>
                  <Link href={municipalityDetailHref(item.municipalityCode, item.businessKey)} className="font-bold text-blue hover:underline">
                    {item.prefectureName} {item.municipalityName}
                  </Link>
                  {item.entityType === "joint_operator" ? <small className="mt-1 block font-bold text-muted">組合等の運営団体</small> : null}
                </td>
                <td className="text-sm text-slate-600">{displayBusinessName(item)}<small className="mt-1 block font-bold text-muted">{accountingTypeLabel(item.accountingType)}{item.accountingType === "non_legal_applied" ? "・料金指標は参考" : ""}</small></td>
                <td className="font-semibold">{formatRankingMetric(item, type)}</td>
                <td><QualityNote flags={item.flags} /></td>
                <td><Badge>{item.feeAdequacyLabel ?? "判定不可"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 ? <div className="p-6 text-sm text-muted">表示できるランキングデータがありません。</div> : null}
    </div>
  );
}

function QualityNote({ flags }: { flags: string[] | null | undefined }) {
  if (!flags?.length) return <span className="text-xs font-bold text-slate-600">確認済み</span>;
  return <span className="text-xs font-bold text-amber-700" title={flags.join("、")}>要確認（{flags.length}）</span>;
}

function MobileMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md bg-panel p-3">
      <div className="text-[11px] font-bold text-muted">{label}</div>
      <div className={strong ? "mt-1 text-base font-bold text-ink" : "mt-1 font-semibold text-ink"}>{value}</div>
    </div>
  );
}
