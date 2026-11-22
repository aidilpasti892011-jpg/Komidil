# Panduan Deploy KOMIDIL (Vercel + Supabase)

Urutan kerja: Supabase dulu (database, storage, auth), lalu Vercel, lalu domain, lalu checklist keamanan.
Semua langkah memakai dashboard, tanpa service-role key.

## 0. Yang perlu disiapkan
- Akun GitHub (repo berisi folder proyek ini), akun Vercel, akun Supabase.
- Akun Google (untuk Google Cloud Console, login Google).
- Node.js 20 atau lebih baru untuk tes lokal (`npm install`, `npm run typecheck`, `npm run build`). ZIP ini belum menyertakan `package-lock.json`; setelah `npm install`, simpan `package-lock.json` ke Git agar versi dependency konsisten.
- Saran: tes build lokal dulu. Kode ini belum pernah dijalankan di lingkungan dengan npm dan Postgres saat ditulis,
  jadi anggap `npm run typecheck` dan `npm run build` sebagai langkah wajib sebelum deploy.

## 1. Supabase

### 1.1 Buat project
1. https://supabase.com > New project. Pilih region Singapore (`ap-southeast-1`) supaya dekat dengan pengguna Indonesia.
2. Simpan database password di password manager. Aplikasi tidak memakainya.
3. Project Settings > API Keys: catat **Project URL** dan **Publishable key** (`sb_publishable_...`). Source ini masih memakai nama env `NEXT_PUBLIC_SUPABASE_ANON_KEY`, jadi masukkan nilai Publishable key ke variabel tersebut tanpa mengubah namanya. Jangan salin `secret` atau `service_role` key.

### 1.2 Jalankan migrasi (SQL Editor, berurutan, masing-masing sekali)
| Urutan | File | Isi |
|---|---|---|
| 1 | `0001_schema.sql` | tabel, RLS, trigger, bucket Storage. Tidak bisa diulang (policy dan enum dibuat tanpa `if not exists`) |
| 2 | `0002_admin_email.sql` | admin tunggal berdasarkan email |
| 3 | `0003_google_login.sql` | profil otomatis dari akun Google |
| 4 | `0004_komunitas.sql` | anti-spam, polling, notifikasi |
| 5 | `0005_admin.sql` | role admin terkunci, `admin_stats()`, cron chapter terjadwal |
| 6 | `0006_rank_ranking.sql` | rank/XP, view_count aman, ranking, cron ranking |
| 7 | `0007_follow_notifikasi.sql` | ikuti komik, notifikasi chapter baru, cron notifikasi |
| 8 | `0008_pencarian.sql` | pencarian pintar (pg_trgm), filter genre ganda, saran judul |
| 9 | `0009_jadwal.sql` | RPC `release_schedule` untuk kalender rilis (/jadwal) |
| 10 | `0010_untukmu_prestasi.sql` | log baca, statistik, badge prestasi, rekomendasi Untukmu, koleksi |
| 11 | `0011_tahap12_security_hardening.sql` | sesi baca database, guard XP langsung, hardening SECURITY DEFINER, definisi seri tamat, batas koleksi atomik |
| 12 | `0012_admin_only_moderation.sql` | seluruh tindakan moderasi dan pemrosesan laporan dikunci ke Super Admin tunggal |

0004 sampai 0012 aman diulang. `0001_schema.sql` hanya dijalankan sekali. Jalankan 0011 setelah 0010 dan 0012 setelah 0011, sebelum deploy kode aplikasi terbaru. 0011 menonaktifkan RPC klaim baca lama berbasis `chapter_views`; jika kode baru dideploy tanpa migration ini, XP baca dan log baca tidak akan diberikan. Jangan jalankan `seed.sql` di produksi (data demo).

Kalau ada error, berhenti di file itu, salin pesan errornya, perbaiki, baru lanjut. Jangan lompat ke file berikutnya.

### 1.3 Ganti email admin (kalau bukan aidilpasti892011@gmail.com)
Email admin ditulis di `0002_admin_email.sql` (dua tempat). Ganti SEBELUM menjalankan file itu.
Kalau sudah terlanjur jalan: ubah email di fungsi `promote_owner_admin()` lalu jalankan ulang file tersebut.

### 1.4 Bucket Storage
`0001_schema.sql` sudah membuat tiga bucket publik. Cek di Storage:
- `covers` (maks 5 MB), `avatars` (2 MB), `chapters` (10 MB), semuanya hanya JPEG, PNG, WebP.
- Upload ke `covers` dan `chapters` hanya untuk admin. Upload ke `avatars` hanya ke folder milik user sendiri.
Kalau bucket belum muncul, jalankan ulang blok `STORAGE` di akhir `0001_schema.sql` (bagian `insert into storage.buckets`).

