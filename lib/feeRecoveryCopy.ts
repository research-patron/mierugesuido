export const feeRecoveryBandOptions = [
  { value: "適正水準", label: "経費回収率100%以上" },
  { value: "やや不足", label: "経費回収率90%以上100%未満" },
  { value: "要注意", label: "経費回収率80%以上90%未満" },
  { value: "改定圧力高", label: "経費回収率80%未満・使用料単価150円/m³以上等" },
  { value: "重点監視", label: "経費回収率80%未満・使用料単価150円/m³未満" }
] as const;

const displayLabelByStoredValue = Object.fromEntries(
  feeRecoveryBandOptions.map((option) => [option.value, option.label])
) as Record<string, string>;

export function displayFeeRecoveryBandLabel(value: string | null | undefined) {
  if (!value) return "判定不可";
  return displayLabelByStoredValue[value] ?? value;
}
