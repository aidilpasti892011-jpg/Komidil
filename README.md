# KOMIDIL - Your World of Comics

Next.js 15 (App Router) + TypeScript + Tailwind 3 + Supabase. Desain sama dengan tahap 1,
tapi data sekarang dari database Supabase, bukan `data.js`.

## Isi tahap ini
- Langkah 1: `supabase/migrations/0001_schema.sql` (14 tabel + poll, RLS, trigger, Storage) dan `supabase/seed.sql` (data demo)
- Langkah 2: proyek Next.js; Home dan Komik (cari, filter tipe/genre/status, sort, muat lebih banyak) membaca dari Supabase
- Langkah 3: detail komik /komik/[slug] (bookmark butuh login dari langkah 5; link chapter ke reader langkah 4)
- Langkah 4: reader /komik/[slug]/[nomor] (scroll vertikal, prev/next, pilih chapter, progress, riwayat ke reading_history, layar penuh, lapor gambar rusak ke reports). Riwayat dan laporan butuh login (langkah 5).
- Langkah 5: login, register (konfirmasi email), lupa/reset password, profil (avatar, bio, statistik), pustaka (Bookmark, Riwayat, Lanjut Baca, Selesai)
- Komunitas: SELESAI (langkah 6). Jalankan juga supabase/migrations/0004_komunitas.sql
- Langkah 6-7: komunitas dan dashboard admin (lihat bagian di bawah)
- Langkah 8: rank + XP anti-abuse, view_count aman, ranking harian/mingguan/bulanan, Webtoon, skeleton + loader K
- Langkah 9: panduan deploy lengkap di [DEPLOY.md](./DEPLOY.md)
- Tahap 9 (fitur): Lanjutkan Membaca di Home, Ikuti komik, notifikasi chapter baru (lihat bagian di bawah)
- Tanpa emoji. Semua ikon SVG. Logo asli di `public/logo.svg`

## Cara jalanin
1. Buat project di https://supabase.com (gratis cukup).
2. Supabase > SQL Editor > New query:
   - tempel dan Run berurutan: `0001_schema.sql`, `0002_admin_email.sql`, `0003_google_login.sql`,
     `0004_komunitas.sql`, `0005_admin.sql`, `0006_rank_ranking.sql`, `0007_follow_notifikasi.sql`, `0008_pencarian.sql`, `0009_jadwal.sql`, `0010_untukmu_prestasi.sql`, `0011_tahap12_security_hardening.sql`
   - tempel isi `supabase/seed.sql` > Run (data demo; hapus sebelum rilis)
3. Supabase > Project Settings > API: salin Project URL dan anon public key.
4. Di folder proyek:
   ```
   cp .env.example .env.local     # isi 2 nilai tadi
   npm install
   npm run dev
   ```
   Buka http://localhost:3000
5. Cek tipe: `npm run typecheck`, cek build: `npm run build`

Kalau `.env.local` belum diisi, situs tetap jalan dan menampilkan pesan "Database belum tersambung" (tidak ada data palsu).

## Jadikan diri sendiri admin (nanti dipakai di langkah 7)
Register dulu (langkah 5), lalu di SQL Editor:
```sql
update public.profiles set role = 'admin' where username = 'USERNAME_KAMU';
```

## Keamanan
- Anon key aman di browser karena semua tabel dilindungi RLS.
- `SUPABASE_SERVICE_ROLE_KEY` rahasia, hanya server, jangan pakai awalan `NEXT_PUBLIC_`.
- User biasa tidak bisa ubah role/suspend/xp (trigger `protect_profile`).
- Password dikelola Supabase Auth (di-hash), tidak pernah disimpan oleh aplikasi ini.
- Input filter divalidasi whitelist di `src/lib/comics.ts`.

## Konten
Hanya konten milik uploader atau berlisensi. Kolom `comics.rights_confirmed` mencatat pernyataan itu.
Cover di data demo adalah placeholder.

## Catatan jujur
Tahap ini ditulis di lingkungan tanpa Postgres dan tanpa akses npm, jadi SQL dan kodenya belum
sempat dijalankan di sana. Kalau ada error saat `npm run build` atau saat menjalankan SQL, kirim pesan errornya.

