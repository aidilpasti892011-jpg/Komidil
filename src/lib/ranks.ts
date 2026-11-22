// Rank pembaca. Dihitung di database (kolom profiles.rank_level dari xp).
// Ambang di sini HARUS sama dengan supabase/migrations/0006_rank_ranking.sql.
export type RankInfo = {
  level: number;
  name: string;
  min: number;
  /** kelas Tailwind untuk badge */
  tone: string;
};

export const RANKS: RankInfo[] = [
  { level: 0, name: "New Reader", min: 0, tone: "bg-line text-mute" },
  { level: 1, name: "Reader", min: 100, tone: "bg-[#2e2e2e] text-white" },
  { level: 2, name: "Active Reader", min: 400, tone: "bg-[#2a2209] text-gold" },
  { level: 3, name: "Dedicated Reader", min: 1200, tone: "bg-gold text-black" },
  { level: 4, name: "Elite Reader", min: 3500, tone: "bg-brand text-white" },
  { level: 5, name: "Legendary Reader", min: 10000, tone: "bg-gradient-to-r from-brand to-gold text-black" },
];

/** Batas total XP per hari (semua jenis). Samakan dengan day_cap di award_xp(). */
export const DAILY_XP_CAP = 150;

/** Penjelasan aturan XP untuk UI. Angka mengikuti tabel xp_rules. */
export const XP_RULES: { label: string; text: string }[] = [
  { label: "Baca chapter", text: "10 XP, sekali per chapter, maks 100 XP per hari" },
  { label: "Buat post", text: "15 XP, maks 3 post per hari (isi minimal 30 karakter)" },
  { label: "Komentar", text: "5 XP, maks 10 komentar per hari (minimal 8 karakter)" },
  { label: "Review", text: "20 XP, sekali per komik, maks 2 per hari (isi minimal 20 karakter)" },
  { label: "Like diterima", text: "1 XP per like dari akun lain, maks 20 XP per hari" },
];

export function rankByLevel(level: number | null | undefined): RankInfo {
  const l = Number.isInteger(level) ? Math.min(Math.max(level as number, 0), RANKS.length - 1) : 0;
  return RANKS[l];
}

export function rankInfo(xp: number) {
  let cur = RANKS[0];
  for (const r of RANKS) if (xp >= r.min) cur = r;
  const next = RANKS[cur.level + 1] ?? null;
  const progress = next ? Math.min(1, (xp - cur.min) / (next.min - cur.min)) : 1;
  return { current: cur, next, progress, remaining: next ? Math.max(0, next.min - xp) : 0 };
}
