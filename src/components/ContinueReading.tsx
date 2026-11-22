import Link from "next/link";
import Cover from "./Cover";
import { IconChevronRight } from "./Icons";
import { getContinueReading } from "@/lib/continue";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

// Kartu "Lanjutkan Membaca" di Home. Tidak tampil kalau belum login atau belum ada riwayat.
export default async function ContinueReading() {
  if (!hasSupabaseEnv()) return null;
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const c = await getContinueReading(data.user.id);
  if (!c) return null;

  const pct = Math.round(c.progress * 100);
  const sub = c.isNext ? `Chapter ${c.chapter} siap dibaca` : `Chapter ${c.chapter} · Progres ${pct}%`;

  return (
    <section aria-label="Lanjutkan membaca" className="mb-1.5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-extrabold tracking-wide text-gold">LANJUTKAN MEMBACA</h2>
        <Link href="/pustaka?tab=lanjut" className="text-[13px] text-mute">Semua</Link>
      </div>
      <Link
        href={`/komik/${c.slug}/${c.chapter}`}
        className="flex items-center gap-3 rounded-[14px] border border-line bg-card p-3 transition hover:border-brand"
      >
        <div className="relative aspect-[3/4] w-[58px] flex-none overflow-hidden rounded-lg">
          <Cover title={c.title} hue={c.cover_hue} url={c.cover_url} sizes="58px" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold">{c.title}</h3>
          <p className="mt-0.5 text-[13px] text-mute">{sub}</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Progres membaca"
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${c.isNext ? 0 : pct}%` }} />
          </div>
          <span className="mt-2 inline-flex items-center gap-0.5 text-[13px] font-semibold text-gold">
            Lanjut membaca <IconChevronRight width={14} height={14} />
          </span>
        </div>
      </Link>
    </section>
  );
}
