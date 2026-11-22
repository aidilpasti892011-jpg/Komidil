# KOMIDIL 0011 — Regression & Concurrency Test Plan

Migration ini belum dieksekusi pada database di lingkungan build paket. Jalankan pada **Supabase staging** dengan akun dan data khusus uji. Jangan jalankan skenario create/delete massal pada akun pengguna produksi.

## A. Client/Server dan build

Dari root proyek:

```bash
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

Periksa juga bahwa `CollectionPicker.tsx` dan `CollectionForms.tsx` tidak mengimpor `src/lib/collections.ts`, `next/headers`, atau server Supabase client. `collections-shared.ts` harus tetap murni dan bebas dari environment/server imports.

## B. Audit hak akses SQL/RLS

Jalankan setelah seluruh migration 0001–0011:

```sql
-- Tidak boleh ada tabel public tanpa RLS.
select tablename
from pg_tables
where schemaname = 'public' and not rowsecurity;

-- reading_sessions wajib RLS aktif dan tidak punya policy untuk akses langsung.
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'reading_sessions';

select * from pg_policies
where schemaname = 'public' and tablename = 'reading_sessions';

-- Hanya role authenticated yang dapat menjalankan RPC sesi.
select p.proname, p.proconfig, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('start_reading_session', 'record_reading_progress', 'complete_reading_session');
```

Ekspektasi: RLS `reading_sessions` aktif, tidak ada policy akses langsung, dan konfigurasi function menampilkan `search_path=pg_catalog, public, pg_temp`. `anon`/`PUBLIC` tidak boleh memiliki EXECUTE pada RPC sesi. `claim_chapter_xp` dan `log_chapter_read` juga tidak boleh dapat dipanggil role authenticated.

```sql
-- Role API tidak boleh membuat objek di schema yang dipakai fungsi SECURITY DEFINER.
select has_schema_privilege('anon', 'public', 'CREATE') as anon_can_create,
       has_schema_privilege('authenticated', 'public', 'CREATE') as authenticated_can_create,
       has_schema_privilege('service_role', 'public', 'CREATE') as service_role_can_create;
-- Ketiganya harus false.

