"use client";

import { useEffect } from "react";
import { emitUsage } from "@/lib/telemetry";
import Link from "next/link";

export default function PageError({ reset }: { reset: () => void }) {
  useEffect(()=>{emitUsage("data_load_error",{routeType:"page",safeErrorCode:"render_error"});},[]);
  return <section className="mx-auto max-w-[1491px] space-y-4 px-7 py-12" role="alert">
    <h1 className="text-2xl font-black">ページを表示できませんでした</h1>
    <p>表示エラーです。検索結果や料金がないことを意味しません。</p>
    <div className="flex flex-wrap gap-3">
      <button className="button-primary" onClick={reset}>再試行</button>
      <Link className="button-secondary" href="/municipalities">自治体検索へ</Link>
    </div>
  </section>;
}
