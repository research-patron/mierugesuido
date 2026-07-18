import { DisclaimerBox } from "@/components/DisclaimerBox";
import { accountingExplanation, detailDisclaimer, footerDisclaimer } from "@/lib/copy";

export default function DisclaimerPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-ink">免責表示</h1>
      <DisclaimerBox>{footerDisclaimer}</DisclaimerBox>
      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="text-xl font-bold text-ink">経費回収率100%相当の参考額</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{detailDisclaimer}</p>
      </section>
      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="text-xl font-bold text-ink">会計収支と使用料水準</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{accountingExplanation}</p>
      </section>
    </div>
  );
}
