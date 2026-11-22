import type { Metadata } from "next";
import Link from "next/link";
import ComicCard from "@/components/ComicCard";
import EmptyState from "@/components/EmptyState";
import { getCurrentUser } from "@/lib/auth";
import { getRecommendations } from "@/lib/personal";
import { hasSupabaseEnv } from "@/lib/utils";

export const metadata: Metadata = { title: "Untukmu" };

export default async function UntukmuPage() {
  if (!hasSupabaseEnv()) return <EmptyState error={null} />;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-8 max-w-[420px] text-center">
        <h1 className="text-[26px] font-bold">Untukmu</h1>
        <p className="mb-4 mt-1.5 text-mute">Login supaya rekomendasi disesuaikan dengan bacaanmu.</p>
        <Link href="/login?next=/untukmu" className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }
  const res = await getRecommendations(24);

  return (
    <div>
      <h1 className="mb-1 mt-1.5 text-2xl font-bold">Untukmu</h1>
      <p className="mb-3 text-[13px] text-mute">
        Dipilih dari komik yang kamu baca, bookmark, ikuti, dan simpan di koleksi. Komik yang sudah kamu sentuh tidak muncul lagi.
      </p>
      {res.error ? (
        <EmptyState error={res.error} />
      ) : res.data.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-center text-sm text-mute">
          Belum ada cukup data. Baca beberapa chapter, bookmark, atau ikuti komik dulu, nanti rekomendasinya muncul di sini.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {res.data.map(({ comic, reason }) => (
            <div key={comic.id}>
              <ComicCard c={comic} />
              <p className="mt-1.5 truncate px-1 text-[11px] text-gold">{reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
