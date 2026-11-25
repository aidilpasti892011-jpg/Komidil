import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import {
  COMIC_STATUSES,
  COMIC_TYPES,
  SORT_KEYS,
  type ComicCardData,
  type ComicStatus,
  type ComicType,
  type Genre,
  type Period,
  type RankedComic,
  type SortKey,
  MAX_GENRE_FILTER,
  RATING_MIN_OPTIONS,
} from "@/lib/types";

const SELECT =
  "id,slug,title,type,status,synopsis,cover_url,cover_hue,rating_avg,chapter_count,latest_chapter_number,last_chapter_at,comic_genres(genres(name))";

type Row = Omit<ComicCardData, "genres"> & { comic_genres: { genres: { name: string } | null }[] };

const toCard = (r: Row): ComicCardData => ({
  ...r,
  rating_avg: Number(r.rating_avg),
  latest_chapter_number: r.latest_chapter_number === null ? null : Number(r.latest_chapter_number),
  genres: (r.comic_genres ?? []).map((g) => g.genres?.name).filter((n): n is string => Boolean(n)),
});

export type ComicQuery = {
  q?: string;
  type?: string;
  genre?: string;
  status?: string;
  sort?: string;
  limit?: number;
};

export type Result<T> = { data: T; error: string | null };

/** Validasi ketat: nilai di luar whitelist diabaikan. */
export function parseQuery(p: Record<string, string | string[] | undefined>): Required<ComicQuery> {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const type = one(p.type);
  const status = one(p.status);
  const sort = one(p.sort);
  const n = parseInt(one(p.n), 10);
  return {
    q: one(p.q).replace(/[%_,()\\]/g, " ").trim().slice(0, 60),
    type: COMIC_TYPES.includes(type as ComicType) ? type : "",
    status: COMIC_STATUSES.includes(status as ComicStatus) ? status : "",
    genre: /^[a-z0-9-]{1,40}$/.test(one(p.genre)) ? one(p.genre) : "",
    sort: SORT_KEYS.includes(sort as SortKey) ? sort : "up",
    limit: Number.isFinite(n) ? Math.min(Math.max(n, 8), 96) : 8,
  };
}

/** Ambil `limit + 1` baris supaya halaman tahu masih ada data lagi atau tidak. */
export async function getComics(
  query: ComicQuery
): Promise<Result<{ items: ComicCardData[]; hasMore: boolean }>> {
  const empty = { items: [], hasMore: false };
  if (!hasSupabaseEnv()) return { data: empty, error: "env" };
  try {
    const sb = await createClient();
    const limit = query.limit ?? 8;

    let ids: string[] | null = null;
    if (query.genre) {
      const { data: g } = await sb.from("genres").select("id").eq("slug", query.genre).maybeSingle();
      if (!g) return { data: empty, error: null };
      const { data: links, error } = await sb.from("comic_genres").select("comic_id").eq("genre_id", g.id);
      if (error) return { data: empty, error: error.message };
      ids = (links ?? []).map((l) => l.comic_id as string);
      if (ids.length === 0) return { data: empty, error: null };
    }

    let qb = sb.from("comics").select(SELECT);
    if (ids) qb = qb.in("id", ids);
    if (query.type) qb = qb.eq("type", query.type);
    if (query.status) qb = qb.eq("status", query.status);
    if (query.q) qb = qb.ilike("title", `%${query.q}%`);

    switch (query.sort) {
      case "pop":
        qb = qb.order("pop_score", { ascending: false }).order("view_count", { ascending: false });
        break;
      case "r":
        qb = qb.order("rating_avg", { ascending: false });
        break;
      case "fol":
        qb = qb.order("follower_count", { ascending: false });
        break;
      case "az":
        qb = qb.order("title", { ascending: true });
        break;
      case "new":
        qb = qb.order("created_at", { ascending: false });
        break;
      default:
        qb = qb.order("last_chapter_at", { ascending: false, nullsFirst: false });
    }

    const { data, error } = await qb.limit(limit + 1);
    if (error) return { data: empty, error: error.message };
    const rows = (data ?? []) as unknown as Row[];
    return { data: { items: rows.slice(0, limit).map(toCard), hasMore: rows.length > limit }, error: null };
  } catch (e) {
    return { data: empty, error: e instanceof Error ? e.message : "unknown" };
  }
}

