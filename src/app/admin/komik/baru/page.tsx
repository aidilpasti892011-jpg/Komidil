import Link from "next/link";
import { randomUUID } from "node:crypto";
import ComicForm from "@/components/admin/ComicForm";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireAdmin("/admin/komik/baru");
  const sb = await createClient();
  const { data: genres } = await sb.from("genres").select("id,name").order("name");
  const comic = { id: randomUUID(), title: "", alt_titles: [], synopsis: null, author: null, artist: null, type: "manhwa", status: "ongoing", cover_hue: Math.floor(Math.random() * 360), cover_url: null, is_published: false, rights_confirmed: false, rights_note: null };
  return (
    <div>
      <Link href="/admin/komik" className="text-[13px] text-mute">Kembali</Link>
      <h2 className="mb-3 mt-1 text-[20px] font-bold">Komik baru</h2>
      <ComicForm comic={comic} isNew genres={genres ?? []} selected={[]} />
    </div>
  );
}
