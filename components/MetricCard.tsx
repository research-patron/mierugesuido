export function MetricCard({
  label,
  value,
  sub
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-soft">
      <div className="text-xs font-black text-muted">{label}</div>
      <div className="mt-2 text-2xl font-black leading-tight text-ink">{value}</div>
      {sub ? <div className="mt-1 text-xs font-bold leading-5 text-slate-500">{sub}</div> : null}
    </div>
  );
}
