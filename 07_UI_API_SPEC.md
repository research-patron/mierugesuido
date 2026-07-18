# UI・API仕様

## 1. ページ構成

```text
/
/municipalities
/municipalities/[municipalityCode]
/rankings
/rankings/expense-recovery-low
/rankings/required-revision-high
/rankings/fee-unit-low
/rankings/treatment-cost-high
/data-sources
/about
/disclaimer
```

## 2. トップページ `/`

### 2.1 表示要素

- サービス名
- 説明文
- 全国マップ
- 地方選択
- 注目ランキングカード
- データ出典
- 免責文言

## 3. 自治体一覧 `/municipalities`

### 3.1 クエリパラメータ

- `q`: 検索文字列
- `prefecture`: 都道府県
- `label`: 診断ラベル
- `sort`: 並び順
- `page`: ページ番号

### 3.2 テーブル列

- 都道府県
- 自治体名
- 主な事業種別
- 最新年度
- 経費回収率
- 使用料単価
- 汚水処理原価
- 100％達成必要改定率
- 診断ラベル
- 公式改定予定

## 4. 自治体詳細 `/municipalities/[municipalityCode]`

### 4.1 セクション

1. ヘッダー
2. 最新診断サマリー
3. 事業別カード
4. 経費回収率・使用料単価・汚水処理原価の推移
5. 必要改定率
6. 会計上の収支
7. 繰入金・企業債
8. 公式改定情報
9. データ根拠
10. 計算式
11. 免責

### 4.2 サマリーカード

- 使用料適正判定
- 改定リスクラベル
- 経費回収率
- 必要改定率100
- 使用料単価
- 汚水処理原価

### 4.3 事業別カード

自治体に複数事業がある場合は、公共下水道、特定環境保全公共下水道、農業集落排水等をカードで表示する。

### 4.4 グラフ

MVPでは軽量なSVGまたはRechartsを使う。

- 経費回収率推移
- 使用料単価 vs 汚水処理原価
- 有収水量推移
- 一般会計繰入金推移

## 5. ランキング `/rankings`

### 5.1 ランキング種類

- 経費回収率が低い順
- 100％達成必要改定率が高い順
- 使用料単価が低い順
- 汚水処理原価が高い順
- 基準外繰入金が大きい順

### 5.2 表示ルール

- 異常値フラグがあるデータは注記アイコンを表示する。
- 分母欠損により計算不可のものはランキングから除外する。
- 自治体単位ランキングでは、代表事業を表示し、詳細では事業別を表示する。

## 6. API

### 6.1 `GET /api/search?q=`

自治体検索。

Response:

```json
{
  "items": [
    {
      "municipalityCode": "06201",
      "prefectureName": "山形県",
      "municipalityName": "山形市"
    }
  ]
}
```

### 6.2 `GET /api/municipalities`

一覧取得。

Query:

- `q`
- `prefecture`
- `label`
- `sort`
- `page`
- `limit`

### 6.3 `GET /api/municipalities/[municipalityCode]`

自治体詳細取得。

Responseに含めるもの：

- municipality
- businesses
- annualFinancials
- diagnosisResults
- revisionEvents
- sourceTrace

### 6.4 `GET /api/rankings/[type]`

ランキング取得。

Types:

- `expense-recovery-low`
- `required-revision-high`
- `fee-unit-low`
- `treatment-cost-high`
- `transfer-dependency-high`

### 6.5 `GET /api/data-sources`

取り込んだsource_files一覧。

## 7. 表示フォーマット

- 率: 小数1桁 `%`
- 円/m³: 小数1桁 `円/m³`
- 改定率: 小数1桁 `%`
- 金額: 百万円または億円に自動丸め
- 水量: 千m³または百万m³に自動丸め

## 8. 免責表示

すべての詳細ページとフッターに以下を表示する。

「本サイトの改定予想幅は、公開決算情報に基づく機械的な試算であり、各自治体の公式な改定予定ではありません。実際の使用料改定は、審議会、条例改正、住民負担、資金収支、施設更新計画、一般会計繰入方針等を踏まえて決定されます。」
