"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBell, IconBookmark, IconPlay } from "./Icons";
import CollectionPicker from "./CollectionPicker";
import { createClient } from "@/lib/supabase/client";

type Props = { comicId: string; title: string; slug: string; firstChapter: number | null };

export default function ComicActions({ comicId, title, slug, firstChapter }: Props) {
  const sb = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data: row } = await sb.from("bookmarks").select("comic_id").eq("user_id", uid).eq("comic_id", comicId).maybeSingle();
      setSaved(Boolean(row));
      const { data: f } = await sb.from("comic_follows").select("notify").eq("user_id", uid).eq("comic_id", comicId).maybeSingle();
      setFollowing(Boolean(f));
      setNotify(f ? Boolean(f.notify) : true);
      const { data: h } = await sb.from("reading_history").select("chapters(number)").eq("user_id", uid).eq("comic_id", comicId).maybeSingle();
      const num = (h as unknown as { chapters: { number: number } | null } | null)?.chapters?.number;
      if (num !== undefined) setResume(Number(num));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comicId]);

  const toggle = async () => {
    if (!userId) return setMsg("Login dulu untuk memakai bookmark.");
    setBusy(true);
    const { error } = saved
      ? await sb.from("bookmarks").delete().eq("user_id", userId).eq("comic_id", comicId)
      : await sb.from("bookmarks").insert({ user_id: userId, comic_id: comicId });
    setBusy(false);
    if (error) return setMsg("Gagal menyimpan: " + error.message);
    setSaved(!saved);
    setMsg(saved ? "Bookmark dihapus." : "Ditambahkan ke bookmark.");
  };

  const toggleFollow = async () => {
    if (!userId) return setMsg("Login dulu untuk mengikuti komik.");
    setBusy(true);
    const { error } = following
      ? await sb.from("comic_follows").delete().eq("user_id", userId).eq("comic_id", comicId)
      : await sb.from("comic_follows").insert({ user_id: userId, comic_id: comicId, notify: true });
    setBusy(false);
    if (error) return setMsg(error.message.includes("Maksimal") ? error.message : "Gagal mengikuti: " + error.message);
    setFollowing(!following);
    setNotify(true);
    setMsg(following ? "Berhenti mengikuti." : "Diikuti. Kamu dapat notifikasi saat chapter baru terbit.");
  };

  const toggleNotify = async () => {
    if (!userId || !following) return;
    setBusy(true);
    const { error } = await sb.from("comic_follows").update({ notify: !notify }).eq("user_id", userId).eq("comic_id", comicId);
    setBusy(false);
    if (error) return setMsg("Gagal mengubah notifikasi: " + error.message);
    setNotify(!notify);
    setMsg(notify ? "Notifikasi chapter baru dimatikan." : "Notifikasi chapter baru dinyalakan.");
  };

  const share = async () => {
    const url = `${window.location.origin}/komik/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: `${title} - KOMIDIL`, url });
      else {
        await navigator.clipboard.writeText(url);
        setMsg("Link disalin.");
      }
    } catch {
      /* dibatalkan user */
    }
  };

  const btn = "inline-flex items-center gap-1.5 rounded-3xl border border-line bg-card px-4 py-2.5 text-sm font-bold";
  return (
    <div className="my-3.5">
      <div className="flex flex-wrap gap-2">
        {(resume !== null || firstChapter !== null) && (
          <Link
            href={`/komik/${slug}/${resume ?? firstChapter}`}
            className="inline-flex items-center gap-1.5 rounded-3xl bg-brand px-5 py-2.5 text-sm font-bold"
          >
            <IconPlay /> {resume !== null ? `Lanjutkan Chapter ${resume}` : "Mulai Baca"}
          </Link>
        )}
        <button onClick={toggle} disabled={busy} aria-pressed={saved} className={`${btn} ${saved ? "border-gold text-gold" : ""}`}>
          <IconBookmark width={18} height={18} /> {saved ? "Tersimpan" : "Bookmark"}
        </button>
        <button onClick={toggleFollow} disabled={busy} aria-pressed={following} className={`${btn} ${following ? "border-gold text-gold" : ""}`}>
          <IconBell width={18} height={18} /> {following ? "Diikuti" : "Ikuti"}
        </button>
        {following && (
          <button onClick={toggleNotify} disabled={busy} aria-pressed={notify} className={`${btn} ${notify ? "" : "text-mute"}`}>
            Notif {notify ? "aktif" : "mati"}
          </button>
        )}
        <CollectionPicker comicId={comicId} className={btn} />
        <button onClick={share} className={btn}>Share</button>
      </div>
      {msg && <p role="status" className="mt-2 text-xs text-gold">{msg}</p>}
    </div>
  );
}
