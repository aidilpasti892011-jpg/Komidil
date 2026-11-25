"use client";
import { useState } from "react";
import RankBadge from "@/components/RankBadge";
import Avatar, { RoleBadge } from "./Avatar";
import CommentForm from "./CommentForm";
import ItemTools from "./ItemTools";
import LikeButton from "./LikeButton";
import ReportButton from "./ReportButton";
import type { CommentRow } from "@/lib/community";
import { timeAgo } from "@/lib/utils";
import ProfilePopup from "./ProfilePopup";

export default function CommentItem(p: {
  c: CommentRow; me: string | null; staff: boolean; admin: boolean; liked: boolean; locked: boolean; path: string; isReply?: boolean;
}) {
  const [reply, setReply] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { c } = p;
  const mine = p.me === c.user_id;
  return (
    <div className="flex gap-2.5">
      <button type="button" onClick={() => c.profiles && setProfileOpen(true)} aria-label="Lihat profil anggota">
        <Avatar a={c.profiles} size={p.isReply ? 26 : 32} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          {c.profiles ? (
            <button type="button" onClick={() => setProfileOpen(true)} className="font-bold hover:text-gold">
              {c.profiles.display_name || c.profiles.username}
            </button>
          ) : <b>Pengguna</b>}
          <RoleBadge role={c.profiles?.role} />
          <RankBadge level={c.profiles?.rank_level} role={c.profiles?.role} />
          <span className="text-mute">{timeAgo(c.created_at)}</span>
          {c.is_hidden && <span className="rounded-md bg-line px-1.5 text-[10px] text-mute">Disembunyikan</span>}
        </div>
        {c.is_hidden && !p.staff ? (
          <p className="mt-1 text-[13px] italic text-mute">Komentar ini disembunyikan moderator.</p>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-snug">{c.body}</p>
        )}
        <div className="-ml-2 mt-1 flex flex-wrap items-center">
          <LikeButton type="comment" id={c.id} liked={p.liked} count={c.like_count} loggedIn={Boolean(p.me)} next={p.path} />
          {!p.isReply && !p.locked && <button type="button" onClick={() => setReply(!reply)} className="px-2.5 py-1 text-[13px] text-mute">Balas</button>}
          {!mine && <ReportButton type="comment" id={c.id} loggedIn={Boolean(p.me)} next={p.path} />}
        </div>
        <ItemTools type="comment" id={c.id} canDelete={mine} admin={p.admin} hidden={c.is_hidden} back={p.path} />
        {reply && <CommentForm postId={c.post_id} parentId={c.id} loggedIn={Boolean(p.me)} compact onDone={() => setReply(false)} />}
      </div>
      {profileOpen && c.profiles && (
        <ProfilePopup author={c.profiles} onClose={() => setProfileOpen(false)} />
      )}
    </div>
  );
}
