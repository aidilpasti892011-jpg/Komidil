import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import RankBadge from "@/components/RankBadge";
import Avatar, { RoleBadge } from "@/components/community/Avatar";
import ItemTools from "@/components/community/ItemTools";
import LikeButton from "@/components/community/LikeButton";
import ReportButton from "@/components/community/ReportButton";
import SpoilerBox from "@/components/community/SpoilerBox";
import { getCurrentUser } from "@/lib/auth";
import { CAT_LABEL, CAT_TABS, POST_SELECT, REVIEW_SELECT, type PostRow, type ReviewRow } from "@/lib/community";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Komunitas" };
export const dynamic = "force-dynamic";
const PER = 15;

export default async function Page({ searchParams }: { searchParams: Promise<{ cat?: string; p?: string }> }) {
  if (!hasSupabaseEnv()) return <EmptyState error={null} />;
  const sp = await searchParams;
  const cat = CAT_TABS.some((t) => t.key === sp.cat) ? sp.cat! : "semua";
  const page = Math.min(Math.max(parseInt(sp.p ?? "1", 10) || 1, 1), 200);
  const me = await getCurrentUser();
  const staff = me?.profile?.role === "admin" || me?.profile?.role === "moderator";
  const admin = me?.profile?.role === "admin";
  const sb = await createClient();
  const from = (page - 1) * PER;
  const path = cat === "semua" ? "/komunitas" : `/komunitas?cat=${cat}`;

  let posts: PostRow[] = [];
  let reviews: ReviewRow[] = [];
  let error: string | null = null;
  let liked = new Set<string>();

  if (cat === "review") {
    let q = sb.from("reviews").select(REVIEW_SELECT).order("created_at", { ascending: false }).range(from, from + PER);
    if (!staff) q = q.eq("is_hidden", false);
    const r = await q;
    error = r.error?.message ?? null;
    reviews = (r.data as unknown as ReviewRow[]) ?? [];
  } else {
    let q = sb.from("posts").select(POST_SELECT).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).range(from, from + PER);
    if (cat !== "semua") q = q.eq("category", cat);
    else q = q.neq("category", "review");
    if (!staff) q = q.eq("is_hidden", false);
    const r = await q;
    error = r.error?.message ?? null;
    posts = (r.data as unknown as PostRow[]) ?? [];
  }
  const hasMore = posts.length > PER || reviews.length > PER;
  posts = posts.slice(0, PER);
  reviews = reviews.slice(0, PER);

  if (me) {
    const ids = [...posts.map((p) => p.id), ...reviews.map((r) => r.id)];
    if (ids.length) {
      const { data } = await sb.from("likes").select("target_id").eq("user_id", me.id).in("target_id", ids);
      liked = new Set((data ?? []).map((l) => l.target_id as string));
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[28px] font-bold">Komunitas</h1>
        <Link href={cat === "review" ? "/komunitas/review/baru" : `/komunitas/baru${cat !== "semua" ? `?cat=${cat}` : ""}`}
          className="rounded-full bg-brand px-5 py-2 text-[13px] font-bold">{cat === "review" ? "Tulis review" : "Buat post"}</Link>
      </div>
      <div className="no-scrollbar -mx-3.5 my-3 flex gap-2 overflow-x-auto px-3.5">
        {CAT_TABS.map((t) => (
          <Link key={t.key} href={t.key === "semua" ? "/komunitas" : `/komunitas?cat=${t.key}`} aria-current={t.key === cat ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${t.key === cat ? "border-brand bg-brand font-bold" : "border-line bg-card text-[#ccc]"}`}>{t.label}</Link>
        ))}
      </div>

      {error && <EmptyState error={error} />}
      {!error && !posts.length && !reviews.length && (
        <p className="py-14 text-center text-mute">Belum ada {cat === "review" ? "review" : "post"} di sini. Jadilah yang pertama.</p>
      )}

      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-[13px]">
              <Avatar a={p.profiles} size={28} />
              <b>{p.profiles?.display_name || p.profiles?.username || "Pengguna"}</b>
              <RoleBadge role={p.profiles?.role} />
              <RankBadge level={p.profiles?.rank_level} />
              <span className="text-mute">{timeAgo(p.created_at)}</span>
            </div>
            <div className="mb-1.5 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-md bg-line px-2 py-0.5 text-[#ccc]">{CAT_LABEL[p.category]}</span>
              {p.is_pinned && <span className="rounded-md bg-gold px-2 py-0.5 font-bold text-black">Disematkan</span>}
              {p.has_spoiler && <span className="rounded-md bg-[#2a2209] px-2 py-0.5 text-gold">Spoiler</span>}
              {p.is_locked && <span className="rounded-md bg-line px-2 py-0.5 text-mute">Terkunci</span>}
              {p.is_hidden && <span className="rounded-md bg-brand/30 px-2 py-0.5 text-[#ff9a9d]">Disembunyikan</span>}
              {p.comics && <span className="rounded-md bg-line px-2 py-0.5 text-gold">{p.comics.title}</span>}
            </div>
            <Link href={`/komunitas/${p.id}`} className="block">
              <h2 className="text-[17px] font-bold leading-snug">{p.title}</h2>
              {!p.has_spoiler && <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-[14px] text-[#bbb]">{p.body}</p>}
            </Link>
            <div className="-ml-2 mt-2 flex items-center text-[13px] text-mute">
              <LikeButton type="post" id={p.id} liked={liked.has(p.id)} count={p.like_count} loggedIn={Boolean(me)} next={path} />
              <Link href={`/komunitas/${p.id}`} className="px-2.5 py-1">{p.comment_count} komentar</Link>
            </div>
          </li>
        ))}

        {reviews.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-[13px]">
              <Avatar a={r.profiles} size={28} />
              <b>{r.profiles?.display_name || r.profiles?.username || "Pengguna"}</b>
              <RoleBadge role={r.profiles?.role} />
              <RankBadge level={r.profiles?.rank_level} />
              <span className="text-mute">{timeAgo(r.created_at)}</span>
              {r.is_hidden && <span className="rounded-md bg-brand/30 px-2 text-[10px] text-[#ff9a9d]">Disembunyikan</span>}
            </div>
            <div className="mb-1.5 flex items-center gap-2">
              {r.comics && <Link href={`/komik/${r.comics.slug}`} className="font-bold text-gold">{r.comics.title}</Link>}
              <span className="rounded-md bg-gold px-2 py-0.5 text-[12px] font-extrabold text-black">{r.rating}/5</span>
            </div>
            {r.body && (
              <SpoilerBox spoiler={r.has_spoiler}>
                <p className="whitespace-pre-wrap break-words text-[14px] text-[#ddd]">{r.body}</p>
              </SpoilerBox>
            )}
            <div className="-ml-2 mt-2 flex items-center">
              <LikeButton type="review" id={r.id} liked={liked.has(r.id)} count={r.like_count} loggedIn={Boolean(me)} next={path} />
              {me?.id !== r.user_id && <ReportButton type="review" id={r.id} loggedIn={Boolean(me)} next={path} />}
            </div>
            <ItemTools type="review" id={r.id} canDelete={me?.id === r.user_id} admin={admin} hidden={r.is_hidden} back="/komunitas" />
          </li>
        ))}
      </ul>

      {(page > 1 || hasMore) && (
        <div className="mt-5 flex justify-center gap-3 text-sm">
          {page > 1 && <Link className="rounded-full border border-line bg-card px-5 py-2" href={`${path}${path.includes("?") ? "&" : "?"}p=${page - 1}`}>Sebelumnya</Link>}
          {hasMore && <Link className="rounded-full border border-line bg-card px-5 py-2" href={`${path}${path.includes("?") ? "&" : "?"}p=${page + 1}`}>Berikutnya</Link>}
        </div>
      )}
    </div>
  );
}
