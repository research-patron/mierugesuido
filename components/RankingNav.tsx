import type { LucideIcon } from "lucide-react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BadgeJapaneseYen,
  Check,
  Droplets,
  Gauge,
  Landmark,
  SlidersHorizontal
} from "lucide-react";
import Link from "next/link";
import React from "react";
import {
  rankingMetrics,
  rankingSelection,
  type RankingDirection,
  type RankingMetric,
  type RankingType
} from "@/lib/rankings";
import styles from "./RankingNav.module.css";

const metricPresentation: Record<RankingMetric, { icon: LucideIcon; helper: string }> = {
  "expense-recovery": {
    icon: Gauge,
    helper: "使用料で費用を賄う割合"
  },
  "fee-unit": {
    icon: BadgeJapaneseYen,
    helper: "1m³あたりの使用料収入"
  },
  "treatment-cost": {
    icon: Droplets,
    helper: "1m³あたりの汚水処理費"
  },
  "transfer-amount": {
    icon: Landmark,
    helper: "基準外繰入金の実額"
  }
};

function directionLabel(metric: RankingMetric, direction: RankingDirection) {
  if (metric === "transfer-amount") return direction === "high" ? "金額が大きい順" : "金額が小さい順";
  return direction === "high" ? "値が高い順" : "値が低い順";
}

export function RankingNav({ current }: { current: RankingType }) {
  const { metric: selectedMetric, direction } = rankingSelection(current);
  const directions: Array<{
    value: RankingDirection;
    label: string;
    helper: string;
    icon: LucideIcon;
  }> = [
    { value: "high", label: "高い順", helper: "大きい値から", icon: ArrowDownWideNarrow },
    { value: "low", label: "低い順", helper: "小さい値から", icon: ArrowUpNarrowWide }
  ];
  const selectedDirectionLabel = directionLabel(selectedMetric.metric, direction);
  const selectedDirectionCompactLabel = selectedMetric.metric === "transfer-amount"
    ? direction === "high" ? "大きい順" : "小さい順"
    : direction === "high" ? "高い順" : "低い順";

  return (
    <section
      className={`panel ${styles.selector}`}
      aria-labelledby="ranking-condition-title"
      aria-describedby="ranking-condition-description"
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.kicker}><SlidersHorizontal aria-hidden="true" />比較ビュー</p>
          <h2 id="ranking-condition-title">比べたい指標を選ぶ</h2>
          <p id="ranking-condition-description">気になる指標を選ぶだけで、全国の並びをすぐに切り替えられます。</p>
        </div>
        <p className={styles.currentView} aria-label={`現在の表示は${selectedMetric.label}、${selectedDirectionLabel}です`}>
          <span>現在の表示</span>
          <strong>{selectedMetric.label}</strong>
          <span aria-hidden="true" className={styles.currentDivider}>/</span>
          <b>{selectedDirectionCompactLabel}</b>
        </p>
      </header>

      <div className={styles.controls}>
        <nav className={styles.metricGroup} aria-label="比較する指標">
          <p className={styles.controlLabel}>比較する指標</p>
          <div className={styles.metricOptions}>
            {rankingMetrics.map((metric) => {
              const selected = metric.metric === selectedMetric.metric;
              const type = metric.types[direction];
              const presentation = metricPresentation[metric.metric];
              const MetricIcon = presentation.icon;
              return (
                <Link
                  key={metric.metric}
                  href={`/rankings/${type}`}
                  aria-current={selected ? "page" : undefined}
                  className={`${styles.metricOption} ${selected ? styles.selected : ""}`}
                >
                  <span className={styles.metricIcon}><MetricIcon aria-hidden="true" /></span>
                  <span className={styles.optionCopy}>
                    <strong>{metric.label}</strong>
                    <small>{presentation.helper}</small>
                  </span>
                  {selected ? (
                    <span className={styles.selectedMark} aria-label="選択中">
                      <Check aria-hidden="true" />
                      <span>選択中</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <nav className={styles.directionGroup} aria-label="並び順">
          <p className={styles.controlLabel}>並び順</p>
          <div className={styles.directionOptions}>
            {directions.map((item) => {
              const type = selectedMetric.types[item.value];
              const selected = direction === item.value;
              const DirectionIcon = item.icon;
              const label = selectedMetric.metric === "transfer-amount"
                ? item.value === "high" ? "大きい順" : "小さい順"
                : item.label;
              return (
                <Link
                  key={item.value}
                  href={`/rankings/${type}`}
                  aria-current={selected ? "page" : undefined}
                  className={`${styles.directionOption} ${selected ? styles.selected : ""}`}
                >
                  <DirectionIcon aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <small>{item.helper}</small>
                  </span>
                  {selected ? <Check className={styles.directionCheck} aria-label="選択中" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

    </section>
  );
}
