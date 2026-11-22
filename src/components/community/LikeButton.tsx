"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleLike } from "@/app/komunitas/actions";

export default function LikeButton(p: { type: "post" | "comment" | "review"; id: string; liked: boolean; count: number; loggedIn: boolean; next: string }) {
  const r = useRouter();
  const [s, setS] = useState({ liked: p.liked, count: p.count });
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const click = () => {
    if (!p.loggedIn) return r.push(`/login?next=${encodeURIComponent(p.next)}`);
    start(async () => {
      const res = await toggleLike(p.type, p.id);
      if (res?.error) return setErr(res.error);
      setErr("");
      setS((o) => ({ liked: !!res?.liked, count: Math.max(0, o.count + (res?.liked ? 1 : -1)) }));
    });
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={click} disabled={pending} aria-pressed={s.liked}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition active:scale-95 ${s.liked ? "text-brand" : "text-mute"}`}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill={s.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />
        </svg>
        {s.count}
      </button>
      {err && <small className="px-2 text-[11px] text-[#ff6b70]">{err}</small>}
    </span>
  );
}
