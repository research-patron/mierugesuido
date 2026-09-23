"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Only this invisible bridge suspends in static export. The visible data remains
// in the initial HTML; query-driven views update after hydration.
export function QuerySync({ onChange }: { onChange: (query: string) => void }) {
  return <Suspense fallback={null}><QueryReader onChange={onChange} /></Suspense>;
}
function QueryReader({ onChange }: { onChange: (query: string) => void }) {
  const params = useSearchParams();
  const query = params.toString();
  useEffect(() => onChange(query), [query, onChange]);
  return null;
}
