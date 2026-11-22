"use client";
import { useState, useTransition } from "react";
import { refreshRankings } from "@/app/admin/actions";
import { btnGhost } from "./Ui";

export default function RefreshRankings() {
  const [pending, start] = useTransition();
  const [m, setM] = useState<{ error?: string; ok?: string }>({});
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={btnGhost}
        onClick={() => start(async () => setM((await refreshRankings()) ?? {}))}
      >
        {pending ? "Memproses..." : "Refresh ranking sekarang"}
      </button>
      <span role="status" className={`text-[12px] ${m.error ? "text-[#ff6b70]" : "text-gold"}`}>{m.error ?? m.ok}</span>
    </div>
  );
}
