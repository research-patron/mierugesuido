# 無料比較の正確性改善：現状調査と第1段階

調査・実装日：2026-09-23。要件は `gesuido_codex_improvement_spec.md`（2026-09-22版）。同名のv2ファイルもローカルにあったが、今回指定されたファイルを採用した。

この報告はローカル実装・ローカル検証を対象とする。本番、note、広告、外部へのイベント送信、購入、契約は実行していない。既存の地図改善・削除済みデータ・競合コピーは保存した。

## 1. 調査結果

| 対象 | コード・実データで確認した結果 | 対応 |
|---|---|---|
| 配信 | Next.js 15のApp Router、`output: export`、末尾スラッシュあり。Cloudflare Pagesで静的配信。実行時DB/APIは不要 | 既存SSGを使用。配信方式を変更しない |
| トップの年度 | `home.json`の最新年度は2024、ラベルは令和6年度 | 「本サイト収録の最新決算年度」と明記 |
| 出典のR7 | 出典側`surveyYear=2025`はカタログ年。決算年度用formatterへ渡してR7を表示していた | 列を「カタログ年」に変更。決算年度とは分離 |
| 原資料の年度 | キャッシュされた2025年カタログの法適用第33表 `33_2024460003300.xlsx` の「決算年度」は2024。ETLはこのセルを使う。R5/R6の法適用・法非適用第33表も既存実データテストで検証 | 全資料をカタログ年−1で推定する処理は導入しない |
| 日付 | DBのsource_filesには110件の公表日・取得日があるが、配布済み一覧には含まれていなかった | ID・URL・カタログ年を照合した別メタデータで追加。公表日、取得日（UTC）、取得状態を表示。公開反映日・全件照合記録は未収録と明示 |
| トップの比較範囲 | 公共1,169自治体に2022年度1件、特環719自治体に2020〜2023年度5件が混在 | R6公共1,168／特環714自治体へ。過年度補完をせず、除外件数を表示 |
| 集計 | トップの割合・平均は指標の有効値が分母、自治体値の単純平均。全国の収入合計÷費用合計ではない | 有効母数・代表1事業・会計範囲を地図近くに表示 |
| 全国ランキング | 共通R6・流域除外・自治体/運営団体の事業別。保存ファイルは各方向50件のみ。既存`getRankings`による全母集団は各指標3,470事業 | 元50件との完全一致を検証し、母数・区分別件数・SHA-256を別メタデータへ。無料の既存50件を維持 |
| トップ→ランキング | 自治体代表1事業から全事業の50件へ切り替わっていた | トップからは同じ自治体・事業・年度の比較へ。全事業ランキングへの切替は明示 |
| 検索 | 配布済み検索は各自治体の代表1事業。公共検索1,164自治体、特環検索246自治体で、地図の対象と異なっていた | 公共・特環は地図と同じ指定事業優先の集合を使用。ほかの事業区分は既存の代表事業検索の範囲を明記 |
| 検索KPI | 絞り込み前の平均・変更件数を、検索対象内のように見せていた | 平均、分母、施行年月日変更件数を検索結果と同期 |
| 家庭用料金 | `householdFee20m3Yen`と`feeUnitPriceYenPerM3`は別。札幌R6公共の公式家庭用月額は1,397円で、使用料単価×20ではない | 元フィールド・計算式を維持。入口、月20m³・収録年度・現在の請求額との違い・第33表リンクを明示 |
| 県内料金比較 | R6法適用の公共＋特環。指定事業を優先し、R6がなければ他方の事業を選ぶ既存方針。共同会計は1事業体、料金は同額同順位 | 集計を変更せず、全国地図/ランキングと対象が異なる旨を遷移先に明記 |
| 品質表示 | ランキングの「確認済み」はflags配列が空かどうか。R6のflags空欄に対応するDB記録はdata_quality_status=ok | 「自動チェック通過」へ。注意理由を開いて読めるようにし、原資料不一致や手動照合と区別 |
| 改定 | R5/R6第33表の施行年月日変更のみ。138事業・109団体。東京の旧KPIは手動公式発表の収録数0を表示 | 府県KPIも同じ第33表の変更インデックスへ。未確認を「なし」にせず、値上げ判定ではないと明示 |
| 初期HTML | 検索はSuspense内でfetch、詳細はfallback=null＋fetch、改定は読み込み表示。ランキングはSSG | 検索・詳細・改定へビルド時データを渡す。URL読取のみ小さいSuspense境界に分離 |
| 無料出力 | 都道府県別静的CSV、公開JSON、公式データタブ、地図・検索・ランキングが存在 | 既存ファイル・URLを維持。CSVが画面の絞り込みを反映しない旨をリンク付近に明示 |
| 計測・広告 | app/components/libにはGA、GTM、AdSense、purchase送信の実装がない。READMEも外部実行時解析なし | 新設しない。実際のホスティング側注入や親サイト設定は未確認 |

