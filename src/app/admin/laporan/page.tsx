import Link from "next/link";
import ReportItem, { type Rep } from "@/components/admin/ReportItem";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

const TABS = [["open", "Baru"], ["reviewing", "Ditinjau"], ["resolved", "Selesai"], ["dismissed", "Ditolak"]] as const;
type Row = { id: string; target_type: string; target_id: string; reason: string; detail: string | null; status: string; created_at: string; profiles: { username: string } | null };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireAdmin("/admin/laporan");
  const { s } = await searchParams;
  const status = TABS.some((t) => t[0] === s) ? s! : "open";
  const sb = await createClient();
  const { data, error } = await sb.from("reports")
    .select("id,target_type,target_id,reason,detail,status,created_at,profiles!reporter_id(username)")
    .eq("status", status).order("created_at", { ascending: status === "open" }).limit(50);
  const rows = (data as unknown as Row[]) ?? [];

  const ids = (t: string) => rows.filter((r) => r.target_type === t).map((r) => r.target_id);
  const [posts, comments, reviews, comics, users] = await Promise.all([
    ids("post").length ? sb.from("posts").select("id,title,body,is_hidden").in("id", ids("post")) : null,
    ids("comment").length ? sb.from("comments").select("id,body,is_hidden,post_id").in("id", ids("comment")) : null,
    ids("review").length ? sb.from("reviews").select("id,body,rating,is_hidden,comics(slug)").in("id", ids("review")) : null,
    ids("comic").length ? sb.from("comics").select("id,title,slug").in("id", ids("comic")) : null,
    ids("user").length ? sb.from("profiles").select("id,username").in("id", ids("user")) : null,
  ]);
  const by = <T extends { id: string }>(x: { data: T[] | null } | null) => new Map((x?.data ?? []).map((i) => [i.id, i]));
  const P = by(posts), C = by(comments), V = by(reviews), K = by(comics), Us = by(users);

  const reps: Rep[] = rows.map((r) => {
    const base = { id: r.id, target_type: r.target_type, target_id: r.target_id, reason: r.reason, detail: r.detail, status: r.status, created_at: r.created_at, reporter: r.profiles?.username ?? "?" };
    if (r.target_type === "post") { const x = P.get(r.target_id); return { ...base, exists: !!x, hidden: x?.is_hidden ?? null, preview: x ? `${x.title}\n${x.body}` : "", link: x ? `/komunitas/${x.id}` : null }; }
    if (r.target_type === "comment") { const x = C.get(r.target_id); return { ...base, exists: !!x, hidden: x?.is_hidden ?? null, preview: x?.body ?? "", link: x ? `/komunitas/${x.post_id}` : null }; }
    if (r.target_type === "review") { const x = V.get(r.target_id); const slug = (x?.comics as unknown as { slug: string } | null)?.slug; return { ...base, exists: !!x, hidden: x?.is_hidden ?? null, preview: x ? `Rating ${x.rating}/5\n${x.body ?? ""}` : "", link: slug ? `/komik/${slug}` : null }; }
    if (r.target_type === "comic") { const x = K.get(r.target_id); return { ...base, exists: !!x, hidden: null, preview: x?.title ?? "", link: x ? `/komik/${x.slug}` : null }; }
    if (r.target_type === "user") { const x = Us.get(r.target_id); return { ...base, exists: !!x, hidden: null, preview: x ? `@${x.username}` : "", link: x ? `/admin/user?q=${encodeURIComponent(x.username)}` : null }; }
    return { ...base, exists: true, hidden: null, preview: `Gambar chapter ${r.target_id}`, link: null };
  });

  return (
    <div>
      <div className="no-scrollbar -mx-3.5 mb-3 flex gap-2 overflow-x-auto px-3.5">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/admin/laporan?s=${k}`} aria-current={k === status ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${k === status ? "border-brand bg-brand font-bold" : "border-line bg-card text-[#ccc]"}`}>{l}</Link>
        ))}
      </div>
      {error && <p className="text-[#ff6b70]">Gagal memuat laporan: {error.message}</p>}
      {!error && !reps.length && <p className="py-12 text-center text-mute">Tidak ada laporan di tab ini.</p>}
      <ul className="space-y-3">{reps.map((r) => <ReportItem key={r.id} r={r} isAdmin />)}</ul>
    </div>
  );
}
