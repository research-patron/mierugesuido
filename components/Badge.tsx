import clsx from "clsx";
import { displayFeeRecoveryBandLabel } from "@/lib/feeRecoveryCopy";

const labelStyles: Record<string, string> = {
  良好: "border-teal/25 bg-teal/10 text-[#006b75]",
  要改善: "border-orange-300/40 bg-orange-100 text-[#9a3412]",
  適正水準: "border-teal/30 bg-teal/10 text-[#006b75]",
  やや不足: "border-lime-500/40 bg-lime-100 text-[#3f6212]",
  要注意: "border-amber/40 bg-amber/15 text-[#8a4b08]",
  改定圧力高: "border-orange-400/40 bg-orange-100 text-[#9a3412]",
  重点監視: "border-red-700/35 bg-red-50 text-[#991b1b]",
  不足: "border-orange-400/40 bg-orange-100 text-[#9a3412]",
  あり: "border-pink-400/40 bg-pink-50 text-[#be123c]",
  なし: "border-slate-300 bg-slate-100 text-[#475569]",
  判定不可: "border-slate-300 bg-slate-100 text-[#475569]"
};

export function Badge({ children }: { children: React.ReactNode }) {
  const key = typeof children === "string" ? children : "";
  const displayChildren = key ? displayFeeRecoveryBandLabel(key) : children;
  return (
    <span
      className={clsx(
        "status-badge inline-flex min-h-6 items-center rounded border px-2 py-1 text-xs font-black leading-none",
        labelStyles[key] ?? "border-slate-300 bg-white text-slate-700"
      )}
    >
      {displayChildren}
    </span>
  );
}
