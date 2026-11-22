import Link from "next/link";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/admin/Ui";
import RefreshRankings from "@/components/admin/RefreshRankings";

type Pt = { d: string; n: number };
type Stats = {
  users: number; suspended: number; comics: number; chapters: number; scheduled: number; views: number; bookmarks: number;
  posts: number; comments: number; reviews: number; open_reports: number; signups: Pt[]; activity: Pt[];
  top_comics: { title: string; slug: string; view_count: number; bookmark_count: number }[];
};

function Bars({ data, label }: { data: Pt[]; label: string }) {
  const max = Math.max(1, ...data.map((p) => p.n));
  const w = 300, h = 90, bw = w / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} role="img" aria-label={label} className="w-full">
      {data.map((p, i) => {
        const bh = (p.n / max) * h;
        return <rect key={p.d} x={i * bw + 2} y={h - bh} width={bw - 4} height={Math.max(bh, 1)} rx={3} fill={p.n ? "#D71920" : "#2a2a2a"}><title>{`${p.d}: ${p.n}`}</title></rect>;
      })}
      <text x="0" y={h + 12} fontSize="9" fill="#929292">{data[0]?.d.slice(5)}</text>
      <text x={w} y={h + 12} fontSize="9" fill="#929292" textAnchor="end">{data.at(-1)?.d.slice(5)}</text>
    </svg>
  );
}

export default async function Page() {
  const me = await requireStaff();
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_stats");
  if (error || !data) {
    return <Card><p className="text-[#ff6b70]">Gagal memuat statistik: {error?.message}</p><p className="mt-1 text-[13px] text-mute">Pastikan 0005_admin.sql sudah dijalankan.</p></Card>;
  }
  const s = data as Stats;
  const tiles: [string, number | string, string?][] = [
    ["User", s.users], ["Komik", s.comics], ["Chapter", s.chapters], ["Terjadwal", s.scheduled],
    ["Total views", Number(s.views).toLocaleString("id-ID")], ["Bookmark", s.bookmarks],
    ["Post", s.posts], ["Komentar", s.comments], ["Review", s.reviews], ["User suspend", s.suspended],
  ];
  return (
    <div className="space-y-4">
      {me.role === "admin" && s.open_reports > 0 && (
        <Link href="/admin/laporan" className="block rounded-2xl border border-brand/60 bg-brand/15 p-4 text-[14px]">
          <b>{s.open_reports} laporan</b> menunggu ditinjau. Buka antrean moderasi.
        </Link>
      )}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {tiles.map(([l, v]) => (
          <div key={l} className="rounded-[14px] bg-card p-3.5 text-center"><b className="block text-[22px] text-gold">{v}</b><small className="text-mute">{l}</small></div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="mb-2 text-[15px] font-bold">Pendaftar baru (14 hari)</h2><Bars data={s.signups} label="Pendaftar per hari" /></Card>
        <Card><h2 className="mb-2 text-[15px] font-bold">Post dan komentar (14 hari)</h2><Bars data={s.activity} label="Aktivitas komunitas per hari" /></Card>
      </div>
      <Card>
        <h2 className="mb-2 text-[15px] font-bold">Komik terpopuler</h2>
        {s.top_comics.length === 0 ? <p className="text-[13px] text-mute">Belum ada data.</p> : (
          <ol className="space-y-1.5 text-[14px]">
            {s.top_comics.map((c) => (
              <li key={c.slug} className="flex justify-between gap-3"><Link href={`/komik/${c.slug}`} className="truncate">{c.title}</Link><span className="shrink-0 text-mute">{c.view_count} views, {c.bookmark_count} bookmark</span></li>
            ))}
          </ol>
        )}
        {me.role === "admin" && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-[12px] text-mute">Ranking dihitung otomatis tiap 15 menit oleh pg_cron. Pakai tombol ini kalau cron belum aktif.</p>
            <RefreshRankings />
          </div>
        )}
      </Card>
    </div>
  );
}
