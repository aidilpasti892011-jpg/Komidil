import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { field } from "@/components/admin/Ui";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin("/admin/komik");
  const { q } = await searchParams;
  const sb = await createClient();
  let query = sb.from("comics").select("id,title,type,status,is_published,chapter_count,view_count,cover_url").order("created_at", { ascending: false }).limit(100);
  const term = (q ?? "").replace(/[%_,()]/g, " ").trim().slice(0, 60);
  if (term) query = query.ilike("title", `%${term}%`);
  const { data, error } = await query;
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <form className="flex-1"><input name="q" defaultValue={term} placeholder="Cari judul" className={`${field} !mt-0`} /></form>
        <Link href="/admin/komik/baru" className="rounded-3xl bg-brand px-5 py-3 text-sm font-bold">Komik baru</Link>
      </div>
      {error && <p className="text-[#ff6b70]">{error.message}</p>}
      <ul className="space-y-2">
        {(data ?? []).map((c) => (
          <li key={c.id}>
            <Link href={`/admin/komik/${c.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3.5">
              <span className="min-w-0"><b className="block truncate text-[15px]">{c.title}</b>
                <small className="text-mute">{c.type} · {c.status} · {c.chapter_count} chapter · {c.view_count} views</small></span>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] ${c.is_published ? "bg-line text-[#ccc]" : "bg-brand/30 text-[#ff9a9d]"}`}>{c.is_published ? "Terbit" : "Draft"}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!error && !data?.length && <p className="py-10 text-center text-mute">Belum ada komik.</p>}
    </div>
  );
}