## Admin tunggal (langkah 5)
Jalankan juga `supabase/migrations/0002_admin_email.sql`. Akun yang mendaftar dengan
`aidilpasti892011@gmail.com` otomatis menjadi Super Admin begitu emailnya dikonfirmasi, dan database
menolak admin kedua (unique index). WAJIB biarkan "Confirm email" aktif di
Supabase > Authentication > Providers > Email, kalau tidak, siapa pun bisa mendaftar dengan
email itu tanpa memilikinya dan langsung jadi admin.

Di Supabase > Authentication > URL Configuration: isi Site URL dengan NEXT_PUBLIC_SITE_URL dan
tambahkan `<SITE_URL>/auth/callback` ke Redirect URLs.

## Login Google (langsung, tanpa form)
1. Jalankan `supabase/migrations/0003_google_login.sql` (profil otomatis pakai nama + foto Google).
2. Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID > Web application.
   - Authorized redirect URI: `https://<PROJECT-REF>.supabase.co/auth/v1/callback` (salin persis dari
     Supabase > Authentication > Providers > Google).
   - Layar persetujuan (OAuth consent screen): isi nama app, email; scope default (email, profile, openid) cukup.
3. Supabase > Authentication > Providers > Google: aktifkan, tempel Client ID dan Client Secret.
4. Supabase > Authentication > URL Configuration: Site URL = NEXT_PUBLIC_SITE_URL, Redirect URLs tambah
   `<SITE_URL>/auth/callback` (untuk lokal juga `http://localhost:3000/auth/callback`).
Client Secret hanya diisi di dashboard Supabase, jangan di kode atau .env frontend.
Email Google sudah terverifikasi, jadi akun pemilik yang login lewat Google juga otomatis menjadi Super Admin.

## Komunitas (langkah 6)
Jalankan `supabase/migrations/0004_komunitas.sql` setelah 0001-0003. Isinya: kolom hitungan dan flag moderasi
dikunci dari API, batas posting (5 per 10 menit) dan komentar (6 per menit), balasan 1 tingkat, polling
(2-6 opsi, 1 suara per user, hitungan lewat trigger), dan notifikasi komentar/balasan (tabel `notifications`,
tampil di lonceng header dan /notifikasi).
Halaman: `/komunitas` (tab Semua, Pengumuman, Info Komik, Ruang Diskusi, Spoiler, Polling, Review),
`/komunitas/baru`, `/komunitas/[id]`, `/komunitas/review/baru`.
Moderasi sepenuhnya hanya oleh Super Admin: sembunyikan, tampilkan, pin, kunci, buka kunci, dan hapus konten. Laporan user masuk tabel `reports` (antrean moderasi ada di /admin/laporan dan hanya dapat diproses Super Admin). Hanya Super Admin yang bisa membuat Pengumuman.

## Admin dashboard (langkah 7)
1. Jalankan `supabase/migrations/0005_admin.sql`. File ini juga mengunci role admin (tidak bisa diberikan/dicabut lewat
   dashboard), membuat fungsi statistik `admin_stats()`, dan menjadwalkan pg_cron.
2. pg_cron: Supabase Dashboard > Database > Extensions > aktifkan `pg_cron`, lalu jalankan ulang 0005 supaya job
   `komidil_scheduled_chapters` (tiap 5 menit) terpasang. Tanpa ini chapter terjadwal tetap muncul di reader tepat waktu
   (RLS cek published_at), tapi jumlah chapter dan "update terbaru" di komik baru ikut diperbarui saat ada perubahan data.
3. Buka `/admin` (login sebagai aidilpasti892011@gmail.com). Moderator hanya dapat melihat Statistik; antrean laporan dan semua tindakan moderasi hanya dapat diakses Super Admin.
Tidak perlu service-role key: semua tulis pakai sesi admin + RLS + Storage policy bucket covers/chapters.
Fitur: komik (cover, genre, pernyataan hak/lisensi wajib), chapter (upload banyak gambar, urutan, jadwal terbit),
pengelolaan moderator dan suspend user, moderasi laporan khusus Super Admin, statistik, notifikasi (lonceng di header dan /notifikasi).

