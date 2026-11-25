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
  { level: 0, name: "Culun", min: 0, tone: "bg-line text-mute" },
  { level: 1, name: "Pemula", min: 100, tone: "bg-[#2e2e2e] text-white" },
  { level: 2, name: "Pendatang", min: 300, tone: "bg-[#164e63] text-cyan-100" },
  { level: 3, name: "Aktif", min: 700, tone: "bg-blue-900 text-blue-100" },
  { level: 4, name: "Terkenal", min: 1500, tone: "bg-purple-900 text-purple-100" },
  { level: 5, name: "Veteran", min: 3000, tone: "bg-slate-600 text-white" },
  { level: 6, name: "Elite", min: 5000, tone: "bg-yellow-700 text-yellow-100" },
  { level: 7, name: "Legenda", min: 8000, tone: "bg-gradient-to-r from-purple-700 to-yellow-500 text-white" },
  { level: 8, name: "Hunter", min: 15000, tone: "bg-red-900 text-red-100" },
  { level: 9, name: "Sepuh", min: 30000, tone: "bg-gradient-to-r from-yellow-500 to-amber-200 text-black" },
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
