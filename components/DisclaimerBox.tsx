import { AlertTriangle } from "lucide-react";

export function DisclaimerBox({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-amber/30 bg-amber/10 p-4 text-sm leading-7 text-slate-700">
      <div className="mb-2 flex items-center gap-2 font-bold text-amber">
        <AlertTriangle size={18} aria-hidden="true" />
        免責と読み方
      </div>
      <div>{children}</div>
    </section>
  );
}
