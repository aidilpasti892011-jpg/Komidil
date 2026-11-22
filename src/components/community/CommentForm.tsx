"use client";
import { useActionState, useEffect, useRef } from "react";
import { createComment, type R } from "@/app/komunitas/actions";

export default function CommentForm({ postId, parentId, loggedIn, compact, onDone }: { postId: string; parentId?: string; loggedIn: boolean; compact?: boolean; onDone?: () => void }) {
  const [st, action, pending] = useActionState<R, FormData>(createComment, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (st?.ok) { ref.current?.reset(); onDone?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);
  if (!loggedIn) return <p className="text-[13px] text-mute">Login dulu untuk ikut berkomentar.</p>;
  return (
    <form ref={ref} action={action} className="mt-2">
      <input type="hidden" name="post_id" value={postId} />
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <textarea name="body" required maxLength={2000} rows={compact ? 2 : 3} placeholder={parentId ? "Tulis balasan" : "Tulis komentar"}
        className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[14px] text-white placeholder:text-mute" />
      <div className="mt-1.5 flex items-center gap-3">
        <button disabled={pending} className="rounded-full bg-brand px-5 py-2 text-[13px] font-bold disabled:opacity-60">{pending ? "Mengirim..." : "Kirim"}</button>
        {st?.error && <span role="alert" className="text-[12px] text-[#ff6b70]">{st.error}</span>}
      </div>
    </form>
  );
}
