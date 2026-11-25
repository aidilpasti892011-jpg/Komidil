import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChapterList from "@/components/ChapterList";
import ComicActions from "@/components/ComicActions";
import Cover from "@/components/Cover";
import DetailReviewForm from "@/components/community/DetailReviewForm";
import ComicReviewList from "@/components/community/ComicReviewList";
import { getCurrentUser } from "@/lib/auth";
import { IconBookmark, IconChevronLeft, IconStar } from "@/components/Icons";
import { getChapters, getComicBySlug, getComicReviews } from "@/lib/comics";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getComicBySlug((await params).slug);
  return { title: c ? c.title : "Komik tidak ditemukan", description: c?.synopsis?.slice(0, 150) };
}

export default async function DetailPage({ params }: Props) {
  const comic = await getComicBySlug((await params).slug);
  if (!comic) notFound();
  const [chapters, me, reviews] = await Promise.all([
    getChapters(comic.id),
    getCurrentUser(),
    getComicReviews(comic.id),
  ]);

  return (
    <article>
      <Link href="/komik" className="my-1.5 mb-3 inline-flex items-center gap-1 text-mute">
        <IconChevronLeft width={18} height={18} /> Kembali
      </Link>

      <div className="flex gap-3.5">
        <div className="relative aspect-[3/4] w-32 flex-none overflow-hidden rounded-[14px] md:w-52">
          <Cover title={comic.title} hue={comic.cover_hue} url={comic.cover_url} sizes="208px" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight md:text-3xl">{comic.title}</h1>
          {comic.alt_titles.length > 0 && (
            <p className="mb-2 mt-1 text-[13px] text-mute">{comic.alt_titles.join(" / ")}</p>
          )}
          <p className="my-1 flex items-center gap-1.5 text-[13px]">
            <IconStar className="text-gold" />
            <b>{comic.rating_avg.toFixed(1)}</b>
            <span className="text-mute">({comic.rating_count} ulasan)</span>
          </p>
          <p className="my-1 text-[13px]"><span className="text-mute">Author </span>{comic.author ?? "-"}</p>
          <p className="my-1 text-[13px]"><span className="text-mute">Artist </span>{comic.artist ?? "-"}</p>
          <p className="my-1 flex items-center gap-1 text-[13px] text-mute">
            <IconBookmark width={14} height={14} /> {comic.bookmark_count} bookmark · {comic.follower_count} pengikut
          </p>
          <div className="my-2 flex flex-wrap gap-1.5">
            <span className="rounded-[10px] bg-gold px-2 py-0.5 text-[11px] font-extrabold text-black">{TYPE_LABEL[comic.type]}</span>
            <span className="rounded-[10px] bg-white px-2 py-0.5 text-[11px] font-extrabold text-black">{STATUS_LABEL[comic.status]}</span>
          </div>
        </div>
      </div>

      <div className="my-2 flex flex-wrap gap-1.5">
        {comic.genres.map((g) => (
          <span key={g} className="rounded-2xl border border-line bg-card px-3 py-1 text-xs text-[#ccc]">{g}</span>
        ))}
      </div>

      <ComicActions comicId={comic.id} title={comic.title} slug={comic.slug} firstChapter={chapters.at(-1)?.number ?? null} />

      <section className="my-6">
        <h2 className="text-xl font-bold">Beri Rating</h2>
        {me ? (
          <DetailReviewForm comicId={comic.id} />
        ) : (
          <div className="mt-3 rounded-2xl border border-line bg-card p-4">
            <p className="text-sm text-mute">Login dulu untuk memberi rating dan review.</p>
            <Link href={`/login?next=/komik/${comic.slug}`} className="mt-3 inline-flex rounded-2xl bg-brand px-5 py-2 text-sm font-bold">
              Masuk
            </Link>
          </div>
        )}
      </section>

      <section className="my-6">
        <h2 className="text-xl font-bold">Ulasan Pembaca ({comic.rating_count})</h2>
        <ComicReviewList reviews={reviews} />
      </section>

      <details className="group text-sm text-[#d0d0d0]">
        <summary className="cursor-pointer list-none">
          <p className="line-clamp-3 group-open:line-clamp-none">{comic.synopsis ?? "Belum ada sinopsis."}</p>
          <span className="mt-1 inline-block text-[13px] text-gold group-open:hidden">Baca selengkapnya</span>
        </summary>
        <span className="mt-1 inline-block text-[13px] text-gold">Tutup</span>
      </details>

      <h2 className="mb-2 mt-6 text-xl font-bold">Daftar Chapter</h2>
      <ChapterList comicId={comic.id} slug={comic.slug} chapters={chapters} />
    </article>
  );
}
