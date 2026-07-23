"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, CalendarDays, Download, Info, ListFilter, Percent } from "lucide-react";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { displayBusinessName } from "@/lib/businessDisplay";
import { formatOfficialRevisionRate } from "@/lib/format";
import { municipalityDetailHref } from "@/lib/municipalityLinks";
import { revisionPeriodLabel } from "@/lib/revisionEvents";

type StaticRevisionDataset = {
  summary: any;
  items: any[];
  prefectures: string[];
};

const emptySummary = { total: 0, averageRevisionRate: null, byStatus: [], byPeriod: [] };

export default function RevisionsPage() {
  return <Suspense fallback={<div className="mx-auto max-w-[1500px] px-8 py-12 text-sm font-bold text-muted">改定情報を読み込んでいます…</div>}><RevisionsContent /></Suspense>;
}

function RevisionsContent() {
  const searchParams = useSearchParams();
  const [dataset, setDataset] = useState<StaticRevisionDataset>({ summary: emptySummary, items: [], prefectures: [] });
  useEffect(() => {
    let cancelled = false;
    fetch("/data/static/revisions.json")
      .then((response) => {
        if (!response.ok) throw new Error("Revision data unavailable");
        return response.json();
      })
      .then((json) => { if (!cancelled) setDataset(json); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const prefecture = searchParams.get("prefecture") ?? "";
  const status = searchParams.get("status") ?? "";
  const period = searchParams.get("period") ?? "";
  const matchingItems = useMemo(() => dataset.items
    .filter((event) => !prefecture || event.municipality?.prefectureName === prefecture)
    .filter((event) => !status || event.status === status)
    .filter((event) => !period || revisionPeriodLabel(event.effectiveDate) === period),
  [dataset.items, period, prefecture, status]);
  const summary = dataset.summary;
  const prefectures = dataset.prefectures;
  const data = { items: matchingItems.slice(0, 50), total: matchingItems.length };

  return (
    <div>
      <section className="water-band border-b border-line">
        <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-start">
            <div>
              <h1 className="text-3xl font-black text-ink sm:text-4xl">下水道使用料の公式改定情報</h1>
              <p className="mt-2 max-w-4xl text-sm font-medium leading-7 text-slate-700">
                自治体が公式に公表した下水道使用料の改定情報を掲載します。ランキングの「使用料収入の必要増加率」は事業全体の決算データに基づく単純計算であり、家庭の月額換算や自治体が公表する使用料改定率ではありません。
              </p>
            </div>
            <div className="rounded-md border border-teal/40 bg-white/90 p-4">
              <div className="flex gap-3">
                <Info className="mt-0.5 text-teal" size={22} />
                <div>
                  <div className="font-black text-ink">本ページは公式公表情報を対象にします</div>
                  <p className="mt-2 text-xs font-medium leading-6 text-slate-600">
                    公式公表情報を登録済みの自治体を表示します。公式サイトや議会資料等へのリンクを原資料として確認できます。
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Bell} label="公表情報" value={summary.total.toLocaleString("ja-JP")} unit="件" sub="登録済みイベント" tone="teal" />
            <StatCard icon={Percent} label="平均改定率" value={formatOfficialRevisionRate(summary.averageRevisionRate).replace("%", "")} unit={summary.averageRevisionRate == null || !Number.isFinite(summary.averageRevisionRate) ? undefined : "%"} sub="登録イベント平均" tone="amber" />
            <StatCard icon={CalendarDays} label="最多時期" value={summary.byPeriod[0]?.label ?? "—"} sub={summary.byPeriod[0] ? `${summary.byPeriod[0].count}件` : "データ未登録"} tone="blue" />
            <StatCard icon={ListFilter} label="表示件数" value={data.items.length.toLocaleString("ja-JP")} unit="件" sub={`全${data.total.toLocaleString("ja-JP")}件`} tone="violet" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <form action="/revisions" className="panel grid content-start gap-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-ink">絞り込み</h2>
            <Link href="/revisions" className="text-xs font-black text-teal hover:underline">条件をクリア</Link>
          </div>
          <FilterSelect label="都道府県" name="prefecture" value={prefecture} options={prefectures} />
          <FilterSelect label="ステータス" name="status" value={status} options={summary.byStatus.map((item: any) => item.label)} />
          <FilterSelect label="施行時期" name="period" value={period} options={summary.byPeriod.map((item: any) => item.label)} />
          <button type="submit" className="button-primary">この条件で絞り込む</button>
        </form>

        <div className="grid gap-4">
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
              <h2 className="text-xl font-black text-ink">全 {data.total.toLocaleString("ja-JP")} 件</h2>
              <button type="button" disabled className="button-secondary opacity-60">
                <Download size={16} />
                一覧をダウンロード（CSV）
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>自治体名</th>
                    <th>対象事業</th>
                    <th>ステータス</th>
                    <th>平均改定率（参考）</th>
                    <th>施行日（予定）</th>
                    <th>原資料</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((event: any) => (
                    <tr key={event.id}>
                      <td>
                        <Link
                          href={municipalityDetailHref(
                            event.municipality.municipalityCode,
                            event.sewerBusiness?.businessKey,
                            "fees"
                          )}
                          className="font-black text-ink hover:text-teal"
                        >
                          {event.municipality.prefectureName} {event.municipality.municipalityName}
                        </Link>
                      </td>
                      <td>{event.targetBusiness ?? displayBusinessName(event.sewerBusiness ?? {})}</td>
                      <td><Badge>{event.status}</Badge></td>
                      <td>{formatOfficialRevisionRate(event.averageRevisionRate)}</td>
                      <td>{event.effectiveDate ?? "未定"}</td>
                      <td>
                        <a href={event.sourceUrl} className="font-black text-teal hover:underline">公式サイト</a>
                      </td>
                      <td className="text-right">›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.items.length === 0 ? (
              <div className="grid min-h-[280px] place-items-center p-8 text-center">
                <div>
                  <CalendarDays className="mx-auto text-teal" size={42} />
                  <h3 className="mt-3 text-lg font-black text-ink">登録済みの公式改定情報はありません</h3>
                  <p className="mt-2 max-w-xl text-sm font-medium leading-7 text-slate-600">
                    公式公表情報が登録されると、自治体名・ステータス・改定率・原資料がここに表示されます。
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}

function FilterSelect({ label, name, value, options }: { label: string; name: string; value: string; options: string[] }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-ink">{label}</span>
      <select name={name} defaultValue={value} className="input-control">
        <option value="">すべて</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
