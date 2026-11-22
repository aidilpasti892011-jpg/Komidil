"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addChapterImages, deleteImage, reorderImages } from "@/app/admin/actions";
import { btnGhost, btnRed } from "./Ui";
import { IMG_TYPES } from "@/lib/shared";
import { createClient } from "@/lib/supabase/client";

type Img = { id: string; page_number: number; image_path: string; url: string };
const MAX = 10 * 1024 * 1024;

async function dims(f: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const b = await createImageBitmap(f);
    const r = { width: b.width, height: b.height };
    b.close();
    return r;
  } catch {
    return { width: null, height: null };
  }
}

export default function ChapterImages({ chapterId, comicId, images }: { chapterId: string; comicId: string; images: Img[] }) {
  const r = useRouter();
  const [list, setList] = useState(images);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const [pending, start] = useTransition();

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    setList(n);
    setDirty(true);
  };
  const saveOrder = () => start(async () => {
    const res = await reorderImages(chapterId, list.map((x) => x.id));
    setMsg(res?.error ?? res?.ok ?? "");
    if (res?.ok) { setDirty(false); r.refresh(); }
  });
  const remove = (id: string) => confirm("Hapus gambar ini?") && start(async () => {
    const res = await deleteImage(id);
    setMsg(res?.error ?? res?.ok ?? "");
    if (res?.ok) { setList((l) => l.filter((x) => x.id !== id)); r.refresh(); }
  });

  const onFiles = async (fl: FileList | null) => {
    if (!fl?.length) return;
    // urut alami berdasarkan nama file (1, 2, 10 bukan 1, 10, 2)
    const files = [...fl].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const bad = files.find((f) => !IMG_TYPES.includes(f.type) || f.size > MAX);
    if (bad) return setMsg(`"${bad.name}" ditolak: harus JPG/PNG/WebP dan maksimal 10 MB.`);
    if (files.length > 100) return setMsg("Maksimal 100 gambar per unggahan.");
    setMsg("");
    setProg({ done: 0, total: files.length });
    const sb = createClient();
    const ok: { path: string; width: number | null; height: number | null }[] = new Array(files.length);
    let next = 0, done = 0, failed = "";
    const worker = async () => {
      while (next < files.length && !failed) {
        const i = next++;
        const f = files[i];
        const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
        const path = `${comicId}/${chapterId}/${Date.now()}-${String(i + 1).padStart(3, "0")}.${ext}`;
        const { error } = await sb.storage.from("chapters").upload(path, f, { contentType: f.type });
        if (error) { failed = `Gagal upload "${f.name}": ${error.message}`; return; }
        ok[i] = { path, ...(await dims(f)) };
        setProg({ done: ++done, total: files.length });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const uploaded = ok.filter(Boolean);
    if (uploaded.length) {
      const res = await addChapterImages(chapterId, uploaded);
      if (res?.error) failed = failed || res.error;
    }
    setProg(null);
    setMsg(failed ? `${failed} (${uploaded.length} gambar sempat terunggah, cek daftar.)` : `${uploaded.length} gambar ditambahkan.`);
    r.refresh();
  };

  // sinkronkan saat server mengirim data baru
  const key = images.map((i) => i.id).join(",");
  const [seen, setSeen] = useState(key);
  if (seen !== key && !dirty) { setSeen(key); setList(images); }

  return (
    <div>
      <label className="block rounded-2xl border border-dashed border-line bg-card p-5 text-center text-[14px]">
        <span className="font-bold">Pilih banyak gambar sekaligus</span>
        <span className="mt-1 block text-[12px] text-mute">JPG, PNG, WebP, maks 10 MB per file. Diurutkan otomatis dari nama file.</span>
        <input type="file" multiple accept={IMG_TYPES.join(",")} disabled={!!prog} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} className="mt-3 w-full text-[13px] text-mute file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-white" />
      </label>
      {prog && (
        <div className="mt-3" role="status">
          <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand transition-all" style={{ width: `${(prog.done / prog.total) * 100}%` }} /></div>
          <p className="mt-1 text-[12px] text-mute">Mengunggah {prog.done} dari {prog.total}</p>
        </div>
      )}
      <p role="alert" className="mt-2 min-h-[18px] text-[13px] text-gold">{msg}</p>

      <div className="mb-2 mt-3 flex items-center justify-between">
        <b className="text-[15px]">{list.length} halaman</b>
        {dirty && <button className={btnRed} disabled={pending} onClick={saveOrder}>Simpan urutan</button>}
      </div>
      <ul className="space-y-2">
        {list.map((im, i) => (
          <li key={im.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={`Halaman ${i + 1}`} loading="lazy" className="h-16 w-12 shrink-0 rounded-lg bg-line object-cover" />
            <span className="w-8 text-center text-[13px] text-mute">{i + 1}</span>
            <div className="ml-auto flex gap-1.5">
              <button className={btnGhost} disabled={i === 0 || pending} onClick={() => move(i, -1)} aria-label="Naik">Naik</button>
              <button className={btnGhost} disabled={i === list.length - 1 || pending} onClick={() => move(i, 1)} aria-label="Turun">Turun</button>
              <button className={`${btnGhost} text-[#ff6b70]`} disabled={pending || dirty} onClick={() => remove(im.id)}>Hapus</button>
            </div>
          </li>
        ))}
      </ul>
      {dirty && <p className="mt-2 text-[12px] text-mute">Simpan urutan dulu sebelum menghapus gambar.</p>}
    </div>
  );
}
