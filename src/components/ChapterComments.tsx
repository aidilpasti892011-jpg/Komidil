"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createChapterComment,
  toggleChapterCommentLike,
  reportChapterComment,
  moderateChapterComment, editChapterComment, deleteChapterComment,
} from "@/app/komik/actions/chapter-comments";
import { timeAgo } from "@/lib/utils";
import ChapterStickerPanel from "@/components/ChapterStickerPanel";

type Profile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  rank_level: number | null;
};

type Sticker = {
  id: string;
  name: string;
  image_path: string;
};

type Comment = {
  id: string;
  chapter_id: string;
  user_id: string;
  parent_id: string | null;
  body: string | null;
  photo_path: string | null;
  sticker_id: string | null;
  is_hidden: boolean;
  like_count: number;
  created_at: string;
  profiles: Profile | Profile[] | null;
};

const reasons = [
  "Spam",
  "Konten tidak pantas",
  "Pelecehan atau ujaran kebencian",
  "Lainnya",
];

export default function ChapterComments({ chapterId }: { chapterId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [stickerUrls, setStickerUrls] = useState<Record<string, string>>({});
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  const [uid, setUid] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyPhoto, setReplyPhoto] = useState<File | null>(null);
  const [replyStickerId, setReplyStickerId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reason, setReason] = useState(reasons[0]);
  const [detail, setDetail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();

    const { data: stickerRows } = await sb
      .from("chapter_stickers")
      .select("id,name,image_path")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    const activeStickers = (stickerRows ?? []) as Sticker[];
    setStickers(activeStickers);

    const nextStickerUrls: Record<string, string> = {};
    activeStickers.forEach((sticker) => {
      const { data } = sb.storage
        .from("stickers")
        .getPublicUrl(sticker.image_path);
      nextStickerUrls[sticker.id] = data.publicUrl;
    });
    setStickerUrls(nextStickerUrls);

    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id ?? null;
    setUid(userId);

    if (userId) {
      const { data: profile } = await sb
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      setStaff(profile?.role === "admin");
    }

    const { data, error } = await sb
      .from("chapter_comments")
      .select("id,chapter_id,user_id,parent_id,body,photo_path,sticker_id,is_hidden,like_count,created_at,profiles!chapter_comments_user_id_fkey(username,display_name,avatar_url,role,rank_level)")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      setMessage(`Gagal memuat komentar: ${error.message}`);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as Comment[];
    setComments(rows);

    const entries = await Promise.all(
      rows.filter((c) => c.photo_path).map(async (c): Promise<[string, string] | null> => {
        const { data: signed } = await sb.storage
          .from("comment-photos")
          .createSignedUrl(c.photo_path!, 3600);
        return signed?.signedUrl ? [c.id, signed.signedUrl] : null;
      })
    );
    const urls: Record<string, string> = {};
    entries.forEach((entry) => {
      if (entry) urls[entry[0]] = entry[1];
    });
    setPhotoUrls(urls);

    if (userId && rows.length) {
      const { data: likes } = await sb
        .from("chapter_comment_likes")
        .select("comment_id")
        .eq("user_id", userId)
        .in("comment_id", rows.map((c) => c.id));

      setLiked(Object.fromEntries((likes ?? []).map((x) => [x.comment_id, true])));
    }

    setLoading(false);
  }, [chapterId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(
    parentId: string | null,
    text: string,
    image: File | null = null,
    stickerId: string | null = null
  ) {
    if (pending) return;
    if (!text.trim() && !image && !stickerId) {
      setMessage("Tulis komentar, pilih foto, atau pilih stiker.");
      return;
    }

    setPending(true);
    setMessage("");
    let photoPath: string | null = null;

    if (image) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        setPending(false);
        setMessage("Foto harus JPG, PNG, atau WebP.");
        return;
      }
      if (image.size > 5 * 1024 * 1024) {
        setPending(false);
        setMessage("Ukuran foto maksimal 5 MB.");
        return;
      }
      if (!uid) {
        setPending(false);
        setMessage("Login dulu untuk mengunggah foto.");
        return;
      }

      const ext = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
      photoPath = `${uid}/${chapterId}/${Date.now()}.${ext}`;
      const sb = createClient();
      const { error } = await sb.storage
        .from("comment-photos")
        .upload(photoPath, image, { contentType: image.type });

      if (error) {
        setPending(false);
        setMessage("Gagal mengunggah foto. Periksa koneksi atau izin penyimpanan.");
        return;
      }
    }

    const result = await createChapterComment(
      chapterId, parentId, text, photoPath, stickerId
    );

    if (result.error && photoPath) {
      await createClient().storage.from("comment-photos").remove([photoPath]);
    }

    setPending(false);
    setMessage(result.error ?? result.ok ?? "");

    if (result.ok) {
      if (parentId) {
        setReplyBody("");
        setReplyPhoto(null);
        setReplyStickerId(null);
        setReplyTo(null);
      } else {
        setBody("");
        setPhoto(null);
        setSelectedStickerId(null);
      }
      await load();
    }
  }

  async function like(c: Comment) {
    if (!uid || pending) {
      setMessage("Login dulu untuk menyukai komentar.");
      return;
    }

    const next = !liked[c.id];
    setPending(true);
    const result = await toggleChapterCommentLike(c.id, next);
    setPending(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    setLiked((old) => ({ ...old, [c.id]: next }));
    setComments((old) =>
      old.map((x) =>
        x.id === c.id
          ? { ...x, like_count: Math.max(0, x.like_count + (next ? 1 : -1)) }
          : x
      )
    );
  }

  async function sendReport() {
    if (!reportId || pending) return;
    setPending(true);
    const result = await reportChapterComment(reportId, reason, detail);
    setPending(false);
    setMessage(result.error ?? result.ok ?? "");
    if (result.ok) {
      setReportId(null);
      setDetail("");
    }
  }

  async function saveEdit(c: Comment) {
    if (pending) return;
    setPending(true);
    const result = await editChapterComment(c.id, editBody);
    setPending(false);
    setMessage(result.error ?? result.ok ?? "");
    if (result.ok) {
      setEditingId(null);
      setEditBody("");
      await load();
    }
  }

  async function removeComment(c: Comment) {
    if (pending) return;
    setPending(true);
    const result = await deleteChapterComment(c.id);
    setPending(false);
    setMessage(result.error ?? result.ok ?? "");
    if (result.ok) {
      setConfirmDeleteId(null);
      await load();
    }
  }

  async function moderate(c: Comment) {
    if (!staff || pending) return;
    setPending(true);
    const result = await moderateChapterComment(c.id, !c.is_hidden);
    setPending(false);
    setMessage(result.error ?? result.ok ?? "");
    if (result.ok) await load();
  }

  function profileOf(c: Comment) {
    return Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
  }

  function renderComment(c: Comment, isReply = false) {
    const profile = profileOf(c);
    const mine = uid === c.user_id;

    return (
      <article key={c.id} className={`flex gap-3 ${isReply ? "ml-5 border-l border-line pl-3" : ""}`}>
        <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-card text-sm font-bold text-gold">
          {(profile?.display_name || profile?.username || "U").slice(0, 1).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <b>{profile?.display_name || profile?.username || "Pengguna"}</b>
            {profile?.role === "admin" && <span className="text-gold">Admin</span>}
            <span className="text-mute">{timeAgo(c.created_at)}</span>
          </div>

          {c.is_hidden && !staff ? (
            <p className="mt-2 text-sm italic text-mute">Komentar disembunyikan Admin.</p>
          ) : (
            <>
              {c.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.body}</p>}
              {c.photo_path && photoUrls[c.id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrls[c.id]}
                  alt="Foto dalam komentar"
                  loading="lazy"
                  className="mt-2 max-h-72 max-w-full rounded-xl border border-line object-contain"
                />
              )}
              {c.sticker_id && stickerUrls[c.sticker_id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stickerUrls[c.sticker_id]}
                  alt="Stiker komentar"
                  loading="lazy"
                  className="mt-2 h-24 w-24 rounded-xl object-contain"
                />
              )}
            </>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-mute">
            <button type="button" onClick={() => void like(c)} className={liked[c.id] ? "font-bold text-pink-400" : ""}>
              {liked[c.id] ? "♥" : "♡"} {c.like_count}
            </button>

            {!isReply && !c.is_hidden && (
              <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                Balas
              </button>
            )}

            {!mine && uid && !c.is_hidden && (
              <button type="button" onClick={() => setReportId(reportId === c.id ? null : c.id)}>
                Laporkan
              </button>
            )}

            {mine && (<><button type="button" onClick={() => { setEditingId(c.id); setEditBody(c.body ?? ""); setConfirmDeleteId(null); }}>Edit</button><button type="button" onClick={() => { setConfirmDeleteId(c.id); setEditingId(null); }}>Hapus</button></>)}
            {staff && (
              <button type="button" onClick={() => void moderate(c)}>
                {c.is_hidden ? "Tampilkan" : "Sembunyikan"}
              </button>
            )}
          </div>

          {editingId === c.id && (
            <div className="mt-3 space-y-2">
              <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-xl border border-line bg-card p-3 text-sm" />
              <button type="button" disabled={pending || !editBody.trim()} onClick={() => void saveEdit(c)} className="rounded-full bg-brand px-4 py-2 text-xs font-bold">Simpan perubahan</button>
              <button type="button" onClick={() => setEditingId(null)} className="ml-2 text-xs">Batal</button>
            </div>
          )}
          {confirmDeleteId === c.id && (
            <div className="mt-3 rounded-xl border border-line bg-card p-3">
              <p className="text-sm">Yakin ingin menghapus komentar ini?</p>
              <button type="button" disabled={pending} onClick={() => void removeComment(c)} className="mt-2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white">Ya, hapus</button>
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="ml-2 text-xs">Batal</button>
            </div>
          )}
          {replyTo === c.id && !isReply && (
            <div className="mt-3">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Tulis balasan..."
                className="w-full rounded-xl border border-line bg-card p-3 text-sm"
              />
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setReplyPhoto(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs"
              />
              <select value={replyStickerId ?? ""}
                onChange={(e) => setReplyStickerId(e.target.value || null)}
                className="mt-2 w-full rounded-xl border border-line bg-card p-2 text-sm">
                <option value="">Tanpa stiker</option>
                {stickers.map((sticker) => (
                  <option key={sticker.id} value={sticker.id}>{sticker.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || (!replyBody.trim() && !replyPhoto && !replyStickerId)}
                onClick={() => void send(c.id, replyBody, replyPhoto, replyStickerId)}
                className="mt-2 rounded-full bg-brand px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                {pending ? "Mengirim..." : "Kirim balasan"}
              </button>
            </div>
          )}

          {reportId === c.id && (
            <div className="mt-3 space-y-2 rounded-xl border border-line bg-card p-3">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-line bg-bg p-2 text-sm">
                {reasons.map((r) => <option key={r}>{r}</option>)}
              </select>
              <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={1000} rows={2} placeholder="Keterangan tambahan (opsional)" className="w-full rounded-lg border border-line bg-bg p-2 text-sm" />
              <button type="button" disabled={pending} onClick={() => void sendReport()} className="rounded-full bg-brand px-4 py-2 text-xs font-bold">
                Kirim laporan
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }

  const roots = comments.filter((c) => !c.parent_id);

  return (
    <section className="mx-auto w-full max-w-[720px] px-4 pb-12 pt-5 text-white">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-extrabold">Diskusi Chapter</h3>
        <span className="text-xs text-mute">{comments.length} komentar</span>
      </div>

      <ChapterStickerPanel uid={uid} staff={staff} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(null, body, photo, selectedStickerId);
        }}
        className="mb-5"
      >
        {uid && stickers.length > 0 && (
          <div className="mb-3 rounded-xl border border-line bg-card p-3">
            <p className="mb-2 text-xs font-bold">Pilih stiker</p>
            <div className="flex flex-wrap gap-2">
              {stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setSelectedStickerId(
                      selectedStickerId === sticker.id ? null : sticker.id
                    )
                  }
                  aria-label={sticker.name}
                  aria-pressed={selectedStickerId === sticker.id}
                  className={`rounded-xl border p-2 ${
                    selectedStickerId === sticker.id
                      ? "border-brand bg-brand/10"
                      : "border-line"
                  }`}
                >
                  {stickerUrls[sticker.id] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={stickerUrls[sticker.id]}
                      alt={sticker.name}
                      className="h-12 w-12 object-contain"
                    />
                  )}
                </button>
              ))}
            </div>
            {selectedStickerId && (
              <button
                type="button"
                onClick={() => setSelectedStickerId(null)}
                className="mt-2 text-xs text-mute"
              >
                Hapus pilihan stiker
              </button>
            )}
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={uid ? "Bagaimana pendapatmu tentang chapter ini?" : "Login untuk ikut berdiskusi..."}
          disabled={!uid}
          className="w-full rounded-2xl border border-line bg-card p-3.5 text-sm placeholder:text-mute disabled:opacity-60"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-mute">{body.length}/2000</span>
            <label className="cursor-pointer rounded-full border border-line px-3 py-2 text-xs font-semibold text-mute">
              {photo ? `Foto: ${photo.name}` : "+ Tambah foto"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!uid || pending}
                className="sr-only"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
            {photo && (
              <button type="button" onClick={() => setPhoto(null)} className="text-xs text-red-300">
                Hapus foto
              </button>
            )}
          </div>
          <button disabled={!uid || pending || (!body.trim() && !photo && !selectedStickerId)} className="rounded-full bg-brand px-5 py-2.5 text-xs font-bold disabled:opacity-50">
            {pending ? "Mengirim..." : "Kirim komentar"}
          </button>
        </div>
      </form>

      {message && <p role="status" className="mb-3 text-xs text-gold">{message}</p>}
      {loading ? (
        <p className="py-6 text-center text-sm text-mute">Memuat komentar...</p>
      ) : roots.length === 0 ? (
        <p className="py-8 text-center text-sm text-mute">Belum ada komentar. Jadilah yang pertama berdiskusi!</p>
      ) : (
        <div className="space-y-5">
          {roots.map((c) => (
            <div key={c.id} className="space-y-4">
              {renderComment(c)}
              {comments.filter((x) => x.parent_id === c.id).map((reply) => renderComment(reply, true))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