-- Tidak boleh ada SECURITY DEFINER publik yang tertinggal dengan search_path lama.
select n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid), p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and not (coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public, pg_temp']);
-- Hasil harus kosong.
```

## C. Sesi baca / XP / reading log

Dengan akun uji non-admin dan chapter yang terbit, memiliki gambar, dan berada pada komik publik:

1. Masuk halaman Reader. Pastikan RPC `start_reading_session` menghasilkan UUID unik baru pada setiap kunjungan.
2. Panggil `complete_reading_session` sebelum 30 detik: harus `accepted=false`, XP 0, log tidak bertambah, dan `reading_log.max_progress` lama tidak boleh naik walau client mengirim progres 0.95.
3. Buat sesi baru, tunggu lebih dari 30 detik, kirim checkpoint 0.60 atau lebih lewat `record_reading_progress`, lalu selesaikan. Harus maksimal satu row `reading_log` untuk pasangan user/chapter dan `max_progress` harus menyimpan nilai maksimum yang dilaporkan.
4. Selesaikan chapter yang sama melalui sesi kedua dan panggil completion berulang: XP dan reading_log tidak bertambah lagi.
5. Uji session id akun lain, UUID acak, session kedaluwarsa, dan completion ulang pada session yang sudah completed: semuanya ditolak. RPC progres pada sesi validated boleh menaikkan checkpoint sampai sesi expired tetapi tidak boleh memberi XP/log chapter kedua.
6. Sembunyikan/unpublish chapter atau comic sebelum completion: klaim ditolak. Ulangi pada chapter tanpa gambar: pembuatan/penyelesaian sesi ditolak. Sembunyikan konten setelah sesi valid lalu coba kirim checkpoint lanjutan: `record_reading_progress` harus menolak checkpoint tersebut.
7. Penuhi XP baca 100 per hari dan total XP 150 per hari: reading_log tetap bertambah untuk chapter berbeda yang valid, XP tidak melewati batas.
8. Jalankan dua completion secara bersamaan untuk session yang sama, lalu dua session berbeda pada chapter sama. Masing-masing pasangan harus menghasilkan maksimal satu log dan satu XP event baca.

Query verifikasi:

```sql
select user_id, chapter_id, count(*)
from public.reading_log
group by user_id, chapter_id
having count(*) > 1;

select user_id, kind, src, actor, count(*)
from public.xp_events
group by user_id, kind, src, actor
having count(*) > 1;
```

Keduanya harus kosong.

## D. Status chapter terbaru dan seri tamat

Gunakan komik uji yang statusnya `ongoing`, `hiatus`, dan `completed`. `reading_log` menandai chapter yang selesai dihitung (>=60% + 30 detik); `reached_latest_chapter` menandai posisi chapter terbaru terbit; `is_finished` menandai seri selesai resmi:

- `ongoing`/`hiatus` + chapter terbaru + progress history 100% + valid read log: `reached_latest_chapter=true`, tetapi `is_finished=false`.
- `completed` + bukan chapter terbaru: `reached_latest_chapter=false` dan `is_finished=false`.
- `completed` + chapter terbaru + progres 94%: harus `false`.
- `completed` + chapter terbaru + progres 95% tetapi tanpa `reading_log`: harus `false`.
- `completed` + chapter terbaru + progres history 95% + `reading_log.max_progress` 95% yang dicatat melalui RPC: `reached_latest_chapter=true` dan `is_finished=true`.
- `completed` + chapter terbaru + history progress 95% tetapi `reading_log.max_progress` di bawah 95%: harus `false`.
- Setelah XP di-claim pada progres 60%, kirim RPC progres lanjutan 95% sebelum sesi kedaluwarsa: `reading_log.max_progress` harus naik dan flag tamat dapat berubah menjadi `true` jika kondisi lain terpenuhi.
- Ubah komik dari `completed` kembali `ongoing`, atau tambahkan chapter terbaru: row lama harus dihitung ulang; `reached_latest_chapter` dan `is_finished` berubah sesuai kondisinya.

## E. Batas koleksi dan permintaan bersamaan

Sebelum uji, audit data yang mungkin sudah melampaui batas sebelum migration 0011. Migration tidak menghapus data pengguna lama; jika ada hasil, rapikan melalui proses admin yang disetujui sebelum menyatakan batas total existing data valid.

```sql
select user_id, count(*)::integer as collections
from public.collections group by user_id having count(*) > 20;

select collection_id, count(*)::integer as items
from public.collection_items group by collection_id having count(*) > 100;
```

Gunakan akun uji yang memiliki **0 koleksi**. Kirim 25 request `INSERT collections` secara paralel memakai token akun tersebut. Tepat paling banyak 20 yang boleh berhasil; jangan ada 21 koleksi.

Gunakan koleksi kosong dan minimal 101 `comic_id` uji yang berbeda. Kirim 101 request `INSERT collection_items` secara paralel. Tepat paling banyak 100 yang boleh berhasil dan `item_count` harus sama dengan jumlah row aktual.

```sql
select c.id, c.item_count, count(i.comic_id)::integer as actual_count
from public.collections c
left join public.collection_items i on i.collection_id = c.id
group by c.id, c.item_count
having c.item_count <> count(i.comic_id)::integer;
```

Query di atas harus kosong. Uji duplikasi `(collection_id, comic_id)`: insert kedua harus gagal unique constraint dan `item_count` tidak boleh bertambah. Hapus item satu per satu dan pastikan counter berkurang. Hapus koleksi dan pastikan item cascade terhapus.

## F. Integrasi UI dan RLS

- Home, `/untukmu`, `/profil/statistik`, `/profil/prestasi`, `/koleksi`, `/koleksi/[id]`, `/pustaka`, Reader, dan detail komik tetap dapat dirender.
- User A tidak dapat melihat/mengubah koleksi User B melalui query langsung atau server action.
- Kirim insert item duplikat secara paralel, termasuk permintaan berformat upsert/ignore-duplicates: counter harus tetap sama dengan jumlah row aktual.
- User tidak dapat menulis/mengubah `reading_log.max_progress`, `reading_sessions`, `user_achievements`, `xp_events`, atau `profiles.xp` secara langsung. Uji juga sebagai admin lewat API: perubahan langsung `profiles.xp` tetap harus ditolak; perubahan XP hanya melalui ledger internal.
- Badge tetap 18 dan unlock sesuai metric database. XP harian yang penuh tidak boleh menghilangkan statistik chapter.

## G. Batas pengukuran progres

Walau start time, durasi, kepemilikan sesi, status konten, dan klaim satu kali divalidasi database, nilai progres visual masih dilaporkan klien. Pengujian harus mengakui bahwa browser yang dimodifikasi masih dapat memalsukan nilai progres setelah menunggu durasi wajib. Jangan mendokumentasikan ini sebagai bukti bahwa manusia benar-benar membaca gambar.


## H. Super Admin tunggal dan moderasi admin-only (migration 0012)

Gunakan akun uji moderator dan konten uji milik akun lain.

- Moderator boleh membaca antrean laporan hanya jika route secara khusus diizinkan; versi aplikasi KOMIDIL yang dikunci ini tidak menampilkan dan tidak mengizinkan route `/admin/laporan` untuk moderator.
- Moderator tidak boleh mengubah `reports.status` melalui Data API.
- Moderator tidak boleh mengubah `posts.is_hidden`, `posts.is_pinned`, `posts.is_locked`, `comments.is_hidden`, atau `reviews.is_hidden`.
- Moderator tidak boleh menghapus post/komentar/review milik pengguna lain.
- Moderator masih boleh mengedit atau menghapus konten miliknya sendiri sesuai policy penulis.
- Akun Super Admin boleh memproses laporan dan mengelola seluruh konten komunitas.
- Pengguna biasa dan moderator tidak dapat membuat kategori `pengumuman`; hanya Super Admin yang dapat.

Lakukan pengujian sebagai authenticated user melalui Data API, bukan hanya dari UI. Hasil operasi yang dilarang harus berupa penolakan RLS/permission atau flag harus tetap sama.
