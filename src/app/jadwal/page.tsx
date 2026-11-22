import type { Metadata } from "next";
import Link from "next/link";
import ScheduleRow from "@/components/ScheduleRow";
import EmptyState from "@/components/EmptyState";
import { addDays, dayTitle, getSchedule, wibDay, type ScheduleItem } from "@/lib/schedule";

export const metadata: Metadata = { title: "Jadwal Rilis" };

const VIEWS = [
  { key: "hari-ini", label: "Hari ini" },
  { key: "besok", label: "Besok" },
  { key: "minggu", label: "Minggu ini" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

type SP = { v?: string; f?: string };

export default async function JadwalPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view: ViewKey = VIEWS.some((x) => x.key === sp.v) ? (sp.v as ViewKey) : "hari-ini";
  const onlyFollowed = sp.f === "1";

  const res = await getSchedule();
  const today = wibDay();
  const tomorrow = addDays(today, 1);
  const hasFollowed = res.data.some((i) => i.followed);

  let items = res.data;
  if (onlyFollowed) items = items.filter((i) => i.followed);
  if (view === "hari-ini") items = items.filter((i) => i.day === today);
  else if (view === "besok") items = items.filter((i) => i.day === tomorrow);

  const groups = new Map<string, ScheduleItem[]>();
  for (const i of items) groups.set(i.day, [...(groups.get(i.day) ?? []), i]);
  const days = Array.from(groups.keys()).sort();

  const link = (v: ViewKey, f: boolean) => `/jadwal?v=${v}${f ? "&f=1" : ""}`;

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="mb-1 mt-1.5 text-2xl font-bold">Jadwal Rilis</h1>
      <p className="mb-3 text-[13px] text-mute">
        Chapter yang dijadwalkan terbit dan yang sudah rilis hari ini. Semua jam dalam WIB.
      </p>

      <div role="tablist" aria-label="Rentang jadwal" className="mb-3 flex flex-wrap gap-1.5">
        {VIEWS.map((x) => (
          <Link
            key={x.key}
            href={link(x.key, onlyFollowed)}
            role="tab"
            aria-selected={view === x.key}
            className={`rounded-full border px-4 py-1.5 text-[13px] ${
              view === x.key ? "border-brand bg-brand font-bold text-white" : "border-line bg-card text-[#ccc]"
            }`}
          >
            {x.label}
          </Link>
        ))}
        <Link
          href={link(view, !onlyFollowed)}
          aria-pressed={onlyFollowed}
          className={`ml-auto rounded-full border px-4 py-1.5 text-[13px] ${
            onlyFollowed ? "border-gold bg-gold/15 font-bold text-gold" : "border-line bg-card text-[#ccc]"
          }`}
        >
          Yang kuikuti
        </Link>
      </div>

      {res.error ? (
        <EmptyState error={res.error} />
      ) : days.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-center text-sm text-mute">
          {onlyFollowed && !hasFollowed
            ? "Belum ada jadwal dari komik yang kamu ikuti. Ikuti komik dari halaman detailnya, atau login dulu."
            : view === "hari-ini"
              ? "Belum ada rilis hari ini."
              : view === "besok"
                ? "Belum ada jadwal untuk besok."
                : "Belum ada jadwal rilis dalam 7 hari ke depan."}
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((d) => {
            const t = dayTitle(d, today);
            return (
              <section key={d} aria-label={`${t.name}, ${t.date}`}>
                {view === "minggu" && (
                  <h2 className="mb-2 flex items-baseline gap-2">
                    <span className="text-[17px] font-bold">{t.name}</span>
                    <span className="text-[13px] text-mute">{t.date}</span>
                  </h2>
                )}
                <div className="space-y-2">
                  {groups.get(d)!.map((i) => (
                    <ScheduleRow key={`${i.comicId}-${i.day}`} item={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
