import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import type { ComicType } from "@/lib/types";

const TZ = "Asia/Jakarta";
export const SCHEDULE_DAYS = 7;

export type ScheduleItem = {
  comicId: string;
  slug: string;
  title: string;
  type: ComicType;
  cover_url: string | null;
  cover_hue: number;
  firstNumber: number;
  lastNumber: number;
  chapterCount: number;
  releaseAt: string;
  released: boolean;
  /** YYYY-MM-DD (WIB) */
  day: string;
  followed: boolean;
};

type Row = {
  comic_id: string;
  slug: string;
  title: string;
  type: ComicType;
  cover_url: string | null;
  cover_hue: number;
  first_number: number | string;
  last_number: number | string;
  chapter_count: number;
  release_at: string;
  released: boolean;
  wib_day: string;
};

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Tanggal WIB (YYYY-MM-DD) untuk sebuah waktu. */
export function wibDay(d: Date = new Date()): string {
  return ymd.format(d);
}

/** Geser tanggal YYYY-MM-DD sebanyak n hari (aritmetika kalender murni, tanpa zona waktu). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const dayName = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" });
const dayDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "UTC" });

export function dayTitle(day: string, today: string): { name: string; date: string } {
  const dt = new Date(`${day}T00:00:00Z`);
  const name = day === today ? "Hari ini" : day === addDays(today, 1) ? "Besok" : dayName.format(dt);
  return { name, date: dayDate.format(dt) };
}

const timeFmt = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
export function releaseTime(iso: string): string {
  return `${timeFmt.format(new Date(iso)).replace(":", ".")} WIB`;
}

/** "dalam 3 jam", "dalam 25 menit". Dipakai hanya untuk yang belum rilis. */
export function timeUntil(iso: string): string {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  if (mins < 1) return "sebentar lagi";
  if (mins < 60) return `dalam ${mins} menit`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `dalam ${h} jam`;
  return `dalam ${Math.floor(h / 24)} hari`;
}

export function chapterLabel(i: Pick<ScheduleItem, "firstNumber" | "lastNumber" | "chapterCount">): string {
  const f = (x: number) => String(x);
  if (i.chapterCount <= 1 || i.firstNumber === i.lastNumber) return `Chapter ${f(i.lastNumber)}`;
  return `Chapter ${f(i.firstNumber)} sampai ${f(i.lastNumber)} (${i.chapterCount} chapter)`;
}

/**
 * Jadwal rilis 7 hari ke depan mulai hari ini (WIB), termasuk yang sudah rilis hari ini.
 * Data dari RPC release_schedule (migrasi 0009). Kalau user login, ditandai komik yang diikuti.
 */
export async function getSchedule(): Promise<{ data: ScheduleItem[]; error: string | null }> {
  if (!hasSupabaseEnv()) return { data: [], error: "env" };
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("release_schedule", { p_days: SCHEDULE_DAYS });
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Row[];

    let followed = new Set<string>();
    const { data: u } = await sb.auth.getUser();
    if (u.user && rows.length > 0) {
      const { data: f } = await sb
        .from("comic_follows")
        .select("comic_id")
        .eq("user_id", u.user.id)
        .in("comic_id", Array.from(new Set(rows.map((r) => r.comic_id))));
      followed = new Set((f ?? []).map((x) => x.comic_id as string));
    }

    return {
      error: null,
      data: rows.map((r) => ({
        comicId: r.comic_id,
        slug: r.slug,
        title: r.title,
        type: r.type,
        cover_url: r.cover_url,
        cover_hue: Number(r.cover_hue),
        firstNumber: Number(r.first_number),
        lastNumber: Number(r.last_number),
        chapterCount: Number(r.chapter_count),
        releaseAt: r.release_at,
        released: r.released,
        day: r.wib_day,
        followed: followed.has(r.comic_id),
      })),
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Gagal memuat jadwal" };
  }
}
