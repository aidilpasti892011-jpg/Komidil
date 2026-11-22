# KOMIDIL Tahap 12 — Audit & Bug Fix

Tanggal paket: 22 November 2026  
Stack/desain dipertahankan: Next.js 15 App Router, TypeScript, Tailwind CSS 3, Supabase, `@supabase/ssr`.

## Temuan dan perbaikan

### Client/Server boundary

- Helper murni `cleanName`, `cleanDesc`, dan konstanta batas dipindah ke `src/lib/collections-shared.ts`.
- Komponen client dan Server Action koleksi mengimpor helper shared; `src/lib/collections.ts` diberi `import "server-only"` dan tetap menjadi tempat query server.
- Pemeriksaan statis import client/server tidak menemukan komponen `use client` yang mengimpor modul koleksi server, Supabase server client, atau `next/headers`.

### Statistik, status chapter, dan status seri tamat

- `reading_log` sekarang memiliki `max_progress`, yang hanya dinaikkan melalui RPC sesi baca setelah syarat sesi tervalidasi.
- `reading_history.reached_latest_chapter` memisahkan posisi chapter terbaru dari status tamat seri.
- `reading_history.is_finished` hanya benar untuk komik resmi `completed`, chapter terbit terbaru, `reading_history.progress >= 95%`, serta `reading_log.max_progress >= 95%` dari sesi tervalidasi.
- Trigger menyegarkan flag ketika log baca, status publikasi komik, atau chapter berubah. Riwayat lama yang tidak mempunyai bukti progres baru tidak diberi nilai progres terverifikasi secara retroaktif.

### XP dan reading log

- `start_reading_session()` membuat UUID sesi unik dan timestamp di database; sesi terikat ke user/chapter/comic dan kedaluwarsa.
- `record_reading_progress()` memvalidasi pemilik, masa aktif, akun tidak disuspend, status konten, dan keberadaan gambar; nilai progres tersimpan secara monotonik.
- `complete_reading_session()` mengunci sesi, memvalidasi umur >=30 detik, checkpoint progres >=60% yang diperbarui di bagian akhir sesi, konten yang masih publik, serta completion sekali pakai. Pembuatan reading log, XP, sinkronisasi `reading_history.progress`, dan badge dilakukan dalam satu transaksi; checkpoint lanjutan juga menyelaraskan progress history setelah sesi tervalidasi.
- `chapter_views` tetap menjadi data view count, bukan timestamp bukti durasi XP. RPC klaim lama tetap ada dengan hasil nol dan EXECUTE dicabut.
- `profiles.xp` dilindungi trigger tambahan: perubahan langsung ditolak, termasuk oleh admin melalui API. `award_xp`, `revoke_xp`, dan `restore_xp` memakai marker transaksi internal dan mempertahankan ledger, unique event, batas 100 XP baca/hari, serta batas total 150 XP/hari.
- Semua fungsi `SECURITY DEFINER` yang sudah ada di schema `public` disetel ke `search_path = pg_catalog, public, pg_temp`. Role API tidak mendapat hak `CREATE` pada schema `public`.

### Koleksi

- Pembuatan koleksi mengunci row `profiles` milik pengguna sebelum menghitung koleksi; operasi bersamaan untuk akun sama diserialisasi sehingga maksimal 20.
- Insert item mengunci row koleksi, memeriksa duplikasi dan batas 100, lalu menaikkan `item_count` dalam transaksi yang sama. Kegagalan insert me-rollback perubahan counter.
- Delete item memperbarui counter melalui trigger; primary key `(collection_id, comic_id)` dan RLS kepemilikan tetap berlaku.

## File diubah

- `package.json`
- `src/app/koleksi/actions.ts`
- `src/components/CollectionForms.tsx`
- `src/components/CollectionPicker.tsx`
- `src/components/Reader.tsx`
- `src/lib/collections.ts`
- `README.md`
- `DEPLOY.md`
- `PROMPT-LANJUT.md`

## File ditambahkan

- `src/lib/collections-shared.ts`
- `supabase/migrations/0011_tahap12_security_hardening.sql`
- `supabase/tests/0011_regression_checklist.md`
- `CHANGES-STAGE12.md`

## Migration dan urutan deploy

Jalankan migration `0011_tahap12_security_hardening.sql` setelah `0010_untukmu_prestasi.sql` dan **sebelum** deploy frontend Reader yang baru. Migration lama `0001`–`0010` tidak diubah. Migration 0011 tidak memerlukan konfigurasi Supabase tambahan atau service-role key di frontend.

## Pengujian di lingkungan audit ini

- ZIP berhasil diekstrak; struktur proyek, helper koleksi, Reader, dan migration `0001`–`0010` diperiksa.
- Pemeriksaan statis import Client/Server: lulus untuk komponen client yang diaudit.
- Logo `public/logo.svg` dan file CSS/layout tidak diubah.
- `npm install` gagal karena DNS/akses ke `registry.npmjs.org` (`EAI_AGAIN`). Dependensi tidak tersedia, sehingga `npm run typecheck`, `npm run lint`, dan `npm run build` **belum teruji secara sah**.
- `psql`, Supabase CLI, dan Docker tidak tersedia. Migration 0011 belum dijalankan ke database nyata; RPC, RLS, trigger, XP cap, dan pengujian konkurensi belum dapat dinyatakan lulus. Jalankan checklist `supabase/tests/0011_regression_checklist.md` di Supabase staging.

## Batas keamanan progres

Waktu mulai dan durasi dihitung database; session ID dibuat database, terikat ke pemilik, kedaluwarsa, dan hanya dapat menyelesaikan XP sekali. Namun angka progres visual tetap dilaporkan browser. Pengguna yang memodifikasi browser masih dapat mengirim nilai progres palsu setelah memenuhi durasi minimum. Mekanisme ini mencegah replay sederhana dan memperkuat validasi, tetapi tidak membuktikan secara kriptografis bahwa gambar benar-benar tampil atau dibaca. Data `reading_log` lama mendapat `max_progress=0` karena progres historis tidak dapat diverifikasi ulang; status tamat lama yang tidak memenuhi bukti baru akan dihitung ulang menjadi belum tamat sampai dibaca ulang.

## Menjalankan proyek

```bash
cp .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# dan NEXT_PUBLIC_SITE_URL.
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

Lihat `DEPLOY.md` untuk konfigurasi Supabase/Vercel, urutan migration, dan tes staging sebelum rilis.
