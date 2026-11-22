Kamu senior full-stack developer + UI/UX designer. Lanjutkan proyek KOMIDIL
(website baca manhwa/manhua/manga, "Your World of Comics"). Jawab bahasa
Indonesia santai. JANGAN pakai emoji sama sekali (ikon pakai SVG). Logo asli
di public/logo.svg.

KONTEKS (terlampir komidil-tahap12.zip; kalau tidak bisa dibuka, minta user
menempel file yang dibutuhkan)
Langkah 1-9 dan TAHAP 9-12 (fitur) SUDAH SELESAI DITULIS (belum pernah dijalankan dengan npm/Postgres):
- Stack: Next.js 15 App Router + TypeScript + Tailwind 3 + @supabase/ssr. Tanpa
  service-role key: semua pakai sesi + RLS.
- Migrasi berurutan di supabase/migrations: 0001 schema, 0002 admin email, 0003 Google
  login, 0004 komunitas, 0005 admin, 0006 rank_ranking, 0007 follow_notifikasi, 0008 pencarian, 0009 jadwal, 0010 untukmu_prestasi, 0011_tahap12_security_hardening, 0012_admin_only_moderation.
- 0006: profiles.rank_level (generated dari xp; ambang di src/lib/ranks.ts HARUS sama),
  xp_rules + xp_events (ledger, unique per user/kind/src/actor), award_xp/revoke_xp/
  restore_xp (internal), trigger XP post/komentar/review/like + cabut XP saat konten
  dihapus/disembunyikan, track_chapter_view (RPC, 1 view per user/sesi per chapter per hari
  WIB, batas anonim 60/jam/IP), claim_chapter_xp (RPC lama; dinonaktifkan oleh 0011 karena memakai timestamp chapter_views),
  my_xp_summary, comic_view_hourly, comic_rankings (daily/weekly/monthly) + refresh_rankings
  via pg_cron tiap 15 menit, comics.pop_score untuk sort "Terpopuler", prune_view_data,
  admin_refresh_rankings. Trigger chapters_stats sekarang hanya jalan saat kolom
  relevan berubah (bukan tiap view).
- UI: Home (hero, tab ranking, rekomendasi, baris Webtoon, update terbaru), /ranking, /komik
  (filter tipe incl. webtoon, sort Terpopuler), detail, reader (hitung view + klaim XP +
  toast), /profil (RankCard), komunitas dan komentar (RankBadge), /admin (tombol refresh
  ranking), loading.tsx untuk Home/komik/detail/reader/komunitas/admin + loader huruf K +
  splash CSS. Home dipindah ke src/app/(home)/page.tsx.
- Tahap 9 (0007): comic_follows (notify per komik, maks 300/akun), comics.follower_count,
  notifications.chapter_id (unique per user+chapter), chapters.notified_at, notify_chapter()
  (klaim atomik, hanya chapter terbaru), trigger chapters_notify, notify_due_chapters() via
  pg_cron 5 menit, prune_notifications(). UI: ContinueReading di Home (src/lib/continue.ts),
  tombol Ikuti + Notif aktif/mati di ComicActions, tab Diikuti di /pustaka, /notifikasi/buka/[id]
  (tandai dibaca + redirect aman).
- Tahap 10 (0008): pg_trgm, comics.search_text (trigger; judul+alt+author+artist), RPC
  search_comics (SECURITY INVOKER; filter tipe/status/rating min/genre ganda any|all, sort
  rel|up|pop|r|az|new|fol, total hasil) dan suggest_comics. TS: parseSearch + searchComics di
  src/lib/comics.ts (fallback ke getComics kalau 0008 belum jalan). UI: KomikFilters (saran,
  pencarian terakhir di localStorage, genre multi sampai 5, reset), /komik menampilkan total hasil.
  Sort baru "fol" dan "rel" ada di src/lib/types.ts.
- Tahap 11 (0009): RPC release_schedule (SECURITY DEFINER, hanya metadata; digabung per komik per hari WIB;
  maks 8 hari, 300 baris). TS: src/lib/schedule.ts (getSchedule, wibDay, dayTitle, releaseTime, timeUntil).
  UI: /jadwal (tab Hari ini/Besok/Minggu ini, filter Yang kuikuti), ScheduleRow, bagian "Rilis Hari Ini" di Home,
  link Jadwal di nav atas. Reader Premium (src/components/Reader.tsx, ReaderSettings.tsx, src/lib/reader-settings.ts):
  mode scroll/halaman (zona ketuk, keyboard, RTL), lebar, kecerahan, auto lanjut chapter (hitung mundur 6 detik),
  lanjut dari halaman terakhir (resume dari reading_history, dibaca di page.tsx reader), toolbar auto-sembunyi,
  placeholder tinggi dari chapter_images.width/height. ReaderImage kini punya w/h.
