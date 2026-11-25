"use client";

import { useActionState } from "react";
import { saveReview, type R } from "@/app/komunitas/actions";

export default function DetailReviewForm({ comicId }: { comicId: string }) {
  const [st, action, pending] = useActionState<R, FormData>(saveReview, undefined);

  return (
    <form action={action} className="mt-3 space-y-3 rounded-2xl border border-line bg-card p-4">
      <input type="hidden" name="comic_id" value={comicId} />
      <input type="hidden" name="return_to" value="detail" />      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Berikan rating</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input className="peer sr-only" type="radio" name="rating" value={n} required />
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-card font-bold peer-checked:border-gold peer-checked:bg-gold peer-checked:text-black">
                {n}★
              </span>
            </label>
          ))}
        </div>
      </fieldset>      <label className="block text-sm">
        Review (opsional)
        <textarea name="body" maxLength={3000} rows={3}
          placeholder="Bagaimana menurutmu komik ini?"
          className="mt-2 w-full rounded-xl border border-line bg-[#171717] px-3 py-2 text-sm" />
      </label>

      <label className="flex items-center gap-2 text-xs text-mute">
        <input type="checkbox" name="spoiler" /> Review mengandung spoiler
      </label>      {st?.error && <p role="alert" className="text-sm text-red-400">{st.error}</p>}

      <button disabled={pending}
        className="w-full rounded-xl bg-brand py-3 text-sm font-bold disabled:opacity-60">
        {pending ? "Menyimpan..." : "Kirim rating"}
      </button>
    </form>
  );
}
