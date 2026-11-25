"use client";

import type { Author } from "@/lib/community";
import { rankInfo } from "@/lib/ranks";
import Avatar, { RoleBadge } from "./Avatar";
import RankBadge from "@/components/RankBadge";

export default function ProfilePopup({
  author,
  onClose,
}: {
  author: Author;
  onClose: () => void;
}) {
  const xp = author.role === "admin" ? 30000 : Math.max(0, author.xp ?? 0);
  const rank = rankInfo(xp);
  const joined = author.created_at
    ? new Date(author.created_at).toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Profil anggota"
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="text-sm font-bold">Profil Anggota</span>
          <button onClick={onClose} className="text-xl text-mute" aria-label="Tutup">×</button>
        </div>

        <div className="mt-5 flex flex-col items-center text-center">
          <Avatar a={author} size={76} />
          <h2 className="mt-3 text-lg font-bold">
            {author.display_name || author.username}
          </h2>
          <p className="text-sm text-mute">@{author.username}</p>
          <div className="mt-3 flex items-center gap-2">
            <RoleBadge role={author.role} />
            <RankBadge level={author.rank_level} role={author.role} />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-line p-4">
          <div className="flex justify-between text-sm">
            <span className="text-mute">Total XP</span>
            <b>{xp.toLocaleString("id-ID")} XP</b>
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <span>{rank.current.name}</span>
            <span className="text-mute">
              {rank.next ? rank.next.name : "Rank tertinggi"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${rank.progress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-mute">
            {rank.next
              ? `${rank.remaining.toLocaleString("id-ID")} XP lagi menuju ${rank.next.name}`
              : "Rank tertinggi telah dicapai"}
          </p>
        </div>

        {author.bio && (
          <p className="mt-4 whitespace-pre-wrap break-words text-sm">
            {author.bio}
          </p>
        )}
        {joined && (
          <p className="mt-4 text-center text-xs text-mute">
            Bergabung sejak {joined}
          </p>
        )}
      </section>
    </div>
  );
}
