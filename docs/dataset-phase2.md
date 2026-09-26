# 5年間の履歴修正とデータ資料セット（第2・3段階）

実装日：2026-09-23。実装はプレビューブランチの第1段階コミットを基点とする。本番・note公開、購入、問い合わせ送信、計測タグの配信、広告開始は行わない。

## 1. 履歴が1年分になる原因と修正

プレビュー限定の仕様ではなく、第1段階のURL条件保持に伴う不具合。自治体詳細で `fiscalYear=2024` に対応する際、事業の `annualFinancials` 自体を2024年度だけに絞り、5年間のグラフにもその配列を渡していた。

公開プレビューの新潟市・公共下水道で再現した。年度指定なしではR2〜R6、年度指定ありではR2〜R5が未取得となった。元の静的データには2020〜2024年の家庭用20m³月額（各3,047円）が残っていた。

修正後は、対象年度の現在値を選ぶ処理と、事業内の履歴を保持する処理を分けた。指定年度がない場合は未収録のまま、指定年度がある場合はそこまでの5年間を表示する。会計条件と事業識別は維持し、空いている年の補完や別事業の値の流用はしない。

トップには指定の「自分のまちの下水道経営状況を見る」を4指標の上に追加。見出しを含めて領域が伸びるよう固定高を解除し、カードの見切れを防いだ。

## 2. 実装した資料セット

- `/datasets/`：資料案内。既存の無料検索・比較・CSVとの差を説明する。
- `/datasets/public-sewer-2024-national/`：最初の1商品。2024年度・全国・公共下水道・自治体代表1事業。組合等の独立した共同運営会計と流域下水道は対象外。
- 商品状態は `preview`。実データの見本と収録内容を表示するが、購入ボタンは出さない。商品ページはnoindex、サイトマップから除外する。資料案内ページは索引対象。
- 全国1,168自治体、13列。経費回収率、使用料単価、汚水処理原価、識別子・年度・会計・順位・品質情報。3指標とも欠損6行を空欄のまま保持する。
- 無料見本は自治体コード順の先頭5行。本体と同じ値・処理・列定義。全国の代表標本とは表現しない。
- 本体の6ファイル：`indicators.csv`、`columns.csv`、`sources.csv`、`README.md`、`corrections.json`、`manifest.json`。ZIPにまとめ、内容と容量を検証する。実装していないXLSX/PDFは提供物に含めない。
- 家庭用料金のデータセットではない。使用料単価から家庭用月額を作らない。
- 自治体・府県に対する新しい個別商品の広告は追加していない。ヘッダーの資料案内と、無料機能より後のトップ案内から進める。

## 3. 共通集計・版管理・公開範囲

`lib/datasetEdition.ts` は既存の `normalizeHomeComparison`、`selectComparisonRows`、`summarizeMunicipalities`、順位処理を再利用する。指標名と計算式は既存のランキング定義・`formulaCopy`を参照する。別の計算式で値を再計算しない。

入力JSON・出典記録・共通処理・生成コード・対象条件・編集内容のSHA-256から固定版を作る。同じ入力版の再生成では生成日時も維持し、CSV・ZIPの内容を再現する。販売条件や訂正内容が変わる場合も該当する編集内容を版に含める。価格と販売状態はデータそのものの版とは分ける。

- 公開先：`public/samples/{slug}/` の5ファイル（見本CSV・列定義・見本の出典対応・README・見本の版情報）のみ。
- 販売用：Git管理外の `private-products/{slug}/{版の先頭12文字}/`。完全版をpublic・公開CI成果物へ移さない。
- `data/static/dataset-catalog.json` は公開説明用の件数・ファイル情報・限定見本。完全版の行一覧や非公開パスは含めない。
- `pnpm build:pages` は `datasets:public` を先に実行する。販売用ZIPは通常ビルドで作らない。対象商品の生成が失敗した場合は見本を除去し購入を止めるが、無料比較の全ページを止めない。
- draftはルート・一覧・サイトマップから除外。previewは購入不可・noindex。retiredは購入不可で説明・訂正記録を残す。publishedでも条件不足・版不一致なら購入不可・noindex。

CSVはUTF-8 BOM、CRLF、全セル引用。nullは空欄、0は0。コードは文字列として取り込む説明を同梱。文字列の数式開始文字はアポストロフィで無効化し、数値や改行・引用符は維持する。

## 4. 販売を止めている未設定項目

