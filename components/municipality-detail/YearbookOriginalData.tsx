"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { accountingTypeLabel } from "@/lib/businessDisplay";
import styles from "@/app/municipalities/[municipalityCode]/page.module.css";

type OriginalTable = {
  id: string;
  tableNo: number;
  tableName: string;
  sheetName: string;
  sourceUrl: string | null;
  columnSetId: string;
  rows: Array<Array<[number, string]>>;
};

type OriginalBusiness = {
  businessKey: string;
  accountingType: "legal_applied" | "non_legal_applied";
  tables: OriginalTable[];
};

type OriginalData = {
  fiscalYear: number;
  fiscalYearLabel: string;
  formatNote: string;
  columnSets: Record<string, string[]>;
  businesses: OriginalBusiness[];
};

export function YearbookOriginalData({
  enabled,
  municipalityCode,
  businessKey,
  accountingType
}: {
  enabled: boolean;
  municipalityCode: string;
  businessKey: string;
  accountingType: string;
}) {
  const [data, setData] = useState<OriginalData | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState("");

  useEffect(() => {
    if (!enabled || data || failed) return;
    let cancelled = false;
    fetch(`/data/static/yearbook/${municipalityCode}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Yearbook original data unavailable");
        return response.json() as Promise<OriginalData>;
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [data, enabled, failed, municipalityCode]);

  const business = useMemo(
    () => data?.businesses.find((candidate) => (
      candidate.businessKey === businessKey && candidate.accountingType === accountingType
    )) ?? null,
    [accountingType, businessKey, data]
  );

  useEffect(() => {
    if (!business?.tables.length) {
      setSelectedTableId("");
      return;
    }
    if (!business.tables.some((table) => table.id === selectedTableId)) {
      setSelectedTableId(business.tables[0].id);
    }
  }, [business, selectedTableId]);

  if (!enabled) return null;
  if (failed) {
    return <p className={styles.yearbookStatus}>地方公営企業年鑑の元データを読み込めませんでした。</p>;
  }
  if (!data) {
    return (
      <p className={styles.yearbookStatus} role="status">
        <Loader2 size={15} aria-hidden="true" />
        地方公営企業年鑑の元データを読み込んでいます…
      </p>
    );
  }
  if (!business || business.tables.length === 0) {
    return (
      <div className={styles.yearbookEmpty}>
        <strong>{data.fiscalYearLabel}の該当原表行はありません</strong>
        <p>表示中の事業・会計区分に一致するe-Stat公開Excel行を確認できませんでした。</p>
      </div>
    );
  }

  const table = business.tables.find((candidate) => candidate.id === selectedTableId) ?? business.tables[0];
  const columns = data.columnSets[table.columnSetId] ?? [];
  const visibleRows = table.rows.map((row) => new Map(row));
  return (
    <section className={styles.yearbookOriginal} aria-labelledby="yearbook-original-title">
      <div className={styles.yearbookToolbar}>
        <div>
          <span>{data.fiscalYearLabel} / {data.fiscalYear}年度決算</span>
          <h3 id="yearbook-original-title">地方公営企業年鑑の元データ</h3>
          <p>{data.formatNote} 本サイト側の項目名への置換や再計算はしていません。</p>
        </div>
        <label>
          <span>原表を選択</span>
          <select value={table.id} onChange={(event) => setSelectedTableId(event.target.value)}>
            {business.tables.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                第{candidate.tableNo}表 {candidate.tableName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.yearbookMeta}>
        <span>{accountingTypeLabel(business.accountingType)}</span>
        <span>第{table.tableNo}表 {table.tableName}</span>
        <span>{columns.length}列 / {table.rows.length}行</span>
        {table.sourceUrl ? (
          <a href={table.sourceUrl} target="_blank" rel="noreferrer">
            e-Statの元Excel
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <div className={styles.yearbookTableScroll} tabIndex={0} aria-label="地方公営企業年鑑の元データ。横方向にスクロールできます">
        <table className={styles.yearbookTable}>
          <caption>第{table.tableNo}表 {table.tableName}（列名・列順・値はe-Stat公開Excelのまま）</caption>
          <thead>
            <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={`${table.id}-${rowIndex}`}>
                {columns.map((column, columnIndex) => (
                  <td key={`${column}-${columnIndex}`}>{row.get(columnIndex) ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.yearbookScrollHint}>横にスクロールすると、公式Excelの全列を確認できます。</p>
    </section>
  );
}
