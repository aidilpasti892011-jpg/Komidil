import RankBadge from "./RankBadge";
import { DAILY_XP_CAP, XP_RULES, rankInfo } from "@/lib/ranks";

/** Kartu rank di profil: level, progres ke rank berikutnya, XP hari ini, dan aturan XP. */
export default function RankCard({ xp, today }: { xp: number; today: number }) {
  const { current, next, progress, remaining } = rankInfo(xp);
  const pct = Math.round(progress * 100);
  const left = Math.max(0, DAILY_XP_CAP - today);
  return (
    <section aria-label="Rank pembaca" className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-mute">Rank kamu</p>
          <h2 className="text-[20px] font-bold leading-tight">{current.name}</h2>
        </div>
        <RankBadge level={current.level} className="!text-[11px] !px-2 !py-0.5" />
      </div>

      <div className="mt-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Progres ke rank berikutnya"
          className="h-2.5 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-gold" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-[12px] text-mute">
          {next ? (
            <>
              <b className="text-white">{xp.toLocaleString("id-ID")}</b> XP. Butuh {remaining.toLocaleString("id-ID")} XP lagi menuju{" "}
              <span className="text-gold">{next.name}</span>.
            </>
          ) : (
            <>
              <b className="text-white">{xp.toLocaleString("id-ID")}</b> XP. Kamu sudah di rank tertinggi.
            </>
          )}
        </p>
      </div>

      <p className="mt-3 rounded-xl bg-bg px-3 py-2 text-[12px] text-[#ccc]">
        XP hari ini: <b className="text-gold">{today}</b> dari {DAILY_XP_CAP}
        {left > 0 ? `. Sisa jatah ${left} XP.` : ". Jatah harian habis, reset besok pukul 00.00 WIB."}
      </p>

      <details className="group mt-2 text-[13px]">
        <summary className="cursor-pointer list-none py-1 text-gold">
          <span className="group-open:hidden">Cara dapat XP</span>
          <span className="hidden group-open:inline">Tutup</span>
        </summary>
        <ul className="mt-1 space-y-1.5 text-[#ccc]">
          {XP_RULES.map((r) => (
            <li key={r.label}>
              <b className="text-white">{r.label}.</b> {r.text}
            </li>
          ))}
          <li className="text-mute">
            XP dihitung server. Konten yang dihapus atau disembunyikan moderator tidak dihitung, dan akun yang disuspend tidak mendapat XP.
          </li>
        </ul>
      </details>
    </section>
  );
}