設定は `config/dataset-products.json` に集約した。価格・note販売URL・販売者名・問い合わせ・販売者表示・利用許諾・訂正・新版・返金・提供条件はnull。原資料確認、販売条件確認、提供確認、公開承認はfalse、確認対象のデータ版も未指定。

全条件がそろい、`reviewedDataVersion`が生成版と一致したpublished商品のみ購入リンクが出る。URLはHTTPSのnote記事、または販売者が確認した独自ドメインの記事に限定。仮URLやJavaScript URLを受け付けない。noteの販売状態を非公式APIから推測しない。

親サイトの問い合わせページは今回のテキスト取得では本文・送信手段を確認できなかった。存在しないとは判定していない。窓口の所有者、商品・訂正受付の可否、プライバシーポリシーの適用範囲は運営者が確認する。新しいフォームや架空の連絡先は追加していない。

## 5. 計測

既存の解析サービスがないため、外部タグ・ID・cookie・ストレージ・送信先を追加せず、承認済みアダプターを接続する境界だけを実装した。初期状態は無効。`configureUsageMeasurement`はenabled、consent、sendがそろった場合だけ有効になる。

- 自治体の家庭用料金の実表示、ランキング結果の実表示、商品説明の実表示に可視領域判定を使用。
- 同一対象の再描画・Strict Modeで重複送信しない。URLによる事業・年度反映前の標準表示は計測しない。
- `sample_download_click`は見本取得リンクのクリック、`note_outbound_click`はnoteへの移動。取得完了・購入完了を意味しない。
- `purchase`イベントは許可しない。noteから戻っても購入としない。
- プロパティは許可リスト、定義した識別子・数値に限定。自由入力、メール、任意URL、エラースタックを送らない。
- 計測無効・拒否・送信失敗でも通常のリンクは動く。外部解析IDの設定、所有権・同意・ポリシー確認、接続先アダプターの追加は運営者承認後。現時点の無効状態を利用ゼロとは解釈しない。

## 6. 生成・更新・確認の手順

```sh
pnpm datasets:generate
python3 scripts/datasets/verify.py
pnpm test
pnpm build:pages
```

生成には既存Node依存とPython 3標準ライブラリを使う。DB・公式Excel・既存の金融JSONは更新しない。原資料更新時は既存のstatic生成を別途行い、その新しい入力から再生成する。

1. 対象条件・商品説明を設定し、完全版と無料見本を生成する。
2. 原資料と各指標、年度、会計範囲、第三者権利を確認する。自動検証を手動全件照合とは扱わない。
3. CSVを文字列型指定で開き、コード、欠損、出典対応を確認。ZIPの展開・ハッシュ・容量を検証する。
4. 価格、販売者、問い合わせ、利用・提供・訂正・更新・返金条件を確定する。note記事の表示と照合する。
5. noteへのアップロード、公開、テスト購入は別途承認後。実際に購入者へ渡るファイルを手動確認する。
6. 対象データ版の確認を記録し、承認後だけpublishedへ変更する。変更後も秘密情報・完全版混入・サイトマップ・購入リンクを検査する。
7. 訂正は日付・対象版・変更内容を `corrections`へ記録して新しい固定版を生成する。旧ZIPを無断で置き換えない。
8. 販売停止はretiredへ。無料機能・旧版説明・必要な訂正記録は維持する。

note側の実売は、運営者が商品IDと対象期間ごとに購入件数・売上・返金・手数料・実費を確認する。購入者の個人情報を解析へ送らない。「note全購入件数÷サイト外部クリック数」を厳密なサイト購入率と呼ばない。

## 7. 公式条件の確認と未確認事項

