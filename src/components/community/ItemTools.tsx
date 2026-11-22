"use client";
import { useState, useTransition } from "react";
import { moderate, removeItem } from "@/app/komunitas/actions";

type Op = "hide" | "show" | "pin" | "unpin" | "lock" | "unlock";
const btn = "rounded-full border border-line px-3 py-1 text-[12px] text-mute active:scale-95 disabled:opacity-50";

/** Hapus milik sendiri + tombol moderasi untuk staff. */
export default function ItemTools(p: {
  type: "post" | "comment" | "review"; id: string; canDelete: boolean; admin: boolean; hidden?: boolean; pinned?: boolean; locked?: boolean; back: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const run = (f: () => Promise<{ error?: string } | undefined>) => start(async () => setErr((await f())?.error ?? ""));
  const mod = (op: Op) => run(() => moderate(p.type, p.id, op));
  if (!p.canDelete && !p.admin) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {p.admin && (
        <>
          <button className={btn} disabled={pending} onClick={() => mod(p.hidden ? "show" : "hide")}>{p.hidden ? "Tampilkan" : "Sembunyikan"}</button>
          {p.type === "post" && <button className={btn} disabled={pending} onClick={() => mod(p.pinned ? "unpin" : "pin")}>{p.pinned ? "Lepas pin" : "Pin"}</button>}
          {p.type === "post" && <button className={btn} disabled={pending} onClick={() => mod(p.locked ? "unlock" : "lock")}>{p.locked ? "Buka kunci" : "Kunci"}</button>}
        </>
      )}
      {p.canDelete && (
        <button className={`${btn} text-[#ff6b70]`} disabled={pending}
          onClick={() => confirm("Hapus permanen?") && run(() => removeItem(p.type, p.id, p.back))}>Hapus</button>
      )}
      {err && <small className="text-[11px] text-[#ff6b70]">{err}</small>}
    </div>
  );
}
