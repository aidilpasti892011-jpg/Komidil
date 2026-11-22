"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword, login, register, resetPassword, signInWithGoogle, type FormState } from "@/app/auth/actions";
import { IconGoogle } from "@/components/Icons";

type Mode = "login" | "register" | "forgot" | "reset";

const CFG = {
  login: { title: "Masuk", sub: "Login ke akun KOMIDIL kamu.", btn: "Masuk", action: login },
  register: { title: "Daftar", sub: "Buat akun untuk bookmark dan riwayat baca.", btn: "Buat akun", action: register },
  forgot: { title: "Lupa password", sub: "Masukkan email, kami kirim link untuk membuat password baru.", btn: "Kirim link reset", action: forgotPassword },
  reset: { title: "Password baru", sub: "Buat password baru untuk akun kamu.", btn: "Simpan password", action: resetPassword },
} as const;

const input =
  "mt-1.5 w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] text-white placeholder:text-mute";

function Field(p: { name: string; label: string; type?: string; ph?: string; ac?: string; max?: number }) {
  return (
    <label className="mb-3 block text-[13px] text-[#ccc]">
      {p.label}
      <input name={p.name} type={p.type ?? "text"} placeholder={p.ph} autoComplete={p.ac} maxLength={p.max ?? 120} required className={input} />
    </label>
  );
}

export default function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const c = CFG[mode];
  const [state, formAction, pending] = useActionState<FormState, FormData>(c.action, undefined);

  return (
    <div className="mx-auto my-5 max-w-[420px]">
      <h1 className="text-[26px] font-bold">{c.title}</h1>
      <p className="mb-4 mt-1.5 text-mute">{c.sub}</p>

      {(mode === "login" || mode === "register") && (
        <>
          <form action={signInWithGoogle}>
            {next && <input type="hidden" name="next" value={next} />}
            <button className="flex w-full items-center justify-center gap-3 rounded-3xl bg-white py-3.5 text-sm font-bold text-[#1f1f1f] transition active:scale-95">
              <IconGoogle />
              Lanjut dengan Google
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-[12px] text-mute">
            <span className="h-px flex-1 bg-line" />atau pakai email<span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form action={formAction} noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        {mode !== "reset" && <Field name="email" label="Email" type="email" ph="nama@email.com" ac="email" />}
        {mode === "register" && <Field name="username" label="Username" ph="3-20 karakter, huruf/angka/_" ac="username" max={20} />}
        {mode !== "forgot" && (
          <Field name="password" label="Password" type="password" ph={mode === "login" ? "Password" : "Minimal 8 karakter, ada huruf dan angka"} ac={mode === "login" ? "current-password" : "new-password"} max={72} />
        )}
        {(mode === "register" || mode === "reset") && (
          <Field name="confirm" label="Ulangi password" type="password" ph="Ketik ulang password" ac="new-password" max={72} />
        )}

        <p role="alert" className={`mb-3 min-h-[18px] text-[13px] ${state?.error ? "text-[#ff6b70]" : "text-gold"}`}>
          {state?.error ?? state?.ok}
        </p>
        <button disabled={pending} className="w-full rounded-3xl bg-brand py-3 text-sm font-bold transition active:scale-95 disabled:opacity-60">
          {pending ? "Memproses..." : c.btn}
        </button>
      </form>

      <p className="mt-4 text-center text-[13px] text-mute">
        {mode === "login" && (<>Belum punya akun? <Link className="text-gold" href="/register">Daftar</Link> · <Link className="text-gold" href="/lupa-password">Lupa password?</Link></>)}
        {mode === "register" && (<>Sudah punya akun? <Link className="text-gold" href="/login">Masuk</Link></>)}
        {(mode === "forgot" || mode === "reset") && <Link className="text-gold" href="/login">Kembali ke login</Link>}
      </p>
    </div>
  );
}
