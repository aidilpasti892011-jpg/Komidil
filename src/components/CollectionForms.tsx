"use client";

import { useActionState } from "react";
import ConfirmButton from "./admin/ConfirmButton";
import {
  createCollection,
  deleteCollection,
  removeCollectionItem,
  updateCollection,
  type R,
} from "@/app/koleksi/actions";
import { COLLECTION_DESC_MAX, COLLECTION_NAME_MAX } from "@/lib/collections-shared";

const field = "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-[15px] text-white placeholder:text-mute";

export function CreateCollectionForm() {
  const [st, action, pending] = useActionState<R, FormData>(createCollection, undefined);
  return (
    <form action={action} className="mb-4">
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={COLLECTION_NAME_MAX}
          placeholder="Nama koleksi baru, misal: Favorit"
          aria-label="Nama koleksi baru"
          className={field}
        />
        <button disabled={pending} className="flex-none rounded-3xl bg-brand px-5 text-sm font-bold disabled:opacity-60">
          {pending ? "Membuat..." : "Buat"}
        </button>
      </div>
      {st?.error && <p role="alert" className="mt-1.5 text-xs text-[#ff6b70]">{st.error}</p>}
    </form>
  );
}

export function EditCollectionForm({ id, name, description }: { id: string; name: string; description: string }) {
  const [st, action, pending] = useActionState<R, FormData>(updateCollection, undefined);
  return (
    <details className="my-3 rounded-[14px] border border-line bg-card">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-[13px] font-bold">Ubah koleksi</summary>
      <div className="space-y-3 px-4 pb-4">
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <label className="block text-[13px] text-[#ccc]">Nama
            <input name="name" defaultValue={name} required maxLength={COLLECTION_NAME_MAX} className={`${field} mt-1.5`} />
          </label>
          <label className="block text-[13px] text-[#ccc]">Deskripsi (opsional)
            <textarea name="description" defaultValue={description} maxLength={COLLECTION_DESC_MAX} rows={2} className={`${field} mt-1.5`} />
          </label>
          <button disabled={pending} className="rounded-3xl bg-brand px-5 py-2 text-[13px] font-bold disabled:opacity-60">
            {pending ? "Menyimpan..." : "Simpan"}
          </button>
          {st?.error && <p role="alert" className="text-xs text-[#ff6b70]">{st.error}</p>}
          {st?.ok && <p role="status" className="text-xs text-gold">{st.ok}</p>}
        </form>
        <ConfirmButton
          label="Hapus koleksi"
          ask="Hapus koleksi ini? Komik di dalamnya tidak ikut terhapus dari KOMIDIL."
          danger
          run={() => deleteCollection(id)}
        />
      </div>
    </details>
  );
}

export function RemoveItemButton({ collectionId, comicId, title }: { collectionId: string; comicId: string; title: string }) {
  return (
    <ConfirmButton
      label="Keluarkan"
      ask={`Keluarkan "${title}" dari koleksi ini?`}
      run={() => removeCollectionItem(collectionId, comicId)}
    />
  );
}
