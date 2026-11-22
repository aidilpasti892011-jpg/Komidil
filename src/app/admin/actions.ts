"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { slugify, UUID_RE } from "@/lib/shared";
import { getCurrentUser } from "@/lib/auth";
import { clean } from "@/lib/community";
import { createClient } from "@/lib/supabase/server";
import { COMIC_STATUSES, COMIC_TYPES } from "@/lib/types";

export type R = { error?: string; ok?: string } | undefined;

/** Setiap action cek ulang role di server (layout saja tidak cukup). */
async function guard(admin: boolean) {
  const me = await getCurrentUser();
  const role = me?.profile?.role;
  const ok = admin ? role === "admin" : role === "admin" || role === "moderator";
  if (!me || !ok) return null;
  return { sb: await createClient(), uid: me.id };
}
const NO = { error: "Tidak diizinkan." };
const fail = (e: { message: string }): R => ({ error: "Gagal: " + e.message });
const IMG_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}(\/[A-Za-z0-9._-]{1,120})?$/i;

/* ---------------- KOMIK ---------------- */
export async function saveComic(_: R, fd: FormData): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  const id = String(fd.get("id") ?? "");
  const isNew = fd.get("is_new") === "1";
  if (!UUID_RE.test(id)) return { error: "ID komik tidak valid." };

  const title = clean(fd.get("title"), 200);
  if (!title) return { error: "Judul wajib diisi." };
  const type = String(fd.get("type") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!(COMIC_TYPES as string[]).includes(type) || !(COMIC_STATUSES as string[]).includes(status)) return { error: "Tipe atau status tidak valid." };
  const hue = Number(fd.get("cover_hue") ?? 0);
  if (!Number.isInteger(hue) || hue < 0 || hue > 360) return { error: "Hue cover 0-360." };
  const published = fd.get("is_published") === "on";
  const rights = fd.get("rights_confirmed") === "on";
  if (!rights) return { error: "Kamu harus menyatakan konten ini milikmu atau berlisensi." };

  const alt = String(fd.get("alt_titles") ?? "").split(/[\n,]/).map((s) => clean(s, 200)).filter(Boolean).slice(0, 10);
  const genreIds = [...new Set(fd.getAll("genre").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 20);

  const row: Record<string, unknown> = {
    title, type, status, alt_titles: alt, cover_hue: hue, is_published: published, rights_confirmed: true,
    synopsis: clean(fd.get("synopsis"), 4000) || null,
    author: clean(fd.get("author"), 120) || null, artist: clean(fd.get("artist"), 120) || null,
    rights_note: clean(fd.get("rights_note"), 500) || null,
  };
  const coverPath = String(fd.get("cover_path") ?? "");
  if (coverPath) {
    if (!IMG_PATH.test(coverPath) || !coverPath.startsWith(id + "/")) return { error: "Path cover tidak valid." };
    row.cover_url = g.sb.storage.from("covers").getPublicUrl(coverPath).data.publicUrl;
  }

  if (isNew) {
    let slug = slugify(String(fd.get("slug") || title));
    const { data: ex } = await g.sb.from("comics").select("slug").like("slug", `${slug}%`);
    const used = new Set((ex ?? []).map((r) => r.slug as string));
    if (used.has(slug)) { let n = 2; while (used.has(`${slug}-${n}`)) n++; slug = `${slug}-${n}`; }
    const { error } = await g.sb.from("comics").insert({ ...row, id, slug, uploaded_by: g.uid });
    if (error) return fail(error);
  } else {
    const { error } = await g.sb.from("comics").update(row).eq("id", id);
    if (error) return fail(error);
  }
  await g.sb.from("comic_genres").delete().eq("comic_id", id);
  if (genreIds.length) {
    const { error } = await g.sb.from("comic_genres").insert(genreIds.map((genre_id) => ({ comic_id: id, genre_id })));
    if (error) return fail(error);
  }
  revalidatePath("/", "layout");
  if (isNew) redirect(`/admin/komik/${id}`);
  return { ok: "Komik tersimpan." };
}

async function wipeFolder(sb: Awaited<ReturnType<typeof createClient>>, bucket: string, prefix: string) {
  const { data } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
  for (const f of data ?? []) {
    if (f.id) await sb.storage.from(bucket).remove([`${prefix}/${f.name}`]);
    else await wipeFolder(sb, bucket, `${prefix}/${f.name}`); // subfolder (chapter)
  }
}

