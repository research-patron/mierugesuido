# Codexへの実装指示プロンプト

あなたはフルスタックエンジニア兼データエンジニアです。
このリポジトリに、総務省/e-Statが公開している「地方公営企業決算状況調査」の下水道事業データを取り込み、全国自治体別・事業別に下水道使用料の適正度、経費回収率、必要改定率、改定リスクを表示するWebサイトを実装してください。

## 最重要ゴール

ユーザーが自治体名を検索すると、以下が分かるサイトを作る。

- 下水道使用料収入で汚水処理費をどの程度回収できているか
- 経費回収率100％達成に必要な理論上の使用料改定率
- 経費回収率80％達成に必要な最低改善ライン
- 使用料単価150円/m³達成に必要な改定率
- 会計上の黒字・赤字と、使用料水準の不足を分けた判定
- 一般会計繰入金・企業債残高・有収水量推移等を踏まえた改定リスク
- 実際に自治体公式サイトで改定予定が確認された場合の改定情報

## 実装資料

以下の資料に従って実装すること。

- `01_REQUIREMENTS.md`
- `02_DATA_SOURCES_AND_DOWNLOAD.md`
- `03_FIELD_MAPPING.yml`
- `04_DATABASE_SCHEMA.sql`
- `05_ETL_SPEC.md`
- `06_CALCULATION_AND_DIAGNOSIS.md`
- `07_UI_API_SPEC.md`
- `08_TEST_PLAN.md`
- `09_DISCLAIMER_AND_COPY.md`

## 技術スタック

原則として以下で実装する。

- Frontend: Next.js App Router + TypeScript
- Styling: Tailwind CSS
- Backend/API: Next.js Route Handlers
- DB: SQLite + Prisma
- ETL: Python 3.11+ または Node.js。Excel処理が安定するならPythonを優先
- Data scripts: `scripts/` 配下
- Tests: Vitest または pytest。ETL検算は必須
- Package manager: pnpm

ただし、既存リポジトリに別スタックがある場合は、既存構成に合わせてよい。その場合でも、機能要件、DB構造、計算式、検算要件は変更しないこと。

## 必須コマンド

以下のコマンドを実装すること。

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm db:migrate
pnpm etl:discover
pnpm etl:download
pnpm etl:import
pnpm etl:calculate
pnpm etl:all
```

各コマンドの意味：

- `etl:discover`: e-Stat APIまたはデータカタログから、対象年度・対象表のファイルメタデータを収集する。
- `etl:download`: 対象Excel/CSVを `data/raw/e-stat/{year}/` に保存する。
- `etl:import`: rawファイルを読み、標準テーブルへ取り込む。
- `etl:calculate`: 使用料単価、汚水処理原価、経費回収率、必要改定率、診断結果を計算する。
- `etl:all`: discover → download → import → calculate を順に実行する。

## `.env.local` に必要な環境変数

```bash
ESTAT_APP_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_SITE_NAME="全国下水道使用料適正診断"
```

`ESTAT_APP_ID` が未設定の場合、e-Stat API経由の取得は失敗させ、エラーメッセージで取得方法を案内すること。ただし、手動で `data/raw` にExcelを置いた場合はインポート可能にする。

## 必須実装

1. e-Statから地方公営企業決算状況調査の下水道事業関連ファイルを取得する。
2. 法適用・法非適用の両方に対応する。
3. 生データを保存する `raw_stat_cells` 的なテーブルを持つ。
4. 標準項目に変換する `annual_financials` 的なテーブルを持つ。
5. 計算結果を `diagnosis_results` に保存する。
6. 自治体一覧、検索、詳細ページ、ランキングページを作る。
7. 診断結果には必ず「公式決算値」と「サイト独自試算」を分けて表示する。
8. 免責文言を全詳細ページとフッターに表示する。
9. 初回実装では、自治体公式サイトの改定予定クローリングはモジュールだけ作り、CSV/JSONで手動登録できる仕組みを必須とする。自動クロールは第2段階でよい。
10. テストデータまたは一部自治体の実データで、経費回収率の再計算が既存資料と概ね一致することを検算する。

## 実装時の強い制約

- モックデータのみで完成扱いにしないこと。
- 計算式を画面に表示すること。
- 調書の表番号・行番号・列番号・項目名をDBまたは設定ファイルに保存し、コードに直書きしないこと。
- 年度により調書レイアウトが変わる可能性を考慮すること。
- 法適用移行年度、打切決算、事業統合、会計統合に備え、異常値・注記フラグを持つこと。
- 「赤字」「値上げ確実」と断定しないこと。表現は「会計上の収支」「使用料水準」「改定リスク」「理論上の必要改定率」に分けること。

## 完了条件

以下がすべて満たされれば完了。

- `pnpm build` が成功する。
- `pnpm test` が成功する。
- 最新年度または指定年度のe-Statデータをダウンロードできる。
- 少なくとも1年度分の下水道事業データをDBに取り込める。
- 自治体名検索が動く。
- 自治体詳細ページで、経費回収率、使用料単価、汚水処理原価、必要改定率、診断コメントが表示される。
- ランキングページが表示される。
- ソースURL、年度、調書表番号、項目名を画面または詳細表示で追跡できる。
- READMEにセットアップ手順、e-Stat APIキー取得方法、ETL実行方法、デプロイ方法を書く。
