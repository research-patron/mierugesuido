export type RevisionFeeDeltaTone = "increase" | "decrease" | "unchanged" | "unavailable";

export type RevisionFeeDeltaPresentation = {
  tone: RevisionFeeDeltaTone;
  label: string;
  ariaLabel: string;
};

export function revisionFeeDeltaPresentation(value: number | null): RevisionFeeDeltaPresentation {
  if (value == null || !Number.isFinite(value)) {
    return {
      tone: "unavailable",
      label: "差額算定不可",
      ariaLabel: "前年度との差額は算定できません"
    };
  }

  if (value === 0) {
    return {
      tone: "unchanged",
      label: "料金差額なし 0円",
      ariaLabel: "前年度から料金の差額はありません"
    };
  }

  const absoluteYen = Math.abs(value).toLocaleString("ja-JP");
  if (value > 0) {
    return {
      tone: "increase",
      label: `増額 +${absoluteYen}円`,
      ariaLabel: `前年度から${absoluteYen}円増額`
    };
  }

  return {
    tone: "decrease",
    label: `減額 -${absoluteYen}円`,
    ariaLabel: `前年度から${absoluteYen}円減額`
  };
}