### 1.5 Pengaturan Auth
Authentication > Providers > Email:
- **Confirm email: AKTIF** (wajib; kalau mati, siapa pun bisa mendaftar dengan email admin lalu jadi admin).
- Minimum password length: 8 atau lebih.
Authentication > URL Configuration (isi setelah punya domain, lihat bagian 4):
- Site URL: `https://domain-kamu.com`
- Redirect URLs: `https://domain-kamu.com/auth/callback`

Email bawaan Supabase sangat dibatasi jumlah kirimnya dan hanya cocok untuk uji coba. Untuk rilis, pasang SMTP sendiri
(Authentication > Emails > SMTP Settings, misalnya Resend atau Brevo) supaya email konfirmasi dan reset password sampai.
Pertimbangkan juga CAPTCHA (Authentication > Attack Protection) untuk mengurangi pendaftaran massal.

### 1.6 pg_cron
1. Database > Extensions > aktifkan `pg_cron`.
2. SQL Editor: jalankan ulang `0005_admin.sql`, `0006_rank_ranking.sql`, dan `0007_follow_notifikasi.sql` (aman diulang) supaya job terpasang.
3. Cek dengan: `select jobname, schedule, active from cron.job;`
   Harus ada `komidil_scheduled_chapters` (tiap 5 menit), `komidil_rankings` (tiap 15 menit), `komidil_prune_views` (harian 03.00 WIB).
4. Riwayat jalan: `select * from cron.job_run_details order by start_time desc limit 10;`
Kalau pg_cron tidak tersedia di paket kamu, ranking tetap bisa dihitung manual lewat tombol "Refresh ranking sekarang" di /admin. Chapter yang dijadwalkan di masa depan baru mengirim notifikasi saat job `komidil_notify_due` jalan, jadi tanpa pg_cron notifikasinya hanya terkirim untuk chapter yang langsung terbit.

### 1.7 Jadikan akun kamu Super Admin
1. Daftar di situs dengan email admin (atau login Google dengan email itu).
2. Konfirmasi email. Trigger akan mengubah role jadi `admin` otomatis.
3. Cek: `select username, role from public.profiles where role = 'admin';` harus tepat satu baris. Di database, role ini bernama `admin` dan ditampilkan di aplikasi sebagai `Super Admin`.
Role admin tidak bisa diberikan lewat API/dashboard, dan database menolak admin kedua.
Moderator dapat ditambahkan dari /admin/user oleh Super Admin. Moderator tidak dapat melakukan moderasi, mengubah status laporan, mengelola komik/chapter, atau suspend akun; seluruh tindakan tersebut hanya untuk Super Admin.

### 1.8 Login Google
1. Google Cloud Console > buat project > APIs & Services > OAuth consent screen: isi nama aplikasi, email dukungan, scope default (email, profile, openid).
2. Credentials > Create credentials > OAuth client ID > Web application.
   - **Authorized redirect URIs**: `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
     (salin persis dari Supabase > Authentication > Providers > Google).
   - Authorized JavaScript origins tidak diperlukan untuk alur lewat Supabase.
3. Salin Client ID dan Client Secret. Tempel keduanya di Supabase > Authentication > Providers > Google, aktifkan, simpan.
   Client Secret hanya ada di dashboard Supabase, jangan di kode, `.env`, atau Vercel.
4. Di OAuth consent screen, ubah status dari **Testing** ke **In production**. Selama Testing, hanya test user yang bisa login
   dan sesi kadaluarsa tiap 7 hari. Scope dasar (email, profile) tidak butuh verifikasi Google.

## 2. Vercel

1. Push proyek ke GitHub (pastikan `.env.local` tidak ikut; `.gitignore` sudah mengecualikannya).
2. Vercel > Add New > Project > pilih repo. Framework Preset: Next.js (terdeteksi otomatis). Root Directory: folder proyek.
3. Environment Variables (Production, dan Preview kalau dipakai):

| Nama | Nilai |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari 1.1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key dari 1.1 |
| `NEXT_PUBLIC_SITE_URL` | `https://domain-kamu.com` (tanpa garis miring di akhir) |

   Variabel `NEXT_PUBLIC_*` dibaca saat build. Setelah mengubahnya, **Redeploy**.
   `NEXT_PUBLIC_SITE_URL` wajib diisi di produksi; kalau kosong, link reset password dan redirect login jatuh ke `http://localhost:3000`.
4. Settings > Functions > Function Region: pilih Singapore (`sin1`) supaya satu wilayah dengan Supabase.
5. Deploy. Buka URL `*.vercel.app` dan cek Home tampil (kalau muncul "Database belum tersambung", env belum terbaca; redeploy).

