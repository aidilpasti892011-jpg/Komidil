import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ComicCard from "@/components/ComicCard";
import EmptyState from "@/components/EmptyState";
import KomikFilters from "@/components/KomikFilters";
import { getGenres, parseSearch, searchComics } from "@/lib/comics";

export const metadata: Metadata = {
  title: "Baca Komik Online — Manhwa, Manhua & Manga Terbaru",
  description: "Jelajahi koleksi komik online di KOMIDIL. Temukan manhwa, manhua, manga, dan webtoon dari berbagai genre seperti action, romance, fantasy, adventure, comedy, drama, dan thriller. Cari komik favorit, lihat daftar komik populer, temukan judul terbaru, dan ikuti update chapter komik pilihanmu.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function KomikPage({ searchParams }: Props) {
  const query = parseSearch(await searchParams);
  const [res, genres] = await Promise.all([searchComics(query), getGenres()]);

  const defSort = query.q ? "rel" : "up";
  const more = new URLSearchParams();
  (["q", "type", "status"] as const).forEach((k) => query[k] && more.set(k, query[k]));
  if (query.genres.length) more.set("genre", query.genres.join(","));
  if (query.allGenres) more.set("gm", "all");
  if (query.minRating > 0) more.set("rmin", String(query.minRating));
  if (query.sort !== defSort) more.set("sort", query.sort);
  more.set("n", String(query.limit + 8));

  const filtered = Boolean(query.q || query.type || query.status || query.genres.length || query.minRating);

  return (
    <>
      <h1 className="mb-3 mt-1.5 text-2xl font-bold">Daftar Komik</h1>
      <Suspense>
        <KomikFilters genres={genres} />
      </Suspense>

      {res.error ? (
        <EmptyState error={res.error} />
      ) : res.data.items.length === 0 ? (
        filtered ? (
          <div className="rounded-2xl border border-line bg-card p-5 text-center">
            <h2 className="text-base font-bold">Tidak ada hasil{query.q ? ` untuk "${query.q}"` : ""}</h2>
            <p className="mt-1 text-sm text-mute">Coba kata kunci lain, kurangi filter, atau cek ejaan.</p>
            <Link href="/komik" className="mt-3 inline-block rounded-3xl border border-line px-5 py-2 text-[13px] text-gold">
              Hapus semua filter
            </Link>
          </div>
        ) : (
          <EmptyState error={null} />
        )
      ) : (
        <>
          <p className="mb-2.5 text-[13px] text-mute" aria-live="polite">
            {res.data.total} komik{query.q ? ` untuk "${query.q}"` : ""}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {res.data.items.map((c) => (
              <ComicCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      {res.data.hasMore && (
        <div className="my-5 text-center">
          <Link
            href={`/komik?${more.toString()}`}
            scroll={false}
            className="inline-block rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold transition active:scale-95"
          >
            Muat lebih banyak
          </Link>
        </div>
      )}
    </>
  );
}
