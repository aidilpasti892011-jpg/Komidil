"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clean, POST_CATS, REPORT_REASONS, REPORT_TARGETS, UUID_RE, type PostCat, type ReportTarget } from "@/lib/community";

export type R = { error?: string; ok?: string; liked?: boolean } | undefined;

async function ctx() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { sb, uid: null as string | null, role: "user" as string, suspended: false };
  const { data: p } = await sb.from("profiles").select("role,is_suspended,suspended_until").eq("id", data.user.id).maybeSingle();
  const suspended = Boolean(p?.is_suspended && !(p.suspended_until && new Date(p.suspended_until) < new Date()));
  return { sb, uid: data.user.id, role: (p?.role as string) ?? "user", suspended };
}
const NEED = "Kamu harus login dulu.";
const SUSP = "Akunmu sedang disuspend, tidak bisa menulis.";
const isAdmin = (r: string) => r === "admin";
const msg = (e: { message: string }) => (/Terlalu|tidak valid|Maksimal|ditutup|tidak bisa|hanya|cocok/i.test(e.message) ? e.message : "Gagal menyimpan: " + e.message);

export async function createPost(_: R, fd: FormData): Promise<R> {
  const c = await ctx();
  if (!c.uid) return { error: NEED };
  if (c.suspended) return { error: SUSP };

  const category = String(fd.get("category") ?? "") as PostCat;
  if (!POST_CATS.some((x) => x.key === category)) return { error: "Kategori tidak valid." };
  if (category === "pengumuman" && !isAdmin(c.role)) return { error: "Hanya Super Admin yang boleh membuat pengumuman." };
  const title = clean(fd.get("title"), 150);
  const body = clean(fd.get("body"), 5000);
  if (title.length < 3) return { error: "Judul minimal 3 karakter." };
  if (!body) return { error: "Isi post tidak boleh kosong." };
  const comicId = String(fd.get("comic_id") ?? "");
  if (comicId && !UUID_RE.test(comicId)) return { error: "Komik tidak valid." };

  let options: string[] = [];
  if (category === "polling") {
    options = fd.getAll("option").map((o) => clean(o, 80)).filter(Boolean);
    options = [...new Set(options)];
    if (options.length < 2 || options.length > 6) return { error: "Polling butuh 2 sampai 6 opsi yang berbeda." };
  }

  const { data, error } = await c.sb
    .from("posts")
    .insert({ user_id: c.uid, category, title, body, comic_id: comicId || null, has_spoiler: category === "spoiler" || fd.get("spoiler") === "on" })
    .select("id")
    .single();
  if (error || !data) return { error: msg(error ?? { message: "tidak diketahui" }) };

  if (options.length) {
    const { error: oe } = await c.sb.from("poll_options").insert(options.map((label) => ({ post_id: data.id, label })));
    if (oe) {
      await c.sb.from("posts").delete().eq("id", data.id);
      return { error: msg(oe) };
    }
  }
  revalidatePath("/komunitas");
  redirect(`/komunitas/${data.id}`);
}

export async function createComment(_: R, fd: FormData): Promise<R> {
  const c = await ctx();
  if (!c.uid) return { error: NEED };
  if (c.suspended) return { error: SUSP };
  const postId = String(fd.get("post_id") ?? "");
  const parent = String(fd.get("parent_id") ?? "");
  const body = clean(fd.get("body"), 2000);
  if (!UUID_RE.test(postId) || (parent && !UUID_RE.test(parent))) return { error: "Permintaan tidak valid." };
  if (!body) return { error: "Komentar tidak boleh kosong." };
  const { error } = await c.sb.from("comments").insert({ post_id: postId, user_id: c.uid, parent_id: parent || null, body });
  if (error) return { error: /row-level/i.test(error.message) ? "Post terkunci atau kamu tidak boleh berkomentar." : msg(error) };
  revalidatePath(`/komunitas/${postId}`);
  return { ok: "Terkirim." };
}

export async function toggleLike(type: "post" | "comment" | "review", id: string): Promise<R> {
  const c = await ctx();
  if (!c.uid) return { error: NEED };
  if (!["post", "comment", "review"].includes(type) || !UUID_RE.test(id)) return { error: "Permintaan tidak valid." };
  const { data: ex } = await c.sb.from("likes").select("target_id").eq("user_id", c.uid).eq("target_type", type).eq("target_id", id).maybeSingle();
  if (ex) {
    const { error } = await c.sb.from("likes").delete().eq("user_id", c.uid).eq("target_type", type).eq("target_id", id);
    return error ? { error: msg(error) } : { liked: false };
  }
  const { error } = await c.sb.from("likes").insert({ user_id: c.uid, target_type: type, target_id: id });
  return error ? { error: /row-level/i.test(error.message) ? SUSP : msg(error) } : { liked: true };
}

