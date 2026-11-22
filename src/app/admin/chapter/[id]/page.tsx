import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteChapter } from "@/app/admin/actions";
import ChapterForm from "@/components/admin/ChapterForm";
import ChapterImages from "@/components/admin/ChapterImages";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { requireAdmin, UUID_RE } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/chapter/${id}`);
  if (!UUID_RE.test(id)) notFound();
  const sb = await createClient();
  const { data: ch } = await sb.from("chapters").select("id,comic_id,number,title,is_published,published_at,comics(title)").eq("id", id).maybeSingle();
  if (!ch) notFound();
  const { data: imgs } = await sb.from("chapter_images").select("id,page_number,image_path").eq("chapter_id", id).order("page_number");
  const images = (imgs ?? []).map((i) => ({ ...i, url: sb.storage.from("chapters").getPublicUrl(i.image_path).data.publicUrl }));
  const title = (ch.comics as unknown as { title: string } | null)?.title ?? "Komik";
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/komik/${ch.comic_id}`} className="text-[13px] text-mute">Kembali ke {title}</Link>
        <h2 className="mb-3 mt-1 text-[20px] font-bold">Chapter {Number(ch.number)}</h2>
        <ChapterForm isNew={false} ch={{ ...ch, number: Number(ch.number) }} />
      </div>
      <section>
        <h3 className="mb-2 text-[17px] font-bold">Gambar chapter</h3>
        <ChapterImages chapterId={id} comicId={ch.comic_id} images={images} />
      </section>
      <section className="rounded-2xl border border-brand/40 p-4">
        <h3 className="font-bold text-[#ff6b70]">Zona berbahaya</h3>
        <div className="mt-2"><ConfirmButton danger label="Hapus chapter" ask="Hapus chapter ini beserta semua gambarnya?" run={deleteChapter.bind(null, id)} /></div>
      </section>
    </div>
  );
}
