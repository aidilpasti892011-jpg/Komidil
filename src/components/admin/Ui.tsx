import type { ReactNode } from "react";

export const field = "mt-1.5 w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] text-white placeholder:text-mute";
export const btnRed = "rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-60";
export const btnGhost = "rounded-3xl border border-line bg-card px-4 py-2 text-[13px] text-[#ddd] transition active:scale-95 disabled:opacity-50";

export function Label({ t, children }: { t: string; children: ReactNode }) {
  return <label className="block text-[13px] text-[#ccc]">{t}{children}</label>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</section>;
}
export function Msg({ st }: { st?: { error?: string; ok?: string } }) {
  return <p role="alert" className={`min-h-[18px] text-[13px] ${st?.error ? "text-[#ff6b70]" : "text-gold"}`}>{st?.error ?? st?.ok}</p>;
}
