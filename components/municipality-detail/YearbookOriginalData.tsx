"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { accountingTypeLabel } from "@/lib/businessDisplay";
import { getFieldDefinition } from "@/lib/fieldDefinitions";
import { unitLabels } from "@/lib/fieldLabels";
import {
  compareOfficialValue,
  officialSourceNote,
  resolveOfficialRowReference,
  resolvePublishedCalculationReference,
  type OfficialRowReference
} from "@/lib/yearbookEvidence";
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

type EvidenceItem = {
  value?: unknown;
  unit?: string;
  tableNo?: number;
  tableName?: string;
  sourceUrl?: string;
};

export function YearbookOriginalData({
  enabled,
  municipalityCode,
  businessKey,
  accountingType,
  evidenceEntries,
  annual,
  diagnosis
}: {
  enabled: boolean;
  municipalityCode: string;
  businessKey: string;
  accountingType: string;
  evidenceEntries: Array<[string, EvidenceItem]>;
  annual: Record<string, any>;
  diagnosis: Record<string, any> | null;
}) {
  const [data, setData] = useState<IndividualData | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [allItemsOpen, setAllItemsOpen] = useState(true);

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

  useEffect(() => {
    setAllItemsOpen(true);
  }, [accountingType, businessKey]);

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
    <>
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

        <details
          className={styles.yearbookAllDetails}
          open={allItemsOpen}
          onToggle={(event) => setAllItemsOpen(event.currentTarget.open)}
        >
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

      <YearbookCalculationAudit
        business={business}
        annual={annual}
        diagnosis={diagnosis}
      />
      <YearbookEvidenceList business={business} entries={evidenceEntries} />
    </>
  );
}

