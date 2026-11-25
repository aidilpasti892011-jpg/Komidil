import type { Metadata } from "next";
import Link from "next/link";
import ProfileEditor from "@/components/ProfileEditor";
import RankBadge from "@/components/RankBadge";
import RankCard from "@/components/RankCard";
import { signInWithGoogle, signOut } from "@/app/auth/actions";
import { IconGoogle } from "@/components/Icons";
import BadgeIcon from "@/components/BadgeIcon";
import { getCurrentUser } from "@/lib/auth";
import { getAchievements } from "@/lib/personal";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export const metadata: Metadata = { title: "Profil" };

const ROLE = { moderator: "Moderator", admin: "Super Admin" } as const;

export default async function ProfilPage() {
  if (!hasSupabaseEnv()) {
    return <p className="py-16 text-center text-mute">Database belum tersambung. Isi .env.local dulu (lihat README).</p>;
  }
  const me = await getCurrentUser();

  if (!me) {
    return (
      <div className="mx-auto my-8 max-w-[420px]">
        <h1 className="text-[26px] font-bold">Profil</h1>
        <p className="mb-4 mt-1.5 text-mute">Kamu belum login. Masuk untuk menyimpan bookmark dan riwayat baca di akun.</p>
        <form action={signInWithGoogle} className="mb-3">
          <input type="hidden" name="next" value="/profil" />
          <button className="flex w-full items-center justify-center gap-3 rounded-3xl bg-white py-3.5 text-sm font-bold text-[#1f1f1f] transition active:scale-95">
            <IconGoogle />
            Lanjut dengan Google
          </button>
        </form>
        <div className="flex gap-2">
          <Link href="/login" className="rounded-3xl bg-brand px-6 py-2.5 text-sm font-bold">Masuk</Link>
          <Link href="/register" className="rounded-3xl border border-line bg-card px-6 py-2.5 text-sm font-bold">Daftar</Link>
        </div>
      </div>
    );
  }

  const sb = await createClient();
  const count = async (t: "bookmarks" | "reading_history", finished?: boolean) => {
    let q = sb.from(t).select("*", { count: "exact", head: true }).eq("user_id", me.id);
    if (finished !== undefined) q = q.eq("is_finished", finished);
    return (await q).count ?? 0;
  };
  const [bm, hist, done, xpSum, ach] = await Promise.all([
    count("bookmarks"),
    count("reading_history"),
    count("reading_history", true),
    sb.rpc("my_xp_summary"),
    getAchievements(),
  ]);
  const unlocked = ach.data.filter((a) => a.unlocked_at);
  const p = me.profile;
  const xp = p?.xp ?? 0;
  const todayXp = Number((xpSum.data as { today?: number } | null)?.today ?? 0);
  const stats: [string, number][] = [["Bookmark", bm], ["Riwayat", hist], ["Selesai", done], ["XP", xp]];

  return (
    <div className="mx-auto max-w-[560px]">
      <div className="my-2 flex items-center justify-between">
        <h1 className="text-[26px] font-bold">Profil</h1>
        <form action={signOut}>
          <button className="rounded-3xl border border-line bg-card px-4 py-2 text-sm font-bold">Keluar</button>
        </form>
      </div>
      <p className="text-sm text-mute">@{p?.username} · {me.email}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {p?.role && p.role !== "user" && (
          <span className="inline-block rounded-[10px] bg-gold px-2.5 py-0.5 text-[11px] font-extrabold text-black">{ROLE[p.role]}</span>
        )}
        <RankBadge level={p?.rank_level} role={p?.role} />
      </div>
      {(p?.role === "admin" || p?.role === "moderator") && <Link href="/admin" className="mt-3 inline-block rounded-3xl bg-brand px-5 py-2 text-[13px] font-bold">Buka dashboard</Link>}

      <div className="my-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-[14px] bg-card p-3.5 text-center">
            <b className="block text-[22px] text-gold">{v}</b>
            <small className="text-mute">{l}</small>
          </div>
        ))}
      </div>

      <div className="mb-4"><RankCard xp={xp} today={todayXp} /></div>

      <div className="mb-4 grid gap-2">
        <Link href="/profil/prestasi" className="flex items-center gap-3 rounded-[14px] border border-line bg-card p-3.5 transition hover:border-brand">
          <div className="min-w-0 flex-1">
            <b className="block text-[15px]">Prestasi</b>
            <small className="text-mute">
              {ach.error ? "Belum tersedia" : `${unlocked.length} dari ${ach.data.length} badge terbuka`}
            </small>
          </div>
          <div className="flex -space-x-2">
            {unlocked.slice(0, 4).map((a) => (
              <span key={a.code} className="rounded-2xl ring-2 ring-card"><BadgeIcon icon={a.icon} tier={a.tier} unlocked size={34} /></span>
            ))}
          </div>
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/profil/statistik" className="rounded-[14px] border border-line bg-card p-3.5 transition hover:border-brand">
            <b className="block text-[15px]">Statistik</b>
            <small className="text-mute">Streak dan genre favorit</small>
          </Link>
          <Link href="/koleksi" className="rounded-[14px] border border-line bg-card p-3.5 transition hover:border-brand">
            <b className="block text-[15px]">Koleksi</b>
            <small className="text-mute">Daftar komik favoritmu</small>
          </Link>
        </div>
      </div>

      <ProfileEditor userId={me.id} displayName={p?.display_name ?? p?.username ?? ""} bio={p?.bio ?? ""} avatarUrl={p?.avatar_url ?? null} />
    </div>
  );
}
