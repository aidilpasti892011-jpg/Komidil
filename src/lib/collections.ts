import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { UUID_RE } from "@/lib/community";

import { MAX_COLLECTIONS } from "@/lib/collections-shared";
export { COLLECTION_DESC_MAX, COLLECTION_NAME_MAX, MAX_COLLECTIONS, MAX_ITEMS, cleanDesc, cleanName } from "@/lib/collections-shared";

type Cover = { title: string; hue: number; url: string | null };
export type CollectionSummary = {
  id: string;
  name: string;
  description: string | null;
  item_count: number;
  updated_at: string;
  covers: Cover[];
};

type CoverRow = {
  collection_id: string;
  comics: { title: string; cover_url: string | null; cover_hue: number } | null;
};

export async function getCollections(userId: string): Promise<{ data: CollectionSummary[]; error: string | null }> {
  if (!hasSupabaseEnv()) return { data: [], error: "env" };
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("collections")
      .select("id,name,description,item_count,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_COLLECTIONS);
    if (error) return { data: [], error: error.message };
    const cols = (data ?? []) as Omit<CollectionSummary, "covers">[];
    if (cols.length === 0) return { data: [], error: null };

    const { data: items } = await sb
      .from("collection_items")
      .select("collection_id,comics(title,cover_url,cover_hue)")
      .in("collection_id", cols.map((c) => c.id))
      .order("added_at", { ascending: false })
      .limit(400);
    const covers = new Map<string, Cover[]>();
    for (const r of (items ?? []) as unknown as CoverRow[]) {
      if (!r.comics) continue;
      const list = covers.get(r.collection_id) ?? [];
      if (list.length < 3) list.push({ title: r.comics.title, hue: Number(r.comics.cover_hue), url: r.comics.cover_url });
      covers.set(r.collection_id, list);
    }
    return { data: cols.map((c) => ({ ...c, item_count: Number(c.item_count), covers: covers.get(c.id) ?? [] })), error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "unknown" };
  }
}

export type CollectionItem = {
  slug: string;
  title: string;
  comic_id: string;
  type: string;
  cover_url: string | null;
  cover_hue: number;
  latest_chapter_number: number | null;
};
export type CollectionDetail = Omit<CollectionSummary, "covers"> & { items: CollectionItem[] };

type ItemRow = {
  comic_id: string;
  comics: {
    slug: string; title: string; type: string; cover_url: string | null; cover_hue: number;
    latest_chapter_number: number | null;
  } | null;
};

export async function getCollection(id: string, userId: string): Promise<CollectionDetail | null> {
  if (!hasSupabaseEnv() || !UUID_RE.test(id)) return null;
  try {
    const sb = await createClient();
    const { data: c } = await sb
      .from("collections")
      .select("id,name,description,item_count,updated_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!c) return null;
    const { data: items } = await sb
      .from("collection_items")
      .select("comic_id,comics(slug,title,type,cover_url,cover_hue,latest_chapter_number)")
      .eq("collection_id", id)
      .order("added_at", { ascending: false })
      .limit(100);
    return {
      ...(c as Omit<CollectionSummary, "covers">),
      item_count: Number((c as { item_count: number }).item_count),
      items: ((items ?? []) as unknown as ItemRow[]).flatMap((r) =>
        r.comics
          ? [{
              comic_id: r.comic_id,
              slug: r.comics.slug,
              title: r.comics.title,
              type: r.comics.type,
              cover_url: r.comics.cover_url,
              cover_hue: Number(r.comics.cover_hue),
              latest_chapter_number: r.comics.latest_chapter_number === null ? null : Number(r.comics.latest_chapter_number),
            }]
          : []
      ),
    };
  } catch {
    return null;
  }
}
