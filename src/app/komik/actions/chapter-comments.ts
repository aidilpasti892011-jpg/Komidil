"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { clean, UUID_RE } from "@/lib/community";

export type CommentResult = {
  ok?: string;
  error?: string;
};

const NEED_LOGIN = "Login dulu untuk melakukan tindakan ini.";

export async function createChapterComment(
  chapterId: string,
  parentId: string | null,
  body: string,
  photoPath: string | null = null,
  stickerId: string | null = null
): Promise<CommentResult> {
  const me = await getCurrentUser();
  if (!me) return { error: NEED_LOGIN };

  if (!UUID_RE.test(chapterId) || (parentId && !UUID_RE.test(parentId))) {
    return { error: "Data komentar tidak valid." };
  }

  if (stickerId && !UUID_RE.test(stickerId)) {
    return { error: "Stiker tidak valid." };
  }

  const text = clean(body, 2000);
  if (!text && !photoPath && !stickerId) {
    return { error: "Tulis komentar atau pilih foto atau stiker." };
  }
  if (photoPath && (!photoPath.startsWith(`${me.id}/`) || photoPath.includes(".."))) {
    return { error: "Lokasi foto tidak valid." };
  }

  const sb = await createClient();

  if (stickerId) {
    const { data: sticker, error: stickerError } = await sb
      .from("chapter_stickers")
      .select("id")
      .eq("id", stickerId)
      .eq("is_active", true)
      .maybeSingle();

    if (stickerError || !sticker) {
      return { error: "Stiker tidak tersedia atau belum disetujui." };
    }
  }

  const { error } = await sb.from("chapter_comments").insert({
    chapter_id: chapterId,
    user_id: me.id,
    parent_id: parentId || null,
    body: text || null,
    photo_path: photoPath,
    sticker_id: stickerId,
  });

  if (error) {
    return {
      error: /row-level|permission/i.test(error.message)
        ? "Komentar tidak dapat dikirim. Periksa akun atau status bab."
        : "Gagal mengirim komentar.",
    };
  }

  return { ok: "Komentar terkirim." };
}

export async function toggleChapterCommentLike(
  commentId: string,
  liked: boolean
): Promise<CommentResult> {
  const me = await getCurrentUser();
  if (!me) return { error: NEED_LOGIN };
  if (!UUID_RE.test(commentId)) return { error: "Komentar tidak valid." };

  const sb = await createClient();

  if (liked) {
    const { error } = await sb.from("chapter_comment_likes").insert({
      comment_id: commentId,
      user_id: me.id,
    });
    if (error) return { error: "Gagal menyukai komentar." };
  } else {
    const { error } = await sb
      .from("chapter_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", me.id);

    if (error) return { error: "Gagal membatalkan suka." };
  }

  return { ok: "Tersimpan." };
}

export async function reportChapterComment(
  commentId: string,
  reason: string,
  detail: string
): Promise<CommentResult> {
  const me = await getCurrentUser();
  if (!me) return { error: NEED_LOGIN };

  const reasons = [
    "Spam",
    "Konten tidak pantas",
    "Pelecehan atau ujaran kebencian",
    "Lainnya",
  ];

  if (!UUID_RE.test(commentId) || !reasons.includes(reason)) {
    return { error: "Data laporan tidak valid." };
  }

  const sb = await createClient();
  const { error } = await sb.from("chapter_comment_reports").insert({
    comment_id: commentId,
    reporter_id: me.id,
    reason,
    detail: clean(detail, 1000) || null,
  });

  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "Kamu sudah melaporkan komentar ini."
        : "Laporan gagal dikirim.",
    };
  }

  return { ok: "Laporan terkirim. Terima kasih." };
}

export async function moderateChapterComment(
  commentId: string,
  hidden: boolean
): Promise<CommentResult> {
  const me = await getCurrentUser();
  if (!me?.profile || me.profile.role !== "admin") {
    return { error: "Hanya admin yang boleh melakukan moderasi." };
  }

  if (!UUID_RE.test(commentId)) return { error: "Komentar tidak valid." };

  const sb = await createClient();
  const { error } = await sb
    .from("chapter_comments")
    .update({ is_hidden: hidden })
    .eq("id", commentId);

  return error ? { error: "Gagal mengubah status komentar." } : { ok: "Status komentar diperbarui." };
}

