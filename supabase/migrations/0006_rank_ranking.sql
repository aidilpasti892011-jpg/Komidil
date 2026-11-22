-- =====================================================================
-- KOMIDIL - Langkah 8: Rank + XP anti-abuse, view_count aman, ranking
-- Jalankan SETELAH 0001-0005. Aman dijalankan ulang.
--
-- Prinsip: SEMUA XP dan view dihitung di database lewat fungsi/trigger
-- security definer. Klien tidak punya hak menulis ke xp_events,
-- chapter_views, comic_view_hourly, maupun comic_rankings.
-- =====================================================================

-- 0) Helper waktu: hari dihitung zona WIB supaya reset harian masuk akal
create or replace function public.today_wib() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- Rahasia internal (garam hash IP). RLS aktif tanpa policy = tidak terbaca dari API.
create table if not exists public.private_settings (
  key   text primary key,
  value text not null
);
alter table public.private_settings enable row level security;
insert into public.private_settings (key, value)
values ('ip_salt', gen_random_uuid()::text)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 1) RANK (dihitung database dari xp)
--    Ambang HARUS sama dengan src/lib/ranks.ts
--    0 New Reader | 100 Reader | 400 Active | 1200 Dedicated | 3500 Elite | 10000 Legendary
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists rank_level smallint
  generated always as (
    case when xp >= 10000 then 5
         when xp >= 3500  then 4
         when xp >= 1200  then 3
         when xp >= 400   then 2
         when xp >= 100   then 1
         else 0 end
  ) stored;

-- ---------------------------------------------------------------------
-- 2) ATURAN XP + LEDGER
-- ---------------------------------------------------------------------
create table if not exists public.xp_rules (
  kind      text primary key,
  amount    integer not null check (amount > 0),
  daily_cap integer not null check (daily_cap > 0)
);
insert into public.xp_rules (kind, amount, daily_cap) values
  ('read',          10, 100),  -- baca 1 chapter (sekali per chapter seumur hidup)
  ('post',          15,  45),  -- maks 3 post berXP per hari
  ('comment',        5,  50),  -- maks 10 komentar berXP per hari
  ('review',        20,  40),  -- sekali per komik, maks 2 per hari
  ('like_received',  1,  20)   -- like dari akun lain (umur akun >= 1 hari)
on conflict (kind) do update set amount = excluded.amount, daily_cap = excluded.daily_cap;
alter table public.xp_rules enable row level security;
drop policy if exists xp_rules_read on public.xp_rules;
create policy xp_rules_read on public.xp_rules for select using (true);

create table if not exists public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null references public.xp_rules(kind),
  src        uuid not null,                                   -- id konten/chapter/komik sumber XP
  actor      uuid not null default '00000000-0000-0000-0000-000000000000', -- pemberi like (kalau ada)
  amount     integer not null check (amount > 0),
  day        date not null default public.today_wib(),
  revoked_at timestamptz,                                     -- konten dihapus/disembunyikan
  created_at timestamptz not null default now(),
  unique (user_id, kind, src, actor)                          -- tidak bisa dihitung dua kali
);
create index if not exists xp_events_user_day_idx on public.xp_events (user_id, day);
create index if not exists xp_events_src_idx on public.xp_events (src);
alter table public.xp_events enable row level security;
drop policy if exists xp_events_own on public.xp_events;
create policy xp_events_own on public.xp_events for select to authenticated using (user_id = auth.uid());
-- tidak ada policy insert/update/delete: hanya fungsi security definer yang bisa menulis
revoke insert, update, delete on public.xp_events from anon, authenticated;

