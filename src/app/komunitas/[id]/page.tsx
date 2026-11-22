import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RankBadge from "@/components/RankBadge";
import Avatar, { RoleBadge } from "@/components/community/Avatar";
import CommentForm from "@/components/community/CommentForm";
import CommentItem from "@/components/community/CommentItem";
import ItemTools from "@/components/community/ItemTools";
import LikeButton from "@/components/community/LikeButton";
import PollBox from "@/components/community/PollBox";
import ReportButton from "@/components/community/ReportButton";
import SpoilerBox from "@/components/community/SpoilerBox";
import { getCurrentUser } from "@/lib/auth";
import { CAT_LABEL, POST_SELECT, UUID_RE, type CommentRow, type PostRow } from "@/lib/community";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Diskusi" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasSupabaseEnv() || !UUID_RE.test(id)) notFound();
  const sb = await createClient();
  const { data } = await sb.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
  const post = data as unknown as PostRow | null;
  if (!post) notFound();

  const me = await getCurrentUser();
  const staff = me?.profile?.role === "admin" || me?.profile?.role === "moderator";
  const admin = me?.profile?.role === "admin";
  if (post.is_hidden && !staff && me?.id !== post.user_id) notFound();
  const path = `/komunitas/${id}`;

  const { data: cm } = await sb
    .from("comments")
    .select("id,post_id,user_id,parent_id,body,is_hidden,like_count,created_at,profiles(username,display_name,avatar_url,role,rank_level)")
    .eq("post_id", id).order("created_at").limit(300);
  const comments = (cm as unknown as CommentRow[]) ?? [];

  let options: { id: string; label: string; votes: number }[] = [];
  let myVote: string | null = null;
  if (post.category === "polling") {
    const { data: o } = await sb.from("poll_options").select("id,label,votes").eq("post_id", id).order("label");
    options = o ?? [];
    if (me) {
      const { data: v } = await sb.from("poll_votes").select("option_id").eq("post_id", id).eq("user_id", me.id).maybeSingle();
      myVote = v?.option_id ?? null;
    }
  }

  let liked = new Set<string>();
  if (me) {
    const { data: l } = await sb.from("likes").select("target_id").eq("user_id", me.id).in("target_id", [id, ...comments.map((c) => c.id)]);
    liked = new Set((l ?? []).map((x) => x.target_id as string));
  }

  const tops = comments.filter((c) => !c.parent_id);
  const replies = (pid: string) => comments.filter((c) => c.parent_id === pid);
  const mine = me?.id === post.user_id;

  return (
    <article className="mx-auto max-w-[720px]">
      <Link href="/komunitas" className="text-[13px] text-mute">Kembali ke komunitas</Link>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-md bg-line px-2 py-0.5 text-[#ccc]">{CAT_LABEL[post.category]}</span>
        {post.is_pinned && <span className="rounded-md bg-gold px-2 py-0.5 font-bold text-black">Disematkan</span>}
        {post.has_spoiler && <span className="rounded-md bg-[#2a2209] px-2 py-0.5 text-gold">Spoiler</span>}
        {post.is_locked && <span className="rounded-md bg-line px-2 py-0.5 text-mute">Terkunci</span>}
        {post.is_hidden && <span className="rounded-md bg-brand/30 px-2 py-0.5 text-[#ff9a9d]">Disembunyikan</span>}
      </div>
      <h1 className="mt-2 text-[24px] font-bold leading-tight">{post.title}</h1>
      <div className="my-3 flex items-center gap-2 text-[13px]">
        <Avatar a={post.profiles} size={30} />
        <b>{post.profiles?.display_name || post.profiles?.username || "Pengguna"}</b>
        <RoleBadge role={post.profiles?.role} />
        <RankBadge level={post.profiles?.rank_level} />
        <span className="text-mute">{timeAgo(post.created_at)}</span>
      </div>
      {post.comics && <Link href={`/komik/${post.comics.slug}`} className="mb-3 inline-block rounded-full bg-card px-3 py-1 text-[13px] text-gold">{post.comics.title}</Link>}

      <SpoilerBox spoiler={post.has_spoiler}>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#ddd]">{post.body}</p>
      </SpoilerBox>

      {post.category === "polling" && options.length > 0 && (
        <div className="mt-4"><PollBox postId={id} options={options} myVote={myVote} loggedIn={Boolean(me)} closed={post.is_locked} next={path} /></div>
      )}

      <div className="-ml-2 mt-3 flex items-center">
        <LikeButton type="post" id={id} liked={liked.has(id)} count={post.like_count} loggedIn={Boolean(me)} next={path} />
        {!mine && <ReportButton type="post" id={id} loggedIn={Boolean(me)} next={path} />}
      </div>
      <ItemTools type="post" id={id} canDelete={mine} admin={admin} hidden={post.is_hidden} pinned={post.is_pinned} locked={post.is_locked} back={path} />

      <h2 className="mb-2 mt-7 text-[17px] font-bold">{post.comment_count} komentar</h2>
      {post.is_locked ? <p className="text-[13px] text-mute">Post ini dikunci, komentar baru dinonaktifkan.</p> : <CommentForm postId={id} loggedIn={Boolean(me)} />}

      <ul className="mt-5 space-y-5">
        {tops.map((c) => (
          <li key={c.id}>
            <CommentItem c={c} me={me?.id ?? null} staff={staff} admin={admin} liked={liked.has(c.id)} locked={post.is_locked} path={path} />
            {replies(c.id).length > 0 && (
              <ul className="ml-[42px] mt-3 space-y-4 border-l border-line pl-3">
                {replies(c.id).map((r) => (
                  <li key={r.id}><CommentItem c={r} me={me?.id ?? null} staff={staff} admin={admin} liked={liked.has(r.id)} locked={post.is_locked} path={path} isReply /></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
