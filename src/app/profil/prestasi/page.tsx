import type { Metadata } from "next";
import Link from "next/link";
import BadgeIcon from "@/components/BadgeIcon";
import EmptyState from "@/components/EmptyState";
import { IconChevronLeft } from "@/components/Icons";
import { getCurrentUser } from "@/lib/auth";
import { getAchievements } from "@/lib/personal";
import { hasSupabaseEnv } from "@/lib/utils";

export const metadata: Metadata = { title: "Prestasi" };

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function PrestasiPage() {
  if (!hasSupabaseEnv()) return <EmptyState error={null} />;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-8 max-w-[420px] text-center">
        <h1 className="text-[26px] font-bold">Prestasi</h1>
        <p className="mb-4 mt-1.5 text-mute">Login untuk melihat badge prestasimu.</p>
        <Link href="/login?next=/profil/prestasi" className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }
  const { data, error } = await getAchievements();
  const open = data.filter((a) => a.unlocked_at).sort((a, b) => (b.unlocked_at! > a.unlocked_at! ? 1 : -1));
  const locked = data.filter((a) => !a.unlocked_at);

  const card = (a: (typeof data)[number]) => {
    const done = Boolean(a.unlocked_at);
    const pct = Math.round((a.value / a.threshold) * 100);
    return (
      <li key={a.code} className={`flex gap-3 rounded-[14px] border p-3 ${done ? "border-gold/40 bg-card" : "border-line bg-card/60"}`}>
        <BadgeIcon icon={a.icon} tier={a.tier} unlocked={done} />
        <div className="min-w-0 flex-1">
          <h3 className={`text-[15px] font-bold ${done ? "" : "text-[#9a9a9a]"}`}>{a.name}</h3>
          <p className="text-[12px] text-mute">{a.description}</p>
          {done ? (
            <p className="mt-1.5 text-[12px] font-semibold text-gold">Terbuka {dateFmt.format(new Date(a.unlocked_at!))}</p>
          ) : (
            <div className="mt-1.5">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={a.threshold}
                aria-valuenow={a.value}
                aria-label={`Progres ${a.name}`}
                className="h-1.5 overflow-hidden rounded-full bg-line"
              >
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-mute">{a.value} / {a.threshold}</p>
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-[560px]">
      <Link href="/profil" className="my-1.5 mb-2 inline-flex items-center gap-1 text-mute">
        <IconChevronLeft width={18} height={18} /> Profil
      </Link>
      <h1 className="text-2xl font-bold">Prestasi</h1>
      {error ? (
        <div className="mt-3"><EmptyState error={error} /></div>
      ) : (
        <>
          <p className="mb-3 mt-1 text-[13px] text-mute">{open.length} dari {data.length} badge terbuka</p>
          {open.length > 0 && (
            <>
              <h2 className="mb-2 text-[12px] font-extrabold tracking-wide text-gold">TERBUKA</h2>
              <ul className="mb-5 grid gap-2">{open.map(card)}</ul>
            </>
          )}
          {locked.length > 0 && (
            <>
              <h2 className="mb-2 text-[12px] font-extrabold tracking-wide text-mute">TERKUNCI</h2>
              <ul className="grid gap-2">{locked.map(card)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
