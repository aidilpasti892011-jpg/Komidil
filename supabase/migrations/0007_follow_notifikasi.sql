-- =====================================================================
-- KOMIDIL tahap 9: Ikuti komik + notifikasi chapter baru
-- Jalankan setelah 0001-0006. Aman diulang.
-- =====================================================================

-- 1) Ikuti komik (terpisah dari bookmark; bookmark = simpan, ikuti = kabari saya)
create table if not exists public.comic_follows (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  comic_id   uuid not null references public.comics(id)   on delete cascade,
  notify     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, comic_id)
);
create index if not exists comic_follows_comic_idx on public.comic_follows (comic_id) where notify;
alter table public.comic_follows enable row level security;
drop policy if exists follows_own on public.comic_follows;
create policy follows_own on public.comic_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- batas anti-abuse: maksimal 300 komik diikuti per akun
create or replace function public.check_follow_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comic_follows where user_id = new.user_id) >= 300 then
    raise exception 'Maksimal 300 komik yang bisa diikuti';
  end if;
  return new;
end $$;
drop trigger if exists follows_limit on public.comic_follows;
create trigger follows_limit before insert on public.comic_follows
  for each row execute function public.check_follow_limit();

-- 2) Jumlah pengikut di tabel comics
alter table public.comics add column if not exists follower_count integer not null default 0;

create or replace function public.on_follow_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.comics set follower_count = follower_count + 1 where id = new.comic_id;
  else
    update public.comics set follower_count = greatest(follower_count - 1, 0) where id = old.comic_id;
  end if;
  return null;
end $$;
drop trigger if exists follows_stats on public.comic_follows;
create trigger follows_stats after insert or delete on public.comic_follows
  for each row execute function public.on_follow_change();
revoke all on function public.check_follow_limit(), public.on_follow_change() from public, anon, authenticated;

update public.comics c set follower_count = (select count(*) from public.comic_follows f where f.comic_id = c.id);

-- 3) Notifikasi: satu notifikasi per user per chapter (idempotent), hilang kalau chapter dihapus
alter table public.notifications add column if not exists chapter_id uuid references public.chapters(id) on delete cascade;
create unique index if not exists notifications_user_chapter_uq
  on public.notifications (user_id, chapter_id) where chapter_id is not null;

-- Penanda chapter yang sudah dikabarkan. Chapter lama dianggap sudah (tidak ada spam mundur);
-- chapter terjadwal di masa depan tetap null sampai waktunya tiba.
alter table public.chapters add column if not exists notified_at timestamptz;
update public.chapters set notified_at = now() where notified_at is null and published_at <= now();

-- 4) Kirim notifikasi satu chapter ke pengikut. Internal saja.
create or replace function public.notify_chapter(p_chapter uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cid    uuid;
  num    numeric;
  ttl    text;
  ctitle text;
  slug   text;
  newest boolean;
  n      integer := 0;
  label  text;
begin
  -- klaim atomik: hanya satu pemanggil yang menang, jadi tidak pernah dobel
  update public.chapters set notified_at = now()
  where id = p_chapter and notified_at is null and is_published and published_at <= now()
  returning comic_id, number, title into cid, num, ttl;
  if cid is null then return 0; end if;

  select c.title, c.slug into ctitle, slug from public.comics c where c.id = cid and c.is_published;
  if slug is null then return 0; end if;

  -- chapter lama yang diunggah belakangan tidak memicu notifikasi
  select not exists (
    select 1 from public.chapters x
    where x.comic_id = cid and x.is_published and x.published_at <= now() and x.number > num
  ) into newest;
  if not newest then return 0; end if;

  label := trim(trailing '.' from trim(trailing '0' from num::text));
  insert into public.notifications (user_id, type, title, body, link, chapter_id)
  select f.user_id, 'new_chapter', ctitle,
         'Chapter ' || label || ' sudah terbit' || coalesce(': ' || nullif(ttl, ''), ''),
         '/komik/' || slug || '/' || label, p_chapter
  from public.comic_follows f
  where f.comic_id = cid and f.notify
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.notify_chapter(uuid) from public, anon, authenticated;

-- 5) Trigger: chapter dibuat atau baru dipublikasikan
create or replace function public.on_chapter_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_published and new.published_at <= now() then
    perform public.notify_chapter(new.id);
  end if;
  return null;
end $$;
revoke all on function public.on_chapter_notify() from public, anon, authenticated;
drop trigger if exists chapters_notify on public.chapters;
create trigger chapters_notify
  after insert or update of is_published, published_at on public.chapters
  for each row execute function public.on_chapter_notify();

-- 6) Chapter terjadwal yang waktunya sudah tiba (dipanggil pg_cron tiap 5 menit)
create or replace function public.notify_due_chapters() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; total integer := 0;
begin
  for r in
    select id from public.chapters
    where notified_at is null and is_published and published_at <= now()
    order by published_at limit 200
  loop
    total := total + public.notify_chapter(r.id);
  end loop;
  return total;
end $$;
revoke all on function public.notify_due_chapters() from public, anon, authenticated;

-- Bersih-bersih: notifikasi sudah dibaca > 60 hari, atau apa pun > 180 hari
create or replace function public.prune_notifications() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
  where (is_read and created_at < now() - interval '60 days') or created_at < now() - interval '180 days';
end $$;
revoke all on function public.prune_notifications() from public, anon, authenticated;

-- 7) pg_cron
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname in ('komidil_notify_due', 'komidil_prune_notif');
    perform cron.schedule('komidil_notify_due', '*/5 * * * *', 'select public.notify_due_chapters()');
    perform cron.schedule('komidil_prune_notif', '10 20 * * *', 'select public.prune_notifications()');
  else
    raise notice 'pg_cron belum tersedia. Aktifkan di Database > Extensions lalu jalankan ulang file ini.';
  end if;
end $$;
