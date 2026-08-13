import type { LucideIcon } from "lucide-react";
import {
  BadgeJapaneseYen,
  Check,
  Droplets,
  Gauge,
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
  }
};

function directionLabel(_metric: RankingMetric, direction: RankingDirection) {
  return direction === "high" ? "値が高い順" : "値が低い順";
}

export function RankingNav({ current }: { current: RankingType }) {
  const { metric: selectedMetric, direction } = rankingSelection(current);
  const directions: RankingDirection[] = ["high", "low"];
  const selectedDirectionLabel = directionLabel(selectedMetric.metric, direction);
  const selectedDirectionCompactLabel = direction === "high" ? "高い順" : "低い順";

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
              const type = selectedMetric.types[item];
              const selected = direction === item;
              const label = item === "high" ? "高い順" : "低い順";
              const accessibleDirection = directionLabel(selectedMetric.metric, item);
              return (
                <Link
                  key={item}
                  href={`/rankings/${type}`}
                  aria-current={selected ? "page" : undefined}
                  aria-label={`${selectedMetric.label}を${accessibleDirection}で表示`}
                  className={`${styles.directionOption} ${selected ? styles.selected : ""}`}
                >
                  <strong>{label}</strong>
                  {selected ? <Check className={styles.directionCheck} aria-hidden="true" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

    </section>
  );
}