2026-09-23に[公式noteヘルプ](https://www.help-note.com/hc/ja/articles/360016349894)で1ファイル50MBの案内を確認した。生成処理は保守的に50,000,000 bytes以下を要求し、公開前に公式案内を再確認する。noteへの実提供は未実施。

[e-Stat利用規約](https://www.e-stat.go.jp/terms-of-use)の商用利用・出典表示・加工表示・第三者権利の条件を確認した。資料ごとの例外と販売者側の条件は別途確認が必要で、法的な十分性を判断したものではない。

本番設定、Search Console、親サイトのポリシー適用、問い合わせ送信、物理スマートフォン、OSのIME変換、Safari/Firefox、スクリーンリーダーは今回未確認。Chromeモバイルはエミュレーション。新規API、認証、決済、月額課金、広告は実装していない。

## 8. 検証記録

- 全回帰：57ファイル・461件成功。原資料キャッシュを用いた既存第33表テストを含み、スキップなし。全公開自治体のR6選択事業について履歴レコード保持を検査。
- `pnpm lint`成功。`pnpm build:pages`成功：1,649ルート、1,648 sitemap URL、アイコン・404・robots・manifest・headersを検証。準備中の商品1ページはnoindexでsitemapから除外。
- 静的サイト上の新規ブラウザーQA：11項目成功。1491×1055／390×844で見出し・カード見切れ・資料・見本・R6/R5/未収録年の履歴、ページ幅、JS無効時の商品本文を確認。Enterキーによる見本CSV取得と表のキーボード横スクロールも検証。実行時エラー・外部リソースへの要求は0件。
- 既存の第1段階ブラウザーQA：15項目成功。比較条件の遷移・reload/back・事業切替、検索、4種類の障害/再試行を再検証。
- 生成物を独立したPython CSV/ZIP処理で検査。本体1,168行・13列、見本5行、全指標値が元の画面データと一致。見本と本体の同一性、出典対応、各ファイルのSHA-256・ZIP展開を確認。ZIPは119,728 bytes、容量制限内。
- 同じ入力で2度生成し、CSV・README・manifest・ZIPすべてのbytesが一致。
- Gitleaks検出0件。追加差分の絶対ローカルパス・個人メール検査0件。`git diff --check`成功。完全版のCSV/ZIPはpublic/outに存在しない。
- 画面は実ブラウザーのスクリーンショットを確認。モバイルはエミュレーションで、未実施環境は第7節のとおり。
- この変更は未コミット・未push。以前のCloudflareプレビューURLは第1段階のまま。ローカル検証を本番・note上の提供確認とは呼ばない。

## 9. 変更範囲とロールバック

履歴修正：自治体詳細の事業選択・推移生成、年度formatter、回帰テスト。トップ：見出しと固定高。販売準備：datasetsルート、商品設定・共通生成・購入条件判定、限定見本、計測の無効な接続境界、ナビゲーション、サイトマップ、静的成果物検査、QAと運用文書。

無料CSV・金融JSON・DB・原資料・地図データは変更しない。第1段階以前の削除・競合コピーには触れない。

今回の変更だけを第1段階のコミットから戻す。完全版はGit管理外なので必要に応じて保管する。全作業ツリーのresetやDBの巻き戻しは不要。プレビュー・mainへの反映は、対象差分への別途承認後に行う。

### 今回の変更ファイル（第1段階からの差分）

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `app/datasets/[slug]/page.tsx`
- `app/datasets/page.tsx`
- `app/error.tsx`
- `app/municipalities/[municipalityCode]/page.tsx`
- `app/page.tsx`
- `app/sitemap.ts`
- `app/ui-fidelity.css`
- `components/DatasetActions.tsx`
- `components/MunicipalityDetailClient.tsx`
- `components/MunicipalitySearch.tsx`
- `components/RankingExplorer.tsx`
- `components/SiteHeader.tsx`
- `components/municipality-detail/CitizenAssessmentPanel.tsx`
- `config/dataset-products.json`
- `data/static/dataset-catalog.json`
- `design-qa.md`
- `docs/dataset-phase2.md`
- `lib/datasetCatalog.ts`
- `lib/datasetEdition.ts`
- `lib/datasetProduct.ts`
- `lib/format.ts`
- `lib/telemetry.ts`
- `package.json`
- `public/samples/public-sewer-2024-national/README.md`
- `public/samples/public-sewer-2024-national/columns.csv`
- `public/samples/public-sewer-2024-national/manifest.json`
- `public/samples/public-sewer-2024-national/sample.csv`
- `public/samples/public-sewer-2024-national/sources.csv`
- `scripts/datasets/generate.ts`
- `scripts/datasets/package.py`
- `scripts/datasets/verify.py`
- `scripts/qa/dataset-stage2.mjs`
- `scripts/verify-publication-output.mjs`
- `tests/dataset-products.test.ts`


## 2026-09-26：承認範囲の更新

本書の未公開・未pushは当初の実装時点の記録。運営者は後続の2020年度CSV・アンケート導線を含む差分についてテスト完了とmain反映を明示承認した。最新の検証と運用は `free-dataset-2020.md` を参照。2024年度のnote商品設定は未確定のまま、購入リンクは非表示。
