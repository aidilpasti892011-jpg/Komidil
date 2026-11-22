import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteComic } from "@/app/admin/actions";
import ComicForm from "@/components/admin/ComicForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { requireAdmin, UUID_RE } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/komik/${id}`);
  if (!UUID_RE.test(id)) notFound();
  const sb = await createClient();
  const { data: c } = await sb.from("comics").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: genres }, { data: cg }, { data: chs }] = await Promise.all([
    sb.from("genres").select("id,name").order("name"),
    sb.from("comic_genres").select("genre_id").eq("comic_id", id),
    sb.from("chapters").select("id,number,title,is_published,published_at").eq("comic_id", id).order("number", { ascending: false }),
  ]);
  const now = Date.now();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/komik" className="text-[13px] text-mute">Kembali</Link>
        <div className="mb-3 mt-1 flex items-center justify-between gap-3">
          <h2 className="truncate text-[20px] font-bold">{c.title}</h2>
          <Link href={`/komik/${c.slug}`} className="shrink-0 text-[13px] text-gold">Lihat publik</Link>
        </div>
        <ComicForm comic={c} isNew={false} genres={genres ?? []} selected={(cg ?? []).map((x) => x.genre_id as number)} />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[17px] font-bold">Chapter ({chs?.length ?? 0})</h3>
          <Link href={`/admin/komik/${id}/chapter/baru`} className="rounded-3xl bg-brand px-4 py-2 text-[13px] font-bold">Chapter baru</Link>
        </div>
        <ul className="space-y-2">
          {(chs ?? []).map((ch) => {
            const sched = ch.published_at && new Date(ch.published_at).getTime() > now;
            return (
              <li key={ch.id}>
                <Link href={`/admin/chapter/${ch.id}`} className="flex items-center justify-between rounded-xl border border-line bg-card p-3 text-[14px]">
                  <span>Chapter {Number(ch.number)}{ch.title ? ` - ${ch.title}` : ""}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] ${sched ? "bg-gold text-black" : !ch.is_published ? "bg-brand/30 text-[#ff9a9d]" : "bg-line text-[#ccc]"}`}>
                    {sched ? `Terjadwal ${new Date(ch.published_at!).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}` : ch.is_published ? "Terbit" : "Nonaktif"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-brand/40 p-4">
        <h3 className="font-bold text-[#ff6b70]">Zona berbahaya</h3>
        <p className="mb-3 mt-1 text-[13px] text-mute">Menghapus komik juga menghapus semua chapter, gambar, bookmark, riwayat, dan review-nya. Tidak bisa dibatalkan.</p>
        <ConfirmButton danger label="Hapus komik" ask={`Hapus "${c.title}" beserta semua datanya secara permanen?`} run={deleteComic.bind(null, id)} />
      </section>
    </div>
  );
}
