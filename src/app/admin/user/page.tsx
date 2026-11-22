import Link from "next/link";
import UserRow, { type U } from "@/components/admin/UserRow";
import { field } from "@/components/admin/Ui";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

const PER = 20;
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const me = await requireAdmin("/admin/user");
  const sp = await searchParams;
  const page = Math.min(Math.max(parseInt(sp.p ?? "1", 10) || 1, 1), 500);
  const term = (sp.q ?? "").replace(/[%_,()]/g, " ").trim().slice(0, 40);
  const sb = await createClient();
  let q = sb.from("profiles").select("id,username,display_name,role,is_suspended,suspended_until,suspended_reason,xp,created_at")
    .order("created_at", { ascending: false }).range((page - 1) * PER, (page - 1) * PER + PER);
  if (term) q = q.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
  const { data, error } = await q;
  const rows = (data as U[] | null) ?? [];
  const more = rows.length > PER;
  const base = `/admin/user?${term ? `q=${encodeURIComponent(term)}&` : ""}`;
  return (
    <div>
      <form className="mb-3"><input name="q" defaultValue={term} placeholder="Cari username atau nama" className={`${field} !mt-0`} /></form>
      <p className="mb-3 text-[12px] text-mute">Admin hanya satu dan dijaga database. Kamu bisa mengatur moderator dan suspend user.</p>
      {error && <p className="text-[#ff6b70]">{error.message}</p>}
      <ul className="space-y-2">{rows.slice(0, PER).map((u) => <UserRow key={u.id} u={u} isSelf={u.id === me.id} />)}</ul>
      {!error && !rows.length && <p className="py-10 text-center text-mute">User tidak ditemukan.</p>}
      <div className="mt-4 flex justify-center gap-3 text-sm">
        {page > 1 && <Link className="rounded-full border border-line bg-card px-5 py-2" href={`${base}p=${page - 1}`}>Sebelumnya</Link>}
        {more && <Link className="rounded-full border border-line bg-card px-5 py-2" href={`${base}p=${page + 1}`}>Berikutnya</Link>}
      </div>
    </div>
  );
}
