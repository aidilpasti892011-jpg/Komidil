"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "./Icons";
import { createClient } from "@/lib/supabase/client";
import type { ChapterRow } from "@/lib/comics";
import { timeAgo } from "@/lib/utils";

const STEP = 30;

export default function ChapterList({ comicId, slug, chapters }: { comicId: string; slug: string; chapters: ChapterRow[] }) {
  const [q, setQ] = useState("");
  const [asc, setAsc] = useState(false);
  const [n, setN] = useState(STEP);
  const [lastId, setLastId] = useState<string | null>(null);

  // "terakhir dibaca": dari tabel reading_history (hanya kalau sudah login; ditulis oleh Reader)
  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: h } = await sb.from("reading_history").select("chapter_id").eq("user_id", data.user.id).eq("comic_id", comicId).maybeSingle();
      setLastId((h?.chapter_id as string) ?? null);
    });
  }, [comicId]);

  const list = useMemo(() => {
    const f = q ? chapters.filter((c) => String(c.number).includes(q)) : chapters;
    return asc ? [...f].reverse() : f;
  }, [chapters, q, asc]);

  if (chapters.length === 0) return <p className="py-6 text-center text-mute">Belum ada chapter.</p>;

  return (
    <div>
      <div className="mb-2.5 flex gap-2">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
          <input
            inputMode="numeric"
            maxLength={6}
            value={q}
            onChange={(e) => {
              setQ(e.target.value.replace(/[^0-9.]/g, ""));
              setN(STEP);
            }}
            aria-label="Cari nomor chapter"
            placeholder="Cari nomor chapter..."
            className="w-full rounded-xl border border-line bg-card py-2.5 pl-11 pr-3.5 text-[15px] text-white placeholder:text-mute"
          />
        </div>
        <button onClick={() => setAsc(!asc)} className="rounded-3xl border border-line bg-card px-4 text-sm font-bold">
          {asc ? "Terlama" : "Terbaru"}
        </button>
      </div>

      {list.slice(0, n).map((c) => (
        <Link
          key={c.id}
          href={`/komik/${slug}/${c.number}`}
          className={`mb-1.5 flex items-center justify-between rounded-xl border bg-card px-3.5 py-3 text-sm ${
            c.id === lastId ? "border-gold" : "border-transparent"
          }`}
        >
          <span>Chapter {c.number}</span>
          <small className="text-xs text-mute">
            {c.id === lastId ? <b className="text-gold">Terakhir dibaca</b> : timeAgo(c.published_at)}
          </small>
        </Link>
      ))}
      {list.length === 0 && <p className="py-6 text-center text-mute">Chapter tidak ditemukan.</p>}
      {list.length > n && (
        <div className="my-3.5 text-center">
          <button onClick={() => setN(n + STEP)} className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold">
            Tampilkan lebih banyak
          </button>
        </div>
      )}
    </div>
  );
}
