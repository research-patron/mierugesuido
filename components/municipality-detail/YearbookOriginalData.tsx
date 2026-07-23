"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { accountingTypeLabel } from "@/lib/businessDisplay";
import styles from "@/app/municipalities/[municipalityCode]/page.module.css";

type IndividualRow = {
  rowNumber: number;
  labelCells: string[];
  valueText: string;
  kind: "data" | "heading" | "note";
};

type IndividualGroup = {
  id: string;
  title: string;
  businessTypeName: string;
  workbookUrl: string;
  sheetName: string;
  rows: IndividualRow[];
};

type IndividualBusiness = {
  businessKey: string;
  accountingType: "legal_applied" | "non_legal_applied";
  operatorName: string;
  groups: IndividualGroup[];
};

type IndividualData = {
  fiscalYear: number;
  sourcePageUrl: string;
  businesses: IndividualBusiness[];
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
  const [data, setData] = useState<IndividualData | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  useEffect(() => {
    if (!enabled || data || failed) return;
    let cancelled = false;
    fetch(`/data/static/yearbook/${municipalityCode}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Yearbook individual data unavailable");
        return response.json() as Promise<IndividualData>;
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
    if (!business?.groups.length) {
      setSelectedGroupId("");
      return;
    }
    if (!business.groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(business.groups[0].id);
    }
  }, [business, selectedGroupId]);

  if (!enabled) return null;
  if (failed) {
    return <p className={styles.yearbookStatus}>地方公営企業年鑑「個表」の自治体別抜粋を読み込めませんでした。</p>;
  }
  if (!data) {
    return (
      <p className={styles.yearbookStatus} role="status">
        <Loader2 size={15} aria-hidden="true" />
        地方公営企業年鑑「個表」の自治体別抜粋を読み込んでいます…
      </p>
    );
  }
  if (!business || business.groups.length === 0) {
    return (
      <div className={styles.yearbookEmpty}>
        <strong>R{data.fiscalYear - 2018}の該当する公式個表列はありません</strong>
        <p>表示中の事業・会計区分に一致する自治体列を確認できませんでした。総務省の原資料もあわせて確認してください。</p>
        <a href={data.sourcePageUrl} target="_blank" rel="noreferrer">
          総務省「12．個表」
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    );
  }

  const group = business.groups.find((candidate) => candidate.id === selectedGroupId) ?? business.groups[0];
  return (
    <section className={styles.yearbookOriginal} aria-labelledby="yearbook-original-title">
      <div className={styles.yearbookToolbar}>
        <div>
          <span>R{data.fiscalYear - 2018} / {data.fiscalYear}年度決算</span>
          <h3 id="yearbook-original-title">地方公営企業年鑑「個表」の自治体別抜粋</h3>
          <p>総務省Excelの自治体列を、公式の項目順・階層・表示値のまま読みやすく縦に並べています。Excelの画面そのものを再現した表示ではありません。</p>
        </div>
        <a className={styles.yearbookSourcePageLink} href={data.sourcePageUrl} target="_blank" rel="noreferrer">
          総務省「12．個表」
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

      <div className={styles.yearbookMeta}>
        <span>{accountingTypeLabel(business.accountingType)}</span>
        <span>{group.businessTypeName}</span>
        <span>運営団体：{business.operatorName}</span>
        <a href={group.workbookUrl} target="_blank" rel="noreferrer">
          選択中の公式Excel
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

      <details className={styles.yearbookAllDetails}>
        <summary>
          <span>
            <strong>公式個表の全項目を見る</strong>
            <small>{business.groups.length}個表を選択できます</small>
          </span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <div className={styles.yearbookGroupToolbar}>
          <label>
            <span>個表を選択</span>
            <select value={group.id} onChange={(event) => setSelectedGroupId(event.target.value)}>
              {business.groups.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}（{candidate.sheetName}）
                </option>
              ))}
            </select>
          </label>
          <div>
            <strong>{group.title}</strong>
            <small>{group.sheetName}・{group.rows.length}項目</small>
          </div>
        </div>

        <div className={styles.yearbookRowsViewport} tabIndex={0} aria-label={`${group.title}の自治体別抜粋`}>
          <table className={styles.yearbookRowsTable}>
            <caption>{group.title}、{business.operatorName}の自治体別抜粋</caption>
            <thead><tr><th scope="col">公式項目</th><th scope="col">値</th></tr></thead>
            <tbody>
              {group.rows.map((row) => {
                const label = row.labelCells.filter(Boolean).join("　");
                if (row.kind === "heading" || row.kind === "note") {
                  return (
                    <tr key={`${group.id}-${row.rowNumber}`} className={row.kind === "note" ? styles.yearbookNoteRow : styles.yearbookHeadingRow}>
                      <th colSpan={2}>{label}<small>{row.rowNumber}行</small></th>
                    </tr>
                  );
                }
                return (
                  <tr key={`${group.id}-${row.rowNumber}`}>
                    <th scope="row">
                      <span>{label}</span>
                      <small>{row.rowNumber}行</small>
                    </th>
                    <td>{row.valueText === "" ? <span className={styles.yearbookBlank}>空欄</span> : row.valueText}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