/** Kartu komik untuk daftar id, urutan mengikuti `ids`. Yang tidak terlihat oleh RLS dilewati. */
export async function getComicsByIds(ids: string[]): Promise<ComicCardData[]> {
  if (!hasSupabaseEnv() || ids.length === 0) return [];
  try {
    const sb = await createClient();
    const { data } = await sb.from("comics").select(SELECT).in("id", ids);
    const byId = new Map(((data ?? []) as unknown as Row[]).map((r) => [r.id, toCard(r)]));
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  } catch {
    return [];
  }
}

export async function getGenres(): Promise<Genre[]> {
  if (!hasSupabaseEnv()) return [];
  try {
    const sb = await createClient();
    const { data } = await sb.from("genres").select("id,name,slug").order("name");
    return (data ?? []) as Genre[];
  } catch {
    return [];
  }
}

// ---------- Langkah 3: detail komik ----------
export type ComicDetail = ComicCardData & {
  alt_titles: string[];
  author: string | null;
  artist: string | null;
  rating_count: number;
  bookmark_count: number;
  follower_count: number;
};
export type ChapterRow = { id: string; number: number; title: string | null; published_at: string };

export async function getComicBySlug(slug: string): Promise<ComicDetail | null> {
  if (!hasSupabaseEnv() || !/^[a-z0-9-]{1,200}$/.test(slug)) return null;
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("comics")
      .select(SELECT + ",alt_titles,author,artist,rating_count,bookmark_count,follower_count")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    const r = data as unknown as Row & Pick<ComicDetail, "alt_titles" | "author" | "artist" | "rating_count" | "bookmark_count" | "follower_count">;
    return { ...toCard(r), alt_titles: r.alt_titles ?? [], author: r.author, artist: r.artist,
             rating_count: r.rating_count, bookmark_count: r.bookmark_count,
             follower_count: r.follower_count ?? 0 };
  } catch {
    return null;
  }
}

export type ComicReview = {
  id: string;
  rating: number;
  body: string | null;
  has_spoiler: boolean;
  created_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export async function getComicReviews(comicId: string): Promise<ComicReview[]> {
  if (!hasSupabaseEnv()) return [];
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("reviews")
      .select("id,rating,body,has_spoiler,created_at,profiles(username,display_name,avatar_url)")
      .eq("comic_id", comicId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Gagal mengambil ulasan:", error.message);
      return [];
    }
    return (data ?? []) as unknown as ComicReview[];
  } catch {
    return [];
  }
}

export async function getChapters(comicId: string): Promise<ChapterRow[]> {
  if (!hasSupabaseEnv()) return [];
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("chapters")
      .select("id,number,title,published_at")
      .eq("comic_id", comicId)
      .order("number", { ascending: false })
      .limit(3000);
    return ((data ?? []) as ChapterRow[]).map((c) => ({ ...c, number: Number(c.number) }));
  } catch {
    return [];
  }
}

// ---------- Langkah 4: reader ----------
export type ReaderImage = { id: string; page: number; url: string; w: number | null; h: number | null };

export async function getChapterImages(chapterId: string): Promise<ReaderImage[]> {
  if (!hasSupabaseEnv()) return [];
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("chapter_images")
      .select("id,page_number,image_path,width,height")
      .eq("chapter_id", chapterId)
      .order("page_number");
    return (data ?? []).map((r) => ({
      id: r.id as string,
      page: r.page_number as number,
      w: (r.width as number | null) ?? null,
      h: (r.height as number | null) ?? null,
      url: sb.storage.from("chapters").getPublicUrl(r.image_path as string).data.publicUrl,
    }));
  } catch {
    return [];
  }
}

// ---------- Langkah 8: ranking ----------
export { PERIODS, PERIOD_LABEL } from "@/lib/types";
export type { Period, RankedComic } from "@/lib/types";

type RankRow = { rank: number; score: number | string; views: number | string; bookmarks: number | string; comics: Row | null };