export async function votePoll(postId: string, optionId: string): Promise<R> {
  const c = await ctx();
  if (!c.uid) return { error: NEED };
  if (!UUID_RE.test(postId) || !UUID_RE.test(optionId)) return { error: "Permintaan tidak valid." };
  const { error } = await c.sb.from("poll_votes").insert({ post_id: postId, user_id: c.uid, option_id: optionId });
  if (error) return { error: /duplicate|unique/i.test(error.message) ? "Kamu sudah memilih di polling ini." : msg(error) };
  revalidatePath(`/komunitas/${postId}`);
  return { ok: "Suaramu tercatat." };
}

/** Pengguna menghapus konten sendiri; Super Admin dapat mengelola konten siapa pun. RLS menegakkan batasnya. */
export async function removeItem(type: "post" | "comment" | "review", id: string, back?: string): Promise<R> {
  const c = await ctx();
  if (!c.uid) return { error: NEED };
  if (!UUID_RE.test(id)) return { error: "Permintaan tidak valid." };
  const table = type === "post" ? "posts" : type === "comment" ? "comments" : "reviews";
  const { data, error } = await c.sb.from(table).delete().eq("id", id).select("id");
  if (error) return { error: msg(error) };
  if (!data?.length) return { error: "Tidak diizinkan atau data sudah tidak ada." };
  revalidatePath("/komunitas");
  if (type === "post") redirect("/komunitas");
  if (back) revalidatePath(back);
  return { ok: "Dihapus." };
}

/** Seluruh tindakan moderasi hanya boleh dilakukan Super Admin. */
export async function moderate(type: "post" | "comment" | "review", id: string, op: "hide" | "show" | "pin" | "unpin" | "lock" | "unlock"): Promise<R> {
  const c = await ctx();
  if (!c.uid) return { error: NEED };
  if (!isAdmin(c.role)) return { error: "Hanya Super Admin yang boleh melakukan moderasi." };
  if (!UUID_RE.test(id)) return { error: "Permintaan tidak valid." };
  const patch: Record<string, boolean> = {
    hide: { is_hidden: true }, show: { is_hidden: false }, pin: { is_pinned: true },
    unpin: { is_pinned: false }, lock: { is_locked: true }, unlock: { is_locked: false },
  }[op] as Record<string, boolean>;
  if (!patch) return { error: "Aksi tidak dikenal." };
  if (type !== "post" && !("is_hidden" in patch)) return { error: "Aksi tidak berlaku." };
  const table = type === "post" ? "posts" : type === "comment" ? "comments" : "reviews";
  const { error } = await c.sb.from(table).update(patch).eq("id", id);
  if (error) return { error: msg(error) };
  revalidatePath("/komunitas", "layout");
  return { ok: "Tersimpan." };
}

export async function report(type: ReportTarget, id: string, reason: string, detail: string): Promise<R> {
  const c = await ctx();
  if (!c.uid) return { error: NEED };
  if (!REPORT_TARGETS.includes(type) || !UUID_RE.test(id)) return { error: "Permintaan tidak valid." };
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return { error: "Pilih alasan laporan." };
  const { count } = await c.sb.from("reports").select("*", { count: "exact", head: true })
    .eq("reporter_id", c.uid).eq("target_type", type).eq("target_id", id).in("status", ["open", "reviewing"]);
  if (count) return { ok: "Laporanmu sudah kami terima sebelumnya." };
  const { error } = await c.sb.from("reports").insert({
    reporter_id: c.uid, target_type: type, target_id: id, reason, detail: clean(detail, 1000) || null,
  });
  return error ? { error: /row-level/i.test(error.message) ? SUSP : msg(error) } : { ok: "Laporan terkirim. Terima kasih." };
}

export async function saveReview(_: R, fd: FormData): Promise<R> {
  const c = await ctx();
  if (!c.uid) return { error: NEED };
  if (c.suspended) return { error: SUSP };
  const comicId = String(fd.get("comic_id") ?? "");
  const rating = Number(fd.get("rating"));
  const body = clean(fd.get("body"), 3000);
  if (!UUID_RE.test(comicId)) return { error: "Pilih komik yang mau direview." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Beri rating 1 sampai 5." };
  const { error } = await c.sb.from("reviews").upsert(
    { comic_id: comicId, user_id: c.uid, rating, body: body || null, has_spoiler: fd.get("spoiler") === "on" },
    { onConflict: "comic_id,user_id" }
  );
  if (error) return { error: msg(error) };
  revalidatePath("/komunitas");
  redirect("/komunitas?cat=review");
}