## 3. Sambungkan Supabase ke URL Vercel
Sebelum domain kustom siap, pakai URL Vercel dulu:
- Supabase > Authentication > URL Configuration: Site URL = `https://<nama>.vercel.app`, Redirect URLs tambah `https://<nama>.vercel.app/auth/callback`.
- Untuk tes lokal tambahkan juga `http://localhost:3000/auth/callback` (hapus setelah rilis kalau tidak dipakai).
- Tes: daftar akun baru, cek email konfirmasi masuk dan linknya kembali ke situs, tes login Google, tes lupa password.

## 4. Domain kustom
1. Vercel > Project > Settings > Domains > Add. Masukkan `domain-kamu.com` dan `www.domain-kamu.com`.
2. Atur DNS di penyedia domain sesuai nilai yang ditampilkan Vercel (A record untuk apex, CNAME untuk `www`). Tunggu status Valid, SSL otomatis.
3. Pilih satu domain utama; yang lain dialihkan (redirect) oleh Vercel.
4. Perbarui di tiga tempat, lalu redeploy:
   - Vercel env `NEXT_PUBLIC_SITE_URL` = `https://domain-kamu.com`
   - Supabase Site URL = `https://domain-kamu.com`
   - Supabase Redirect URLs: `https://domain-kamu.com/auth/callback` (dan versi `www` kalau dipakai)
5. Google Cloud Console tidak perlu diubah karena redirect URI-nya milik Supabase, bukan domain kamu.
6. Hapus URL `*.vercel.app` dan `localhost` dari Redirect URLs kalau sudah tidak dipakai.

## 5. Checklist keamanan sebelum rilis

### Data dan akun
- [ ] Data demo dihapus. Jalankan:
  ```sql
  delete from public.comics where rights_note = 'Data demo KOMIDIL, bukan karya nyata';
  select public.refresh_rankings();
  select count(*) from public.comics where rights_note like 'Data demo%';  -- harus 0
  ```
  Genre dari seed boleh dipertahankan atau dihapus dari /admin.
- [ ] Hanya satu admin: `select count(*) from public.profiles where role = 'admin';` harus 1.
- [ ] **Confirm email** aktif. Coba daftar dengan email baru: akun tidak bisa login sebelum konfirmasi.
- [ ] SMTP sendiri terpasang dan email konfirmasi masuk ke inbox (bukan spam).
- [ ] Google OAuth consent screen berstatus In production.

### Rahasia
- [ ] Di Vercel hanya ada tiga env di atas. Tidak ada `service_role`, tidak ada Client Secret Google.
- [ ] `.env.local` tidak ada di repo: `git log --all -- .env.local` kosong.
- [ ] Kalau pernah salah commit kunci, rotasi di Supabase (Settings > API) dan Google Cloud.

### RLS dites (WAJIB)
Semua tabel berstatus RLS aktif:
```sql
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;  -- harus kosong
```
Tes perilaku. Jalankan di SQL Editor (masing-masing dibungkus transaksi dan di-rollback). Ganti `<UUID-USER-BIASA>` dengan id user non-admin
(`select id from auth.users where email = '...'`).
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-USER-BIASA>","role":"authenticated"}', true);

-- 1. User biasa tidak boleh mengubah XP/role sendiri -> harus ERROR. Admin melalui API juga tidak boleh menulis XP langsung; hanya fungsi ledger internal yang boleh mengubahnya.
update public.profiles set xp = 999999 where id = '<UUID-USER-BIASA>';
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-USER-BIASA>","role":"authenticated"}', true);
-- 2. Tidak boleh menulis ledger XP / ranking / view -> harus ERROR permission denied
insert into public.xp_events (user_id, kind, src, amount) values ('<UUID-USER-BIASA>', 'read', gen_random_uuid(), 10);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-USER-BIASA>","role":"authenticated"}', true);
-- 3. Tidak boleh memanggil pemberi XP langsung -> harus ERROR permission denied for function
select public.award_xp('<UUID-USER-BIASA>', 'read', gen_random_uuid());
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID-USER-BIASA>","role":"authenticated"}', true);
-- 4. Tidak boleh mengubah view_count komik -> harus "UPDATE 0" (ditolak RLS)
update public.comics set view_count = 999999999;
rollback;

