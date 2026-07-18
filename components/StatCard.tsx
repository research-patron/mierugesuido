import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

const toneClass = {
  teal: "bg-teal/10 text-teal",
  blue: "bg-blue/10 text-blue",
  amber: "bg-amber/15 text-amber",
  red: "bg-red-100 text-red-600",
  green: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700"
};

export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  tone = "teal"
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: keyof typeof toneClass;
}) {
  return (
    <div className="stat-card">
      <div className={clsx("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", toneClass[tone])}>
        <Icon size={27} strokeWidth={2.1} />
      </div>
      <div className="min-w-0">
        <div className="stat-card-label text-[13px] font-black text-ink">{label}</div>
        <div className="stat-card-value mt-1 flex flex-wrap items-baseline gap-1">
          <span className="text-3xl font-black leading-none text-ink sm:text-[2.15rem]">{value}</span>
          {unit ? <span className="text-sm font-black text-ink">{unit}</span> : null}
        </div>
        {sub ? <div className="mt-1 text-xs font-bold leading-5 text-muted">{sub}</div> : null}
      </div>
    </div>
  );
}
