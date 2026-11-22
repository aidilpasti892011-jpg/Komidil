import { createClient } from "@/lib/supabase/server";
import { getComicsByIds } from "@/lib/comics";
import { hasSupabaseEnv } from "@/lib/utils";
import type { ComicCardData } from "@/lib/types";

// ---------- Untukmu ----------
export type Recommendation = { comic: ComicCardData; reason: string };

/** Rekomendasi dari RPC recommend_for_me (0010). Kosong kalau belum login / belum ada riwayat. */
export async function getRecommendations(limit = 12): Promise<{ data: Recommendation[]; error: string | null }> {
  if (!hasSupabaseEnv()) return { data: [], error: "env" };
  try {
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return { data: [], error: null };
    const { data, error } = await sb.rpc("recommend_for_me", { p_limit: limit });
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as { id: string; score: number; reason: string }[];
    const cards = await getComicsByIds(rows.map((r) => r.id));
    const reasonOf = new Map(rows.map((r) => [r.id, r.reason]));
    return { data: cards.map((comic) => ({ comic, reason: reasonOf.get(comic.id) ?? "" })), error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "unknown" };
  }
}

// ---------- Statistik ----------
export type ReadingStats = {
  chapters: number;
  comics: number;
  finished: number;
  days_active: number;
  streak_current: number;
  streak_best: number;
  last30: number;
  first_read: string | null;
  last7: { day: string; n: number }[];
  top_genres: { name: string; n: number }[];
  top_types: { type: string; n: number }[];
};

export async function getReadingStats(): Promise<{ data: ReadingStats | null; error: string | null }> {
  if (!hasSupabaseEnv()) return { data: null, error: "env" };
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("my_reading_stats");
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    const d = data as ReadingStats;
    return { data: { ...d, last7: d.last7 ?? [], top_genres: d.top_genres ?? [], top_types: d.top_types ?? [] }, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "unknown" };
  }
}

// ---------- Prestasi ----------
export type Achievement = {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: number;
  threshold: number;
  value: number;
  unlocked_at: string | null;
};

export async function getAchievements(): Promise<{ data: Achievement[]; error: string | null }> {
  if (!hasSupabaseEnv()) return { data: [], error: "env" };
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("my_achievements");
    if (error) return { data: [], error: error.message };
    return {
      data: ((data ?? []) as Achievement[]).map((a) => ({
        ...a,
        tier: Number(a.tier),
        threshold: Number(a.threshold),
        value: Number(a.value),
      })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "unknown" };
  }
}