begin;
set local role anon;
-- 5. Anonim tidak boleh membaca ledger/privat -> harus kosong atau permission denied
select count(*) from public.xp_events;
select count(*) from public.private_settings;
rollback;
```
Tes dari aplikasi:
- [ ] Anonim: tidak bisa bookmark, komentar, atau like (diarahkan ke login). Bisa membaca chapter.
- [ ] User biasa: tidak bisa membuka `/admin` (404). Tidak bisa membuat Pengumuman.
- [ ] `reading_sessions` berstatus RLS aktif dan tidak memiliki policy untuk akses langsung; fungsi RPC authenticated saja yang dapat mengelolanya.
- [ ] User disuspend: tidak bisa posting, komentar, like, atau mendapat XP.
- [ ] Moderator: bisa sembunyikan komentar, tidak bisa mengubah role.
- [ ] Buka satu chapter dua kali di hari yang sama: `view_count` hanya naik 1 (`select view_count from comics where slug = '...'`).
- [ ] Baca satu chapter dengan progres minimal 60% dan sesi >30 detik: reading_log tercatat sekali; XP +10 bila batas harian masih tersedia. Klaim ulang / dua sesi paralel untuk chapter sama tidak menambah XP atau log.
- [ ] Coba klaim memakai session id milik akun lain, sesi kedaluwarsa, chapter disembunyikan, atau sesi berumur <30 detik: ditolak.
- [ ] Cap harian XP baca 100 dan total semua jenis 150 tetap berlaku.
- [ ] Komik `ongoing`/`hiatus` di chapter terbaru tidak menambah statistik seri tamat; komik `completed` baru dihitung setelah chapter terbit terbaru memiliki log baca valid dan progres >=95%.
- [ ] Coba buat lebih dari 20 koleksi melalui request paralel: total tetap <=20. Coba tambah 101 komik berbeda ke koleksi melalui request paralel: jumlah tetap <=100; duplikat ditolak. Jalankan ini hanya pada akun/komik uji.
- [ ] Posting lalu hapus: XP kembali berkurang. Batas harian 150 XP tidak terlewati.
- [ ] Setelah beberapa view, tekan "Refresh ranking sekarang" di /admin: /ranking terisi.

### Konten dan hukum
- [ ] Semua komik yang diunggah milik sendiri atau berlisensi; `rights_confirmed` dan `rights_note` terisi.
- [ ] Siapkan halaman kebijakan privasi, syarat layanan, dan kontak takedown (belum ada di proyek ini).
- [ ] Setelah rilis: pantau antrean /admin/laporan.

### Operasional
- [ ] Paket gratis Supabase menjeda project yang tidak aktif selama seminggu dan tanpa backup harian terjamin. Untuk rilis serius, pertimbangkan paket Pro (backup harian, tanpa jeda).
- [ ] Aktifkan notifikasi error di Vercel dan pantau Supabase > Logs.
- [ ] Cek `cron.job_run_details` seminggu setelah rilis untuk memastikan job ranking jalan.

## 6. Masalah umum
| Gejala | Penyebab | Solusi |
|---|---|---|
| "Database belum tersambung" di produksi | env tidak terbaca saat build | cek nama env, lalu Redeploy |
| Setelah login balik ke `localhost:3000` | `NEXT_PUBLIC_SITE_URL` kosong/salah | isi, lalu Redeploy; cek Site URL di Supabase |
| `redirect_uri_mismatch` di Google | redirect URI di Google beda dari milik Supabase | salin persis dari halaman Provider Google di Supabase |
| Email konfirmasi tidak datang | SMTP bawaan terbatas | pasang SMTP sendiri (1.5) |
| Komunitas error "column rank_level does not exist" | 0006 belum dijalankan | jalankan `0006_rank_ranking.sql` |
| Tombol Ikuti error "relation comic_follows does not exist" | 0007 belum dijalankan | jalankan `0007_follow_notifikasi.sql` |
| Pencarian tidak toleran typo / tidak ada saran judul | 0008 belum dijalankan | jalankan `0008_pencarian.sql` (halaman tetap jalan lewat jalur lama) |
| Untukmu / Statistik / Prestasi / Koleksi kosong atau error | 0010 belum dijalankan | jalankan `0010_untukmu_prestasi.sql` (Home tetap jalan, baris Untukmu disembunyikan) |
| Klaim XP/log baca gagal setelah update Reader | 0011 belum dijalankan | jalankan `0011_tahap12_security_hardening.sql` setelah 0010 |
| /jadwal menampilkan "Gagal memuat data" | 0009 belum dijalankan | jalankan `0009_jadwal.sql` (Home tetap jalan, bagian Rilis Hari Ini disembunyikan) |
| Ranking kosong | cron belum aktif atau belum ada view | tombol Refresh di /admin; cek `cron.job` |
| Gambar cover tidak muncul | env Supabase kosong saat build (`next.config.mjs` memakainya) | isi env, Redeploy |
| Admin tidak terdeteksi | email belum dikonfirmasi atau beda dengan `0002_admin_email.sql` | konfirmasi email, cek 1.3 dan 1.7 |