- Tahap 12 (0010): reading_log, 18 badge, statistik WIB, recommend_for_me, koleksi (maks 20/100) dan RLS.
  Tahap 12 hardening (0011): helper koleksi dipisah shared/server; sesi baca unik dibuat database, progres dicatat sebagai
  checkpoint, completion atomik mengunci sesi dan memproses XP + reading_log + badge; RPC lama berbasis chapter_views
  dinonaktifkan; update langsung `profiles.xp` dijaga trigger dan hanya jalur ledger internal yang dapat menulis XP; semua fungsi `SECURITY DEFINER` diberi search_path aman; `reading_history.reached_latest_chapter` memisahkan posisi chapter terbaru dari status seri; `is_finished` hanya true jika komik resmi completed, chapter terbit terbaru, progres history >=95%,
  dan `reading_log.max_progress` >=95% yang dicatat server-side melalui RPC (tetap berasal dari progres browser, bukan bukti perhatian manusia); create koleksi dikunci per profil dan increment item_count atomik. Log lama dimulai dari max_progress 0 karena tidak ada bukti sesi historis.
  UI: ForYou di Home, /untukmu, /profil/statistik, /profil/prestasi, /koleksi, /koleksi/[id], CollectionPicker di ComicActions,
  tile di /profil, tab Koleksi di /pustaka, toast badge di Reader (desain tidak diubah).
- Tahap 13 (0012): seluruh tindakan moderasi, status laporan, hide/pin/lock/delete konten orang lain dan pengumuman hanya untuk satu Super Admin; moderator tidak bisa melakukan tindakan moderasi. Nilai role database tetap `admin`, label tampil `Super Admin`.
- Dokumen: README.md (ringkasan + aturan XP) dan DEPLOY.md (Vercel + Supabase, checklist).

YANG BELUM / CATATAN JUJUR
- Instalasi dependensi dan pengujian typecheck/build/SQL tidak tersedia pada lingkungan audit ini (registry npm tidak dapat
  diakses; Postgres/Supabase CLI/Docker tidak ada). Jalankan checklist `supabase/tests/0011_regression_checklist.md`.
- Durasi sesi divalidasi memakai waktu database, tetapi progres gambar tetap dilaporkan browser; sistem tidak dapat
  membuktikan secara kriptografis bahwa pengguna benar-benar melihat gambar.
- Notifikasi banyak chapter sekaligus belum digabung; belum ada push/email.
- Pencarian memindai tabel (OK sampai ribuan judul); belum ada abaikan-aksen / FTS multibahasa.
- Reader: pengaturan hanya di browser (tidak ikut akun); mode halaman belum bisa spread dua halaman; resume scroll
  bergantung gambar sebelum posisi selesai dimuat (ada timeout 6 detik). Jadwal: belum ada kalender bulanan.
- Tahap 12: koleksi hanya pribadi; badge non-baca terbuka saat halaman dibuka (bukan trigger); rekomendasi sederhana (tanpa
  collaborative filtering); statistik tanpa waktu baca.
- Belum ada: halaman profil publik, kebijakan privasi/ToS/takedown, tes otomatis, backfill XP.

IDENTITAS: hitam #090909, kartu #171717, merah #D71920, kuning #FFC629, abu
#929292. Sinematik, gelap, premium, kartu rounded, mobile-first (Android).

ATURAN
- Jangan pura-pura login atau simpan data berhasil. Semua lewat Supabase asli.
- Konten hanya milik uploader atau berlisensi. Jangan scrape/copy dari situs
  lain. Cover placeholder.
- Password jangan plain text, secret/service-role key jangan di frontend,
  validasi semua input (server-side).
- Kerjakan bertahap, tiap tahap harus bisa dijalankan.
- Kalau mau kena limit: LANGSUNG kasih semua file (zip atau tiap file lengkap
  dengan path), jelaskan sudah/belum, lalu tulis prompt lanjut baru seperti ini.

TAHAP BERIKUTNYA (urutan yang disepakati; desain sekarang tetap acuan, jangan dirombak)
- Sebelum rilis publik: privasi, ToS, kontak takedown, halaman profil publik.
Prinsip: KOMIDIL harus terasa seperti platform baca komik sungguhan, bukan website penuh tombol.

MULAI SEKARANG: kerjakan tahap rilis publik (privasi, ToS, kontak takedown, profil publik + koleksi publik opsional), lalu tes otomatis dan backfill.
