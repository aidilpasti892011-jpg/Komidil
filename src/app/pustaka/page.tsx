import type { Metadata } from "next";
import Link from "next/link";
import Cover from "@/components/Cover";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Pustaka" };

const TABS = [
  ["bookmark", "Bookmark"],
  ["diikuti", "Diikuti"],
  ["riwayat", "Riwayat"],
  ["lanjut", "Lanjut Baca"],
  ["selesai", "Selesai"],
] as const;
type Tab = (typeof TABS)[number][0];

type ComicMini = { slug: string; title: string; cover_url: string | null; cover_hue: number; type: string };
type HistRow = { progress: number; is_finished: boolean; comics: ComicMini | null; chapters: { number: number } | null };
type BmRow = { comics: ComicMini | null };
type FolRow = { notify: boolean; comics: (ComicMini & { latest_chapter_number: number | null; last_chapter_at: string | null }) | null };

const COMIC = "comics(slug,title,cover_url,cover_hue,type)";

export default async function PustakaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!hasSupabaseEnv()) return <p className="py-16 text-center text-mute">Database belum tersambung.</p>;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-8 max-w-[420px] text-center">
        <h1 className="text-[26px] font-bold">Pustaka</h1>
        <p className="mb-4 mt-1.5 text-mute">Login untuk melihat bookmark dan riwayat bacaanmu.</p>
        <Link href="/login?next=/pustaka" className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }

  const raw = (await searchParams).tab;
  const tab: Tab = TABS.some(([k]) => k === raw) ? (raw as Tab) : "bookmark";
  const sb = await createClient();

  let rows: { comic: ComicMini; sub: string; href: string }[] = [];
  if (tab === "bookmark") {
    const { data } = await sb.from("bookmarks").select(COMIC).eq("user_id", me.id).order("created_at", { ascending: false });
    rows = ((data ?? []) as unknown as BmRow[]).flatMap((r) =>
      r.comics ? [{ comic: r.comics, sub: r.comics.type, href: `/komik/${r.comics.slug}` }] : []
    );
  } else if (tab === "diikuti") {
    const { data } = await sb
      .from("comic_follows")
      .select("notify,comics(slug,title,cover_url,cover_hue,type,latest_chapter_number,last_chapter_at)")
      .eq("user_id", me.id)
      .limit(300);
    const list = ((data ?? []) as unknown as FolRow[]).flatMap((r) => (r.comics ? [{ c: r.comics, notify: r.notify }] : []));
    // yang baru update di atas
    list.sort((a, b) => new Date(b.c.last_chapter_at ?? 0).getTime() - new Date(a.c.last_chapter_at ?? 0).getTime());
    rows = list.map(({ c, notify }) => ({
      comic: c,
      sub: `${c.latest_chapter_number === null ? "Belum ada chapter" : `Ch ${Number(c.latest_chapter_number)} · ${timeAgo(c.last_chapter_at)}`}${notify ? "" : " · notif mati"}`,
      href: `/komik/${c.slug}`,
    }));
  } else {
    let q = sb.from("reading_history").select(`progress,is_finished,${COMIC},chapters(number)`).eq("user_id", me.id).order("updated_at", { ascending: false });
    if (tab === "lanjut") q = q.eq("is_finished", false);
    if (tab === "selesai") q = q.eq("is_finished", true);
    const { data } = await q;
    rows = ((data ?? []) as unknown as HistRow[]).flatMap((r) =>
      r.comics && r.chapters
        ? [{ comic: r.comics, sub: `Chapter ${Number(r.chapters.number)} · ${Math.round(Number(r.progress) * 100)}%`, href: `/komik/${r.comics.slug}/${Number(r.chapters.number)}` }]
        : []
    );
  }

  return (
    <>
      <h1 className="mb-2 mt-1.5 text-2xl font-bold">Pustaka</h1>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-1.5">
        <Link href="/koleksi" className="flex-none rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-[#ccc]">
          Koleksi
        </Link>
        {TABS.map(([k, l]) => (
          <Link
            key={k}
            href={`/pustaka?tab=${k}`}
            className={`flex-none rounded-full border px-3.5 py-1.5 text-[13px] ${tab === k ? "border-brand bg-brand text-white" : "border-line bg-card text-[#ccc]"}`}
          >
            {l}
          </Link>
        ))}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <Link key={r.href} href={r.href} className="flex items-center gap-3 rounded-[14px] bg-card p-2.5">
            <div className="relative aspect-[3/4] w-[52px] flex-none overflow-hidden rounded-lg">
              <Cover title={r.comic.title} hue={r.comic.cover_hue} url={r.comic.cover_url} sizes="52px" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{r.comic.title}</div>
              <small className="text-xs text-mute">{r.sub}</small>
            </div>
          </Link>
        ))}
      </div>
      {rows.length === 0 && <p className="py-10 text-center text-mute">{tab === "diikuti" ? "Belum ada komik yang diikuti. Tekan Ikuti di halaman komik untuk dapat notifikasi chapter baru." : "Belum ada isi. Buka komik, bookmark atau baca satu chapter dulu."}</p>}
    </>
  );
}
