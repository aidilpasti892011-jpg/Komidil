import type { Metadata } from "next";
import Link from "next/link";
import RankRow from "@/components/RankRow";
import EmptyState from "@/components/EmptyState";
import { getRankings } from "@/lib/comics";
import { PERIODS, PERIOD_LABEL, type Period } from "@/lib/types";

export const metadata: Metadata = { title: "Ranking Komik" };

const HINT: Record<Period, string> = {
  daily: "24 jam terakhir",
  weekly: "7 hari terakhir",
  monthly: "30 hari terakhir",
};

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period = (PERIODS as string[]).includes(sp.p ?? "") ? (sp.p as Period) : "weekly";
  const res = await getRankings(period, 50);

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="mb-1 mt-1.5 text-2xl font-bold">Ranking Komik</h1>
      <p className="mb-3 text-[13px] text-mute">
        Skor dari jumlah pembaca dan bookmark baru dalam {HINT[period]}, disesuaikan dengan rating. Diperbarui tiap 15 menit.
      </p>
      <div role="tablist" aria-label="Periode ranking" className="mb-3 flex gap-1.5">
        {PERIODS.map((k) => (
          <Link
            key={k}
            href={`/ranking?p=${k}`}
            role="tab"
            aria-selected={period === k}
            className={`rounded-full border px-4 py-1.5 text-[13px] ${
              period === k ? "border-brand bg-brand font-bold text-white" : "border-line bg-card text-[#ccc]"
            }`}
          >
            {PERIOD_LABEL[k]}
          </Link>
        ))}
      </div>

      {res.error ? (
        <EmptyState error={res.error} />
      ) : res.data.length === 0 ? (
        <p className="py-10 text-center text-mute">Belum ada data ranking untuk periode ini.</p>
      ) : (
        <ul className="space-y-2">
          {res.data.map((c) => (
            <RankRow key={c.id} c={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