-- Batas total XP per hari (semua jenis digabung). Samakan dengan DAILY_XP_CAP di src/lib/ranks.ts
-- Fungsi internal pemberi XP. Dipanggil trigger / RPC lain, TIDAK bisa dipanggil klien.
create or replace function public.award_xp(p_user uuid, p_kind text, p_src uuid, p_actor uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r_rule    public.xp_rules;
  day_cap   constant integer := 150;
  d         date := public.today_wib();
  act       uuid := coalesce(p_actor, '00000000-0000-0000-0000-000000000000');
  used_kind integer;
  used_all  integer;
  g         integer;
  new_id    uuid;
begin
  select * into r_rule from public.xp_rules where kind = p_kind;
  if not found then return 0; end if;

  -- akun suspend tidak dapat XP
  if not exists (
    select 1 from public.profiles
    where id = p_user
      and not (is_suspended and (suspended_until is null or suspended_until >= now()))
  ) then
    return 0;
  end if;

  -- kunci per user supaya batas harian tidak bisa dilewati lewat request paralel
  perform pg_advisory_xact_lock(hashtext('xp:' || p_user::text));

  -- batas dihitung dari SEMUA event hari ini (termasuk yang dicabut) => hapus lalu buat ulang tidak menambah jatah
  select coalesce(sum(amount) filter (where kind = p_kind), 0), coalesce(sum(amount), 0)
    into used_kind, used_all
  from public.xp_events where user_id = p_user and day = d;

  g := least(r_rule.amount, r_rule.daily_cap - used_kind, day_cap - used_all);
  if g <= 0 then return 0; end if;

  insert into public.xp_events (user_id, kind, src, actor, amount, day)
  values (p_user, p_kind, p_src, act, g, d)
  on conflict (user_id, kind, src, actor) do nothing
  returning id into new_id;
  if new_id is null then return 0; end if;

  update public.profiles set xp = xp + g where id = p_user;
  return g;
end $$;
revoke all on function public.award_xp(uuid, text, uuid, uuid) from public, anon, authenticated;

-- Cabut XP (konten dihapus / disembunyikan). Event tetap tercatat (revoked_at) agar jatah harian tidak kembali.
create or replace function public.revoke_xp(p_src uuid, p_user uuid default null, p_kind text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  with r as (
    update public.xp_events set revoked_at = now()
    where src = p_src and revoked_at is null
      and (p_user is null or user_id = p_user)
      and (p_kind is null or kind = p_kind)
    returning user_id, amount
  )
  update public.profiles p set xp = greatest(p.xp - s.total, 0)
  from (select user_id, sum(amount)::int as total from r group by user_id) s
  where p.id = s.user_id;
end $$;
revoke all on function public.revoke_xp(uuid, uuid, text) from public, anon, authenticated;

-- Pulihkan XP kalau konten tampil lagi (moderator salah sembunyikan).
create or replace function public.restore_xp(p_src uuid, p_user uuid default null, p_kind text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  with r as (
    update public.xp_events set revoked_at = null
    where src = p_src and revoked_at is not null
      and (p_user is null or user_id = p_user)
      and (p_kind is null or kind = p_kind)
    returning user_id, amount
  )
  update public.profiles p set xp = p.xp + s.total
  from (select user_id, sum(amount)::int as total from r group by user_id) s
  where p.id = s.user_id;
end $$;
revoke all on function public.restore_xp(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) TRIGGER XP: post, komentar, review, like
-- ---------------------------------------------------------------------
create or replace function public.xp_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_hidden and char_length(btrim(new.body)) >= 30 then
    perform public.award_xp(new.user_id, 'post', new.id);
  end if;
  return null;
end $$;
drop trigger if exists xp_post on public.posts;
create trigger xp_post after insert on public.posts
  for each row execute function public.xp_on_post();

create or replace function public.xp_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_hidden and char_length(btrim(new.body)) >= 8 then
    perform public.award_xp(new.user_id, 'comment', new.id);
  end if;
  return null;
end $$;
drop trigger if exists xp_comment on public.comments;
create trigger xp_comment after insert on public.comments
  for each row execute function public.xp_on_comment();

-- Review: XP hanya kalau ada isi (>= 20 karakter), sekali per komik (src = comic_id)
create or replace function public.xp_on_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_hidden and char_length(btrim(coalesce(new.body, ''))) >= 20 then
    perform public.award_xp(new.user_id, 'review', new.comic_id);
  end if;
  return null;
end $$;
drop trigger if exists xp_review on public.reviews;
create trigger xp_review after insert or update of body on public.reviews
  for each row execute function public.xp_on_review();

-- Like: XP untuk PENULIS konten. Bukan like ke diri sendiri, konten tampil, pemberi like bukan akun baru/suspend.
create or replace function public.xp_on_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid; hid boolean;
begin
  if new.target_type = 'post' then
    select user_id, is_hidden into author, hid from public.posts where id = new.target_id;
  elsif new.target_type = 'comment' then
    select user_id, is_hidden into author, hid from public.comments where id = new.target_id;
  else
    select user_id, is_hidden into author, hid from public.reviews where id = new.target_id;
  end if;
  if author is null or hid or author = new.user_id then return null; end if;
  if not exists (
    select 1 from public.profiles
    where id = new.user_id and created_at < now() - interval '1 day'
      and not (is_suspended and (suspended_until is null or suspended_until >= now()))
  ) then return null; end if;
  perform public.award_xp(author, 'like_received', new.target_id, new.user_id);
  return null;
end $$;
drop trigger if exists xp_like on public.likes;
create trigger xp_like after insert on public.likes
  for each row execute function public.xp_on_like();

-- Konten dihapus / disembunyikan => XP-nya dicabut. Tampil lagi => dipulihkan.
create or replace function public.xp_on_content_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.revoke_xp(old.id);
  if tg_table_name = 'reviews' then
    perform public.revoke_xp(old.comic_id, old.user_id, 'review');
  end if;
  return null;
end $$;

create or replace function public.xp_on_content_hide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_hidden and not old.is_hidden then
    perform public.revoke_xp(new.id);
    if tg_table_name = 'reviews' then
      perform public.revoke_xp(new.comic_id, new.user_id, 'review');
    end if;
  elsif old.is_hidden and not new.is_hidden then
    perform public.restore_xp(new.id);
    if tg_table_name = 'reviews' then
      perform public.restore_xp(new.comic_id, new.user_id, 'review');
    end if;
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts','comments','reviews'] loop
    execute format('drop trigger if exists xp_delete on public.%I', t);
    execute format('create trigger xp_delete after delete on public.%I for each row execute function public.xp_on_content_delete()', t);
    execute format('drop trigger if exists xp_hide on public.%I', t);
    execute format('create trigger xp_hide after update of is_hidden on public.%I for each row execute function public.xp_on_content_hide()', t);
  end loop;
end $$;

revoke all on function public.xp_on_post(), public.xp_on_comment(), public.xp_on_review(), public.xp_on_like(),
  public.xp_on_content_delete(), public.xp_on_content_hide() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) VIEW COUNT AMAN
--    1 view per (user atau sesi anonim) per chapter per hari (WIB).
-- ---------------------------------------------------------------------
create table if not exists public.chapter_views (
  id         bigint generated always as identity primary key,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  comic_id   uuid not null references public.comics(id) on delete cascade,
  viewer_key text not null,                  -- 'u:<uid>' atau 'a:<sesi>'
  day        date not null default public.today_wib(),
  ip_hash    text,                           -- hash IP berotasi harian, hanya untuk batas anonim
  created_at timestamptz not null default now(),
  unique (chapter_id, viewer_key, day)
);
create index if not exists chapter_views_ip_idx on public.chapter_views (ip_hash, created_at);
create index if not exists chapter_views_day_idx on public.chapter_views (day);
alter table public.chapter_views enable row level security;   -- tanpa policy: tertutup dari API

create table if not exists public.comic_view_hourly (
  comic_id uuid not null references public.comics(id) on delete cascade,
  hour     timestamptz not null,
  views    bigint not null default 0,
  primary key (comic_id, hour)
);
create index if not exists comic_view_hourly_hour_idx on public.comic_view_hourly (hour);
alter table public.comic_view_hourly enable row level security;

-- Trigger statistik chapter dulu jalan di SETIAP update (termasuk view_count). Sekarang hanya
-- saat kolom yang relevan berubah, supaya view tidak memicu hitung ulang berat.
drop trigger if exists chapters_stats on public.chapters;
create trigger chapters_stats
  after insert or delete or update of comic_id, number, is_published, published_at on public.chapters
  for each row execute function public.on_chapter_change();

create or replace function public.track_chapter_view(p_chapter uuid, p_session text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  cid   uuid;
  vkey  text;
  hdrs  json;
  ip    text;
  iph   text;
  n     integer;
begin
  select ch.comic_id into cid
  from public.chapters ch join public.comics c on c.id = ch.comic_id
  where ch.id = p_chapter and ch.is_published and ch.published_at <= now() and c.is_published;
  if cid is null then return false; end if;

  if uid is not null then
    vkey := 'u:' || uid::text;
  else
    if p_session is null or p_session !~ '^[A-Za-z0-9_-]{16,64}$' then return false; end if;
    vkey := 'a:' || p_session;
    -- batas per IP (best effort; header diisi gateway Supabase/Cloudflare)
    begin
      hdrs := nullif(current_setting('request.headers', true), '')::json;
    exception when others then hdrs := null;
    end;
    ip := coalesce(nullif(hdrs ->> 'cf-connecting-ip', ''), nullif(hdrs ->> 'x-real-ip', ''));
    if ip is not null then
      iph := md5(ip || (select value from public.private_settings where key = 'ip_salt') || public.today_wib()::text);
      if (select count(*) from public.chapter_views
          where ip_hash = iph and created_at > now() - interval '1 hour') >= 60 then
        return false;
      end if;
    end if;
  end if;

  insert into public.chapter_views (chapter_id, comic_id, viewer_key, ip_hash)
  values (p_chapter, cid, vkey, iph)
  on conflict (chapter_id, viewer_key, day) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;

  update public.chapters set view_count = view_count + 1 where id = p_chapter;
  update public.comics   set view_count = view_count + 1 where id = cid;
  insert into public.comic_view_hourly (comic_id, hour, views)
  values (cid, date_trunc('hour', now()), 1)
  on conflict (comic_id, hour) do update set views = public.comic_view_hourly.views + 1;
  return true;
end $$;
revoke all on function public.track_chapter_view(uuid, text) from public;
grant execute on function public.track_chapter_view(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) XP BACA CHAPTER (klaim dari Reader)
--    Syarat server-side: sudah terdaftar view >= 30 detik lalu, progres >= 60%, chapter terbit & punya gambar.
--    Sekali per chapter seumur hidup. Progres dikirim klien (tidak bisa diverifikasi penuh),
--    karena itu dibatasi dwell time, 1x per chapter, dan batas 100 XP baca per hari.
-- ---------------------------------------------------------------------
create or replace function public.claim_chapter_xp(p_chapter uuid, p_progress numeric)
returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return 0; end if;
  if p_progress is null or p_progress < 0.6 or p_progress > 1 then return 0; end if;
  if not exists (
    select 1 from public.chapters ch join public.comics c on c.id = ch.comic_id
    where ch.id = p_chapter and ch.is_published and ch.published_at <= now() and c.is_published
      and exists (select 1 from public.chapter_images i where i.chapter_id = ch.id)
  ) then return 0; end if;
  if not exists (
    select 1 from public.chapter_views v
    where v.chapter_id = p_chapter and v.viewer_key = 'u:' || uid::text
      and v.created_at <= now() - interval '30 seconds'
  ) then return 0; end if;
  return public.award_xp(uid, 'read', p_chapter);
end $$;
revoke all on function public.claim_chapter_xp(uuid, numeric) from public, anon;
grant execute on function public.claim_chapter_xp(uuid, numeric) to authenticated;

-- Ringkasan XP milik sendiri untuk halaman profil
create or replace function public.my_xp_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); out jsonb;
begin
  if uid is null then return null; end if;
  select jsonb_build_object(
    'xp', p.xp,
    'rank_level', p.rank_level,
    'today', coalesce((select sum(amount) from public.xp_events where user_id = uid and day = public.today_wib()), 0)
  ) into out from public.profiles p where p.id = uid;
  return out;
end $$;
revoke all on function public.my_xp_summary() from public, anon;
grant execute on function public.my_xp_summary() to authenticated;

-- ---------------------------------------------------------------------
-- 6) RANKING (harian / mingguan / bulanan)
--    skor = (views + 5 x bookmark baru di periode) x (0.8 + 0.4 x rating_bayes / 5) + rating_bayes x 0.01
--    rating_bayes = (rata2 x jumlah + 3.5 x 5) / (jumlah + 5)  => komik 1 review tidak langsung menang
--    Jendela bergulir: 24 jam / 7 hari / 30 hari terakhir.
-- ---------------------------------------------------------------------
alter table public.comics add column if not exists pop_score numeric(12,2) not null default 0;
create index if not exists comics_pop_idx on public.comics (pop_score desc, view_count desc);

create table if not exists public.comic_rankings (
  period      text not null check (period in ('daily','weekly','monthly')),
  comic_id    uuid not null references public.comics(id) on delete cascade,
  rank        integer not null,
  score       numeric(12,2) not null,
  views       bigint not null default 0,
  bookmarks   bigint not null default 0,
  computed_at timestamptz not null default now(),
  primary key (period, comic_id)
);
create index if not exists comic_rankings_rank_idx on public.comic_rankings (period, rank);
alter table public.comic_rankings enable row level security;
drop policy if exists comic_rankings_read on public.comic_rankings;
create policy comic_rankings_read on public.comic_rankings for select using (true);
revoke insert, update, delete on public.comic_rankings from anon, authenticated;

create or replace function public.comic_scores(p_hours integer)
returns table (comic_id uuid, title text, views bigint, bookmarks bigint, bayes numeric, score numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.title,
         coalesce(v.n, 0)::bigint,
         coalesce(b.n, 0)::bigint,
         r.bayes,
         ((coalesce(v.n, 0) + 5 * coalesce(b.n, 0)) * (0.8 + 0.4 * r.bayes / 5.0) + r.bayes * 0.01)::numeric
  from public.comics c
  cross join lateral (
    select ((c.rating_avg * c.rating_count + 17.5) / (c.rating_count + 5))::numeric as bayes
  ) r
  left join (select comic_id, sum(views) as n from public.comic_view_hourly
             where hour > now() - make_interval(hours => p_hours) group by comic_id) v on v.comic_id = c.id
  left join (select comic_id, count(*) as n from public.bookmarks
             where created_at > now() - make_interval(hours => p_hours) group by comic_id) b on b.comic_id = c.id
  where c.is_published;
$$;
revoke all on function public.comic_scores(integer) from public, anon, authenticated;

create or replace function public.refresh_rankings() returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  for p in select * from (values ('daily', 24), ('weekly', 168), ('monthly', 720)) as t(period, hrs) loop
    delete from public.comic_rankings where period = p.period;
    insert into public.comic_rankings (period, comic_id, rank, score, views, bookmarks, computed_at)
    select p.period, x.comic_id, x.rk, x.score, x.views, x.bookmarks, now()
    from (
      select s.*, row_number() over (order by s.score desc, s.bayes desc, s.title) as rk
      from public.comic_scores(p.hrs) s
    ) x
    where x.rk <= 100;
  end loop;

  -- skor 30 hari dipakai untuk sort "Terpopuler" di /komik
  update public.comics c set pop_score = round(s.score, 2)
  from public.comic_scores(720) s
  where s.comic_id = c.id and c.pop_score is distinct from round(s.score, 2);
end $$;
revoke all on function public.refresh_rankings() from public, anon, authenticated;

-- Hapus data dedupe/jam yang sudah tidak dipakai
create or replace function public.prune_view_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chapter_views where day < public.today_wib() - 2;
  delete from public.comic_view_hourly where hour < now() - interval '31 days';
end $$;
revoke all on function public.prune_view_data() from public, anon, authenticated;

-- Tombol "Refresh ranking" di dashboard (admin saja), berguna kalau pg_cron belum aktif.
create or replace function public.admin_refresh_rankings() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Khusus admin'; end if;
  perform public.refresh_rankings();
end $$;
revoke all on function public.admin_refresh_rankings() from public, anon;
grant execute on function public.admin_refresh_rankings() to authenticated;

-- ---------------------------------------------------------------------
-- 7) pg_cron: ranking tiap 15 menit, bersih-bersih tiap hari 03:00 WIB (20:00 UTC)
--    Aktifkan dulu: Supabase Dashboard > Database > Extensions > pg_cron
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname in ('komidil_rankings', 'komidil_prune_views');
    perform cron.schedule('komidil_rankings', '*/15 * * * *', 'select public.refresh_rankings()');
    perform cron.schedule('komidil_prune_views', '0 20 * * *', 'select public.prune_view_data()');
  else
    raise notice 'pg_cron belum tersedia. Aktifkan di Database > Extensions lalu jalankan ulang file ini.';
  end if;
end $$;

-- Isi ranking pertama kali
select public.refresh_rankings();