function YearbookCalculationAudit({
  business,
  annual,
  diagnosis
}: {
  business: IndividualBusiness;
  annual: Record<string, any>;
  diagnosis: Record<string, any> | null;
}) {
  const revenue = finiteNumber(annual.sewerFeeRevenue);
  const volume = positiveNumber(annual.annualBillableVolume);
  const cost = finiteNumber(annual.wastewaterTreatmentCost);
  const fee = positiveNumber(annual.householdFee20m3Yen);
  const recovery = revenue != null && cost != null && cost > 0 ? revenue / cost * 100 : null;
  const feeUnit = revenue != null && volume != null ? revenue * 1000 / volume : null;
  const treatmentUnit = cost != null && volume != null ? cost * 1000 / volume : null;
  const shortfall = revenue != null && cost != null ? Math.max(cost - revenue, 0) : null;
  const requiredIncrease = revenue != null && cost != null && revenue > 0
    ? Math.max(cost / revenue - 1, 0) * 100
    : null;

  const revenueRef = resolveOfficialRowReference(business, "sewerFeeRevenue");
  const volumeRef = resolveOfficialRowReference(business, "annualBillableVolume");
  const costRef = resolveOfficialRowReference(business, "wastewaterTreatmentCost");
  const householdRef = resolveOfficialRowReference(business, "householdFee20m3Yen");
  const rows = [
    {
      label: "一般家庭用20m³／月",
      value: fee == null ? "未取得" : `${Math.round(fee).toLocaleString("ja-JP")}円／月`,
      formula: "料金表の公式値をそのまま表示（事業全体の回収額への換算はしません）",
      references: compactReferences([householdRef]),
      published: null
    },
    {
      label: "使用料単価",
      value: feeUnit == null ? "算定不可" : `${feeUnit.toFixed(1)}円／m³`,
      formula: "下水道使用料収入 × 1,000 ÷ 年間有収水量",
      references: compactReferences([revenueRef, volumeRef]),
      published: resolvePublishedCalculationReference(business, "feeUnitPrice")
    },
    {
      label: "汚水処理原価",
      value: treatmentUnit == null ? "算定不可" : `${treatmentUnit.toFixed(1)}円／m³`,
      formula: "汚水処理費 × 1,000 ÷ 年間有収水量",
      references: compactReferences([costRef, volumeRef]),
      published: resolvePublishedCalculationReference(business, "treatmentCost")
    },
    {
      label: "経費回収率",
      value: recovery == null ? "算定不可" : `${recovery.toFixed(1)}%`,
      formula: "下水道使用料収入 ÷ 汚水処理費 × 100",
      references: compactReferences([revenueRef, costRef]),
      published: resolvePublishedCalculationReference(business, "expenseRecoveryRate")
    },
    {
      label: "年間不足額・使用料収入の必要増加率",
      value: shortfall == null || requiredIncrease == null
        ? "算定不可"
        : shortfall > 0
          ? `${shortfall.toLocaleString("ja-JP")}千円・${requiredIncrease.toFixed(1)}%`
          : "不足なし",
      formula: "不足額 = 汚水処理費 − 下水道使用料収入／必要増加率 = 汚水処理費 ÷ 下水道使用料収入 − 1",
      references: compactReferences([revenueRef, costRef]),
      published: null
    }
  ];

  return (
    <section className={styles.yearbookAuditSection} aria-labelledby="yearbook-calculation-title">
      <div className={styles.yearbookAuditHeading}>
        <span>このサイトの表示との対応</span>
        <h3 id="yearbook-calculation-title">主要指標の計算式と公式個表の参照行</h3>
        <p>計算用の元値と、公式個表に同じ指標が掲載されている場合の表示値を照合しています。</p>
      </div>
      <div className={styles.yearbookCalculationList}>
        {rows.map((row) => (
          <article key={row.label}>
            <div className={styles.yearbookCalculationValue}>
              <strong>{row.label}</strong>
              <span>{row.value}</span>
            </div>
            <div className={styles.yearbookCalculationTrace}>
              <p>{row.formula}</p>
              <ReferenceLine references={row.references} />
              {row.published ? (
                <PublishedCheck
                  reference={row.published}
                  calculatedValue={
                    row.label === "使用料単価"
                      ? feeUnit
                      : row.label === "汚水処理原価"
                        ? treatmentUnit
                        : recovery
                  }
                  precision={row.label === "経費回収率" ? 1 : 2}
                />
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {diagnosis?.requiredRevisionRateTo100 != null && requiredIncrease != null ? (
        <p className={styles.yearbookAuditFootnote}>
          診断データの必要増加率 {(Math.max(Number(diagnosis.requiredRevisionRateTo100), 0) * 100).toFixed(1)}% と、上記の元値からの再計算結果 {requiredIncrease.toFixed(1)}% を照合しています。
        </p>
      ) : null}
    </section>
  );
}

function YearbookEvidenceList({
  business,
  entries
}: {
  business: IndividualBusiness;
  entries: Array<[string, EvidenceItem]>;
}) {
  return (
    <section className={`${styles.evidenceSection} ${styles.yearbookEvidenceSection}`} aria-labelledby="indicator-evidence-title">
      <div>
        <strong id="indicator-evidence-title">この画面で使用する主要項目</strong>
        <small>{entries.length}項目・e-Stat原資料と公式個表の対応</small>
      </div>
      {entries.length === 0 ? (
        <p className={styles.emptySupport}>表示できる根拠データは未登録です。</p>
      ) : (
        <div className={styles.evidenceList}>
          {entries.map(([field, item]) => {
            const definition = getFieldDefinition(field);
            const reference = resolveOfficialRowReference(business, field);
            const comparison = compareOfficialValue(item?.value, reference);
            const note = officialSourceNote(field, item?.tableNo);
            return (
              <article key={field}>
                <div>
                  <strong>{definition.label}</strong>
                  <small>{definition.meaning}</small>
                  {reference ? <ReferenceLine references={[reference]} /> : <small className={styles.yearbookNoIndividualRow}>{note}</small>}
                </div>
                <div>
                  <strong>{formatTraceValue(item?.value)} {unitLabels[item?.unit ?? ""] ?? item?.unit ?? definition.unit}</strong>
                  <small>{sourceTableLabel(item, definition.sourceTable)}</small>
                  {reference ? (
                    <small className={comparison === "mismatch" ? styles.yearbookMismatch : styles.yearbookVerified}>
                      {comparison === "exact"
                        ? "公式個表の表示値と一致"
                        : comparison === "dash_as_zero"
                          ? "個表の「-」を計算用データでは0として収録"
                          : "公式個表との一致を確認できません"}
                    </small>
                  ) : null}
                  {item?.sourceUrl ? (
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                      e-Stat原資料
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : <small>原資料リンク未登録</small>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ReferenceLine({ references }: { references: OfficialRowReference[] }) {
  if (references.length === 0) {
    return <small className={styles.yearbookNoIndividualRow}>表示中の公式個表に対応行はありません。</small>;
  }
  return (
    <small className={styles.yearbookReferenceLine}>
      {references.map((reference, index) => (
        <span key={`${reference.groupId}-${reference.rowNumber}`}>
          {index > 0 ? "／" : ""}
          <a href={reference.workbookUrl} target="_blank" rel="noreferrer">
            個表（{reference.groupNumber}）{reference.rowNumber}行
          </a>
          「{reference.label}」={reference.valueText || "空欄"}
        </span>
      ))}
    </small>
  );
}

function PublishedCheck({
  reference,
  calculatedValue,
  precision
}: {
  reference: OfficialRowReference;
  calculatedValue: number | null;
  precision: number;
}) {
  const comparison = compareOfficialValue(calculatedValue, reference, precision);
  return (
    <small className={comparison === "exact" ? styles.yearbookVerified : styles.yearbookMismatch}>
      {comparison === "exact" ? <CheckCircle2 size={12} aria-hidden="true" /> : null}
      公式掲載値 {reference.valueText}（個表（{reference.groupNumber}）{reference.rowNumber}行）と
      {comparison === "exact" ? "一致" : "不一致"}
    </small>
  );
}

function compactReferences(references: Array<OfficialRowReference | null>) {
  return references.filter((reference): reference is OfficialRowReference => Boolean(reference));
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumber(value: unknown) {
  const number = finiteNumber(value);
  return number != null && number > 0 ? number : null;
}

function formatTraceValue(value: unknown) {
  const number = finiteNumber(value);
  if (number != null) return number.toLocaleString("ja-JP");
  return value == null ? "不明" : String(value);
}

function sourceTableLabel(item: EvidenceItem, fallback: string) {
  const tableNo = item?.tableNo ? `${item.tableNo}表` : "";
  const tableName = item?.tableName ?? fallback;
  return [tableNo, tableName].filter(Boolean).join(" ");
}
