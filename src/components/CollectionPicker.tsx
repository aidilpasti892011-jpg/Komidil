"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconBookmark } from "./Icons";
import { createClient } from "@/lib/supabase/client";
import { COLLECTION_NAME_MAX, cleanName } from "@/lib/collections-shared";

type Col = { id: string; name: string; item_count: number };

// Tombol "Koleksi" di halaman komik + sheet untuk memasukkan/mengeluarkan komik dari koleksi.
// Semua lewat Supabase + RLS (hanya koleksi milik sendiri); batas jumlah dijaga trigger database.
export default function CollectionPicker({ comicId, className }: { comicId: string; className: string }) {
  const sb = createClient();
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [cols, setCols] = useState<Col[]>([]);
  const [member, setMember] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const closeBtn = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await sb.auth.getUser();
    const id = u.user?.id ?? null;
    setUid(id);
    if (!id) {
      setLoading(false);
      return;
    }
    const [c, m] = await Promise.all([
      sb.from("collections").select("id,name,item_count").eq("user_id", id).order("updated_at", { ascending: false }).limit(20),
      sb.from("collection_items").select("collection_id").eq("comic_id", comicId),
    ]);
    if (c.error) setMsg("Gagal memuat koleksi: " + c.error.message);
    setCols(((c.data ?? []) as Col[]).map((x) => ({ ...x, item_count: Number(x.item_count) })));
    setMember(new Set((m.data ?? []).map((r) => r.collection_id as string)));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comicId]);

  useEffect(() => {
    if (!open) return;
    setMsg("");
    load();
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, load]);

  const fail = (e: { message: string; code?: string }) =>
    e.code === "23505" ? "Sudah ada." : /Maksimal/i.test(e.message) ? e.message : "Gagal menyimpan: " + e.message;

  const toggle = async (c: Col) => {
    setBusy(c.id);
    setMsg("");
    const has = member.has(c.id);
    const { error } = has
      ? await sb.from("collection_items").delete().eq("collection_id", c.id).eq("comic_id", comicId)
      : await sb.from("collection_items").insert({ collection_id: c.id, comic_id: comicId });
    setBusy(null);
    if (error) return setMsg(fail(error));
    setMember((s) => {
      const n = new Set(s);
      if (has) n.delete(c.id);
      else n.add(c.id);
      return n;
    });
    setCols((l) => l.map((x) => (x.id === c.id ? { ...x, item_count: x.item_count + (has ? -1 : 1) } : x)));
  };

  const create = async () => {
    const n = cleanName(name);
    if (!n || !uid) return;
    setBusy("new");
    setMsg("");
    const { data, error } = await sb.from("collections").insert({ user_id: uid, name: n }).select("id,name,item_count").single();
    if (error || !data) {
      setBusy(null);
      return setMsg(error ? (error.code === "23505" ? "Kamu sudah punya koleksi dengan nama itu." : fail(error)) : "Gagal membuat koleksi.");
    }
    const col = { ...(data as Col), item_count: 0 };
    const { error: e2 } = await sb.from("collection_items").insert({ collection_id: col.id, comic_id: comicId });
    setBusy(null);
    setName("");
    setCols((l) => [{ ...col, item_count: e2 ? 0 : 1 }, ...l]);
    if (e2) setMsg(fail(e2));
    else setMember((s) => new Set(s).add(col.id));
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={className}>
        <IconBookmark width={18} height={18} /> Koleksi
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" role="presentation">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Simpan ke koleksi"
            className="relative max-h-[80dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[22px] border border-b-0 border-line bg-card px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Simpan ke koleksi</h2>
              <button ref={closeBtn} type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-4 py-1.5 text-[13px] font-bold">
                Selesai
              </button>
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-mute">Memuat...</p>
            ) : !uid ? (
              <p className="py-4 text-center text-sm text-mute">
                <Link href="/login" className="font-bold text-gold">Login</Link> dulu untuk memakai koleksi.
              </p>
            ) : (
              <>
                {cols.length > 0 && (
                  <ul className="mb-3 space-y-1.5">
                    {cols.map((c) => {
                      const on = member.has(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            disabled={busy !== null}
                            onClick={() => toggle(c)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition disabled:opacity-60 ${on ? "border-gold bg-gold/10" : "border-line bg-bg"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{c.name}</span>
                              <span className="text-xs text-mute">{c.item_count} komik</span>
                            </span>
                            <span aria-hidden="true" className={`grid h-5 w-5 flex-none place-items-center rounded-full border text-[12px] font-bold ${on ? "border-gold bg-gold text-black" : "border-line"}`}>
                              {on && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && create()}
                    maxLength={COLLECTION_NAME_MAX}
                    placeholder={cols.length === 0 ? "Buat koleksi pertama, misal: Favorit" : "Koleksi baru"}
                    aria-label="Nama koleksi baru"
                    className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[15px] text-white placeholder:text-mute"
                  />
                  <button type="button" onClick={create} disabled={busy !== null || !cleanName(name)} className="flex-none rounded-3xl bg-brand px-4 text-sm font-bold disabled:opacity-50">
                    Buat
                  </button>
                </div>
                {msg && <p role="alert" className="mt-2 text-xs text-[#ff6b70]">{msg}</p>}
                <Link href="/koleksi" className="mt-3 inline-block text-[13px] text-gold">Kelola semua koleksi</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
