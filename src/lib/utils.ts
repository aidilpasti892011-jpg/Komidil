export function timeAgo(iso: string | null): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.max(0, Math.floor(diff / 3_600_000));
  if (h < 1) return "baru saja";
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  const m = Math.floor(d / 30);
  return m < 12 ? `${m} bulan lalu` : `${Math.floor(m / 12)} tahun lalu`;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
