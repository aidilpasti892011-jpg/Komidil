-- =====================================================================
-- KOMIDIL - Langkah 7: Admin dashboard
-- Jalankan SETELAH 0001-0004. Aman dijalankan ulang.
-- =====================================================================

-- 1) Role 'admin' TIDAK bisa diberikan/dicabut lewat API (hanya trigger email di 0002).
--    Admin hanya boleh mengatur role user <-> moderator, dan tidak bisa suspend admin.
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    if new.id is distinct from old.id then raise exception 'Kolom ini tidak boleh diubah'; end if;
    if not public.is_admin() then
      if new.role is distinct from old.role or new.is_suspended is distinct from old.is_suspended
         or new.suspended_until is distinct from old.suspended_until
         or new.suspended_reason is distinct from old.suspended_reason
         or new.xp is distinct from old.xp then
        raise exception 'Kolom ini tidak boleh diubah';
      end if;
    else
      if new.role is distinct from old.role and (new.role = 'admin' or old.role = 'admin') then
        raise exception 'Role admin tidak bisa diubah lewat dashboard.';
      end if;
      if old.role = 'admin' and (new.is_suspended is distinct from old.is_suspended) then
        raise exception 'Admin tidak bisa disuspend.';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- 2) Chapter terjadwal: refresh statistik komik. Dipanggil pg_cron tiap 5 menit.
create or replace function public.refresh_scheduled_chapters() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select distinct c.id from public.comics c
    where exists (select 1 from public.chapters ch
                  where ch.comic_id = c.id and ch.is_published
                    and ch.published_at <= now()
                    and (c.last_chapter_at is null or ch.published_at > c.last_chapter_at))
  loop
    perform public.refresh_comic_chapters(r.id);
  end loop;
end $$;
revoke all on function public.refresh_scheduled_chapters() from public, anon, authenticated;

-- Aktifkan pg_cron: Supabase Dashboard > Database > Extensions > pg_cron (ON), lalu jalankan blok ini.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'komidil_scheduled_chapters';
    perform cron.schedule('komidil_scheduled_chapters', '*/5 * * * *', 'select public.refresh_scheduled_chapters()');
  else
    raise notice 'pg_cron belum tersedia. Aktifkan di Database > Extensions lalu jalankan ulang file ini.';
  end if;
end $$;

-- 3) Statistik dashboard (hanya staff). Satu panggilan RPC.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_staff() then raise exception 'Khusus staff'; end if;
  select jsonb_build_object(
    'users',        (select count(*) from public.profiles),
    'suspended',    (select count(*) from public.profiles where is_suspended),
    'comics',       (select count(*) from public.comics),
    'chapters',     (select count(*) from public.chapters),
    'scheduled',    (select count(*) from public.chapters where published_at > now()),
    'views',        (select coalesce(sum(view_count), 0) from public.comics),
    'bookmarks',    (select count(*) from public.bookmarks),
    'posts',        (select count(*) from public.posts),
    'comments',     (select count(*) from public.comments),
    'reviews',      (select count(*) from public.reviews),
    'open_reports', (select count(*) from public.reports where status in ('open','reviewing')),
    'signups', (select coalesce(jsonb_agg(jsonb_build_object('d', d::date, 'n',
                  (select count(*) from public.profiles p where p.created_at::date = d::date)) order by d), '[]')
                from generate_series(current_date - 13, current_date, interval '1 day') d),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('d', d::date, 'n',
                  (select count(*) from public.posts x where x.created_at::date = d::date)
                + (select count(*) from public.comments x where x.created_at::date = d::date)) order by d), '[]')
                from generate_series(current_date - 13, current_date, interval '1 day') d),
    'top_comics', (select coalesce(jsonb_agg(t), '[]') from (
                  select title, slug, view_count, bookmark_count from public.comics
                  order by view_count desc, bookmark_count desc limit 5) t)
  ) into out;
  return out;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- 4) Indeks bantu halaman admin
create index if not exists profiles_created_idx on public.profiles (created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
