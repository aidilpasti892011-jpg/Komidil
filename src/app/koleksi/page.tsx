import type { Metadata } from "next";
import Link from "next/link";
import Cover from "@/components/Cover";
import EmptyState from "@/components/EmptyState";
import { CreateCollectionForm } from "@/components/CollectionForms";
import { getCurrentUser } from "@/lib/auth";
import { getCollections, MAX_COLLECTIONS } from "@/lib/collections";
import { hasSupabaseEnv, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Koleksi" };

export default async function KoleksiPage() {
  if (!hasSupabaseEnv()) return <EmptyState error={null} />;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-8 max-w-[420px] text-center">
        <h1 className="text-[26px] font-bold">Koleksi</h1>
        <p className="mb-4 mt-1.5 text-mute">Login untuk membuat koleksi komik favoritmu.</p>
        <Link href="/login?next=/koleksi" className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }
  const { data, error } = await getCollections(me.id);

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="mb-1 mt-1.5 text-2xl font-bold">Koleksi</h1>
      <p className="mb-3 text-[13px] text-mute">
        Kelompokkan komik sesukamu. Tambahkan dari tombol Koleksi di halaman komik. Maksimal {MAX_COLLECTIONS} koleksi, dan hanya kamu yang bisa melihatnya.
      </p>
      {error ? (
        <EmptyState error={error} />
      ) : (
        <>
          <CreateCollectionForm />
          {data.length === 0 ? (
            <p className="py-8 text-center text-mute">Belum ada koleksi. Buat yang pertama di atas.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {data.map((c) => (
                <li key={c.id}>
                  <Link href={`/koleksi/${c.id}`} className="flex items-center gap-3 rounded-[14px] border border-line bg-card p-3 transition hover:border-brand">
                    <div className="flex w-[84px] flex-none -space-x-5" aria-hidden="true">
                      {c.covers.length === 0 ? (
                        <div className="aspect-[3/4] w-[52px] rounded-lg border border-dashed border-line" />
                      ) : (
                        c.covers.map((cv, i) => (
                          <div
                            key={i}
                            className="relative aspect-[3/4] w-[52px] flex-none overflow-hidden rounded-lg border-2 border-card"
                            style={{ zIndex: 3 - i }}
                          >
                            <Cover title={cv.title} hue={cv.hue} url={cv.url} sizes="52px" />
                          </div>
                        ))
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-[16px] font-bold">{c.name}</h2>
                      <p className="text-[13px] text-mute">{c.item_count} komik · {timeAgo(c.updated_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
