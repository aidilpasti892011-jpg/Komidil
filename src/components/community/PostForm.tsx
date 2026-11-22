"use client";
import { useActionState, useState } from "react";
import { createPost, type R } from "@/app/komunitas/actions";
import { POST_CATS } from "@/lib/community";

const f = "mt-1.5 w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] text-white placeholder:text-mute";

export default function PostForm({ comics, admin, initialCat }: { comics: { id: string; title: string }[]; admin: boolean; initialCat: string }) {
  const [st, action, pending] = useActionState<R, FormData>(createPost, undefined);
  const cats = POST_CATS.filter((c) => c.key !== "pengumuman" || admin);
  const [cat, setCat] = useState(cats.some((c) => c.key === initialCat) ? initialCat : "diskusi");
  const [opts, setOpts] = useState(["", ""]);
  return (
    <form action={action} className="space-y-3.5">
      <label className="block text-[13px] text-[#ccc]">Kategori
        <select name="category" value={cat} onChange={(e) => setCat(e.target.value)} className={f}>
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </label>
      <label className="block text-[13px] text-[#ccc]">Judul
        <input name="title" required minLength={3} maxLength={150} className={f} placeholder="Judul singkat dan jelas" />
      </label>
      <label className="block text-[13px] text-[#ccc]">{cat === "polling" ? "Pertanyaan atau keterangan" : "Isi"}
        <textarea name="body" required maxLength={5000} rows={6} className={f} placeholder="Tulis di sini" />
      </label>
      <label className="block text-[13px] text-[#ccc]">Komik terkait (opsional)
        <select name="comic_id" defaultValue="" className={f}>
          <option value="">Tidak ada</option>
          {comics.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      {cat === "polling" && (
        <fieldset className="rounded-2xl border border-line p-3.5">
          <legend className="px-1.5 text-[13px] text-[#ccc]">Opsi polling (2 sampai 6)</legend>
          {opts.map((o, i) => (
            <input key={i} name="option" value={o} maxLength={80} placeholder={`Opsi ${i + 1}`} className={`${f} mb-2`}
              onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          {opts.length < 6 && <button type="button" onClick={() => setOpts([...opts, ""])} className="text-[13px] text-gold">Tambah opsi</button>}
        </fieldset>
      )}
      {cat !== "spoiler" ? (
        <label className="flex items-center gap-2.5 text-[14px]">
          <input type="checkbox" name="spoiler" className="h-4 w-4 accent-[#D71920]" /> Tandai berisi spoiler
        </label>
      ) : <p className="text-[13px] text-gold">Kategori Spoiler otomatis diberi peringatan spoiler.</p>}
      <p role="alert" className="min-h-[18px] text-[13px] text-[#ff6b70]">{st?.error}</p>
      <button disabled={pending} className="w-full rounded-3xl bg-brand py-3 text-sm font-bold disabled:opacity-60">{pending ? "Memposting..." : "Posting"}</button>
    </form>
  );
}
