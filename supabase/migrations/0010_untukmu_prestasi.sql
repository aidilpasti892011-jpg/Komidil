-- =====================================================================
-- KOMIDIL tahap 12: log baca, statistik, badge prestasi, Untukmu, koleksi
-- Jalankan setelah 0001-0009. Aman diulang.
-- Prinsip sama seperti XP: semua angka dihitung database lewat fungsi
-- security definer. Klien tidak bisa menulis reading_log / user_achievements.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) reading_log: satu baris per chapter yang BENAR-BENAR dibaca (>= 60% dan >= 30 detik)
--    Terpisah dari xp_events karena XP kena batas harian, statistik tidak boleh ikut terpotong.
-- ---------------------------------------------------------------------
create table if not exists public.reading_log (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  comic_id   uuid not null references public.comics(id)   on delete cascade,
  day        date not null default public.today_wib(),
  created_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create index if not exists reading_log_user_day_idx   on public.reading_log (user_id, day);
create index if not exists reading_log_user_comic_idx on public.reading_log (user_id, comic_id);
alter table public.reading_log enable row level security;
drop policy if exists reading_log_own on public.reading_log;
create policy reading_log_own on public.reading_log for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.reading_log from anon, authenticated;

-- Backfill dari XP baca yang sudah ada (hanya yang chapter-nya masih ada)
insert into public.reading_log (user_id, chapter_id, comic_id, day, created_at)
select e.user_id, e.src, ch.comic_id, e.day, e.created_at
from public.xp_events e
join public.chapters ch on ch.id = e.src
where e.kind = 'read' and e.revoked_at is null
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2) Koleksi favorit (dibuat sebelum rekomendasi karena ikut jadi sinyal)
-- ---------------------------------------------------------------------
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  description text check (char_length(description) <= 200),
  item_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists collections_user_name_idx on public.collections (user_id, lower(name));
create index if not exists collections_user_idx on public.collections (user_id, updated_at desc);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  comic_id      uuid not null references public.comics(id)      on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, comic_id)
);
create index if not exists collection_items_comic_idx on public.collection_items (comic_id);

alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;

drop policy if exists collections_select on public.collections;
drop policy if exists collections_insert on public.collections;
drop policy if exists collections_update on public.collections;
drop policy if exists collections_delete on public.collections;
create policy collections_select on public.collections for select to authenticated using (user_id = auth.uid());
create policy collections_insert on public.collections for insert to authenticated
  with check (user_id = auth.uid() and public.can_write());
create policy collections_update on public.collections for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_write());
create policy collections_delete on public.collections for delete to authenticated using (user_id = auth.uid());

drop policy if exists collection_items_select on public.collection_items;
drop policy if exists collection_items_insert on public.collection_items;
drop policy if exists collection_items_delete on public.collection_items;
create policy collection_items_select on public.collection_items for select to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy collection_items_insert on public.collection_items for insert to authenticated
  with check (public.can_write()
    and exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
    and exists (select 1 from public.comics m where m.id = comic_id));
create policy collection_items_delete on public.collection_items for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

-- rapikan nama + batas koleksi per akun (20)
create or replace function public.collections_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if char_length(new.name) < 1 then raise exception 'Nama koleksi tidak boleh kosong'; end if;
  if new.description is not null then new.description := nullif(btrim(new.description), ''); end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.collections where user_id = new.user_id) >= 20 then
      raise exception 'Maksimal 20 koleksi per akun';
    end if;
    new.item_count := 0;
  else
    new.user_id := old.user_id;
    -- item_count hanya boleh diubah trigger collection_items_guard (kedalaman trigger > 1), bukan user langsung
    if pg_trigger_depth() = 1 then new.item_count := old.item_count; end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists collections_guard on public.collections;
create trigger collections_guard before insert or update on public.collections
  for each row execute function public.collections_guard();

-- batas 100 komik per koleksi + jaga item_count
create or replace function public.collection_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select item_count from public.collections where id = new.collection_id) >= 100 then
      raise exception 'Maksimal 100 komik per koleksi';
    end if;
    update public.collections set item_count = item_count + 1, updated_at = now() where id = new.collection_id;
    return new;
  else
    update public.collections set item_count = greatest(item_count - 1, 0), updated_at = now() where id = old.collection_id;
    return old;
  end if;
end $$;
drop trigger if exists collection_items_guard on public.collection_items;
create trigger collection_items_guard before insert or delete on public.collection_items
  for each row execute function public.collection_items_guard();

