"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  submitChapterSticker,
  moderateChapterSticker,
} from "@/app/komik/actions/chapter-comments";

type Submission = {
  id: string;
  image_path: string;
  description: string | null;
  created_at: string;
};

export default function ChapterStickerPanel({
  uid,
  staff,
}: {
  uid: string | null;
  staff: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [queue, setQueue] = useState<Submission[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const loadQueue = useCallback(async () => {
    if (!staff) return;

    const sb = createClient();
    const { data, error } = await sb
      .from("chapter_sticker_submissions")
      .select("id,image_path,description,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      setMessage("Gagal memuat antrean stiker.");
      return;
    }

    const rows = (data ?? []) as Submission[];
    setQueue(rows);

    const entries = await Promise.all(
      rows.map(async (item): Promise<[string, string] | null> => {
        const { data: signed } = await sb.storage
          .from("sticker-submissions")
          .createSignedUrl(item.image_path, 3600);

        return signed?.signedUrl
          ? [item.id, signed.signedUrl]
          : null;
      })
    );

    const nextUrls: Record<string, string> = {};
    entries.forEach((entry) => {
      if (entry) nextUrls[entry[0]] = entry[1];
    });

    setUrls(nextUrls);
  }, [staff]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function submit() {
    if (!uid || !file || pending) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Gunakan gambar JPG, PNG, atau WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setPending(true);
    setMessage("");

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

    const path = `${uid}/${Date.now()}.${ext}`;
    const sb = createClient();

    const { error: uploadError } = await sb.storage
      .from("sticker-submissions")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setPending(false);
      setMessage("Gagal mengunggah stiker. Periksa koneksi atau izin penyimpanan.");
      return;
    }

    const result = await submitChapterSticker(path, description);

    if (result.error) {
      await sb.storage.from("sticker-submissions").remove([path]);
    }

    setPending(false);
    setMessage(result.error ?? result.ok ?? "");

    if (result.ok) {
      setFile(null);
      setDescription("");
    }
  }

  async function review(
    id: string,
    decision: "approved" | "rejected"
  ) {
    if (!staff || pending) return;

    setPending(true);
    setMessage("");

    const result = await moderateChapterSticker(id, decision);

    setPending(false);
    setMessage(result.error ?? result.ok ?? "");

    if (result.ok) await loadQueue();
  }

  return (
    <section className="mb-6 space-y-4 rounded-2xl border border-line bg-card p-4">
      <div>
        <h4 className="font-bold">Koleksi Stiker Komunitas</h4>
        <p className="mt-1 text-xs text-mute">
          Ajukan karya stiker sendiri. Admin akan memeriksanya sebelum
          stiker tersedia untuk semua pengguna.
        </p>
      </div>

      {uid ? (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-mute">
            Pilih gambar stiker
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-xs"
            />
          </label>

          {file && (
            <p className="text-xs text-mute">File: {file.name}</p>
          )}

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            placeholder="Nama stiker (opsional)"
            disabled={pending}
            className="w-full rounded-xl border border-line bg-bg p-3 text-sm"
          />

          <button
            type="button"
            disabled={!file || pending}
            onClick={() => void submit()}
            className="rounded-full bg-brand px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {pending ? "Memproses..." : "Ajukan stiker"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-mute">
          Login untuk mengajukan stiker.
        </p>
      )}

      {message && (
        <p role="status" className="text-xs text-gold">
          {message}
        </p>
      )}

      {staff && (
        <div className="border-t border-line pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h5 className="text-sm font-bold">Antrean Moderasi</h5>
            <button
              type="button"
              onClick={() => void loadQueue()}
              className="text-xs text-brand"
            >
              Muat ulang
            </button>
          </div>

          {queue.length === 0 ? (
            <p className="text-xs text-mute">
              Belum ada pengajuan stiker.
            </p>
          ) : (
            <div className="space-y-4">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-line p-3"
                >
                  {urls[item.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urls[item.id]}
                      alt="Pratinjau stiker"
                      className="h-20 w-20 rounded-lg bg-bg object-contain"
                    />
                  ) : (
                    <div className="grid h-20 w-20 place-items-center rounded-lg bg-bg text-xs text-mute">
                      Gambar
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold">
                      {item.description || "Tanpa deskripsi"}
                    </p>
                    <p className="mt-1 text-xs text-mute">
                      {new Date(item.created_at).toLocaleDateString("id-ID")}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void review(item.id, "approved")}
                        className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                      >
                        Setujui
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void review(item.id, "rejected")}
                        className="rounded-full border border-line px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
