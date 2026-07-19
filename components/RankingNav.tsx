import Link from "next/link";
import { rankingLabels, type RankingType } from "@/lib/rankings";

const rankingTypes = Object.keys(rankingLabels) as RankingType[];

export function RankingNav({ current }: { current: RankingType }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-5">
      {rankingTypes.map((type) => (
        <Link
          key={type}
          href={`/rankings/${type}`}
          className={current === type ? "flex min-h-12 items-center justify-center rounded-md bg-teal px-3 py-2 text-center font-black text-white shadow-sm" : "flex min-h-12 items-center justify-center rounded-md border border-line bg-white px-3 py-2 text-center font-black text-ink hover:border-teal hover:bg-teal/5"}
        >
          {rankingLabels[type]}
        </Link>
      ))}
    </div>
  );
}