-- ---------------------------------------------------------------------
-- 3) Badge prestasi
-- ---------------------------------------------------------------------
create table if not exists public.achievements (
  code        text primary key,
  name        text not null,
  description text not null,
  icon        text not null,
  tier        smallint not null default 1,
  metric      text not null,
  threshold   integer not null check (threshold > 0),
  sort        integer not null default 0
);
alter table public.achievements enable row level security;
drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements for select using (true);
revoke insert, update, delete on public.achievements from anon, authenticated;

create table if not exists public.user_achievements (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  code        text not null references public.achievements(code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);
alter table public.user_achievements enable row level security;
drop policy if exists user_achievements_own on public.user_achievements;
create policy user_achievements_own on public.user_achievements for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.user_achievements from anon, authenticated;

-- metric: chapters | comics | streak | finished | bookmarks | follows | collections | posts | comments | reviews
insert into public.achievements (code, name, description, icon, tier, metric, threshold, sort) values
  ('read_1',     'Langkah Pertama',  'Baca 1 chapter sampai tuntas',            'book',     1, 'chapters',    1,   10),
  ('read_10',    'Pembaca Rajin',    'Baca 10 chapter',                         'book',     2, 'chapters',   10,   20),
  ('read_100',   'Kutu Buku',        'Baca 100 chapter',                        'books',    3, 'chapters',  100,   30),
  ('read_500',   'Maraton Komik',    'Baca 500 chapter',                        'books',    4, 'chapters',  500,   40),
  ('comics_5',   'Penjelajah',       'Baca 5 komik berbeda',                    'compass',  1, 'comics',      5,   50),
  ('comics_25',  'Petualang',        'Baca 25 komik berbeda',                   'compass',  3, 'comics',     25,   60),
  ('streak_3',   'Mulai Konsisten',  'Baca 3 hari berturut-turut',              'flame',    1, 'streak',      3,   70),
  ('streak_7',   'Seminggu Penuh',   'Baca 7 hari berturut-turut',              'flame',    2, 'streak',      7,   80),
  ('streak_30',  'Sebulan Setia',    'Baca 30 hari berturut-turut',             'flame',    4, 'streak',     30,   90),
  ('finish_1',   'Tamat!',           'Selesaikan 1 komik sampai chapter terakhir', 'flag',  1, 'finished',    1,  100),
  ('finish_5',   'Penamat Sejati',   'Selesaikan 5 komik',                      'flag',     3, 'finished',    5,  110),
  ('bm_10',      'Kolektor',         'Bookmark 10 komik',                       'bookmark', 2, 'bookmarks',  10,  120),
  ('follow_5',   'Pemantau Rilis',   'Ikuti 5 komik',                           'bell',     1, 'follows',     5,  130),
  ('coll_1',     'Kurator',          'Buat koleksi pertama yang berisi komik',  'layers',   1, 'collections', 1,  140),
  ('coll_5',     'Kurator Handal',   'Punya 5 koleksi yang berisi komik',       'layers',   3, 'collections', 5,  150),
  ('post_1',     'Suara Pertama',    'Buat 1 post di komunitas',                'pen',      1, 'posts',       1,  160),
  ('comment_10', 'Teman Diskusi',    'Tulis 10 komentar',                       'chat',     2, 'comments',   10,  170),
  ('review_3',   'Kritikus',         'Tulis 3 review',                          'star',     2, 'reviews',     3,  180)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon, tier = excluded.tier,
  metric = excluded.metric, threshold = excluded.threshold, sort = excluded.sort;

-- Angka-angka sumber badge, dihitung dari data asli (bukan dari klien)
create or replace function public._ach_metrics(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'chapters',    (select count(*) from public.reading_log where user_id = p_user),
    'comics',      (select count(distinct comic_id) from public.reading_log where user_id = p_user),
    'streak',      coalesce((
        select max(c) from (
          select count(*) as c from (
            select day - (row_number() over (order by day))::int as grp
            from (select distinct day from public.reading_log where user_id = p_user) d
          ) x group by grp
        ) y), 0),
    'finished',    (select count(*) from public.reading_history where user_id = p_user and is_finished),
    'bookmarks',   (select count(*) from public.bookmarks where user_id = p_user),
    'follows',     (select count(*) from public.comic_follows where user_id = p_user),
    'collections', (select count(*) from public.collections c
                    where c.user_id = p_user and c.item_count > 0),
    'posts',       (select count(*) from public.posts where user_id = p_user and not is_hidden),
    'comments',    (select count(*) from public.comments where user_id = p_user and not is_hidden),
    'reviews',     (select count(*) from public.reviews where user_id = p_user and not is_hidden)
  );
$$;
revoke all on function public._ach_metrics(uuid) from public, anon, authenticated;

-- Buka badge yang syaratnya sudah terpenuhi. Mengembalikan badge yang BARU terbuka.
create or replace function public._sync_achievements(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m jsonb := public._ach_metrics(p_user); out jsonb := '[]'::jsonb; r record;
begin
  for r in
    select a.code, a.name, a.description
    from public.achievements a
    where coalesce((m ->> a.metric)::int, 0) >= a.threshold
      and not exists (select 1 from public.user_achievements u where u.user_id = p_user and u.code = a.code)
    order by a.sort
  loop
    insert into public.user_achievements (user_id, code) values (p_user, r.code) on conflict do nothing;
    if found then
      insert into public.notifications (user_id, type, title, body, link)
      values (p_user, 'achievement', 'Badge baru: ' || r.name, r.description, '/profil/prestasi');
      out := out || jsonb_build_array(jsonb_build_object('code', r.code, 'name', r.name));
    end if;
  end loop;
  return out;
end $$;
revoke all on function public._sync_achievements(uuid) from public, anon, authenticated;

-- Daftar badge + progres milik sendiri (sekaligus menyinkronkan)
create or replace function public.my_achievements()
returns table (code text, name text, description text, icon text, tier smallint,
               threshold integer, value integer, unlocked_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m jsonb;
begin
  if uid is null then return; end if;
  perform public._sync_achievements(uid);
  m := public._ach_metrics(uid);
  return query
    select a.code, a.name, a.description, a.icon, a.tier, a.threshold,
           least(coalesce((m ->> a.metric)::int, 0), a.threshold)::int,
           u.unlocked_at
    from public.achievements a
    left join public.user_achievements u on u.user_id = uid and u.code = a.code
    order by a.sort;
end $$;
revoke all on function public.my_achievements() from public, anon;
grant execute on function public.my_achievements() to authenticated;

-- Dipanggil klien saat sebuah chapter selesai dibaca. Validasi sama dengan claim_chapter_xp
-- (progres >= 60%, sudah 30 detik sejak view tercatat, chapter terbit dan punya gambar).
-- Mengembalikan badge baru (array jsonb), atau null kalau tidak sah.
create or replace function public.log_chapter_read(p_chapter uuid, p_progress numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; ins integer;
begin
  if uid is null then return null; end if;
  if p_progress is null or p_progress < 0.6 or p_progress > 1 then return null; end if;
  select ch.comic_id into cid
  from public.chapters ch join public.comics c on c.id = ch.comic_id
  where ch.id = p_chapter and ch.is_published and ch.published_at <= now() and c.is_published
    and exists (select 1 from public.chapter_images i where i.chapter_id = ch.id);
  if cid is null then return null; end if;
  if not exists (
    select 1 from public.chapter_views v
    where v.chapter_id = p_chapter and v.viewer_key = 'u:' || uid::text
      and v.created_at <= now() - interval '30 seconds'
  ) then return null; end if;

  insert into public.reading_log (user_id, chapter_id, comic_id) values (uid, p_chapter, cid)
  on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then return '[]'::jsonb; end if;
  return public._sync_achievements(uid);
end $$;
revoke all on function public.log_chapter_read(uuid, numeric) from public, anon;
grant execute on function public.log_chapter_read(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 4) Statistik membaca (milik sendiri). Hari dihitung WIB.
-- ---------------------------------------------------------------------
create or replace function public.my_reading_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); t date := public.today_wib(); out jsonb; cur int := 0; best int := 0;
begin
  if uid is null then return null; end if;

  with d as (select distinct day from public.reading_log where user_id = uid),
       g as (select day, day - (row_number() over (order by day))::int as grp from d)
  select
    coalesce(case when (select max(day) from d) >= t - 1
      then (select count(*) from g where grp = (select grp from g order by day desc limit 1)) else 0 end, 0),
    coalesce((select max(c) from (select count(*) as c from g group by grp) z), 0)
  into cur, best;

  select jsonb_build_object(
    'chapters',       (select count(*) from public.reading_log where user_id = uid),
    'comics',         (select count(distinct comic_id) from public.reading_log where user_id = uid),
    'finished',       (select count(*) from public.reading_history where user_id = uid and is_finished),
    'days_active',    (select count(distinct day) from public.reading_log where user_id = uid),
    'streak_current', cur,
    'streak_best',    best,
    'last30',         (select count(*) from public.reading_log where user_id = uid and day > t - 30),
    'first_read',     (select min(day) from public.reading_log where user_id = uid),
    'last7', (
      select jsonb_agg(jsonb_build_object('day', s.d, 'n', coalesce(c.n, 0)) order by s.d)
      from generate_series(t - 6, t, interval '1 day') as gs(x)
      cross join lateral (select gs.x::date as d) s
      left join (select day, count(*)::int as n from public.reading_log
                 where user_id = uid and day >= t - 6 group by day) c on c.day = s.d),
    'top_genres', coalesce((
      select jsonb_agg(jsonb_build_object('name', q.name, 'n', q.n) order by q.n desc, q.name)
      from (select g.name, count(*)::int as n
            from public.reading_log l
            join public.comic_genres cg on cg.comic_id = l.comic_id
            join public.genres g on g.id = cg.genre_id
            where l.user_id = uid group by g.name order by count(*) desc, g.name limit 5) q), '[]'::jsonb),
    'top_types', coalesce((
      select jsonb_agg(jsonb_build_object('type', q.type, 'n', q.n) order by q.n desc)
      from (select c.type::text as type, count(*)::int as n
            from public.reading_log l join public.comics c on c.id = l.comic_id
            where l.user_id = uid group by c.type order by count(*) desc) q), '[]'::jsonb)
  ) into out;
  return out;
end $$;
revoke all on function public.my_reading_stats() from public, anon;
grant execute on function public.my_reading_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 5) Untukmu: rekomendasi dari kebiasaan membaca
--    Sinyal per komik: dibaca (ln(1+chapter), maks 3), ada di riwayat (+1, tamat +1),
--    bookmark (+2), ikuti (+2), masuk koleksi (+1.5).
--    Skor = 0.60 kecocokan genre + 0.15 kecocokan tipe + 0.15 popularitas + 0.10 rating (bayes).
--    Komik yang sudah punya sinyal tidak direkomendasikan lagi. SECURITY INVOKER: RLS berlaku.
-- ---------------------------------------------------------------------
create or replace function public.recommend_for_me(p_limit integer default 12)
returns table (id uuid, score numeric, reason text)
language sql stable set search_path = public as $$
  with me as (select auth.uid() as uid),
  sig as (
    select comic_id, least(ln(1 + count(*)), 3)::numeric as w
      from public.reading_log, me where user_id = me.uid group by comic_id
    union all
    select comic_id, case when is_finished then 2 else 1 end
      from public.reading_history, me where user_id = me.uid
    union all
    select comic_id, 2 from public.bookmarks, me where user_id = me.uid
    union all
    select comic_id, 2 from public.comic_follows, me where user_id = me.uid
    union all
    select ci.comic_id, 1.5
      from public.collection_items ci join public.collections c on c.id = ci.collection_id, me
      where c.user_id = me.uid
  ),
  aff as (select comic_id, sum(w) as w from sig group by comic_id),
  gaff as (
    select cg.genre_id, sum(a.w) as w
    from aff a join public.comic_genres cg on cg.comic_id = a.comic_id group by cg.genre_id
  ),
  gmax as (select nullif(max(w), 0) as m from gaff),
  taff as (
    select c.type, sum(a.w) as w from aff a join public.comics c on c.id = a.comic_id group by c.type
  ),
  tmax as (select nullif(max(w), 0) as m from taff),
  pmax as (select max(ln(1 + pop_score)) as m from public.comics where is_published),
  cand as (
    select c.id, c.type, c.pop_score,
           ((c.rating_avg * c.rating_count + 3.5 * 5) / (c.rating_count + 5)) / 5.0 as rating_b
    from public.comics c
    where c.is_published and c.chapter_count > 0
      and not exists (select 1 from aff a where a.comic_id = c.id)
  ),
  gm as (
    select ca.id,
           least(sum(coalesce(ga.w, 0) / (select m from gmax)) / 3.0, 1.0) as g_score,
           (array_agg(g.name order by coalesce(ga.w, 0) desc, g.name))[1] as top_genre,
           max(coalesce(ga.w, 0)) as top_w
    from cand ca
    join public.comic_genres cg on cg.comic_id = ca.id
    join public.genres g on g.id = cg.genre_id
    left join gaff ga on ga.genre_id = cg.genre_id
    group by ca.id
  )
  select ca.id,
         round((
           0.60 * coalesce(gm.g_score, 0)
         + 0.15 * coalesce(ta.w / (select m from tmax), 0)
         + 0.15 * coalesce(ln(1 + ca.pop_score) / nullif((select m from pmax), 0), 0)
         + 0.10 * ca.rating_b)::numeric, 4) as score,
         case when coalesce(gm.top_w, 0) > 0 then 'Karena kamu suka ' || gm.top_genre
              else 'Lagi ramai dibaca' end as reason
  from cand ca
  left join gm on gm.id = ca.id
  left join taff ta on ta.type = ca.type
  where exists (select 1 from aff)                      -- belum ada sinyal = tidak ada rekomendasi
  order by 2 desc, ca.id
  limit least(greatest(coalesce(p_limit, 12), 1), 48);
$$;
revoke all on function public.recommend_for_me(integer) from public, anon;
grant execute on function public.recommend_for_me(integer) to authenticated;
