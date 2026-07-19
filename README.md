# 全国下水道使用料適正診断

総務省/e-Statの「地方公営企業決算状況調査 / 全国 / 調査表 / 年次」を取り込み、自治体・事業別に下水道使用料水準、経費回収率、必要改定率、改定リスクを表示する Next.js アプリです。

## 主な機能

- 自治体名・都道府県・かな検索
- 国土交通省 国土数値情報「行政区域データ N03」を使ったGIS地図選択
- 自治体詳細ページでの事業選択、R2〜R6料金指標、R6損益・貸借構造、公式改定情報表示
- 経費回収率、使用料単価、汚水処理原価、100%/80%/150円m³達成必要改定率の計算
- ランキング表示
- source_files / raw_stat_cells / annual_financials / diagnosis_results / financial_statement_items による根拠追跡
- e-Stat API取得と、`data/raw/manual` 配置ファイルの手動フォールバック
- 詳細ページとフッターの免責表示

## セットアップ

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

`.env.local`:

```bash
ESTAT_APP_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_SITE_NAME="全国下水道使用料適正診断"
```

e-Stat APIキーは e-Stat のAPI利用登録で取得し、`ESTAT_APP_ID` に設定します。APIキー未設定の場合、e-Stat API経由の発見処理は失敗します。ただし `data/manual/source_files.csv` と `data/raw/manual/{year}/` にファイルがある場合、`pnpm etl:all` は手動フォールバックで取込・計算まで実行します。

## コマンド

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm db:migrate
pnpm etl:discover
pnpm etl:download
pnpm etl:import
pnpm etl:statements
pnpm etl:calculate
pnpm etl:all
pnpm gis:build
```

`pnpm etl:all` はDBスキーマ準備の後、`discover -> download -> import -> calculate -> statements` を実行します。既定では直近5年分（2025,2024,2023,2022,2021）を対象にし、財務諸表はR5/R6の法適用事業を取り込みます。対象年を絞る場合は `--years` を指定してください。

## e-Stat ETL

対象統計:

- 政府統計コード: `00200251`
- 政府統計名: 地方財政状況調査
- 提供統計名: 地方公営企業決算状況調査
- 対象: 全国 / 調査表 / 年次 / 下水道事業 / 法適用・法非適用

API経路:

1. `getDataCatalog` で `地方公営企業決算状況調査 / 全国 / 調査表 / 年次` のリソースを発見
2. 法適用・法非適用の対象表を `source_files` に登録
3. e-Stat の `file-download` URLからExcelを保存し、`Content-Disposition` から実ファイル名と拡張子を判定
4. e-Stat横持ち形式の `団体コード / 業種コード / 表番号 / 行番号 / 列001...` から下水道事業行を抽出
5. 標準項目を `annual_financials` に統合し、根拠セルを `raw_stat_cells` に保存
6. `diagnosis_results` を再計算
7. 法適用の第20表（損益）・第21表（費用構成）・第22表（貸借）を `financial_statement_items` へ取り込み

年度指定:

```bash
pnpm etl:all
pnpm etl:all -- --years=2025,2024,2023,2022,2021
pnpm etl:discover -- --year=2024
```

e-Statのカタログ年と決算年度は1年ずれる場合があります。例えば2025年カタログの実ファイルには2024年度（R6）決算が入るため、画面の最新決算はファイル内の `決算年度` を優先します。

## GIS地図データ

トップページの地図選択は、国土交通省 国土数値情報「行政区域データ N03」の県別ZIP内GeoJSONをWeb表示用に軽量化した `public/gis/mlit-n03-simplified.json` を使用します。

出典:

- 国土交通省 国土数値情報 行政区域データ N03
- データ時点: 2023年1月1日
- 公式ページ: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v3_1.html

再生成:

```bash
pnpm gis:build
```

元ZIPは既定でOSの一時ディレクトリへキャッシュします。永続キャッシュを使う場合は次のように指定できます。

```bash
N03_CACHE_DIR=data/raw/gis/mlit-n03/2023 pnpm gis:build
```

`data/raw/gis` は巨大な元データ用のため `.gitignore` 対象です。配布・デプロイに必要なのは軽量化済みの `public/gis/mlit-n03-simplified.json` です。

## 手動フォールバック

e-Stat APIから直接Excel URLを解決できない場合は、手動でファイルを置けます。

```text
data/raw/manual/{year}/your_file.xlsx
data/manual/source_files.csv
```

`source_files.csv` には年度、表番号、表名、法適用区分、出典URL、ローカルパスを記録します。Excel/CSVは、標準列名を持つ場合は `annual_financials` に直接取り込み、通常の調査表形式の場合は生セルを `raw_stat_cells` に保存します。手動フォールバックは公式e-Stat取込みと同時に混ぜず、フォールバックモードでのみ登録します。

このリポジトリには検証用の小さな標準化CSVを同梱しています。これは実装検証用であり、本番データとしての完全な全国データではありません。実運用では e-Stat APIまたは公式Excelを使用してください。

## 会計方式と比較範囲

- 法適用・法非適用とも、総務省の統一定義による下水道使用料と汚水処理費を用いた料金指標は算定します。
- 法非適用の料金指標は画面上「参考」と明示します。
- 損益計算書・費用構成表・貸借対照表の構造図は、同一様式がある法適用事業だけを対象とし、法非適用に似た図を推測で作りません。

## 計算式

- 使用料単価 = 下水道使用料収入（千円） × 1000 ÷ 年間有収水量（m³）
- 汚水処理原価 = 汚水処理費（千円） × 1000 ÷ 年間有収水量（m³）
- 経費回収率 = 下水道使用料収入 ÷ 汚水処理費 × 100
- 100%達成必要改定率 = 汚水処理費 ÷ 下水道使用料収入 - 1
- 80%達成必要改定率 = 0.8 × 汚水処理費 ÷ 下水道使用料収入 - 1
- 150円/m³達成必要改定率 = 150 ÷ 使用料単価 - 1

## デプロイ

公開版は Next.js の static export で生成します。本番のリクエスト時に Node.js、Prisma、SQLite、Cloudflare D1、Pages Functions は使いません。

公開用データを更新する場合だけ、開発用の `prisma/dev.db` から公開可能な表示データを生成します。`prisma/dev.db`、ダウンロー元のローカルパス、環境変数、認証情報は出力されません。

```bash
pnpm install
pnpm static:data  # 公開データを更新するときだけ
pnpm test
pnpm build:pages
```

`pnpm build:pages` の出力先は `out` です。

### Cloudflare Pages の設定

- Production branch: `main`
- Build command: `pnpm build:pages`
- Build output directory: `out`
- Root directory: リポジトリルート
- Functions directory: 設定しない
- Environment variables / D1 binding: 本番表示には不要

生成済みの公開データは `data/static` と `public/data/static` に含まれるため、Cloudflare のビルド環境にデータベースやシークレットを渡す必要はありません。

- [Cloudflare Pages: Next.js static export](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)
- [Next.js: Static Exports](https://nextjs.org/docs/app/guides/static-exports)

独自ドメインは開発完了後に Pages プロジェクト側で設定できます。
