"use client";
import { useActionState, useState } from "react";
import { saveComic, type R } from "@/app/admin/actions";
import { btnRed, field, Label, Msg } from "./Ui";
import { createClient } from "@/lib/supabase/client";
import { IMG_TYPES } from "@/lib/shared";

type Comic = {
  id: string; title: string; slug?: string; alt_titles: string[]; synopsis: string | null; author: string | null; artist: string | null;
  type: string; status: string; cover_hue: number; cover_url: string | null; is_published: boolean; rights_confirmed: boolean; rights_note: string | null;
};

export default function ComicForm({ comic, isNew, genres, selected }: { comic: Comic; isNew: boolean; genres: { id: number; name: string }[]; selected: number[] }) {
  const [st, action, pending] = useActionState<R, FormData>(saveComic, undefined);
  const [coverPath, setCoverPath] = useState("");
  const [cover, setCover] = useState(comic.cover_url);
  const [up, setUp] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!IMG_TYPES.includes(file.type)) return setUp("Cover harus JPG, PNG, atau WebP.");
    if (file.size > 5 * 1024 * 1024) return setUp("Cover maksimal 5 MB.");
    setUp("Mengunggah...");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${comic.id}/cover-${Date.now()}.${ext}`;
    const sb = createClient();
    const { error } = await sb.storage.from("covers").upload(path, file, { contentType: file.type });
    if (error) return setUp("Gagal upload: " + error.message);
    setCoverPath(path);
    setCover(URL.createObjectURL(file));
    setUp("Cover siap. Tekan Simpan untuk menerapkan.");
  };

  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="id" value={comic.id} />
      <input type="hidden" name="is_new" value={isNew ? "1" : "0"} />
      <input type="hidden" name="cover_path" value={coverPath} />
      <Label t="Judul"><input name="title" required maxLength={200} defaultValue={comic.title} className={field} /></Label>
      {isNew && <Label t="Slug (opsional, otomatis dari judul)"><input name="slug" maxLength={80} placeholder="contoh-judul-komik" className={field} /></Label>}
      <Label t="Judul alternatif (pisah dengan koma atau baris baru)"><textarea name="alt_titles" rows={2} defaultValue={comic.alt_titles.join(", ")} className={field} /></Label>
      <div className="grid grid-cols-2 gap-3">
        <Label t="Author"><input name="author" maxLength={120} defaultValue={comic.author ?? ""} className={field} /></Label>
        <Label t="Artist"><input name="artist" maxLength={120} defaultValue={comic.artist ?? ""} className={field} /></Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Label t="Tipe">
          <select name="type" defaultValue={comic.type} className={field}>
            {["manhwa", "manhua", "manga", "webtoon"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </select>
        </Label>
        <Label t="Status">
          <select name="status" defaultValue={comic.status} className={field}>
            <option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="hiatus">Hiatus</option>
          </select>
        </Label>
      </div>
      <Label t="Sinopsis"><textarea name="synopsis" rows={5} maxLength={4000} defaultValue={comic.synopsis ?? ""} className={field} /></Label>

      <fieldset className="rounded-2xl border border-line p-3.5">
        <legend className="px-1.5 text-[13px] text-[#ccc]">Genre</legend>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <label key={g.id} className="cursor-pointer">
              <input type="checkbox" name="genre" value={g.id} defaultChecked={selected.includes(g.id)} className="peer sr-only" />
              <span className="inline-block rounded-full border border-line bg-bg px-3.5 py-1.5 text-[13px] peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-white">{g.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-2xl border border-line p-3.5">
        <p className="mb-2 text-[13px] text-[#ccc]">Cover (JPG, PNG, WebP, maks 5 MB)</p>
        <div className="flex items-center gap-3">
          <div className="grid h-[96px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl text-2xl font-bold"
            style={{ background: `linear-gradient(160deg,hsl(${comic.cover_hue},70%,42%),hsl(${(comic.cover_hue + 50) % 360},60%,14%))` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {cover ? <img src={cover} alt="Cover" className="h-full w-full object-cover" /> : <span className="opacity-50">{comic.title.charAt(0) || "K"}</span>}
          </div>
          <div className="min-w-0 flex-1 text-[13px]">
            <input type="file" accept={IMG_TYPES.join(",")} onChange={(e) => upload(e.target.files?.[0])} className="w-full text-[13px] text-mute file:mr-3 file:rounded-full file:border-0 file:bg-line file:px-4 file:py-2 file:text-white" />
            <p className="mt-1.5 text-gold">{up}</p>
          </div>
        </div>
        <Label t="Hue placeholder (0-360, dipakai kalau belum ada cover)">
          <input name="cover_hue" type="number" min={0} max={360} defaultValue={comic.cover_hue} className={field} />
        </Label>
      </div>

      <div className="rounded-2xl border border-gold/40 bg-[#2a2209] p-3.5 text-[13px]">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="rights_confirmed" defaultChecked={comic.rights_confirmed} className="mt-0.5 h-4 w-4 accent-[#D71920]" />
          <span>Saya menyatakan komik ini milik saya sendiri atau saya punya lisensi/izin untuk mempublikasikannya di KOMIDIL.</span>
        </label>
        <Label t="Catatan hak/lisensi (opsional)"><input name="rights_note" maxLength={500} defaultValue={comic.rights_note ?? ""} className={field} placeholder="Contoh: karya orisinal, izin dari kreator" /></Label>
      </div>

      <label className="flex items-center gap-2.5 text-[14px]">
        <input type="checkbox" name="is_published" defaultChecked={comic.is_published} className="h-4 w-4 accent-[#D71920]" /> Terbitkan (tampil publik)
      </label>
      <Msg st={st} />
      <button disabled={pending} className={btnRed}>{pending ? "Menyimpan..." : isNew ? "Buat komik" : "Simpan perubahan"}</button>
    </form>
  );
}
