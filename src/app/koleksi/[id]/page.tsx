import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cover from "@/components/Cover";
import { EditCollectionForm, RemoveItemButton } from "@/components/CollectionForms";
import { IconChevronLeft } from "@/components/Icons";
import { getCurrentUser } from "@/lib/auth";
import { getCollection } from "@/lib/collections";
import { TYPE_LABEL, type ComicType } from "@/lib/types";

export const metadata: Metadata = { title: "Koleksi", robots: { index: false } };

export default async function KoleksiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-8 max-w-[420px] text-center">
        <h1 className="text-[26px] font-bold">Koleksi</h1>
        <p className="mb-4 mt-1.5 text-mute">Login untuk membuka koleksimu.</p>
        <Link href={`/login?next=/koleksi/${id}`} className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }
  const col = await getCollection(id, me.id);
  if (!col) notFound();

  return (
    <div className="mx-auto max-w-[720px]">
      <Link href="/koleksi" className="my-1.5 mb-2 inline-flex items-center gap-1 text-mute">
        <IconChevronLeft width={18} height={18} /> Koleksi
      </Link>
      <h1 className="text-2xl font-bold">{col.name}</h1>
      {col.description && <p className="mt-1 text-[14px] text-[#ccc]">{col.description}</p>}
      <p className="mt-0.5 text-[13px] text-mute">{col.item_count} komik</p>

      <EditCollectionForm id={col.id} name={col.name} description={col.description ?? ""} />

      {col.items.length === 0 ? (
        <p className="py-10 text-center text-mute">Koleksi ini masih kosong. Buka halaman komik lalu tekan tombol Koleksi.</p>
      ) : (
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {col.items.map((i) => (
            <li key={i.comic_id} className="flex items-center gap-3 rounded-[14px] bg-card p-2.5">
              <Link href={`/komik/${i.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative aspect-[3/4] w-[52px] flex-none overflow-hidden rounded-lg">
                  <Cover title={i.title} hue={i.cover_hue} url={i.cover_url} sizes="52px" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{i.title}</div>
                  <small className="text-xs text-mute">
                    {TYPE_LABEL[i.type as ComicType] ?? i.type}
                    {i.latest_chapter_number !== null ? ` · Ch ${i.latest_chapter_number}` : ""}
                  </small>
                </div>
              </Link>
              <RemoveItemButton collectionId={col.id} comicId={i.comic_id} title={i.title} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
