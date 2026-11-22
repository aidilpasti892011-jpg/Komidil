-- =====================================================================
-- KOMIDIL - Langkah 5: admin tunggal berdasarkan email
-- Jalankan SETELAH 0001_schema.sql.
--
-- PENTING: pengaturan Supabase > Authentication > Providers > Email >
-- "Confirm email" HARUS tetap AKTIF. Admin hanya diberikan setelah email
-- terkonfirmasi, jadi orang lain tidak bisa mengaku punya email ini.
-- =====================================================================

-- Hanya boleh ada SATU admin di seluruh tabel.
create unique index if not exists profiles_single_admin
  on public.profiles ((true)) where role = 'admin';

-- Begitu email admin terkonfirmasi, profilnya otomatis jadi admin.
create or replace function public.promote_owner_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'aidilpasti892011@gmail.com' and new.email_confirmed_at is not null then
    update public.profiles set role = 'admin' where id = new.id and role <> 'admin';
  end if;
  return new;
end $$;

drop trigger if exists on_owner_confirmed on auth.users;
create trigger on_owner_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.promote_owner_admin();

-- Kalau akun admin sudah terlanjur terdaftar sebelum file ini dijalankan:
update public.profiles p set role = 'admin'
from auth.users u
where u.id = p.id and lower(u.email) = 'aidilpasti892011@gmail.com'
  and u.email_confirmed_at is not null and p.role <> 'admin';
