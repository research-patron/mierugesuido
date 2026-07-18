import Link from "next/link";
import { accountingTypeLabel } from "@/lib/businessDisplay";
import type { RankingType } from "@/lib/data";
import { municipalityDetailHref } from "@/lib/municipalityLinks";
import { formatRankingMetric, rankingMetricLabels, rankingMetricValue } from "@/lib/rankingDisplay";

export function RankingComparison({ items, type }: { items: any[]; type: RankingType }) {
  const rows = items.slice(0, 3);
  if (rows.length === 0) {
    return (
      <section className="panel p-4">
        <h2 className="text-lg font-black text-ink">ランキング上位3件の比較</h2>
        <p className="mt-3 rounded-md bg-panel p-4 text-sm font-bold text-muted">比較できるランキングデータは未登録です。</p>
      </section>
    );
  }
  return (
    <section className="panel p-4">
      <h2 className="text-lg font-black text-ink">ランキング上位3件の比較</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {rows.map((item, index) => (
          <article key={`${item.municipalityCode}-${index}-summary`} className="rounded-md border border-line bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <Link href={municipalityDetailHref(item.municipalityCode, item.businessKey)} className="font-black text-teal hover:underline">
                {item.prefectureName} {item.municipalityName}
              </Link>
              <span className="rounded bg-teal px-2 py-1 text-xs font-black text-white">{index + 1}位</span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-muted">{item.entityType === "joint_operator" ? "組合等の運営団体・" : ""}{accountingTypeLabel(item.accountingType)}{item.accountingType === "non_legal_applied" ? "・料金指標は参考" : ""}</p>
            <div className="mt-3 rounded-md border border-line text-center">
              <Metric label={rankingMetricLabels[type]} value={formatRankingMetric(item, type)} />
            </div>
          </article>
        ))}
      </div>
      <div className="mt-4">
        <BarChart
          title={rankingMetricLabels[type]}
          values={rows.map((item) => rankingMetricValue(item, type))}
          formatter={(_value, index) => formatRankingMetric(rows[index], type)}
        />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-2">
      <div className="text-[10px] font-black text-muted">{label}</div>
      <div className="mt-1 text-sm font-black text-ink">{value}</div>
    </div>
  );
}

function BarChart({
  title,
  values,
  formatter
}: {
  title: string;
  values: Array<number | null | undefined>;
  formatter: (value: number | null | undefined, index: number) => string;
}) {
  const max = Math.max(1, ...values.map((value) => value ?? 0));
  const colors = ["#0b9aa3", "#f59b32", "#77c776"];
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="text-xs font-black text-ink">{title}</div>
      <div className="mt-3 grid gap-2">
        {values.map((value, index) => (
          <div key={`${title}-${index}`}>
            <div className="mb-1 flex justify-between text-[11px] font-bold text-muted">
              <span>{index + 1}位</span>
              <span>{formatter(value, index)}</span>
            </div>
            <div className="h-8 overflow-hidden rounded bg-panel">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.max(((value ?? 0) / max) * 100, value == null ? 0 : 6)}%`,
                  backgroundColor: colors[index] ?? "#0b9aa3"
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
