import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import ChapterForm from "@/components/admin/ChapterForm";
import { requireAdmin, UUID_RE } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/komik/${id}/chapter/baru`);
  if (!UUID_RE.test(id)) notFound();
  const sb = await createClient();
  const { data: c } = await sb.from("comics").select("id,title").eq("id", id).maybeSingle();
  if (!c) notFound();
  const { data: last } = await sb.from("chapters").select("number").eq("comic_id", id).order("number", { ascending: false }).limit(1);
  const next = last?.[0] ? Math.floor(Number(last[0].number)) + 1 : 1;
  return (
    <div>
      <Link href={`/admin/komik/${id}`} className="text-[13px] text-mute">Kembali ke {c.title}</Link>
      <h2 className="mb-1 mt-1 text-[20px] font-bold">Chapter baru</h2>
      <p className="mb-3 text-[13px] text-mute">Setelah dibuat, kamu langsung bisa mengunggah gambarnya.</p>
      <ChapterForm isNew ch={{ id: randomUUID(), comic_id: id, number: next, title: null, is_published: true, published_at: null }} />
    </div>
  );
}