## Rank, ranking, dan view (langkah 8)
Jalankan `supabase/migrations/0006_rank_ranking.sql` setelah 0001-0005 (aman diulang).

**Rank** (kolom `profiles.rank_level`, dihitung database dari `xp`): New Reader 0, Reader 100, Active Reader 400,
Dedicated Reader 1.200, Elite Reader 3.500, Legendary Reader 10.000 XP. Badge tampil di profil, komentar, post, dan review.
Ambang yang sama ada di `src/lib/ranks.ts` (untuk progress bar). Kalau mengubah satu, ubah keduanya.

**XP** hanya ditulis fungsi/trigger `security definer` (tabel `xp_events` tidak bisa ditulis klien):
| Aksi | XP | Batas |
|---|---|---|
| Baca chapter | 10 | sekali per chapter seumur hidup, 100 XP baca per hari |
| Post (isi min. 30 karakter) | 15 | 45 XP per hari |
| Komentar (min. 8 karakter) | 5 | 50 XP per hari |
| Review (isi min. 20 karakter) | 20 | sekali per komik, 40 XP per hari |
| Like diterima | 1 | dari akun lain umur >= 1 hari, 20 XP per hari |

Batas total semua jenis: 150 XP per hari (reset 00.00 WIB). Konten yang dihapus atau disembunyikan moderator mencabut XP-nya
(dipulihkan kalau tampil lagi). Batas harian tetap menghitung XP yang sudah dicabut, jadi hapus-lalu-posting-ulang tidak menambah jatah.
Akun yang disuspend tidak mendapat XP. Perubahan `profiles.xp` langsung melalui API ditolak trigger database; hanya `award_xp`, `revoke_xp`, dan `restore_xp` yang dapat mengubahnya. Migration 0011 mengeraskan `search_path` fungsi `SECURITY DEFINER` serta mencabut hak `CREATE` schema `public` dari role API. Setelah migration 0011, XP baca memakai sesi database unik (`start_reading_session`, `record_reading_progress`, `complete_reading_session`); database memeriksa waktu mulai, durasi minimal 30 detik, checkpoint >=60%, kepemilikan, status konten, dan klaim satu kali. `chapter_views` hanya untuk view count. Nilai progres visual tetap berasal dari browser meskipun disimpan server-side, sehingga tidak dapat membuktikan secara kriptografis bahwa gambar benar-benar dilihat.

**View count**: Reader memanggil RPC `track_chapter_view`. Satu view per user (atau per sesi anonim) per chapter per hari (WIB).
Anonim juga dibatasi 60 view per jam per IP (hash IP berotasi harian, best effort lewat header gateway). Counter
`comics.view_count` dan `chapters.view_count` tidak bisa diubah klien.

**Ranking**: skor = (views + 5 x bookmark baru) x (0.8 + 0.4 x rating_bayes / 5) di jendela 24 jam / 7 hari / 30 hari.
Tabel `comic_rankings` di-refresh pg_cron tiap 15 menit (admin bisa menekan "Refresh ranking sekarang" di /admin).
Sort "Terpopuler" di /komik memakai `comics.pop_score` (skor 30 hari). Halaman: `/ranking`, plus bagian ranking di Home.

**Webtoon**: filter tipe di /komik dan baris khusus di Home (tampil kalau ada komik bertipe webtoon).

**Loading**: `loading.tsx` untuk Home, /komik, detail, komunitas, admin, reader; halaman lain memakai loader huruf K.
Splash logo K sekitar 1 detik hanya saat halaman dibuka penuh (murni CSS, hapus `<Splash />` di `layout.tsx` kalau tidak mau).

Catatan: komik/komunitas yang dibuat sebelum 0006 tidak mendapat XP mundur (tidak ada backfill).

