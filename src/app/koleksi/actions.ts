"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/community";
import { cleanDesc, cleanName } from "@/lib/collections-shared";

export type R = { error?: string; ok?: string } | undefined;

const NEED = "Kamu harus login dulu.";
const fail = (e: { message: string; code?: string }) =>
  e.code === "23505"
    ? "Kamu sudah punya koleksi dengan nama itu."
    : /Maksimal|tidak boleh|tidak valid/i.test(e.message)
      ? e.message
      : "Gagal menyimpan: " + e.message;

async function ctx() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  return { sb, uid: data.user?.id ?? null };
}

export async function createCollection(_: R, fd: FormData): Promise<R> {
  const { sb, uid } = await ctx();
  if (!uid) return { error: NEED };
  const name = cleanName(fd.get("name"));
  if (!name) return { error: "Nama koleksi tidak boleh kosong." };
  const { data, error } = await sb.from("collections").insert({ user_id: uid, name }).select("id").single();
  if (error || !data) return { error: fail(error ?? { message: "tidak diketahui" }) };
  revalidatePath("/koleksi");
  redirect(`/koleksi/${data.id}`);
}

export async function updateCollection(_: R, fd: FormData): Promise<R> {
  const { sb, uid } = await ctx();
  if (!uid) return { error: NEED };
  const id = String(fd.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Koleksi tidak valid." };
  const name = cleanName(fd.get("name"));
  if (!name) return { error: "Nama koleksi tidak boleh kosong." };
  const description = cleanDesc(fd.get("description")) || null;
  const { data, error } = await sb
    .from("collections")
    .update({ name, description })
    .eq("id", id)
    .eq("user_id", uid)
    .select("id");
  if (error) return { error: fail(error) };
  if (!data || data.length === 0) return { error: "Koleksi tidak ditemukan." };
  revalidatePath("/koleksi");
  revalidatePath(`/koleksi/${id}`);
  return { ok: "Tersimpan." };
}

export async function deleteCollection(id: string): Promise<R> {
  const { sb, uid } = await ctx();
  if (!uid) return { error: NEED };
  if (!UUID_RE.test(id)) return { error: "Koleksi tidak valid." };
  const { error } = await sb.from("collections").delete().eq("id", id).eq("user_id", uid);
  if (error) return { error: "Gagal menghapus: " + error.message };
  revalidatePath("/koleksi");
  redirect("/koleksi");
}

export async function removeCollectionItem(collectionId: string, comicId: string): Promise<R> {
  const { sb, uid } = await ctx();
  if (!uid) return { error: NEED };
  if (!UUID_RE.test(collectionId) || !UUID_RE.test(comicId)) return { error: "Data tidak valid." };
  // RLS memastikan hanya koleksi milik sendiri yang bisa diubah
  const { error } = await sb.from("collection_items").delete().eq("collection_id", collectionId).eq("comic_id", comicId);
  if (error) return { error: "Gagal menghapus: " + error.message };
  revalidatePath(`/koleksi/${collectionId}`);
  revalidatePath("/koleksi");
  return {};
}
