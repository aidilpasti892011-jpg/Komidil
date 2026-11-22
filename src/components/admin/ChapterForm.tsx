"use client";
import { useActionState, useState } from "react";
import { saveChapter, type R } from "@/app/admin/actions";
import { btnRed, field, Label, Msg } from "./Ui";

type Ch = { id: string; comic_id: string; number: number | null; title: string | null; is_published: boolean; published_at: string | null };

const toLocal = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function ChapterForm({ ch, isNew }: { ch: Ch; isNew: boolean }) {
  const [st, action, pending] = useActionState<R, FormData>(saveChapter, undefined);
  const future = ch.published_at && new Date(ch.published_at).getTime() > Date.now();
  const [mode, setMode] = useState<string>(isNew ? "now" : future ? "schedule" : "keep");
  const [local, setLocal] = useState(ch.published_at ? toLocal(ch.published_at) : "");
  const iso = local ? new Date(local).toISOString() : "";

  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="id" value={ch.id} />
      <input type="hidden" name="comic_id" value={ch.comic_id} />
      <input type="hidden" name="is_new" value={isNew ? "1" : "0"} />
      <input type="hidden" name="published_at_iso" value={iso} />
      <div className="grid grid-cols-3 gap-3">
        <Label t="Nomor"><input name="number" required inputMode="decimal" defaultValue={ch.number ?? ""} placeholder="1" className={field} /></Label>
        <div className="col-span-2"><Label t="Judul (opsional)"><input name="title" maxLength={150} defaultValue={ch.title ?? ""} className={field} /></Label></div>
      </div>
      <fieldset className="rounded-2xl border border-line p-3.5 text-[14px]">
        <legend className="px-1.5 text-[13px] text-[#ccc]">Waktu terbit</legend>
        {!isNew && <label className="mb-2 flex items-center gap-2"><input type="radio" name="mode" value="keep" checked={mode === "keep"} onChange={() => setMode("keep")} className="accent-[#D71920]" /> Biarkan seperti sekarang</label>}
        <label className="mb-2 flex items-center gap-2"><input type="radio" name="mode" value="now" checked={mode === "now"} onChange={() => setMode("now")} className="accent-[#D71920]" /> Terbit sekarang</label>
        <label className="flex items-center gap-2"><input type="radio" name="mode" value="schedule" checked={mode === "schedule"} onChange={() => setMode("schedule")} className="accent-[#D71920]" /> Jadwalkan</label>
        {mode === "schedule" && (
          <>
            <input type="datetime-local" required value={local} onChange={(e) => setLocal(e.target.value)} className={field} />
            <p className="mt-1.5 text-[12px] text-mute">Waktu mengikuti zona perangkatmu. Jumlah chapter dan "update terbaru" di komik diperbarui oleh pg_cron tiap 5 menit.</p>
          </>
        )}
      </fieldset>
      <label className="flex items-center gap-2.5 text-[14px]"><input type="checkbox" name="is_published" defaultChecked={ch.is_published} className="h-4 w-4 accent-[#D71920]" /> Aktif (kalau dimatikan, chapter disembunyikan walau sudah waktunya)</label>
      <Msg st={st} />
      <button disabled={pending} className={btnRed}>{pending ? "Menyimpan..." : isNew ? "Buat chapter" : "Simpan"}</button>
    </form>
  );
}