export async function submitChapterSticker(
  imagePath: string,
  description: string
): Promise<CommentResult> {
  const me = await getCurrentUser();
  if (!me) return { error: NEED_LOGIN };

  if (
    !imagePath.startsWith(`${me.id}/`) ||
    imagePath.includes("..") ||
    imagePath.length > 500
  ) {
    return { error: "Lokasi file stiker tidak valid." };
  }

  const sb = await createClient();

  const { error } = await sb.from("chapter_sticker_submissions").insert({
    user_id: me.id,
    image_path: imagePath,
    description: clean(description, 200) || null,
    status: "pending",
  });

  if (error) return { error: "Pengajuan stiker gagal disimpan." };

  return { ok: "Stiker berhasil diajukan untuk moderasi." };
}

export async function moderateChapterSticker(
  submissionId: string,
  decision: "approved" | "rejected"
): Promise<CommentResult> {
  const me = await getCurrentUser();

  if (!me?.profile || me.profile.role !== "admin") {
    return { error: "Hanya admin yang boleh melakukan moderasi." };
  }

  if (!UUID_RE.test(submissionId) || !["approved", "rejected"].includes(decision)) {
    return { error: "Data moderasi tidak valid." };
  }

  const sb = await createClient();

  const { data: submission, error: fetchError } = await sb
    .from("chapter_sticker_submissions")
    .select("id,user_id,image_path,description,status")
    .eq("id", submissionId)
    .maybeSingle();

  if (fetchError || !submission) {
    return { error: "Pengajuan tidak ditemukan atau akses ditolak." };
  }

  if (submission.status !== "pending") {
    return { error: "Pengajuan ini sudah dimoderasi." };
  }

  if (decision === "rejected") {
    const { error } = await sb
      .from("chapter_sticker_submissions")
      .update({ status: "rejected" })
      .eq("id", submissionId)
      .eq("status", "pending");

    return error
      ? { error: "Gagal menolak pengajuan." }
      : { ok: "Pengajuan stiker ditolak." };
  }

  const { data: file, error: downloadError } = await sb.storage
    .from("sticker-submissions")
    .download(submission.image_path);

  if (downloadError || !file) {
    return { error: "File pengajuan tidak dapat dibaca." };
  }

  const mime = file.type;
  const ext =
    mime === "image/png" ? "png" :
    mime === "image/webp" ? "webp" :
    mime === "image/jpeg" ? "jpg" : null;

  if (!ext || file.size > 2 * 1024 * 1024) {
    return { error: "Format atau ukuran file stiker tidak didukung." };
  }

  const officialPath = `approved/${submissionId}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from("stickers")
    .upload(officialPath, file, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    return { error: "Gagal menerbitkan file stiker resmi." };
  }

  const stickerName =
    clean(submission.description ?? "", 40) || "Stiker komunitas";

  const { data: sticker, error: insertError } = await sb
    .from("chapter_stickers")
    .insert({
      name: stickerName,
      image_path: officialPath,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !sticker) {
    await sb.storage.from("stickers").remove([officialPath]);
    return { error: "Gagal memasukkan stiker ke koleksi resmi." };
  }

  const { error: updateError } = await sb
    .from("chapter_sticker_submissions")
    .update({ status: "approved" })
    .eq("id", submissionId)
    .eq("status", "pending");

  if (updateError) {
    await sb
      .from("chapter_stickers")
      .update({ is_active: false })
      .eq("id", sticker.id);

    await sb.storage.from("stickers").remove([officialPath]);

    return { error: "Status pengajuan gagal diperbarui. Stiker dinonaktifkan." };
  }

  return { ok: "Stiker disetujui dan masuk ke koleksi resmi!" };
}

export async function editChapterComment(
  commentId: string,
  body: string
): Promise<CommentResult> {
  const me = await getCurrentUser();
  if (!me) return { error: NEED_LOGIN };
  if (!UUID_RE.test(commentId)) return { error: "Komentar tidak valid." };

  const text = clean(body, 2000);
  if (!text) return { error: "Isi komentar tidak boleh kosong." };

  const sb = await createClient();
  const { error } = await sb
    .from("chapter_comments")
    .update({ body: text })
    .eq("id", commentId)
    .eq("user_id", me.id);

  return error
    ? { error: "Gagal mengedit komentar." }
    : { ok: "Komentar berhasil diedit." };
}

export async function deleteChapterComment(
  commentId: string
): Promise<CommentResult> {
  const me = await getCurrentUser();
  if (!me) return { error: NEED_LOGIN };
  if (!UUID_RE.test(commentId)) return { error: "Komentar tidak valid." };

  const sb = await createClient();
  const { error } = await sb
    .from("chapter_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", me.id);

  return error
    ? { error: "Gagal menghapus komentar." }
    : { ok: "Komentar berhasil dihapus." };
}
