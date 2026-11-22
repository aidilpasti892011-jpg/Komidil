import { hasSupabaseEnv } from "@/lib/utils";

// Pesan jujur saat database belum tersambung / kosong / error. Tidak ada data palsu.
export default function EmptyState({ error }: { error: string | null }) {
  if (!hasSupabaseEnv()) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5 text-sm">
        <h2 className="mb-1 text-base font-bold text-gold">Database belum tersambung</h2>
        <p className="text-mute">
          Salin <code>.env.example</code> jadi <code>.env.local</code>, isi URL dan anon key dari Supabase,
          lalu restart <code>npm run dev</code>. Detail ada di README.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-brand/50 bg-card p-5 text-sm">
        <h2 className="mb-1 text-base font-bold text-brand">Gagal memuat data</h2>
        <p className="text-mute">
          Pastikan semua migrasi (0001 sampai 0010) dan <code>seed.sql</code> sudah dijalankan. Pesan: {error}
        </p>
      </div>
    );
  }
  return <p className="py-8 text-center text-mute">Tidak ada komik yang cocok.</p>;
}
