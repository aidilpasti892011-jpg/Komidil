"use client";
import { useState, useTransition } from "react";
import { btnGhost } from "./Ui";

/** Tombol aksi berbahaya: konfirmasi dulu, tampilkan hasil/error dari server action. */
export default function ConfirmButton({ label, ask, run, danger }: { label: string; ask: string; run: () => Promise<{ error?: string; ok?: string } | undefined | void>; danger?: boolean }) {
  const [pending, start] = useTransition();
  const [m, setM] = useState("");
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={pending} className={`${btnGhost} ${danger ? "text-[#ff6b70]" : ""}`}
        onClick={() => confirm(ask) && start(async () => { const r = await run(); setM(r?.error ?? ""); })}>
        {pending ? "Memproses..." : label}
      </button>
      {m && <small className="mt-1 text-[11px] text-[#ff6b70]">{m}</small>}
    </span>
  );
}