/** Ranking dari tabel comic_rankings (di-refresh pg_cron). Hanya komik yang terlihat oleh RLS. */
export async function getRankings(period: Period, limit = 10): Promise<Result<RankedComic[]>> {
  if (!hasSupabaseEnv()) return { data: [], error: "env" };
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("comic_rankings")
      .select(`rank,score,views,bookmarks,comics!inner(${SELECT})`)
      .eq("period", period)
      .order("rank", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as unknown as RankRow[];
    return {
      data: rows
        .filter((r) => r.comics)
        .map((r) => ({
          ...toCard(r.comics as Row),
          rank: r.rank,
          score: Number(r.score),
          views: Number(r.views),
          bookmarks: Number(r.bookmarks),
        })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "unknown" };
  }
}

// ---------- Tahap 10: pencarian pintar ----------
export type SearchQuery = {
  q: string;
  type: string;
  status: string;
  genres: string[];
  allGenres: boolean;
  minRating: number;
  sort: SortKey;
  limit: number;
};

/** Validasi ketat dari URL. Nilai di luar whitelist diabaikan. */
export function parseSearch(p: Record<string, string | string[] | undefined>): SearchQuery {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(p.q).replace(/[%_,()\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const type = one(p.type);
  const status = one(p.status);
  const sort = one(p.sort);
  const rmin = parseFloat(one(p.rmin));
  const n = parseInt(one(p.n), 10);
  const genres = [...new Set(one(p.genre).split(",").map((g) => g.trim()).filter((g) => /^[a-z0-9-]{1,40}$/.test(g)))].slice(
    0,
    MAX_GENRE_FILTER
  );
  return {
    q,
    type: COMIC_TYPES.includes(type as ComicType) ? type : "",
    status: COMIC_STATUSES.includes(status as ComicStatus) ? status : "",
    genres,
    allGenres: one(p.gm) === "all" && genres.length > 1,
    minRating: (RATING_MIN_OPTIONS as readonly number[]).includes(rmin) ? rmin : 0,
    sort: SORT_KEYS.includes(sort as SortKey) && (sort !== "rel" || q) ? (sort as SortKey) : q ? "rel" : "up",
    limit: Number.isFinite(n) ? Math.min(Math.max(n, 8), 96) : 8,
  };
}

export type SearchResult = { items: ComicCardData[]; hasMore: boolean; total: number };

/** Pencarian lewat RPC search_comics (0008). Kalau 0008 belum dijalankan, jatuh ke getComics biasa. */
export async function searchComics(query: SearchQuery): Promise<Result<SearchResult>> {
  const empty: SearchResult = { items: [], hasMore: false, total: 0 };
  if (!hasSupabaseEnv()) return { data: empty, error: "env" };
  try {
    const sb = await createClient();
    const { data: hits, error } = await sb.rpc("search_comics", {
      p_q: query.q,
      p_type: query.type || null,
      p_status: query.status || null,
      p_genres: query.genres,
      p_all_genres: query.allGenres,
      p_min_rating: query.minRating,
      p_sort: query.sort,
      p_limit: query.limit + 1,
      p_offset: 0,
    });

    if (error) {
      if (error.code === "PGRST202" || /search_comics/.test(error.message)) {
        const r = await getComics({
          q: query.q,
          type: query.type,
          status: query.status,
          genre: query.genres[0] ?? "",
          sort: query.sort === "rel" ? "up" : query.sort,
          limit: query.limit,
        });
        return { data: { ...r.data, total: r.data.items.length }, error: r.error };
      }
      return { data: empty, error: error.message };
    }

    const rows = (hits ?? []) as { id: string; total: number | string }[];
    if (rows.length === 0) return { data: empty, error: null };
    const ids = rows.slice(0, query.limit).map((r) => r.id);
    const { data, error: e2 } = await sb.from("comics").select(SELECT).in("id", ids);
    if (e2) return { data: empty, error: e2.message };
    const byId = new Map(((data ?? []) as unknown as Row[]).map((r) => [r.id, toCard(r)]));
    return {
      data: {
        items: ids.map((id) => byId.get(id)).filter((c): c is ComicCardData => Boolean(c)),
        hasMore: rows.length > query.limit,
        total: Number(rows[0].total),
      },
      error: null,
    };
  } catch (e) {
    return { data: empty, error: e instanceof Error ? e.message : "unknown" };
  }
}