## Tahap 9: Lanjutkan Membaca, Ikuti, Notifikasi
Jalankan `supabase/migrations/0007_follow_notifikasi.sql` setelah 0001-0006 (aman diulang).
- **Lanjutkan Membaca** (Home, di bawah hero, hanya saat login): komik terakhir yang dibaca. Progres < 95% lanjut di chapter yang sama; >= 95% membuka chapter berikutnya kalau sudah ada. Komik yang sudah habis dilewati.
- **Ikuti** (halaman detail): tabel `comic_follows` (terpisah dari bookmark), maksimal 300 per akun. Tombol "Notif aktif/mati" per komik. Pustaka punya tab "Diikuti" (diurutkan dari yang terbaru update). Jumlah pengikut di `comics.follower_count`.
- **Notifikasi chapter baru**: dibuat database, bukan klien. Trigger `chapters_notify` mengirim saat chapter dibuat atau baru dipublikasikan; chapter terjadwal dikirim job pg_cron `komidil_notify_due` tiap 5 menit. `chapters.notified_at` menjamin satu chapter hanya dikabarkan sekali, dan unique index `(user_id, chapter_id)` mencegah dobel. Chapter lama yang diunggah belakangan (nomornya lebih kecil dari chapter terbit tertinggi) tidak memicu notifikasi.
- Klik notifikasi lewat `/notifikasi/buka/[id]`: menandai dibaca lalu mengarahkan ke tautan (hanya path internal).
- Pembersihan harian: notifikasi sudah dibaca > 60 hari dan semua > 180 hari dihapus (`prune_notifications`).
- Batas yang diketahui: unggah banyak chapter sekaligus menghasilkan satu notifikasi per chapter per pengikut (belum digabung). Belum ada notifikasi push atau email, hanya lonceng di aplikasi.

## Tahap 10: Pencarian pintar dan filter lanjutan
Jalankan `supabase/migrations/0008_pencarian.sql` setelah 0001-0007 (aman diulang). Butuh ekstensi `pg_trgm` (otomatis dibuat; ada di Supabase).
- **Cari** di judul, judul alternatif, author, dan artist. Toleran salah ketik ringan (kesamaan trigram). Hasil diurutkan berdasarkan relevansi: judul persis, awalan judul, judul mengandung, lalu field lain.
- **Saran saat mengetik** (min. 2 huruf, RPC `suggest_comics`, maks 6) dan **pencarian terakhir** (disimpan di browser, maks 6, bisa dihapus).
- **Filter**: tipe, status, rating minimal (3+, 4+, 4.5+), dan genre ganda (sampai 5) dengan pilihan "harus cocok semua genre". Tombol "Reset filter" muncul saat ada filter aktif.
- **Urutan**: Update terbaru, Terpopuler, Rating tertinggi, A-Z, Baru ditambahkan, Paling banyak diikuti, dan Paling relevan (hanya saat ada kata kunci; jadi bawaan saat mencari).
- Semua filter ada di URL (`/komik?q=...&genre=action,fantasy&gm=all&rmin=4&sort=fol`), jadi bisa dibagikan. Nilai divalidasi whitelist di `parseSearch` dan lagi di SQL.
- Menampilkan jumlah hasil, dan pesan khusus kalau tidak ada hasil.
- Kalau 0008 belum dijalankan, halaman /komik tetap jalan lewat jalur lama (cari judul + satu genre).
- Batas yang diketahui: pencarian dengan kata kunci memindai tabel komik (cukup untuk ribuan judul). Kalau katalog jauh lebih besar, pindahkan ke indeks full-text. Pencarian belum mengabaikan aksen atau huruf Hanzi/Hangul secara khusus.

## Tahap 11: Reader Premium dan Jadwal Rilis
Jalankan `supabase/migrations/0009_jadwal.sql` setelah 0001-0008 (aman diulang). Reader Premium tidak butuh migrasi.

