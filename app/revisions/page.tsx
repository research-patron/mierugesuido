"use client";

import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
  Info,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  Search,
  X
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { accountingTypeLabel, displayBusinessName } from "@/lib/businessDisplay";
import { formatOfficialRevisionRate } from "@/lib/format";
import { municipalityDetailHref } from "@/lib/municipalityLinks";
import { isStaticRevisionDataset, type StaticRevisionDataset } from "@/lib/staticRevisionDataset";
import type {
  YearbookFeeChange,
  YearbookFeeChangeSupportReason
} from "@/lib/yearbookFeeChanges";

type FilterOption = { value: string; label: string };
type RevisionLoadState = "loading" | "ready" | "error";
type RevisionMunicipalityGroup = {
  key: string;
  municipalityCode: string | null;
  prefectureName: string;
  operatorName: string;
  items: YearbookFeeChange[];
};

const revisionGroupPageSize = 40;

const supportReasonLabels: Record<YearbookFeeChangeSupportReason, string> = {
  previous_date_matches: "R6の前回使用料改定年月日が、R5の現行使用料施行年月日と一致",
  official_rate_reported: "R6の実質使用料改定率に数値の記載あり",
  tariff_changed: "家庭用または業務用の料金額に差異あり",
  tariff_system_changed: "料金体系に関する項目に差異あり"
};

const tariffSystemLabels: Record<string, string> = {
  systemCodeRaw: "使用料体系（原表コード）",
  waterVolumeRankCount: "水量ランク数",
  minimumExcessUnitPriceYenPerM3: "最低ランクの超過使用料",
  maximumExcessUnitPriceYenPerM3: "最高ランクの超過使用料",
  progressivity: "累進度"
};

export default function RevisionsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1500px] px-8 py-12 text-sm font-bold text-muted">第33表の施行年月日比較データを読み込んでいます…</div>}>
      <RevisionsContent />
    </Suspense>
  );
}

