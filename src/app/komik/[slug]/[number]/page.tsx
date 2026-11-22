import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Reader from "@/components/Reader";
import { getChapterImages, getChapters, getComicBySlug } from "@/lib/comics";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string; number: string }> };

export const metadata: Metadata = { title: "Baca", robots: { index: false } };

export default async function ReaderPage({ params }: Props) {
  const { slug, number } = await params;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(number)) notFound();

  const comic = await getComicBySlug(slug);
  if (!comic) notFound();
  const chapters = await getChapters(comic.id); // urut terbaru -> terlama, hanya yang sudah terbit
  const cur = chapters.find((c) => c.number === Number(number));
  if (!cur) notFound();

  const images = await getChapterImages(cur.id);
  const resume = await getResume(comic.id, cur.id);
  return (
    <Reader
      key={cur.id}
      comicId={comic.id}
      slug={comic.slug}
      title={comic.title}
      chapters={chapters.map((c) => ({ id: c.id, number: c.number }))}
      current={{ id: cur.id, number: cur.number }}
      images={images}
      resume={resume}
    />
  );
}

// Posisi terakhir di chapter ini. Hanya kalau login, chapter sama, dan belum selesai (< 95%).
async function getResume(comicId: string, chapterId: string): Promise<{ page: number; progress: number } | null> {
  try {
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return null;
    const { data } = await sb
      .from("reading_history")
      .select("chapter_id,page,progress")
      .eq("user_id", u.user.id)
      .eq("comic_id", comicId)
      .maybeSingle();
    if (!data || data.chapter_id !== chapterId) return null;
    const progress = Math.min(Math.max(Number(data.progress), 0), 1);
    const page = Number(data.page);
    if (!Number.isFinite(page) || page <= 1 || progress >= 0.95) return null;
    return { page: Math.floor(page), progress };
  } catch {
    return null;
  }
}
