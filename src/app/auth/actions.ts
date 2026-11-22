"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPassword, EMAIL_RE, safeNext, USERNAME_RE } from "@/lib/validators";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!EMAIL_RE.test(email) || !password) return { error: "Email atau password tidak valid." };

  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: /not confirmed/i.test(error.message)
        ? "Email belum dikonfirmasi. Cek inbox (dan folder spam) kamu."
        : "Email atau password salah.",
    };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(fd.get("next")));
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const username = str(fd, "username");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "Email tidak valid." };
  if (!USERNAME_RE.test(username)) return { error: "Username 3-20 karakter: huruf, angka, atau underscore." };
  const pwErr = checkPassword(password);
  if (pwErr) return { error: pwErr };
  if (password !== confirm) return { error: "Konfirmasi password tidak sama." };

  const sb = await createClient();
  const { data: taken } = await sb.from("profiles").select("id").ilike("username", username.replace(/_/g, "\\_")).maybeSingle();
  if (taken) return { error: "Username sudah dipakai." };

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { username }, emailRedirectTo: `${site()}/auth/callback` },
  });
  if (error) return { error: "Gagal mendaftar: " + error.message };
  return { ok: "Pendaftaran berhasil. Cek email kamu dan klik link konfirmasi sebelum login." };
}

export async function forgotPassword(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Email tidak valid." };
  const sb = await createClient();
  await sb.auth.resetPasswordForEmail(email, { redirectTo: `${site()}/auth/callback?next=/reset-password` });
  // jawaban sama apa pun hasilnya, supaya email terdaftar tidak bisa ditebak
  return { ok: "Kalau email itu terdaftar, link reset password sudah dikirim." };
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const pwErr = checkPassword(password);
  if (pwErr) return { error: pwErr };
  if (password !== confirm) return { error: "Konfirmasi password tidak sama." };

  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: "Sesi reset sudah habis. Minta link reset baru." };
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: "Gagal mengganti password: " + error.message };
  redirect("/profil");
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const display_name = str(fd, "display_name");
  const bio = str(fd, "bio");
  if (display_name.length < 1 || display_name.length > 40) return { error: "Nama tampilan 1-40 karakter." };
  if (bio.length > 300) return { error: "Bio maksimal 300 karakter." };

  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: "Kamu belum login." };
  const { error } = await sb.from("profiles").update({ display_name, bio: bio || null }).eq("id", data.user.id);
  if (error) return { error: "Gagal menyimpan: " + error.message };
  revalidatePath("/profil");
  return { ok: "Profil tersimpan." };
}

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// Login Google: langsung lempar ke halaman akun Google, tanpa isi form.
export async function signInWithGoogle(fd: FormData) {
  const next = safeNext(fd.get("next"));
  const sb = await createClient();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${site()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?e=google");
  redirect(data.url);
}
