"use client";

import { useActionState, useState } from "react";
import { updateProfile, type FormState } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

const input = "mt-1.5 w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] text-white";
const OK = ["image/jpeg", "image/png", "image/webp"];

export default function ProfileEditor(p: { userId: string; displayName: string; bio: string; avatarUrl: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, undefined);
  const [avatar, setAvatar] = useState(p.avatarUrl);
  const [msg, setMsg] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!OK.includes(file.type)) return setMsg("Format harus JPG, PNG, atau WebP.");
    if (file.size > 2 * 1024 * 1024) return setMsg("Ukuran avatar maksimal 2 MB.");
    setMsg("Mengunggah...");
    const sb = createClient();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${p.userId}/avatar-${Date.now()}.${ext}`; // folder = user id (dicek oleh policy Storage)
    const up = await sb.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (up.error) return setMsg("Gagal upload: " + up.error.message);
    const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error } = await sb.from("profiles").update({ avatar_url: url }).eq("id", p.userId);
    if (error) return setMsg("Gagal menyimpan avatar: " + error.message);
    setAvatar(url);
    setMsg("Avatar diperbarui.");
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3.5">
        <div className="grid h-[72px] w-[72px] flex-none place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-gold text-3xl font-black text-black">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            (p.displayName || "?").charAt(0).toUpperCase()
          )}
        </div>
        <label className="cursor-pointer rounded-3xl border border-line bg-card px-4 py-2.5 text-sm font-bold">
          Ganti avatar
          <input type="file" accept={OK.join(",")} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>
      {msg && <p role="status" className="mb-3 text-xs text-gold">{msg}</p>}

      <form action={action}>
        <label className="mb-3 block text-[13px] text-[#ccc]">
          Nama tampilan
          <input name="display_name" defaultValue={p.displayName} maxLength={40} required className={input} />
        </label>
        <label className="mb-3 block text-[13px] text-[#ccc]">
          Bio
          <textarea name="bio" defaultValue={p.bio} maxLength={300} rows={3} className={input} />
        </label>
        <p role="alert" className={`mb-3 min-h-[18px] text-[13px] ${state?.error ? "text-[#ff6b70]" : "text-gold"}`}>
          {state?.error ?? state?.ok}
        </p>
        <button disabled={pending} className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold disabled:opacity-60">
          {pending ? "Menyimpan..." : "Simpan profil"}
        </button>
      </form>
    </div>
  );
}
