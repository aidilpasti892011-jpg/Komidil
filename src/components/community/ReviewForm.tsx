"use client";
import { useActionState } from "react";
import { saveReview, type R } from "@/app/komunitas/actions";

const f = "mt-1.5 w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] text-white placeholder:text-mute";

export default function ReviewForm({ comics, defaultComic }: { comics: { id: string; title: string }[]; defaultComic?: string }) {
  const [st, action, pending] = useActionState<R, FormData>(saveReview, undefined);
  return (
    <form action={action} className="space-y-3.5">
      <label className="block text-[13px] text-[#ccc]">Komik
        <select name="comic_id" required defaultValue={defaultComic ?? ""} className={f}>
          <option value="" disabled>Pilih komik</option>
          {comics.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="text-[13px] text-[#ccc]">Rating</legend>
        <div className="mt-1.5 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} required className="peer sr-only" />
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-card font-bold peer-checked:border-gold peer-checked:bg-gold peer-checked:text-black peer-focus-visible:ring-2 peer-focus-visible:ring-white">{n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-[13px] text-[#ccc]">Review (opsional)
        <textarea name="body" maxLength={3000} rows={5} className={f} placeholder="Ceritakan pendapatmu tanpa membocorkan cerita" />
      </label>
      <label className="flex items-center gap-2.5 text-[14px]"><input type="checkbox" name="spoiler" className="h-4 w-4 accent-[#D71920]" /> Review ini berisi spoiler</label>
      <p className="text-[12px] text-mute">Satu review per komik. Mengirim lagi untuk komik yang sama akan memperbarui review lamamu.</p>
      <p role="alert" className="min-h-[18px] text-[13px] text-[#ff6b70]">{st?.error}</p>
      <button disabled={pending} className="w-full rounded-3xl bg-brand py-3 text-sm font-bold disabled:opacity-60">{pending ? "Menyimpan..." : "Kirim review"}</button>
    </form>
  );
}
