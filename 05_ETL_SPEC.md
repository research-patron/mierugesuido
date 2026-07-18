# ETL処理仕様

## 1. 全体フロー

```text
Discover → Download → Parse Layout → Import Raw Cells → Normalize Fields → Calculate Indicators → Build Search Index
```

## 2. Discover

### 2.1 目的

e-Statから対象年度・対象表のファイルメタデータを収集し、`source_files` に保存する。

### 2.2 対象

- 地方公営企業決算状況調査
- 全国
- 調査表
- 年次
- 下水道事業（一）法適用
- 下水道事業（二）法適用
- 下水道事業（一）法非適用
- 下水道事業（二）法非適用
- 表番号: 法適用 19,20,21,22,23,24,32,33,34,40,45
- 表番号: 法非適用 10,21,24,26,32,33,34,40,45

### 2.3 実装要件

- `ESTAT_APP_ID` がある場合はAPIを使う。
- APIで対象ファイルURLが取れない場合は、e-Statのファイル一覧HTMLを取得してリンク抽出する。
- ファイル名、表番号、表名、法適用区分、調査年月、公開日を抽出する。
- 取得できなかった表はwarningとして記録し、処理全体は継続する。

## 3. Download

### 3.1 目的

Discoverしたファイルを `data/raw/e-stat/{year}/` に保存する。

### 3.2 要件

- 既に同じSHA256のファイルがある場合は再ダウンロードしない。
- HTTP失敗時は3回リトライする。
- 保存後に `source_files.sha256` を更新する。
- Excel, CSV, PDFが混在した場合は、MVPではExcel/CSVのみ解析対象。PDFはsourceとして保存のみ。

## 4. Parse Layout

### 4.1 目的

調査表レイアウトExcelを読み、標準項目の表番号・行番号・列番号・項目名を特定する。

### 4.2 要件

- `03_FIELD_MAPPING.yml` の `item_keywords` を使って項目候補を検索する。
- 行・列番号が明記されている場合は優先する。
- 項目名が複数候補の場合はconfidenceを算出し、最も高い候補を採用する。
- confidenceが0.7未満の場合は `field_mappings` に保存するが `requires_review` フラグを付ける。
- レイアウト差分を `data/processed/layout_diff/{year}.json` に出力する。

## 5. Import Raw Cells

### 5.1 目的

Excel/CSVから生値を読み取り、`raw_stat_cells` に保存する。

### 5.2 要件

- セルの値、行番号、列番号、シート名、セルアドレスを保存する。
- 数値変換できる値は `value_numeric` に保存する。
- 団体コード、団体名、都道府県、会計名、事業種別を抽出する。
- 抽出できない場合は、行周辺のヘッダから推定し、confidenceをログに残す。
- 失敗行はスキップせず、エラーとして `etl_runs.log_json` に保存する。

## 6. Normalize Fields

### 6.1 目的

`raw_stat_cells` からサイトで使う標準項目へ変換し、`annual_financials` に保存する。

### 6.2 要件

- `field_mappings` を使って標準項目を抽出する。
- 同一自治体・同一事業・同一年度の重複は統合する。
- 公共下水道、特定環境保全公共下水道、農業集落排水、漁業集落排水、個別排水等は `sewer_businesses.business_type` で保持する。
- 法適用移行年度の打切決算はフラグ化する。
- 値が欠損している場合、計算に使う指標はNULLにする。

## 7. Calculate Indicators

### 7.1 目的

`annual_financials` から指標を計算し、`diagnosis_results` に保存する。

### 7.2 要件

- 使用料単価、汚水処理原価、経費回収率、必要改定率を計算する。
- 分母が0またはNULLの場合は計算値をNULLにする。
- 異常値フラグを生成する。
- `calculation_trace_json` に使用した値と式を保存する。

## 8. Build Search Index

### 8.1 目的

自治体名・都道府県・事業名で検索できるようにする。

### 8.2 要件

- SQLite FTSまたは単純LIKE検索でMVP対応。
- 検索対象: 自治体名、自治体名かな、都道府県名、事業名。

## 9. ログ・再実行性

- 各ETL処理は `etl_runs` に記録する。
- 同じ年度を再実行しても重複データを作らない。
- source fileのSHA256が変わった場合のみ再インポートする。
