# KOMIDIL Tahap 13 — Penguncian Moderasi Super Admin

## Sasaran
Menyesuaikan kewenangan dengan ketentuan pemilik: satu akun Super Admin menjadi satu-satunya pihak yang dapat mengelola komik/chapter, melakukan suspend pengguna, memproses laporan, dan melakukan tindakan moderasi komunitas.

## Perubahan
- Menambahkan `0012_admin_only_moderation.sql` untuk membatasi RLS dan trigger moderasi ke `public.is_admin()`.
- Moderator tidak dapat mengubah flag hidden/pinned/locked, memproses status laporan, atau menghapus konten milik orang lain.
- Pengguna biasa tetap dapat mengedit/menghapus kontennya sendiri; Super Admin dapat mengelola seluruh konten.
- Semua fungsi moderation server action memeriksa role admin di server.
- UI antrean laporan dan tombol moderasi hanya tersedia untuk Super Admin.
- Label UI role `admin` ditampilkan sebagai `Super Admin`; nilai role database tetap `admin` untuk mempertahankan migrasi yang telah ada.
- Google login memakai SVG logo Google resmi yang sudah ada. Profile editor mendukung ganti avatar melalui bucket `avatars` (JPG/PNG/WebP, maksimum 2 MB).

## Yang tetap sama
Desain, warna, logo, navigasi utama, dan fitur pembaca tidak dirombak.

## Deploy
Jalankan migration `0012_admin_only_moderation.sql` setelah `0011_tahap12_security_hardening.sql`. Untuk project Supabase yang benar-benar baru, jalankan `0001` sampai `0012` satu kali dan berurutan. Jangan jalankan `seed.sql` untuk produksi.

## Status pengujian
Pemeriksaan statis source dilakukan setelah perubahan. Build Next.js, typecheck lengkap dengan dependency, eksekusi SQL pada Supabase, dan uji perilaku RLS tetap harus dilakukan pada project staging; belum boleh dianggap lulus sebelum hasil nyata diperiksa.
