import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export type ContinueItem = {
  slug: string;
  title: string;
  type: string;
  cover_url: string | null;
  cover_hue: number;
  /** nomor chapter yang dibuka saat kartu diklik */
  chapter: number;
  /** 0..1, progres di chapter tersebut (0 kalau chapter baru) */
  progress: number;
  /** true = chapter berikutnya dari yang terakhir selesai dibaca */
  isNext: boolean;
};

type Row = {
  comic_id: string;
  progress: number;
  is_finished: boolean;
  comics: { slug: string; title: string; type: string; cover_url: string | null; cover_hue: number } | null;
  chapters: { number: number } | null;
};

/**
 * Komik terakhir yang dibaca user dan belum tamat.
 * - progres < 95%: lanjut di chapter yang sama
 * - progres >= 95%: buka chapter berikutnya kalau ada, kalau tidak lewati (sudah habis)
 */
export async function getContinueReading(userId: string): Promise<ContinueItem | null> {
  if (!hasSupabaseEnv()) return null;
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("reading_history")
      .select("comic_id,progress,is_finished,comics(slug,title,type,cover_url,cover_hue),chapters(number)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5);

    for (const r of (data ?? []) as unknown as Row[]) {
      if (!r.comics || !r.chapters) continue;
      const num = Number(r.chapters.number);
      const p = Math.min(Math.max(Number(r.progress), 0), 1);
      const base = { ...r.comics, cover_hue: Number(r.comics.cover_hue) };

      if (p < 0.95) return { ...base, chapter: num, progress: p, isNext: false };

      const { data: nx } = await sb
        .from("chapters")
        .select("number")
        .eq("comic_id", r.comic_id)
        .gt("number", num)
        .order("number", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nx) return { ...base, chapter: Number(nx.number), progress: 0, isNext: true };
    }
    return null;
  } catch {
    return null;
  }
}
