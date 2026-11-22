"use client";
import { useState, type ReactNode } from "react";

export default function SpoilerBox({ spoiler, children }: { spoiler: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!spoiler);
  if (open) return <>{children}</>;
  return (
    <div className="rounded-xl border border-gold/40 bg-[#2a2209] p-3.5 text-[13px]">
      <p className="font-bold text-gold">Peringatan spoiler</p>
      <p className="mb-2 mt-0.5 text-[#d9c27a]">Isi bagian ini membocorkan cerita.</p>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-black">
        Tampilkan
      </button>
    </div>
  );
}
