import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ContinueReading from "@/components/ContinueReading";
import ComicCard from "@/components/ComicCard";
import EmptyState from "@/components/EmptyState";
import ForYou from "@/components/ForYou";
import Hero from "@/components/Hero";
import RankingTabs from "@/components/RankingTabs";
import ScheduleRow from "@/components/ScheduleRow";
import SectionHeader from "@/components/SectionHeader";
import { getSchedule, wibDay } from "@/lib/schedule";
import { getComics, getRankings } from "@/lib/comics";
import { COMIC_TYPES, PERIODS, TYPE_LABEL, type Period, type RankedComic } from "@/lib/types";

export const metadata: Metadata = {
  title: "Baca Komik Online, Manhwa, Manhua & Manga Terbaru",
  description: "Baca komik online di KOMIDIL. Temukan manhwa, manhua, manga, dan webtoon terbaru, lengkap dengan rekomendasi, ranking, serta jadwal rilis.",
};

export default async function HomePage() {
  const [top, latest, webtoon, daily, weekly, monthly, schedule] = await Promise.all([
    getComics({ sort: "r", limit: 8 }),
    getComics({ sort: "up", limit: 8 }),
    getComics({ type: "webtoon", sort: "up", limit: 8 }),
    getRankings("daily", 5),
    getRankings("weekly", 5),
    getRankings("monthly", 5),
    getSchedule(),
  ]);
  const todayKey = wibDay();
  const todayItems = schedule.data.filter((i) => i.day === todayKey).slice(0, 4);
  const error = top.error ?? latest.error;

  if (error || top.data.items.length === 0) {
    return (
      <div className="pt-4">
        <EmptyState error={error} />
      </div>
    );
  }

  const lists: Record<Period, RankedComic[]> = { daily: daily.data, weekly: weekly.data, monthly: monthly.data };
  const hasRanking = PERIODS.some((p) => lists[p].length > 0);
  // Hero: yang sedang naik daun minggu ini, kalau belum ada data pakai rating tertinggi
  const heroItems = weekly.data.length >= 2 ? weekly.data.slice(0, 4) : top.data.items.slice(0, 4);

  return (
    <>
      <Hero items={heroItems} />

      <Suspense fallback={null}>
        <ContinueReading />
      </Suspense>

      <Suspense fallback={null}>
        <ForYou />
      </Suspense>

      <div className="mb-1.5 grid grid-cols-4 gap-2">
        {COMIC_TYPES.map((t) => (
          <Link
            key={t}
            href={`/komik?type=${t}`}
            className="rounded-[14px] border border-line bg-card py-3 text-center text-[14px] font-bold transition hover:border-brand"
          >
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      {todayItems.length > 0 && (
        <>
          <SectionHeader title="Rilis Hari Ini" href="/jadwal" />
          <div className="space-y-2">
            {todayItems.map((i) => (
              <ScheduleRow key={`${i.comicId}-${i.day}`} item={i} />
            ))}
          </div>
        </>
      )}

      {hasRanking && (
        <>
          <SectionHeader title="Ranking Komik" href="/ranking" />
          <RankingTabs lists={lists} />
        </>
      )}

      <SectionHeader title="Rekomendasi Komik" href="/komik?sort=r" />
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1.5">
        {top.data.items.map((c) => (
          <div key={c.id} className="w-[140px] flex-none md:w-[170px]">
            <ComicCard c={c} />
          </div>
        ))}
      </div>

      {webtoon.data.items.length > 0 && (
        <>
          <SectionHeader title="Webtoon" href="/komik?type=webtoon" />
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1.5">
            {webtoon.data.items.map((c) => (
              <div key={c.id} className="w-[140px] flex-none md:w-[170px]">
                <ComicCard c={c} />
              </div>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Update Terbaru" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {latest.data.items.map((c) => (
          <ComicCard key={c.id} c={c} />
        ))}
      </div>
    </>
  );
}
