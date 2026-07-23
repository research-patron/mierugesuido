"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, LockKeyhole, Search, SlidersHorizontal } from "lucide-react";
import { BUSINESS_CATEGORY_OPTIONS } from "@/lib/businessDisplay";
import { feeRecoveryBandOptions } from "@/lib/feeRecoveryCopy";

type ViewMode = "table" | "card";

export function MunicipalitySearchFilterPanel({
  prefectures,
  q,
  prefecture,
  businessType,
  accountingType,
  label,
  hasRevisionEvent,
  sort,
  limit,
  view
}: {
  prefectures: string[];
  q?: string;
  prefecture?: string;
  businessType?: string;
  accountingType?: string;
  label?: string;
  hasRevisionEvent?: string;
  sort: string;
  limit: number;
  view: ViewMode;
}) {
  const advancedRef = useRef<HTMLDetailsElement | null>(null);
  const advancedActive = Boolean(prefecture || businessType || accountingType || label || hasRevisionEvent);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncOpenState = () => {
      if (!advancedRef.current) return;
      advancedRef.current.open = !mediaQuery.matches || advancedActive;
    };

    syncOpenState();
    mediaQuery.addEventListener("change", syncOpenState);
    return () => mediaQuery.removeEventListener("change", syncOpenState);
  }, [advancedActive]);

  return (
    <form action="/municipalities" className="panel search-filter-panel">
      <input type="hidden" name="limit" value={limit} />
      <input type="hidden" name="view" value={view} />

      <div className="filter-primary-row">
        <label className="filter-field filter-field--keyword">
          <span>キーワード検索</span>
          <span className="filter-input-shell">
            <input type="search" name="q" defaultValue={q} placeholder="自治体名を入力してください" />
            <button type="submit" className="filter-search-submit" aria-label="キーワードで検索">
              <Search size={19} aria-hidden="true" />
            </button>
          </span>
        </label>
        <div className="search-filter-actions">
          <button type="submit" className="filter-apply-button">
            <Search size={16} aria-hidden="true" />
            条件を適用
          </button>
          <span className="filter-chip" aria-label="流域下水道は常に除外されます">
            <LockKeyhole size={14} aria-hidden="true" />
            流域下水道は常に除外
          </span>
        </div>
      </div>

      <details ref={advancedRef} className="filter-advanced-panel" open>
        <summary>
          <span>
            <SlidersHorizontal size={16} />
            {advancedActive ? "詳細条件（適用中）" : "詳細条件"}
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="filter-advanced-grid">
          <FilterSelect label="都道府県" name="prefecture" value={prefecture} options={prefectures.map((item) => ({ value: item, label: item }))} />
          <FilterSelect label="事業種別" name="businessType" value={businessType} options={BUSINESS_CATEGORY_OPTIONS} />
          <FilterSelect
            label="法適用区分"
            name="accountingType"
            value={accountingType}
            options={[
              { value: "legal_applied", label: "法適用" },
              { value: "non_legal_applied", label: "法非適用" }
            ]}
          />
          <FilterSelect label="経費回収率レンジ" name="label" value={label} options={[...feeRecoveryBandOptions]} />
          <FilterSelect
            label="公式改定情報"
            name="hasRevisionEvent"
            value={hasRevisionEvent}
            options={[
              { value: "true", label: "登録あり" },
              { value: "false", label: "未登録" }
            ]}
          />
          <div className="filter-field filter-field--static" role="note">
            <span>流域下水道を除外</span>
            <span className="filter-static-value">
              <LockKeyhole size={14} aria-hidden="true" />
              除外する
            </span>
          </div>
          <FilterSelect
            label="並び順"
            name="sort"
            value={sort === "latest" ? "" : sort}
            allLabel="標準順"
            options={[
              { value: "expense-recovery-low", label: "経費回収率が低い順" },
              { value: "required-revision-high", label: "使用料収入の必要増加率が高い順" },
              { value: "fee-unit-low", label: "使用料単価が低い順" }
            ]}
          />
        </div>
      </details>
    </form>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
  allLabel = "すべて"
}: {
  label: string;
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={value}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