function RevisionsContent() {
  const searchParams = useSearchParams();
  const [dataset, setDataset] = useState<StaticRevisionDataset | null>(null);
  const [loadState, setLoadState] = useState<RevisionLoadState>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [visibleGroupCount, setVisibleGroupCount] = useState(revisionGroupPageSize);

  useEffect(() => {
    let cancelled = false;
    setDataset(null);
    setLoadState("loading");
    fetch("/data/static/revisions.json")
      .then((response) => {
        if (!response.ok) throw new Error("Revision data unavailable");
        return response.json();
      })
      .then((json: unknown) => {
        if (!isStaticRevisionDataset(json)) throw new Error("Revision data invalid");
        if (!cancelled) {
          setDataset(json);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataset(null);
          setLoadState("error");
        }
      });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  const prefecture = searchParams.get("prefecture") ?? "";
  const businessType = searchParams.get("businessType") ?? "";
  const comparison = dataset?.yearbookFeeComparison;
  const comparisonItems = useMemo(
    () => (comparison?.items ?? []).filter(hasChangedEffectiveDateShape),
    [comparison?.items]
  );
  const matchingItems = useMemo(() => comparisonItems
    .filter((item) => !prefecture || item.prefectureName.includes(prefecture))
    .filter((item) => !businessType || item.categoryCode === businessType),
  [businessType, comparisonItems, prefecture]);
  const matchingGroups = useMemo(
    () => groupYearbookChangesByMunicipality(matchingItems),
    [matchingItems]
  );
  const visibleGroups = matchingGroups.slice(0, visibleGroupCount);
  const visibleBusinessCount = visibleGroups.reduce((total, group) => total + group.items.length, 0);

  useEffect(() => {
    setVisibleGroupCount(revisionGroupPageSize);
  }, [businessType, prefecture]);
  const availablePrefectures = useMemo(
    () => [...new Set(comparisonItems.map((item) => item.prefectureName))]
      .sort((a, b) => a.localeCompare(b, "ja")),
    [comparisonItems]
  );
  const availableBusinesses = useMemo(() => {
    const labels = new Map<string, string>();
    comparisonItems.forEach((item) => labels.set(item.categoryCode, item.businessName));
    return [...labels.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ja"));
  }, [comparisonItems]);
  const isLoading = loadState === "loading";
  const hasLoadError = loadState === "error";
  const municipalityKpiValue = loadState === "ready" && comparison
    ? comparison.changedMunicipalityCount.toLocaleString("ja-JP")
    : isLoading ? "読込中" : "取得失敗";
  const businessKpiValue = loadState === "ready" && comparison
    ? comparison.changedBusinessCount.toLocaleString("ja-JP")
    : isLoading ? "読込中" : "取得失敗";

  return (
    <div className="revision-page">
      <section className="water-band border-b border-line">
        <div className="revision-hero mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="text-xs font-black text-teal">地方公営企業決算状況調査 R5 → R6</div>
          <h1 className="mt-1 text-3xl font-black text-ink sm:text-4xl">使用料施行年月日の変更一覧</h1>
          <p className="revision-lead">
            同一事業の「現行使用料施行年月日」がR5からR6で変わった記録だけを表示します。まず施行日を比較し、料金額や改定率は各行の参考情報として確認できます。
          </p>

          <div className="revision-evidence-note" role="note">
            <Info className="mt-0.5 shrink-0 text-teal" size={20} aria-hidden="true" />
            <div>
              <strong>金額差だけでは一覧に含めません</strong>
              <p>
                抽出条件は第33表の施行年月日の変化だけです。料金改定の内容や理由は、条例、議会資料、広報など各自治体の公式資料で最終確認してください。
              </p>
            </div>
          </div>

          <div
            className="revision-kpi-grid grid gap-3 sm:grid-cols-2"
            aria-busy={isLoading}
          >
            <StatCard
              icon={MapPinned}
              label="施行年月日が変わった団体"
              value={municipalityKpiValue}
              unit={loadState === "ready" ? "団体" : undefined}
              sub={loadState === "ready" ? "同一団体は1件として集計" : isLoading ? "比較結果を読み込んでいます" : "データを再取得してください"}
              tone="teal"
            />
            <StatCard
              icon={Building2}
              label="施行年月日が変わった事業"
              value={businessKpiValue}
              unit={loadState === "ready" ? "事業" : undefined}
              sub={loadState === "ready" ? "R5・R6の同一事業を比較" : isLoading ? "比較結果を読み込んでいます" : "データを再取得してください"}
              tone="blue"
            />
          </div>
        </div>
      </section>

      <section className="revision-content mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <section className="panel revision-filter-panel" aria-labelledby="revision-filter-heading">
          <form action="/revisions" className="revision-filter-form">
            <div className="revision-filter-heading">
              <div>
                <h2 id="revision-filter-heading">表示を絞り込む</h2>
                <p>都道府県名を入力するか候補から選び、必要に応じて事業を指定します。</p>
              </div>
              <Link href="/revisions">条件をクリア</Link>
            </div>
            <PrefectureCombobox value={prefecture} options={availablePrefectures} />
            <FilterSelect label="事業" name="businessType" value={businessType} options={availableBusinesses} />
            <button type="submit" className="button-primary">この条件で表示</button>
          </form>
          <div className="revision-source-links">
            <span>出典</span>
            <strong>{comparison?.sourceLabel ?? "総務省 地方公営企業決算状況調査 第33表"}</strong>
            <SourceLink href={comparison?.sourcePageUrls.r5 ?? ""}>R5 e-Stat</SourceLink>
            <SourceLink href={comparison?.sourcePageUrls.r6 ?? ""}>R6 e-Stat</SourceLink>
          </div>
        </section>

        <section className="panel revision-results-panel">
          <div className="revision-list-heading">
            <div>
              <h2>施行年月日が変わった事業</h2>
              <p>
                {loadState === "ready"
                  ? `${matchingGroups.length.toLocaleString("ja-JP")}団体・${matchingItems.length.toLocaleString("ja-JP")}事業中、${visibleGroups.length.toLocaleString("ja-JP")}団体（${visibleBusinessCount.toLocaleString("ja-JP")}事業）を表示`
                  : isLoading ? "比較結果を読み込んでいます" : "比較結果を表示できません"}
              </p>
            </div>
            <p className="revision-list-rule"><CalendarDays size={16} aria-hidden="true" /> 抽出条件：R5とR6の施行年月日が異なる事業</p>
          </div>

          {isLoading ? (
            <div className="revision-empty-state" role="status" aria-live="polite">
              <LoaderCircle className="mx-auto animate-spin text-teal" size={38} aria-hidden="true" />
              <h3>施行年月日比較データを読み込んでいます</h3>
              <p>R5・R6の現行使用料施行年月日を比較した結果を取得しています。</p>
            </div>
          ) : hasLoadError ? (
            <div className="revision-empty-state" role="alert">
              <Info className="mx-auto text-amber" size={38} aria-hidden="true" />
              <h3>施行年月日比較データを取得できませんでした</h3>
              <p>通信状況を確認して再試行してください。解決しない場合は、ページを再読み込みしてください。</p>
              <button
                type="button"
                className="button-secondary mt-4"
                onClick={() => setLoadAttempt((current) => current + 1)}
              >
                <RefreshCw size={15} aria-hidden="true" />
                再試行する
              </button>
            </div>
          ) : (
            <>
              <div className="revision-comparison-list">
                {visibleGroups.map((group) => <MunicipalityChangeGroup key={group.key} group={group} />)}
              </div>
              {matchingItems.length === 0 ? (
                <div className="revision-empty-state">
                  <CalendarDays className="mx-auto text-teal" size={38} aria-hidden="true" />
                  <h3>条件に一致する記録はありません</h3>
                  <p>条件をクリアして、判定結果をもう一度ご確認ください。</p>
                </div>
              ) : null}
              {visibleGroups.length < matchingGroups.length ? (
                <div className="revision-load-more">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setVisibleGroupCount((current) => current + revisionGroupPageSize)}
                  >
                    さらに{Math.min(revisionGroupPageSize, matchingGroups.length - visibleGroups.length).toLocaleString("ja-JP")}団体を表示
                  </button>
                  <span>残り{(matchingGroups.length - visibleGroups.length).toLocaleString("ja-JP")}団体</span>
                </div>
              ) : null}
            </>
          )}
        </section>

        <details className="panel revision-official-disclosure">
          <summary onKeyDown={toggleDetailsOnKeyboard}>
            <span>
              <strong>自治体が公式に公表した改定情報</strong>
              <small>
                {loadState === "ready" && dataset
                  ? `${dataset.summary.total.toLocaleString("ja-JP")}件登録・第33表の年月日比較とは別枠`
                  : isLoading ? "自治体公式情報を読み込んでいます" : "自治体公式情報を取得できませんでした"}
              </small>
            </span>
            <span>詳細を見る <ChevronDown size={15} aria-hidden="true" /></span>
          </summary>
          <div className="revision-official-body">
            {isLoading ? (
              <p>自治体公式情報を読み込んでいます。</p>
            ) : hasLoadError ? (
              <p>自治体公式情報を取得できませんでした。上の「再試行する」からデータを再取得してください。</p>
            ) : dataset?.items.length ? dataset.items.map((event) => (
              <article key={event.id} className="revision-official-row">
                <div>
                  <strong>{event.municipality.prefectureName} {event.municipality.municipalityName}</strong>
                  <span>{event.targetBusiness ?? displayBusinessName(event.sewerBusiness ?? {})}</span>
                </div>
                <div>
                  <span>{event.effectiveDate ?? "施行日未定"}・{formatOfficialRevisionRate(event.averageRevisionRate)}</span>
                  <a href={event.sourceUrl} target="_blank" rel="noreferrer">公式資料 <ExternalLink size={13} aria-hidden="true" /></a>
                </div>
              </article>
            )) : (
              <p>登録済みの自治体公式公表はありません。第33表の比較結果と混同しないよう、0件のまま別枠で表示しています。</p>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}

function groupYearbookChangesByMunicipality(items: YearbookFeeChange[]): RevisionMunicipalityGroup[] {
  const groups: RevisionMunicipalityGroup[] = [];
  const groupsByKey = new Map<string, RevisionMunicipalityGroup>();

  items.forEach((item) => {
    const key = item.municipalityCode
      ? `code:${item.municipalityCode}`
      : `name:${item.prefectureName}\u0000${item.operatorName}`;
    const existing = groupsByKey.get(key);

    if (existing) {
      existing.items.push(item);
      return;
    }

    const group = {
      key,
      municipalityCode: item.municipalityCode,
      prefectureName: item.prefectureName,
      operatorName: item.operatorName,
      items: [item]
    };
    groupsByKey.set(key, group);
    groups.push(group);
  });

  return groups;
}

function MunicipalityChangeGroup({ group }: { group: RevisionMunicipalityGroup }) {
  const headingId = useId();
  const firstBusiness = group.items[0];
  const detailHref = group.municipalityCode
    ? municipalityDetailHref(group.municipalityCode, firstBusiness.businessKey, "fees")
    : null;

  return (
    <section className="revision-municipality-group" aria-labelledby={headingId}>
      <header className="revision-municipality-header">
        <div>
          <span className="revision-location">{group.prefectureName}</span>
          <h3 id={headingId}>
            {detailHref ? <Link href={detailHref}>{group.operatorName}</Link> : group.operatorName}
          </h3>
        </div>
        <span className="revision-municipality-count">{group.items.length.toLocaleString("ja-JP")}事業</span>
      </header>
      <div className="revision-municipality-businesses">
        {group.items.map((item) => <YearbookChangeRow key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function YearbookChangeRow({ item }: { item: YearbookFeeChange }) {
  const businessHeadingId = useId();
  const detailHref = item.municipalityCode
    ? municipalityDetailHref(item.municipalityCode, item.businessKey, "fees")
    : null;
  const businessTariffChanges = item.tariffChanges.filter((change) => change.key !== "householdFee20m3Yen");
  const accountingChanged = item.accountingTypes.r5 !== item.accountingTypes.r6;

  return (
    <article className="revision-comparison-row" aria-labelledby={businessHeadingId}>
      <header className="revision-row-header">
        <div>
          <h4 id={businessHeadingId}>
            {detailHref ? <Link href={detailHref}>{item.businessName}</Link> : item.businessName}
          </h4>
          <span>{accountingTypeLabel(item.accountingType)}</span>
        </div>
        <span className="revision-date-change-badge"><CalendarDays size={14} aria-hidden="true" />施行年月日が変化</span>
      </header>

      <div className="revision-date-section">
        <div className="revision-section-label">
          <span>主判定項目</span>
          <strong>現行使用料施行年月日</strong>
        </div>
        <div className="revision-date-comparison" aria-label={`現行使用料施行年月日 R5 ${formatIsoDate(item.currentUsageFeeEffectiveDate.r5.iso)} R6 ${formatIsoDate(item.currentUsageFeeEffectiveDate.r6.iso)}`}>
          <div><span>R5</span><strong>{formatIsoDate(item.currentUsageFeeEffectiveDate.r5.iso)}</strong></div>
          <ArrowRight size={18} aria-hidden="true" />
          <div><span>R6</span><strong>{formatIsoDate(item.currentUsageFeeEffectiveDate.r6.iso)}</strong></div>
        </div>
        <p>この施行年月日の変化だけを条件に、この一覧へ掲載しています。</p>
      </div>

      <div className="revision-rate-section">
        <div>
          <span className="revision-field-kicker">第33表の公式記載</span>
          <strong>実質使用料改定率</strong>
        </div>
        <dl>
          <div><dt>一般家庭用20m³</dt><dd>{formatOfficialPercent(item.officialRevisionRate.household20m3Percent)}</dd></div>
          <div><dt>平均</dt><dd>{formatOfficialPercent(item.officialRevisionRate.averagePercent)}</dd></div>
        </dl>
      </div>

      <div className="revision-household-section">
        <div>
          <span className="revision-field-kicker">一般家庭への影響額（参考）</span>
          <strong>一般家庭用20m³／月</strong>
        </div>
        <div className="revision-household-comparison">
          <span>R5 {formatYen(item.householdFee20m3.r5)}</span>
          <ArrowRight size={16} aria-hidden="true" />
          <span>R6 {formatYen(item.householdFee20m3.r6)}</span>
          <b>{formatYenDelta(item.householdFee20m3.delta)}</b>
        </div>
        <div className="revision-simple-rate">
          <span>20m³料金の単純変化率</span>
          <strong>{formatSimpleChangeRate(item.householdFee20m3.changeRate)}</strong>
          <small>公式の実質使用料改定率とは異なる単純計算です。</small>
        </div>
      </div>

      <details className="revision-detail-disclosure">
        <summary onKeyDown={toggleDetailsOnKeyboard}>
          <span>業務用料金・料金体系・関連項目を見る</span>
          <ChevronDown className="revision-disclosure-chevron" size={16} aria-hidden="true" />
        </summary>
        <div className="revision-detail-body">
          <section>
            <h5>業務用料金の差異</h5>
            {businessTariffChanges.length ? (
              <dl className="revision-change-list">
                {businessTariffChanges.map((change) => (
                  <div key={change.key}>
                    <dt>{change.label}</dt>
                    <dd>R5 {formatYen(change.r5)} <span aria-hidden="true">→</span> R6 {formatYen(change.r6)} <b>{formatYenDelta(change.delta)}</b></dd>
                  </div>
                ))}
              </dl>
            ) : <p>比較できる業務用料金に差異はありません。</p>}
          </section>

          <section>
            <h5>料金体系の差異</h5>
            {item.tariffSystemChanges.length ? (
              <dl className="revision-change-list">
                {item.tariffSystemChanges.map((change) => (
                  <div key={change.key}>
                    <dt>{tariffSystemLabels[change.key] ?? change.key}</dt>
                    <dd>R5 {formatTariffSystemSignal(change.key, change.r5)} <span aria-hidden="true">→</span> R6 {formatTariffSystemSignal(change.key, change.r6)}</dd>
                  </div>
                ))}
              </dl>
            ) : <p>比較できる料金体系項目に差異はありません。</p>}
          </section>

          <section>
            <h5>関連する第33表の記載</h5>
            {item.supportReasons.length ? (
              <ul className="revision-reason-list">
                {item.supportReasons.map((reason) => <li key={reason}><CheckCircle2 size={14} aria-hidden="true" />{supportReasonLabels[reason]}</li>)}
              </ul>
            ) : <p>第33表内で関連する記載を確認できませんでした。</p>}
            <dl className="revision-context-list">
              <div><dt>R6の前回使用料改定年月日</dt><dd>{formatOptionalIsoDate(item.previousUsageFeeRevisionDate.r6.iso)}</dd></div>
              <div><dt>R5現行施行日との一致</dt><dd>{item.previousUsageFeeRevisionDate.r6MatchesR5Current ? "一致" : "一致を確認できず"}</dd></div>
              {accountingChanged ? <div><dt>会計区分</dt><dd>R5 {accountingTypeLabel(item.accountingTypes.r5)} → R6 {accountingTypeLabel(item.accountingTypes.r6)}</dd></div> : null}
            </dl>
          </section>
        </div>
      </details>
    </article>
  );
}

function PrefectureCombobox({ value, options }: { value: string; options: string[] }) {
  const inputId = useId();
  const listboxId = `${inputId}-options`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => setQuery(value), [value]);

  const filteredOptions = useMemo(
    () => filterPrefectureOptions(options, query),
    [options, query]
  );
  const activeOption = activePrefectureOption(filteredOptions, activeIndex);

  useEffect(() => {
    setActiveIndex((current) => {
      if (!open || filteredOptions.length === 0) return -1;
      return activePrefectureOption(filteredOptions, current) === undefined ? 0 : current;
    });
  }, [filteredOptions, open]);

  const choose = (option: string) => {
    setQuery(option);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => movePrefectureOptionIndex(filteredOptions, current, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => movePrefectureOptionIndex(filteredOptions, current, -1));
      return;
    }
    if (event.key === "Enter" && open && activeOption !== undefined) {
      event.preventDefault();
      choose(activeOption);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div
      ref={fieldRef}
      className="revision-filter-field revision-prefecture-combobox"
      onBlur={(event) => {
        if (!fieldRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <label htmlFor={inputId}>都道府県</label>
      <div className="revision-combobox-input-wrap">
        <Search size={16} aria-hidden="true" />
        <input
          id={inputId}
          name="prefecture"
          type="text"
          role="combobox"
          value={query}
          className="input-control"
          placeholder="例：新潟県"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={open && activeOption !== undefined ? `${listboxId}-${activeIndex}` : undefined}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(firstPrefectureOptionIndex(filteredOptions));
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            const nextFilteredOptions = filterPrefectureOptions(options, nextQuery);
            setQuery(nextQuery);
            setOpen(true);
            setActiveIndex(firstPrefectureOptionIndex(nextFilteredOptions));
          }}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="revision-combobox-clear"
            aria-label="都道府県の入力を消去"
            onClick={() => {
              setQuery("");
              setOpen(true);
              setActiveIndex(firstPrefectureOptionIndex(options));
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          className="revision-combobox-toggle"
          aria-label={open ? "都道府県候補を閉じる" : "都道府県候補を開く"}
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => {
            const nextOpen = !open;
            setOpen(nextOpen);
            setActiveIndex(nextOpen ? firstPrefectureOptionIndex(filteredOptions) : -1);
          }}
        >
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div id={listboxId} role="listbox" aria-label="都道府県の候補" className="revision-combobox-options">
          {filteredOptions.length ? filteredOptions.map((option, index) => (
            <div
              key={option}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={option === query}
              className={index === activeIndex ? "is-active" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option}
            </div>
          )) : <p>一致する都道府県がありません</p>}
        </div>
      ) : null}
      <small>文字入力でも、候補の選択でも絞り込めます。</small>
    </div>
  );
}

function filterPrefectureOptions(options: string[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  if (!normalizedQuery) return options;
  return options.filter((option) => option.toLocaleLowerCase("ja").includes(normalizedQuery));
}

function firstPrefectureOptionIndex(options: string[]) {
  return options.length > 0 ? 0 : -1;
}

function activePrefectureOption(options: string[], activeIndex: number) {
  if (activeIndex < 0 || activeIndex >= options.length) return undefined;
  return options[activeIndex];
}

function movePrefectureOptionIndex(options: string[], activeIndex: number, direction: 1 | -1) {
  if (options.length === 0) return -1;
  if (activeIndex < 0 || activeIndex >= options.length) {
    return direction === 1 ? 0 : options.length - 1;
  }
  if (direction === 1) return Math.min(activeIndex + 1, options.length - 1);
  return activeIndex === 0 ? options.length - 1 : activeIndex - 1;
}

function FilterSelect({ label, name, value, options }: {
  label: string;
  name: string;
  value: string;
  options: FilterOption[];
}) {
  return (
    <label className="revision-filter-field">
      <span>{label}</span>
      <select name={name} defaultValue={value} className="input-control">
        <option value="">すべて</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!href) return <span className="revision-source-link--disabled">{children}</span>;
  return <a href={href} target="_blank" rel="noreferrer">{children}<ExternalLink size={12} aria-hidden="true" /></a>;
}

function hasChangedEffectiveDateShape(item: YearbookFeeChange) {
  const dates = item?.currentUsageFeeEffectiveDate;
  return Boolean(
    dates?.changed
    && dates.r5?.iso
    && dates.r6?.iso
    && dates.r5.iso !== dates.r6.iso
    && item?.officialRevisionRate
  );
}

function toggleDetailsOnKeyboard(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const details = event.currentTarget.parentElement;
  if (!(details instanceof HTMLDetailsElement)) return;
  event.preventDefault();
  details.open = !details.open;
}

function formatIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : value;
}

function formatOptionalIsoDate(value: string | null) {
  return value ? formatIsoDate(value) : "記載なし";
}

function formatOfficialPercent(value: number | null) {
  return value == null || !Number.isFinite(value)
    ? "記載なし"
    : `${value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatSimpleChangeRate(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "算定不可";
  const percent = value * 100;
  return `${percent > 0 ? "+" : ""}${percent.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatYen(value: number | null) {
  return value == null || !Number.isFinite(value) ? "記載なし" : `${value.toLocaleString("ja-JP")}円`;
}

function formatYenDelta(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "差額算定不可";
  if (value === 0) return "差額なし";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("ja-JP")}円`;
}

function formatTariffSystemSignal(key: string, value: string | number | boolean) {
  if (typeof value === "boolean") return value ? "あり" : "なし";
  if (typeof value !== "number") return value;
  if (key === "systemCodeRaw") return `コード値 ${value}`;
  if (key === "waterVolumeRankCount") return `${value.toLocaleString("ja-JP")}ランク`;
  if (key === "minimumExcessUnitPriceYenPerM3" || key === "maximumExcessUnitPriceYenPerM3") {
    return `${value.toLocaleString("ja-JP")}円／m³`;
  }
  if (key === "progressivity") return `${value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}倍`;
  return value.toLocaleString("ja-JP");
}
