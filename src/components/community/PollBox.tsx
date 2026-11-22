"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { votePoll } from "@/app/komunitas/actions";

export default function PollBox(p: { postId: string; options: { id: string; label: string; votes: number }[]; myVote: string | null; loggedIn: boolean; closed: boolean; next: string }) {
  const r = useRouter();
  const [sel, setSel] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const total = p.options.reduce((a, o) => a + o.votes, 0);
  const canVote = p.loggedIn && !p.myVote && !p.closed;
  const send = () =>
    start(async () => {
      const res = await votePoll(p.postId, sel);
      if (res?.error) setErr(res.error);
      else r.refresh();
    });
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <ul className="space-y-2.5">
        {p.options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          return (
            <li key={o.id}>
              <label className={`relative block overflow-hidden rounded-xl border px-3.5 py-3 text-[14px] ${p.myVote === o.id ? "border-gold" : "border-line"} ${canVote ? "cursor-pointer" : ""}`}>
                <span className="absolute inset-y-0 left-0 bg-brand/25" style={{ width: `${pct}%` }} aria-hidden="true" />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    {canVote && <input type="radio" name="opt" value={o.id} checked={sel === o.id} onChange={() => setSel(o.id)} className="accent-[#D71920]" />}
                    {o.label}
                  </span>
                  <span className="text-mute">{pct}% ({o.votes})</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-mute">
        <span>{total} suara</span>
        {canVote && <button disabled={!sel || pending} onClick={send} className="rounded-full bg-brand px-5 py-2 font-bold text-white disabled:opacity-50">{pending ? "Mengirim..." : "Pilih"}</button>}
        {!p.loggedIn && <button type="button" onClick={() => r.push(`/login?next=${encodeURIComponent(p.next)}`)} className="text-gold">Login untuk memilih</button>}
        {p.myVote && <span className="text-gold">Kamu sudah memilih.</span>}
        {p.closed && <span>Polling ditutup.</span>}
        {err && <span className="text-[#ff6b70]">{err}</span>}
      </div>
    </div>
  );
}
