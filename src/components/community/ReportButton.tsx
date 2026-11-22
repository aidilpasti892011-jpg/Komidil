"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { report } from "@/app/komunitas/actions";
import { REPORT_REASONS, type ReportTarget } from "@/lib/community";

export default function ReportButton({ type, id, loggedIn, next }: { type: ReportTarget; id: string; loggedIn: boolean; next: string }) {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [m, setM] = useState<{ t: string; bad: boolean } | null>(null);
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const res = await report(type, id, reason, detail);
      setM({ t: res?.error ?? res?.ok ?? "", bad: Boolean(res?.error) });
      if (res?.ok) setOpen(false);
    });
  return (
    <span className="relative">
      <button type="button" className="px-2.5 py-1 text-[13px] text-mute" onClick={() => (loggedIn ? setOpen(!open) : r.push(`/login?next=${encodeURIComponent(next)}`))}>
        Laporkan
      </button>
      {m && <small className={`ml-1 text-[11px] ${m.bad ? "text-[#ff6b70]" : "text-gold"}`}>{m.t}</small>}
      {open && (
        <div className="mt-2 w-[min(320px,86vw)] rounded-2xl border border-line bg-card p-3 text-[13px]">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="mb-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5">
            {REPORT_REASONS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={1000} rows={2} placeholder="Keterangan tambahan (opsional)"
            className="mb-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5" />
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={send} className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold disabled:opacity-60">Kirim laporan</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-xs text-mute">Batal</button>
          </div>
        </div>
      )}
    </span>
  );
}