**Reader Premium** (tombol pengaturan di toolbar reader; disimpan di browser, tanpa akun):
- **Mode**: Scroll (gulir terus, untuk webtoon/manhwa) atau Halaman (satu gambar per layar). Mode halaman: ketuk 30% kiri/kanan untuk pindah, ketuk tengah untuk menu. Kalau gambar lebih tinggi dari layar, ketukan menggulir 85% layar dulu baru pindah halaman. Keyboard: panah, spasi, PageUp/PageDown. Opsi arah baca kanan ke kiri untuk manga.
- **Lebar gambar**: Sempit (520px), Sedang (720px), Lebar (960px), Penuh.
- **Kecerahan**: 40-100%, meredupkan gambar saja (bukan kecerahan layar).
- **Auto lanjut chapter**: di akhir chapter hitung mundur 6 detik (bisa dibatalkan) lalu buka chapter berikutnya. Hanya jalan setelah user benar-benar berinteraksi dan semua gambar selesai dimuat, jadi tidak loncat sendiri di chapter pendek.
- **Lanjut dari halaman terakhir**: kalau login dan chapter sama belum selesai (< 95%), reader melompat ke halaman terakhir, dengan tombol "Dari awal". Posisi dibaca dari `reading_history` di server.
- Toolbar otomatis sembunyi saat menggulir turun dan muncul saat menggulir naik; ketuk untuk menampilkan. Penunjuk halaman "3 / 24". Placeholder tinggi gambar memakai `chapter_images.width/height` kalau ada, sehingga lazy-load tidak lagi memuat semua gambar sekaligus dan posisi tidak loncat.
- Layar penuh dan lapor gambar rusak pindah ke panel pengaturan.

**Jadwal rilis** (`/jadwal`, bagian "Rilis Hari Ini" di Home, menu Jadwal di navigasi atas desktop; menu bawah mobile tetap 5 item):
- Tab Hari ini, Besok, Minggu ini (7 hari, dikelompokkan per hari). Filter "Yang kuikuti" untuk komik di `comic_follows`, ditandai ikon lonceng.
- Chapter terjadwal disembunyikan RLS dari publik, jadi kalender memakai RPC `release_schedule` (SECURITY DEFINER) yang hanya membuka metadata: komik, rentang nomor chapter, jam rilis. Judul chapter dan gambar tidak ikut bocor.
- Beberapa chapter dari satu komik di hari yang sama digabung jadi satu baris ("Chapter 12 sampai 15").
- Hari dan jam dihitung WIB (Asia/Jakarta). Jadwal dibuat admin lewat form chapter (pilihan "Jadwalkan").
- Batas yang diketahui: tidak ada tampilan kalender bulanan, maksimal 7 hari ke depan dan 300 baris. Jam di halaman dihitung saat dimuat, belum menyegarkan diri.

## Tahap 12: Untukmu, Statistik, Prestasi, Koleksi
Jalankan `supabase/migrations/0010_untukmu_prestasi.sql` setelah 0001-0009, lalu `0011_tahap12_security_hardening.sql` (keduanya aman diulang).

**Log baca (`reading_log`)**: satu baris per chapter per akun. Setelah 0011, sesi dibuat lewat `start_reading_session()` memakai timestamp database; checkpoint progres disimpan monotonik lewat `record_reading_progress()` pada sesi dan `reading_log.max_progress`; `complete_reading_session()` memvalidasi umur sesi >= 30 detik, progres >=60%, checkpoint di bagian akhir sesi, konten yang masih terbit, dan klaim XP satu kali. Setelah sesi tervalidasi, checkpoint juga diselaraskan ke progres `reading_history` agar perhitungan tamat dan badge memakai data yang konsisten. Log tetap tercatat walaupun XP harian sudah mencapai batas. Migrasi 0010 mengisi awal dari XP baca yang sudah ada. Klien tidak bisa menulis tabel ini.

**Untukmu** (Home, baris di bawah Lanjutkan Membaca, plus halaman `/untukmu`): RPC `recommend_for_me` (SECURITY INVOKER, RLS berlaku).
- Sinyal per komik: dibaca (ln(1+chapter), maks 3), ada di riwayat (+1, tamat +2), bookmark (+2), ikuti (+2), masuk koleksi (+1,5).
- Skor = 0,60 kecocokan genre + 0,15 kecocokan tipe + 0,15 popularitas (`pop_score`) + 0,10 rating (bayes). Komik yang sudah punya sinyal tidak direkomendasikan lagi. Alasan ditampilkan ("Karena kamu suka Action" atau "Lagi ramai dibaca").
- Belum ada sinyal sama sekali = tidak ada rekomendasi (baris disembunyikan, tidak ada data palsu). Kalau 0010 belum jalan, Home tetap normal.