### 識別と順位

- DBの事業一意キーは運営主体＋businessKey＋会計区分。年次レコードは事業＋決算年度。自治体コードだけで事業を識別していない。
- `sewer_service_memberships`は運営主体と供給自治体の関係、期間、consolidated区分、公式出典を保持する。財務額を供給自治体へ配賦していない。
- ランキング母数生成時にも主体コード＋事業キー＋会計＋年度の重複を拒否する。
- 全国順位は従来の連番から同値同順位（1、2、2、4）へ統一した。県内家庭用料金の既存規則に合わせ、保存精度で判定する。表示の小数丸め、100%超、外れ値だけで値を落とさない。

## 2. 実装範囲と互換性

- トップに家庭用料金の検索フォームを先置きし、経営比較へ進むリンクを分けた。地図読み込みを検索開始の前提にしない。
- `fiscalYear`, `businessType`, `accountingType`, `prefecture`, `rowUnit`を共通のURL条件として保持。既存`business`, `view`, `q`, `hasRevisionEvent`等を削除・別用途に転用していない。
- 事業の意図的な切替では事業区分も更新。指定年度/事業がなければ未収録と表示し、別年度・別事業で補わない。
- 全国の全事業ランキングは既存の50件公開抜粋。絞り込みURLではその抜粋内の一致行を表示するため、全文字通りの「各条件の上位50件」とは呼ばない。全母数と表示件数を別表示する。
- 検索の公共・特環以外の区分は、代表事業に選ばれた自治体だけが検索対象。全事業検索への拡張は今回行っていない。自治体詳細で各事業を選べる既存機能は維持する。
- 無料CSVは従来の全区分・自治体代表1事業の固定ファイル。画面条件との違いを明記し、削除・有料化しない。
- source record・DB・スキーマ・マイグレーション・公式Excel・既存の公開金融JSON/CSVは変更しない。追加データは母数と出典日付のメタデータだけ。
- 削除した機能はない。「確認済み」、出典の誤解を招く「決算」列、府県の旧公式発表0件KPIを、実際の意味が分かる表示へ置き換えた。

## 3. 検証方法

既存作業ツリーに多数の追跡済み金融データ削除と競合コピーがある。Gitの追跡済みデータを一時ディレクトリへ展開し、現在のコードと既存地図変更を重ねて検証した。削除・競合コピーを復元したり、DBで上書きしていない。

```sh
pnpm lint
pnpm test
pnpm build:pages
# 公式Excelを利用できる環境では、キャッシュの場所を指定して実データテストも実行
YEARBOOK_FEE_TEST_SOURCE_ROOT=<local-cache> pnpm test
# 上記の静的outをローカル配信した後に実行
COMPARISON_BASE_URL=http://127.0.0.1:3199 node scripts/qa/comparison-phase1.mjs
```

`PLAYWRIGHT_MODULE`で既存ランタイムのPlaywrightを指定できる。QAの生成物はGit管理外の`artifacts`へ置く。

通常のクリーン環境で原資料キャッシュがなければ、既存の公式第33表実データテスト1件はスキップする。モックを使って原資料テストを成功扱いにしていない。最終結果は下の検証記録に追記する。

## 4. 未確認・適用上の限界

- 本番サイト・Cloudflareの実設定、Search Console、親サイトの問い合わせ/ポリシーの適用範囲・送信可否は未確認。ローカル確認を本番検証と呼ばない。
- static exportの初期HTMLは標準事業/標準条件。`business`や`view`などの操作URLはJS実行後に反映する。ブックマークと戻るは保持するが、事業別クエリごとに別HTMLを生成したわけではない。
- 初期HTMLのcanonicalは自治体ルート単位。JSによる事業・年度の選択反映後は、その事業・年度をcanonicalとタイトルにも反映する。事業別URLの個別インデックスは保証せず、Search Consoleでの確認は未実施。事業固有の静的パスを将来作る場合も旧URLを維持する。
- 既定の正規オリジンは従来のCloudflare Pages URLのまま。独自ドメインの採用状況と`NEXT_PUBLIC_SITE_URL`の本番値は運営者が確認する。
- 全110ファイルの決算年度と公表日を今回原典から再照合したわけではない。公表日・取得日は取込記録である。公開反映日、サイト更新日時、全件照合記録は未記録として扱う。
- スマートフォンはChromeの390×844・touch emulation。物理端末、OSの日本語IME変換、Safari/Firefox、スクリーンリーダーは今回未実施。日本語文字入力とEnter検索は実ブラウザーで検証。
- 初期HTMLへデータを含めた分、HTMLは増える。転送圧縮を含む本番性能やCore Web Vitalsの改善を主張しない。

