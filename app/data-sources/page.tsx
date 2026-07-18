import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleHelp, Database, FileText, Info, Scale } from "lucide-react";
import { formulaCopy } from "@/lib/copy";
import { getDataSources } from "@/lib/data";
import { fieldDefinitions } from "@/lib/fieldDefinitions";
import { formatSettlementFiscalLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  const sources = await getDataSources();

  return (
    <div>
      <section className="water-band border-b border-line">
        <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:px-8">
          <div>
            <h1 className="text-3xl font-black text-ink sm:text-4xl">データの見方・出典</h1>
            <p className="mt-2 max-w-4xl text-sm font-medium leading-7 text-slate-700">
              本サービスで使用しているデータの概要、指標の計算方法、判定ロジック、出典を説明します。
            </p>
          </div>
          <div className="rounded-md border border-teal/40 bg-white/90 p-4">
            <div className="flex gap-3">
              <Info className="mt-0.5 text-teal" size={22} />
              <div className="text-sm font-bold leading-7 text-ink">
                <p>法非適用事業は、料金表・経費回収率・使用料単価・汚水処理原価を「参考比較」として掲載します。</p>
                <p className="mt-1 text-slate-600">地方公営企業決算状況調査で法適用と同じ企業会計方式の損益計算書・貸借対照表を確認できるのは法適用事業です。流域下水道は家庭料金の同列比較から外します。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="panel p-4">
          <h2 className="text-xl font-black text-ink">1. 指標の見方</h2>
          <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
            <InfoCard icon={Database} title="対象データ">
              <ul className="grid gap-2 text-sm font-medium leading-7 text-slate-700">
                <li>対象: 地方公共団体が経営する公共下水道・特定環境保全公共下水道等</li>
                <li>対象年度: 取り込んだ公表年度の決算値</li>
                <li>県内比較: 公共下水道と特環の横並びは本サイト独自。総務省の公式類似団体区分では別区分</li>
                <li>地図・一覧: 複数事業がある自治体は、最新年度のうち診断上の注意度が最も高い1事業を表示。自治体全体の合算値ではない</li>
              </ul>
            </InfoCard>
            <div className="rounded-md border border-line bg-white p-4">
              <h3 className="font-black text-ink">計算式（主な指標）</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {formulaCopy.map((item) => (
                  <div key={item.title} className="rounded-md border border-line bg-panel p-3">
                    <div className="text-sm font-black text-teal">{item.title}</div>
                    <div className="mt-2 text-xs font-bold leading-6 text-slate-700">{item.formula}</div>
                  </div>
                ))}
              </div>
            </div>
            <InfoCard icon={CircleHelp} title="色分けルール">
              <div className="grid gap-2 text-sm font-medium leading-7 text-slate-700">
                <p className="rounded-md border border-line bg-panel px-3 py-2 text-xs font-bold leading-6 text-ink">
                  色分けは、公式指標を読みやすくするための本サイト独自の参考区分です。
                </p>
                <p><strong className="text-ink">経費回収率100%以上</strong></p>
                <p><strong className="text-ink">経費回収率90%以上100%未満</strong></p>
                <p><strong className="text-ink">経費回収率80%以上90%未満</strong></p>
                <p><strong className="text-ink">経費回収率80%未満・使用料単価150円/m³以上（または単価不明）</strong></p>
                <p><strong className="text-ink">経費回収率80%未満・使用料単価150円/m³未満</strong></p>
                <p className="rounded-md bg-panel px-3 py-2 text-xs leading-6 text-slate-600">
                  まず経費回収率で100%・90%・80%の段階を見ます。80%未満だけは使用料単価150円/m³も併用します。この単価は「一般家庭20m³／月の使用料」とは別の指標です。
                </p>
              </div>
            </InfoCard>
          </div>
        </section>

        <section className="panel p-4">
          <div className="flex items-center gap-2">
            <Scale size={21} className="text-teal" aria-hidden="true" />
            <h2 className="text-xl font-black text-ink">2. 法適用・法非適用の比較範囲</h2>
          </div>
          <p className="mt-3 max-w-5xl text-sm font-medium leading-7 text-slate-700">
            両方とも地方公営企業であり、地方公営企業決算状況調査の対象です。法非適用には、同調査上、法適用と同じ企業会計方式の損益計算書・貸借対照表様式がありません。一方、汚水処理費と下水道使用料による経費回収率は両区分で共通の公式指標です。そのため料金指標は会計方式を明示して参考比較し、企業会計方式の財務図は法適用事業に限ります。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>表示・比較する内容</th>
                  <th>法適用</th>
                  <th>法非適用</th>
                  <th>本サイトの扱い</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-black">経費回収率・使用料単価・汚水処理原価</td>
                  <td>同一定義で算定</td>
                  <td>同一定義で算定</td>
                  <td className="font-black text-teal">比較対象（法非適用は参考表示）</td>
                </tr>
                <tr>
                  <td className="font-black">損益計算書・費用構成表・貸借対照表</td>
                  <td>公式様式あり</td>
                  <td>同等の公式様式なし</td>
                  <td className="font-black text-red">法適用のみ財務ボックス図を表示</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-black">
            <a href="https://www.e-stat.go.jp/stat-search/file-download?fileKind=2&statInfId=000040327165" className="inline-flex items-center gap-2 text-teal hover:underline">
              <FileText size={16} aria-hidden="true" />
              総務省 R6調査表・審査要領
            </a>
            <a href="https://www.mlit.go.jp/mizukokudo/sewerage/crd_sewerage_tk_000140.html" className="inline-flex items-center gap-2 text-teal hover:underline">
              <FileText size={16} aria-hidden="true" />
              国土交通省 経費回収率の解説
            </a>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="panel overflow-hidden p-4">
            <h2 className="text-xl font-black text-ink">3. データの出典</h2>
            <div className="mt-4 rounded-md border border-teal/25 bg-teal/5 p-4">
              <h3 className="font-black text-ink">公的統計（e-Stat / 総務省）</h3>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-700">
                総務省が公表する「地方公営企業決算状況調査」を基に作成しています。画面の各指標は、詳細ページのデータ根拠から表番号・項目名まで確認できます。
              </p>
              <a
                href="https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00200251"
                className="mt-3 inline-flex items-center gap-2 text-sm font-black text-teal hover:underline"
              >
                <FileText size={16} />
                e-Stat 地方公営企業決算状況調査ファイル一覧
              </a>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>決算</th>
                    <th>区分</th>
                    <th>表番号</th>
                    <th>表名</th>
                    <th>出典種別</th>
                    <th>取得状況</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.id}>
                      <td>{formatSettlementFiscalLabel({ surveyYear: source.surveyYear, fiscalYearLabel: source.fiscalYearLabel })}</td>
                      <td>{accountingLabel(source.accountingType)}</td>
                      <td>{source.tableNo ?? "不明"}</td>
                      <td>{source.tableName ?? "不明"}</td>
                      <td>{source.sourceUrl?.startsWith("manual://") ? "手動配置" : "e-Stat"}</td>
                      <td>{source.downloadedAt ? "取得済み" : source.localPath ? "配置済み" : "未取得"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sources.length === 0 ? <div className="p-6 text-sm font-bold text-muted">データソースは未登録です。</div> : null}
          </div>

          <section className="panel p-4">
            <h2 className="text-xl font-black text-ink">4. よくあるご質問</h2>
            <div className="mt-4 grid gap-3">
              {[
                ["法非適用事業も使用料を比較できますか？", "汚水処理費と下水道使用料は総務省の統一定義で整理されるため、経費回収率等は参考比較できます。一方、損益計算書・貸借対照表の同列比較は行いません。"],
                ["流域下水道が対象外なのはなぜですか？", "使用料の決め方や費用負担の構造が市区町村の公共下水道と異なるため、同列比較から外しています。"],
                ["データなしと表示されるのはなぜですか？", "必要な分母・分子のどちらかが未取得、または該当事業の決算データが未登録の場合に表示します。"],
                ["一般家庭用20m³／月使用料と使用料単価は同じですか？", "一般家庭用20m³／月使用料は料金表上の税込額です。使用料単価は年間使用料収入÷年間有収水量、経費回収率は使用料収入÷汚水処理費で算定するため、料金表の税込・税抜を示す項目ではありません。"],
                ["ランキングの並び順はどう決まりますか？", "算定不可を除外し、選択した指標の昇順または降順で並べます。"],
              ].map(([question, answer]) => (
                <details key={question} className="rounded-md border border-line bg-white p-3">
                  <summary className="cursor-pointer text-sm font-black text-ink">{question}</summary>
                  <p className="mt-3 text-sm font-medium leading-7 text-slate-700">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </section>

        <section className="panel p-4">
          <h2 className="text-xl font-black text-ink">GIS地図データ</h2>
          <p className="mt-2 text-sm font-medium leading-7 text-slate-700">
            行政区域地図は、国土交通省 国土数値情報「行政区域データ N03」（2023年1月1日時点）の県別ZIP内GeoJSONをWeb表示用に簡略化して使用しています。境界は表示用途のため、厳密な境界確認には原典を参照してください。
          </p>
          <a
            href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v3_1.html"
            className="mt-3 inline-flex items-center gap-2 text-sm font-black text-teal hover:underline"
          >
            <FileText size={16} />
            国土数値情報 行政区域データ N03
          </a>
        </section>

        <section className="panel overflow-hidden p-4">
          <h2 className="text-xl font-black text-ink">根拠項目の意味</h2>
          <p className="mt-2 text-sm font-medium leading-7 text-slate-700">
            自治体詳細ページの「データ根拠」に表示する主な項目について、確認すべき意味と単位を整理しています。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table min-w-[1100px]">
              <thead>
                <tr>
                  <th>項目</th>
                  <th>意味</th>
                  <th>単位</th>
                  <th>主な出典表</th>
                  <th>用途</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fieldDefinitions).map(([field, definition]) => (
                  <tr key={field}>
                    <td className="font-black">{definition.label}</td>
                    <td className="min-w-[360px] text-sm leading-6 text-slate-700">{definition.meaning}</td>
                    <td>{definition.unit}</td>
                    <td>{definition.sourceTable}</td>
                    <td>{definition.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2 font-black text-ink">
        <Icon size={20} className="text-teal" />
        {title}
      </div>
      {children}
    </div>
  );
}

function accountingLabel(value: string | null) {
  if (value === "legal_applied") return "法適用";
  if (value === "non_legal_applied") return "法非適用";
  return "不明";
}