**Statistik membaca** (`/profil/statistik`, RPC `my_reading_stats`): streak sekarang dan terbaik (hari WIB), total chapter, komik, komik tamat, chapter 30 hari terakhir, grafik 7 hari, genre favorit (top 5), jenis bacaan. Waktu baca tidak dilacak (tidak ada data yang bisa dipercaya untuk itu).

**Badge prestasi** (`/profil/prestasi`, tile di profil): 18 badge (tabel `achievements`, bisa ditambah lewat SQL): baca 1/10/100/500 chapter, 5/25 komik, streak 3/7/30 hari, tamatkan 1/5 komik, 10 bookmark, ikuti 5 komik, 1/5 koleksi berisi, 1 post, 10 komentar, 3 review. Dibuka server (`_sync_achievements`) dari data database; progres visual baca tetap memiliki batasan input browser yang dijelaskan di bawah; badge baru juga masuk notifikasi dan muncul sebagai toast di reader. Badge dari sumber selain baca (bookmark, post, dll.) terbuka saat kamu membuka halaman Prestasi/Profil atau menyelesaikan chapter berikutnya, bukan seketika.

**Koleksi favorit** (`/koleksi`, `/koleksi/[id]`, tombol Koleksi di halaman komik, tab Koleksi di Pustaka): maksimal 20 koleksi per akun dan 100 komik per koleksi (dijaga trigger atomik), nama unik per akun, ubah nama/deskripsi, hapus koleksi, keluarkan komik. Pembuatan koleksi mengunci profil per akun; penambahan item mengunci row koleksi sebelum pemeriksaan batas dan duplikasi, sehingga counter dan insert atomik. Koleksi bersifat pribadi (RLS: hanya pemilik).

Tiga status dipisahkan: (1) chapter dihitung sudah dibaca saat sesi valid lolos minimal 30 detik dan progres >=60%, lalu tercatat di `reading_log`; (2) `reading_history.reached_latest_chapter` menandai bahwa chapter pada riwayat adalah chapter terbit terbaru, baik seri `ongoing`, `hiatus`, maupun `completed`; (3) `reading_history.is_finished` hanya true bila status resmi komik `completed`, chapter terbaru tercapai, progres `reading_history` >=95%, dan `reading_log.max_progress` chapter itu >=95%. Nilai progres maksimum disimpan monotonik oleh RPC sesi, bukan dipercaya hanya dari row history. Data log lama yang tidak memiliki bukti progres sesi diberi nilai awal 0; status tamat lama yang tidak bisa diverifikasi ulang akan kembali false sampai chapter dibaca melalui sesi baru.

Batas keamanan yang diketahui: sesi dan durasi berasal dari database, tetapi angka progres visual tetap disampaikan browser. RPC membatasi manipulasi sederhana, menjaga monotonisitas progres, memerlukan sesi unik dan durasi, serta mencegah klaim ulang; sistem tidak dapat membuktikan secara kriptografis bahwa pengguna benar-benar melihat setiap gambar. Koleksi belum bisa dibagikan/publik; rekomendasi belum memakai teks sinopsis atau collaborative filtering; badge belum punya animasi buka; statistik belum punya rentang bulan/tahun. Lihat `CHANGES-STAGE12.md` dan `supabase/tests/0011_regression_checklist.md`.


## Penguncian moderasi Super Admin (migration 0012)

Jalankan `supabase/migrations/0012_admin_only_moderation.sql` setelah migration 0011. Migration ini memperketat RLS dan trigger: Moderator tidak dapat menyembunyikan, mengunci, menyematkan, menghapus konten orang lain, ataupun mengubah status laporan. Pengguna tetap dapat menghapus konten miliknya sendiri; Super Admin dapat mengelola seluruh konten.
