"use client";

import Link from "next/link";
import { useState } from "react";
import RankRow from "./RankRow";
import { PERIODS, PERIOD_LABEL, type Period, type RankedComic } from "@/lib/types";

export default function RankingTabs({ lists, limit = 5 }: { lists: Record<Period, RankedComic[]>; limit?: number }) {
  const [p, setP] = useState<Period>("weekly");
  const items = lists[p].slice(0, limit);
  return (
    <div>
      <div role="tablist" aria-label="Periode ranking" className="mb-2.5 flex gap-1.5">
        {PERIODS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={p === k}
            onClick={() => setP(k)}
            className={`rounded-full border px-4 py-1.5 text-[13px] transition ${
              p === k ? "border-brand bg-brand font-bold text-white" : "border-line bg-card text-[#ccc]"
            }`}
          >
            {PERIOD_LABEL[k]}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-card p-4 text-center text-[13px] text-mute">Belum ada data ranking.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => <RankRow key={c.id} c={c} />)}
        </ul>
      )}
      <div className="mt-2.5 text-center">
        <Link href={`/ranking?p=${p}`} className="text-[13px] text-gold">Lihat ranking lengkap</Link>
      </div>
    </div>
  );
}