export async function deleteComic(id: string): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(id)) return { error: "ID tidak valid." };
  const { error } = await g.sb.from("comics").delete().eq("id", id);
  if (error) return fail(error);
  await wipeFolder(g.sb, "covers", id).catch(() => {});
  await wipeFolder(g.sb, "chapters", id).catch(() => {});
  revalidatePath("/", "layout");
  redirect("/admin/komik");
}

/* ---------------- CHAPTER ---------------- */
export async function saveChapter(_: R, fd: FormData): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  const comicId = String(fd.get("comic_id") ?? "");
  const id = String(fd.get("id") ?? "");
  const isNew = fd.get("is_new") === "1";
  if (!UUID_RE.test(comicId) || !UUID_RE.test(id)) return { error: "ID tidak valid." };

  const number = Number(String(fd.get("number") ?? "").replace(",", "."));
  if (!Number.isFinite(number) || number < 0 || number > 99999 || Math.abs(Math.round(number * 100) - number * 100) > 1e-6) {
    return { error: "Nomor chapter 0 sampai 99999 (maks 2 desimal)." };
  }
  const mode = String(fd.get("mode") ?? "keep");
  const when = mode === "schedule" ? new Date(String(fd.get("published_at_iso") ?? "")) : null;
  if (when && Number.isNaN(when.getTime())) return { error: "Tanggal jadwal tidak valid." };
  if (when && when.getTime() < Date.now() - 60_000 && isNew) return { error: "Jadwal terbit harus di masa depan." };

  const row = {
    number: Math.round(number * 100) / 100,
    title: clean(fd.get("title"), 150) || null,
    is_published: fd.get("is_published") === "on",
    ...(when ? { published_at: when.toISOString() } : mode === "now" && !isNew ? { published_at: new Date().toISOString() } : {}),
  };
  const q = isNew
    ? g.sb.from("chapters").insert({ ...row, id, comic_id: comicId })
    : g.sb.from("chapters").update(row).eq("id", id);
  const { error } = await q;
  if (error) return { error: /duplicate|unique/i.test(error.message) ? "Nomor chapter itu sudah ada di komik ini." : "Gagal: " + error.message };
  revalidatePath("/", "layout");
  if (isNew) redirect(`/admin/chapter/${id}`);
  return { ok: "Chapter tersimpan." };
}

export async function deleteChapter(id: string): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(id)) return { error: "ID tidak valid." };
  const { data: ch } = await g.sb.from("chapters").select("comic_id").eq("id", id).maybeSingle();
  const { error } = await g.sb.from("chapters").delete().eq("id", id);
  if (error) return fail(error);
  if (ch) await wipeFolder(g.sb, "chapters", `${ch.comic_id}/${id}`).catch(() => {});
  revalidatePath("/", "layout");
  redirect(ch ? `/admin/komik/${ch.comic_id}` : "/admin/komik");
}

export async function addChapterImages(chapterId: string, items: { path: string; width: number | null; height: number | null }[]): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(chapterId) || !Array.isArray(items) || !items.length || items.length > 200) return { error: "Data gambar tidak valid." };
  const { data: ch } = await g.sb.from("chapters").select("comic_id").eq("id", chapterId).maybeSingle();
  if (!ch) return { error: "Chapter tidak ditemukan." };
  const prefix = `${ch.comic_id}/${chapterId}/`;
  for (const it of items) {
    if (typeof it.path !== "string" || !it.path.startsWith(prefix) || !IMG_PATH.test(it.path)) return { error: "Path gambar tidak valid." };
  }
  const { data: last } = await g.sb.from("chapter_images").select("page_number").eq("chapter_id", chapterId).order("page_number", { ascending: false }).limit(1);
  let n = last?.[0]?.page_number ?? 0;
  const dim = (v: unknown) => (typeof v === "number" && v > 0 && v < 30000 ? Math.round(v) : null);
  const { error } = await g.sb.from("chapter_images").insert(
    items.map((it) => ({ chapter_id: chapterId, page_number: ++n, image_path: it.path, width: dim(it.width), height: dim(it.height) }))
  );
  if (error) return fail(error);
  revalidatePath(`/admin/chapter/${chapterId}`);
  return { ok: `${items.length} gambar ditambahkan.` };
}

export async function reorderImages(chapterId: string, orderedIds: string[]): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(chapterId) || !orderedIds.every((x) => UUID_RE.test(x))) return { error: "Data tidak valid." };
  // dua tahap supaya tidak bentrok dengan unique (chapter_id, page_number)
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await g.sb.from("chapter_images").update({ page_number: 100000 + i }).eq("id", orderedIds[i]).eq("chapter_id", chapterId);
    if (error) return fail(error);
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await g.sb.from("chapter_images").update({ page_number: i + 1 }).eq("id", orderedIds[i]).eq("chapter_id", chapterId);
    if (error) return fail(error);
  }
  revalidatePath(`/admin/chapter/${chapterId}`);
  return { ok: "Urutan disimpan." };
}