## 5. 後続段階の商品設定（未確定はnull・draft）

以下は後続実装の設定項目。今回は商品ページ、商品ファイル、購入ボタン、計測タグを公開しない。

| 設定 | 必要な確定内容 |
|---|---|
| productId / slug / title / status | 最初の1商品。未決定ならdraft |
| fiscalYear / regions / businessScope / accountingScope / rowUnit | 固定年度、対象地域、事業・会計・比較単位。除外と代表選択規則 |
| dataVersion / schemaVersion | 入力ファイルハッシュ、共通集計版、列定義。画面・見本・商品に同じ版を使用 |
| priceJpy / noteUrl | 現在はnull。実在する承認済み販売記事と、税を含む表示価格 |
| seller / contact / policy URLs | 販売者が確認した実在の情報。親サイトの適用範囲と訂正/商品問い合わせの可否 |
| sampleAssets / deliverables | 実データから生成した見本と、実際に納品するCSV・列定義・README・出典対応等。完成していないXLSX/PDFを約束しない |
| license / correction / newEdition / refund / delivery | 引用・再配布・更新・訂正・返金・提供方法。note側の表示と一致させる |
| sourcesReviewed / sellerTermsReviewed / deliveryReviewed / publicationApproved | 根拠資料、内容、販売条件、提供、運営者の公開承認。未確認はfalse |

販売状態はdraft / preview / published / retired。必須設定・実ファイル・確認・承認がそろうまでpublishedにせず購入ボタンを出さない。previewは実在する見本だけを掲載し、薄い準備中ページを索引対象にしない。

### 後続の生成・販売手順

1. 初回商品の年度・地域・比較単位を決める。既存無料CSVとの差は、固定した比較条件、列定義、欠損情報、出典対応、検証記録を一式にすること。元の公的数値を独占情報として扱わない。
2. 共通比較処理、既存指標定義とCSV処理を再利用し、固定入力から画面・見本・商品を生成する。価格や行数を手入力で創作しない。CSVの先頭ゼロ、欠損、引用符、数式注入、必要に応じXLSXの型指定を商品段階で検証する。
3. メタデータに入力版・列定義・行数・欠損数・計算式・比較条件・出典・生成日時を記録。対象商品で検証が失敗した場合だけ生成/公開を止める。
4. サイト公開先へ置くのは無料見本だけ。有料編集パッケージはpublic、公開JS、公開CI成果物へ入れず、noteを提供先とする。
5. 運営者がe-Stat等の資料ごとの利用条件、noteの最新ファイル制約、提供/返金設定、販売者表示を確認する。この報告は法的な十分性の判定ではない。
6. 公開・テスト購入・実提供の確認は別途承認後。未確認APIや購入者認証は作らない。
7. 計測を採用するなら既存の所有権・同意設定を確認。`note_outbound_click`と実購入を分け、purchaseへ変換しない。入力文字列・メール等を送らず、無効時でも無料機能と通常のリンクを動かす。

### 更新・訂正・販売停止

- データ更新時は従来のstatic生成と照合を行う。ランキング母数メタデータは同じ集計実行で再生成し、50件の入力SHAが変わったのに母数が旧版ならビルドを止める。
- 商品追加時は新しい固定版で見本・納品ファイルを生成し、公開承認を記録する。旧版を無断で最新版に差し替えない。
- 訂正は対象データ版・影響範囲・修正内容・日付を記録し、対象見本と商品説明を同時に更新する。
- 販売停止はretiredへ変更して購入導線を止める。既存無料機能と必要な旧版説明・訂正記録を維持する。

## 6. ロールバック

今回は未コミット・未公開。今回の変更一覧だけを作業前の内容へ戻し、追加した比較コンポーネント・メタデータ・QAを外す。`git reset --hard`や全作業ツリー復元は使わない。特にAGENTS.md、府県mapページ、PrefectureMapExplorerには作業前からの変更があるため、その差分を残す。

公開する場合は別途承認・通常の出版前検査が必要。将来の撤回もこの変更だけをrevertする形を取り、データベースの巻き戻しは不要。

## 7. 最終検証記録

