import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { IconChevronLeft } from "@/components/Icons";
import { getCurrentUser } from "@/lib/auth";
import { getReadingStats } from "@/lib/personal";
import { TYPE_LABEL, type ComicType } from "@/lib/types";
import { hasSupabaseEnv } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistik Membaca" };

const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" });
const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const label = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));

export default async function StatistikPage() {
  if (!hasSupabaseEnv()) return <EmptyState error={null} />;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-8 max-w-[420px] text-center">
        <h1 className="text-[26px] font-bold">Statistik Membaca</h1>
        <p className="mb-4 mt-1.5 text-mute">Login untuk melihat statistik bacaanmu.</p>
        <Link href="/login?next=/profil/statistik" className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }
  const { data: s, error } = await getReadingStats();

  return (
    <div className="mx-auto max-w-[560px]">
      <Link href="/profil" className="my-1.5 mb-2 inline-flex items-center gap-1 text-mute">
        <IconChevronLeft width={18} height={18} /> Profil
      </Link>
      <h1 className="mb-3 text-2xl font-bold">Statistik Membaca</h1>

      {error || !s ? (
        <EmptyState error={error} />
      ) : s.chapters === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-center text-sm text-mute">
          Belum ada chapter yang tercatat. Baca satu chapter sampai lebih dari separuh dan tunggu 30 detik, nanti statistiknya mulai terisi.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[14px] border border-line bg-card p-4">
            <p className="text-[12px] font-extrabold tracking-wide text-gold">STREAK BACA</p>
            <p className="mt-1 text-3xl font-bold">
              {s.streak_current} <span className="text-base font-semibold text-mute">hari berturut-turut</span>
            </p>
            <p className="mt-0.5 text-[13px] text-mute">
              Terbaik: {s.streak_best} hari · Total {s.days_active} hari aktif
              {s.first_read ? ` · Sejak ${dateFmt.format(new Date(`${s.first_read}T00:00:00Z`))}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {([
              ["Chapter dibaca", s.chapters],
              ["Komik dibaca", s.comics],
              ["Komik tamat", s.finished],
              ["30 hari terakhir", s.last30],
            ] as [string, number][]).map(([l, v]) => (
              <div key={l} className="rounded-[14px] bg-card p-3.5 text-center">
                <b className="block text-[22px] text-gold">{v}</b>
                <small className="text-mute">{l}</small>
              </div>
            ))}
          </div>

          <section className="rounded-[14px] border border-line bg-card p-4" aria-label="Chapter dibaca 7 hari terakhir">
            <h2 className="mb-3 text-[15px] font-bold">7 hari terakhir</h2>
            {(() => {
              const max = Math.max(1, ...s.last7.map((d) => d.n));
              return (
                <div
                  role="img"
                  aria-label={s.last7.map((d) => `${label(d.day)} ${d.n} chapter`).join(", ")}
                  className="flex h-[120px] items-end gap-2"
                >
                  {s.last7.map((d, i) => (
                    <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-[11px] tabular-nums text-mute">{d.n > 0 ? d.n : ""}</span>
                      <div
                        className={`w-full rounded-t-md ${i === s.last7.length - 1 ? "bg-gold" : "bg-brand"} ${d.n === 0 ? "opacity-25" : ""}`}
                        style={{ height: `${d.n === 0 ? 4 : Math.max(8, (d.n / max) * 78)}px` }}
                      />
                      <span className="text-[11px] text-mute">{label(d.day)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>

          {s.top_genres.length > 0 && (
            <section className="rounded-[14px] border border-line bg-card p-4">
              <h2 className="mb-3 text-[15px] font-bold">Genre favorit</h2>
              <ul className="space-y-2.5">
                {s.top_genres.map((g) => (
                  <li key={g.name}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span>{g.name}</span>
                      <span className="tabular-nums text-mute">{g.n} chapter</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand to-gold" style={{ width: `${(g.n / s.top_genres[0].n) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {s.top_types.length > 0 && (
            <section className="rounded-[14px] border border-line bg-card p-4">
              <h2 className="mb-2.5 text-[15px] font-bold">Jenis bacaan</h2>
              <div className="flex flex-wrap gap-1.5">
                {s.top_types.map((t) => (
                  <span key={t.type} className="rounded-2xl border border-line px-3 py-1 text-[13px]">
                    {TYPE_LABEL[t.type as ComicType] ?? t.type} <b className="text-gold">{t.n}</b>
                  </span>
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-mute">
            Dihitung dari chapter yang dibaca minimal 60% dan 30 detik. Waktu baca tidak dilacak. Riwayat sebelum fitur ini diambil dari catatan XP baca.
          </p>
        </div>
      )}
    </div>
  );
}