export async function deleteImage(id: string): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(id)) return { error: "ID tidak valid." };
  const { data: img } = await g.sb.from("chapter_images").select("image_path,chapter_id").eq("id", id).maybeSingle();
  if (!img) return { error: "Gambar tidak ditemukan." };
  const { error } = await g.sb.from("chapter_images").delete().eq("id", id);
  if (error) return fail(error);
  await g.sb.storage.from("chapters").remove([img.image_path]);
  revalidatePath(`/admin/chapter/${img.chapter_id}`);
  return { ok: "Gambar dihapus." };
}

/* ---------------- USER ---------------- */
export async function setRole(userId: string, role: "user" | "moderator"): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(userId) || !["user", "moderator"].includes(role)) return { error: "Data tidak valid." };
  if (userId === g.uid) return { error: "Tidak bisa mengubah role akunmu sendiri." };
  const { error } = await g.sb.from("profiles").update({ role }).eq("id", userId);
  if (error) return fail(error);
  revalidatePath("/admin/user");
  return { ok: "Role diubah." };
}

export async function suspendUser(userId: string, reason: string, days: number | null): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(userId)) return { error: "Data tidak valid." };
  if (userId === g.uid) return { error: "Tidak bisa suspend akunmu sendiri." };
  const why = clean(reason, 200);
  if (why.length < 3) return { error: "Isi alasan suspend (min 3 karakter)." };
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) return { error: "Durasi 1-3650 hari." };
  const until = days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString();
  const { error } = await g.sb.from("profiles").update({ is_suspended: true, suspended_until: until, suspended_reason: why }).eq("id", userId);
  if (error) return fail(error);
  revalidatePath("/admin/user");
  return { ok: "User disuspend." };
}

export async function unsuspendUser(userId: string): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(userId)) return { error: "Data tidak valid." };
  const { error } = await g.sb.from("profiles").update({ is_suspended: false, suspended_until: null, suspended_reason: null }).eq("id", userId);
  if (error) return fail(error);
  revalidatePath("/admin/user");
  return { ok: "Suspend dicabut." };
}

/* ---------------- MODERASI (staff) ---------------- */
const STATUS = ["open", "reviewing", "resolved", "dismissed"] as const;
export async function setReportStatus(id: string, status: (typeof STATUS)[number]): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(id) || !STATUS.includes(status)) return { error: "Data tidak valid." };
  const { error } = await g.sb.from("reports").update({ status, resolved_by: status === "resolved" || status === "dismissed" ? g.uid : null }).eq("id", id);
  if (error) return fail(error);
  revalidatePath("/admin/laporan");
  return { ok: "Status diperbarui." };
}

/** Tindakan pada konten yang dilaporkan: sembunyikan / tampilkan / hapus. */
export async function actOnTarget(type: "post" | "comment" | "review", id: string, op: "hide" | "show" | "delete"): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  if (!UUID_RE.test(id) || !["post", "comment", "review"].includes(type) || !["hide", "show", "delete"].includes(op)) return { error: "Data tidak valid." };
  const table = type === "post" ? "posts" : type === "comment" ? "comments" : "reviews";
  const q = op === "delete" ? g.sb.from(table).delete().eq("id", id).select("id") : g.sb.from(table).update({ is_hidden: op === "hide" }).eq("id", id).select("id");
  const { data, error } = await q;
  if (error) return fail(error);
  if (!data?.length) return { error: "Konten tidak ditemukan." };
  revalidatePath("/admin/laporan");
  revalidatePath("/komunitas", "layout");
  return { ok: op === "delete" ? "Dihapus." : op === "hide" ? "Disembunyikan." : "Ditampilkan." };
}

/* ---------------- NOTIFIKASI ---------------- */
export async function markAllRead() {
  const me = await getCurrentUser();
  if (!me) return;
  const sb = await createClient();
  await sb.from("notifications").update({ is_read: true }).eq("user_id", me.id).eq("is_read", false);
  revalidatePath("/", "layout");
}

/* ---------------- RANKING ---------------- */
/** Hitung ulang ranking sekarang (admin). Normalnya pg_cron yang menjalankan tiap 15 menit. */
export async function refreshRankings(): Promise<R> {
  const g = await guard(true);
  if (!g) return NO;
  const { error } = await g.sb.rpc("admin_refresh_rankings");
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return { ok: "Ranking diperbarui." };
}