- `pnpm lint`（TypeScript）：成功。
- 全回帰テスト：56ファイル・453件成功。公式第33表の実ファイル検証を含み、今回はスキップなし。
- `pnpm build:pages`：成功。1,647ルート、同数のsitemap URL、6 PNG、favicon、404、robots、manifest、headersの整合検査も成功。
- 静的ビルド上のChrome 153：15項目すべて成功。1491×1055と390×844で画面幅、条件保持、リロード・戻る、既存事業URL、事業切替、日本語入力、キーボード・タップを検証。
- JavaScript無効でトップ・検索・詳細・ランキング・改定・出典の数値、年度、説明、出典導線を確認。titleとcanonicalは各1個。JS実行後の事業・年度付きcanonicalと事業名タイトルも確認。
- 通信503を与えて県内比較・検索候補・公式データ・全国地図のエラー/再試行を確認。地図失敗時も無料検索を利用できる。空結果と未収録年度は別状態。ブラウザー実行時エラー0件。
- 作業前後のトップと主要画面を撮影し、PC/モバイルの文字、料金、比較条件、出典日付、改定一覧を目視確認。生成画像・ログはローカルQA成果物としてGit外に保存。
- Gitleaksで今回の変更50ファイルを検査し、検出0件。追加差分の認証情報・個人メール・絶対ローカルパスも検査。`git diff --check`成功。
- 既存の公開データ、GIS、Prismaと競合コピーに関する1,630件の作業開始時ステータスを維持。DB・公式Excel・既存の金融ペイロードを更新していない。
- ステージング、コミット、push、本番公開、note操作、広告開始、外部イベント送信、有料契約は実行していない。

この合格は今回のローカル実装範囲に対するもの。第4節の未確認環境・本番設定・原典全件照合まで合格とするものではない。

## 8. 今回の変更ファイル

既存の地図変更との差分を除き、作業開始時から変わったファイルだけを列記する。

### ルート・SSGとエラー表示

- `app/data-sources/page.tsx`
- `app/error.tsx`
- `app/map/[prefectureCode]/page.tsx`
- `app/map/page.tsx`
- `app/municipalities/[municipalityCode]/page.tsx`
- `app/municipalities/page.tsx`
- `app/page.tsx`
- `app/rankings/[type]/page.tsx`
- `app/rankings/page.tsx`
- `app/revisions/page.tsx`

### 画面・条件保持・再試行

- `components/JapanMapSelector.tsx`
- `components/MunicipalitiesContent.tsx`
- `components/MunicipalityDetailClient.tsx`
- `components/MunicipalitySearch.tsx`
- `components/MunicipalitySearchFilters.tsx`
- `components/MunicipalityTable.tsx`
- `components/PrefectureComparisonPage.tsx`
- `components/PrefectureMapExplorer.tsx`
- `components/QuerySync.tsx`
- `components/RankingComparison.tsx`
- `components/RankingExplorer.tsx`
- `components/RankingNav.tsx`
- `components/RankingTable.tsx`
- `components/RevisionsContent.tsx`
- `components/municipality-detail/FinancialStory.tsx`
- `components/municipality-detail/PrefecturePeerComparison.tsx`
- `components/municipality-detail/YearbookOriginalData.tsx`

### 共通比較・年度・静的読込

- `lib/comparison.ts`
- `lib/format.ts`
- `lib/rankingCoverage.ts`
- `lib/staticData.ts`

### 生成・QAスクリプト

- `scripts/qa/comparison-phase1.mjs`
- `scripts/static/generate.ts`
- `scripts/static/rankingCoverage.ts`

### 回帰テスト

- `tests/accounting-copy-audit.test.ts`
- `tests/business-switch-ui.test.ts`
- `tests/citizen-diagnosis-entry-copy.test.ts`
- `tests/comparison-phase1.test.ts`
- `tests/home-search-ui.test.ts`
- `tests/map-page-shell.test.ts`
- `tests/national-map-ui.test.ts`
- `tests/prefecture-map-explorer-ui.test.ts`
- `tests/ranking-basis-ui.test.ts`
- `tests/revision-correctness.test.ts`

### メタデータと引き継ぎ

- `data/static/ranking-coverage.json`：3,470事業の母数、区分別件数と版ハッシュ。元の順位ファイルは維持。
- `data/static/source-provenance.json`：公表日・取得日。既存の出典ID・URL・カタログ年と照合。
- `AGENTS.md`：今回の範囲、比較・販売の制約、非公開方針を追記。
- `README.md`：比較条件、初期HTML、メタデータ更新と報告への導線。
- `docs/comparison-phase1.md`：現状調査、変更理由、検証、制約、商品設定と運営手順。
- `design-qa.md`：今回の検証ゲートを追記。
