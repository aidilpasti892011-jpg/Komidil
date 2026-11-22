-- =====================================================================
-- KOMIDIL - Langkah 1: skema database, RLS, dan Storage
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor (project baru).
-- =====================================================================

-- ---------- ENUM ----------
create type public.user_role     as enum ('user','moderator','admin');
create type public.comic_type    as enum ('manhwa','manhua','manga','webtoon');
create type public.comic_status  as enum ('ongoing','completed','hiatus');
create type public.post_category as enum ('pengumuman','info_komik','diskusi','spoiler','polling','review');
create type public.like_target   as enum ('post','comment','review');
create type public.report_target as enum ('chapter_image','comic','post','comment','review','user');
create type public.report_status as enum ('open','reviewing','resolved','dismissed');

-- ---------- TABEL ----------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name     text check (char_length(display_name) <= 40),
  avatar_url       text,
  bio              text check (char_length(bio) <= 300),
  role             public.user_role not null default 'user',
  is_suspended     boolean not null default false,
  suspended_until  timestamptz,
  suspended_reason text,
  xp               integer not null default 0 check (xp >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.genres (
  id   smallint generated always as identity primary key,
  name text not null unique,
  slug text not null unique
);

create table public.comics (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title                 text not null check (char_length(title) between 1 and 200),
  alt_titles            text[] not null default '{}',
  synopsis              text,
  cover_url             text,
  cover_hue             smallint not null default 0 check (cover_hue between 0 and 360),
  banner_url            text,
  type                  public.comic_type   not null default 'manhwa',
  status                public.comic_status not null default 'ongoing',
  author                text,
  artist                text,
  rating_avg            numeric(3,2) not null default 0,
  rating_count          integer not null default 0,
  view_count            bigint  not null default 0,
  bookmark_count        integer not null default 0,
  chapter_count         integer not null default 0,
  latest_chapter_number numeric(7,2),
  last_chapter_at       timestamptz,
  is_published          boolean not null default true,
  -- uploader wajib menyatakan konten miliknya sendiri / berlisensi
  rights_confirmed      boolean not null default false,
  rights_note           text,
  uploaded_by           uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index comics_last_chapter_idx on public.comics (last_chapter_at desc nulls last);
create index comics_rating_idx       on public.comics (rating_avg desc);
create index comics_type_status_idx  on public.comics (type, status);
create index comics_title_lower_idx  on public.comics (lower(title));

create table public.comic_genres (
  comic_id uuid     not null references public.comics(id) on delete cascade,
  genre_id smallint not null references public.genres(id) on delete cascade,
  primary key (comic_id, genre_id)
);
create index comic_genres_genre_idx on public.comic_genres (genre_id);

create table public.chapters (
  id           uuid primary key default gen_random_uuid(),
  comic_id     uuid not null references public.comics(id) on delete cascade,
  number       numeric(7,2) not null check (number >= 0),
  title        text,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),   -- isi masa depan = jadwal terbit
  view_count   bigint not null default 0,
  created_at   timestamptz not null default now(),
  unique (comic_id, number)
);
create index chapters_comic_pub_idx on public.chapters (comic_id, published_at desc);

create table public.chapter_images (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  image_path  text not null,      -- path di bucket 'chapters'
  width       integer,
  height      integer,
  unique (chapter_id, page_number)
);

create table public.bookmarks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  comic_id   uuid not null references public.comics(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comic_id)
);

create table public.reading_history (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  comic_id    uuid not null references public.comics(id)   on delete cascade,
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  page        integer not null default 1 check (page > 0),
  progress    numeric(4,3) not null default 0 check (progress between 0 and 1),
  is_finished boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, comic_id)
);
create index reading_history_user_idx on public.reading_history (user_id, updated_at desc);

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  comic_id   uuid not null references public.comics(id)   on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text check (char_length(body) <= 3000),
  has_spoiler boolean not null default false,
  is_hidden  boolean not null default false,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (comic_id, user_id)
);

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  category      public.post_category not null default 'diskusi',
  title         text not null check (char_length(title) between 3 and 150),
  body          text not null check (char_length(body) between 1 and 5000),
  comic_id      uuid references public.comics(id) on delete set null,
  has_spoiler   boolean not null default false,
  is_pinned     boolean not null default false,
  is_locked     boolean not null default false,
  is_hidden     boolean not null default false,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now()
);
create index posts_cat_idx on public.posts (category, created_at desc);

-- Polling (dipakai di langkah 6, tabelnya disiapkan dari sekarang)
create table public.poll_options (
  id      uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  label   text not null check (char_length(label) between 1 and 80),
  votes   integer not null default 0
);
create table public.poll_votes (
  post_id   uuid not null references public.posts(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  is_hidden  boolean not null default false,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.likes (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_type public.like_target not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  target_type  public.report_target not null,
  target_id    uuid not null,
  reason       text not null check (char_length(reason) between 3 and 100),
  detail       text check (char_length(detail) <= 1000),
  status       public.report_status not null default 'open',
  resolved_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

-- ---------- FUNGSI BANTU ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin','moderator'));
$$;

-- user boleh menulis (login + tidak sedang disuspend)
create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid()
                   and (not is_suspended
                        or (suspended_until is not null and suspended_until < now())));
$$;

-- ---------- TRIGGER ----------
-- Profil otomatis dibuat saat user register
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted text := new.raw_user_meta_data ->> 'username';
  fallback text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
begin
  if wanted is null or wanted !~ '^[A-Za-z0-9_]{3,20}$' then
    wanted := fallback;
  end if;
  begin
    insert into public.profiles (id, username, display_name) values (new.id, wanted, wanted);
  exception when unique_violation then
    insert into public.profiles (id, username, display_name) values (new.id, fallback, fallback);
  end;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- user biasa tidak boleh ubah role / suspend / xp lewat API
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.is_suspended is distinct from old.is_suspended
       or new.suspended_until is distinct from old.suspended_until
       or new.suspended_reason is distinct from old.suspended_reason
       or new.xp is distinct from old.xp then
      raise exception 'Kolom ini tidak boleh diubah';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- flag moderasi hanya boleh diubah staff
create or replace function public.protect_post_flags() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_staff() then
    new.is_hidden := old.is_hidden;
    new.is_pinned := old.is_pinned;
    new.is_locked := old.is_locked;
    new.category  := old.category;
    new.user_id   := old.user_id;
  end if;
  return new;
end $$;
create trigger posts_protect before update on public.posts
  for each row execute function public.protect_post_flags();

create or replace function public.protect_comment_flags() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_staff() then
    new.is_hidden := old.is_hidden;
    new.user_id   := old.user_id;
    new.post_id   := old.post_id;
  end if;
  return new;
end $$;
create trigger comments_protect before update on public.comments
  for each row execute function public.protect_comment_flags();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger comics_touch before update on public.comics
  for each row execute function public.touch_updated_at();

-- statistik chapter di tabel comics (hanya chapter yang sudah terbit)
create or replace function public.refresh_comic_chapters(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.comics c set
    chapter_count         = s.cnt,
    latest_chapter_number = s.mx,
    last_chapter_at       = s.lp
  from (select count(*)::int as cnt, max(number) as mx, max(published_at) as lp
        from public.chapters
        where comic_id = cid and is_published and published_at <= now()) s
  where c.id = cid;
end $$;

create or replace function public.on_chapter_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT','UPDATE') then perform public.refresh_comic_chapters(new.comic_id); end if;
  if tg_op in ('DELETE','UPDATE') then perform public.refresh_comic_chapters(old.comic_id); end if;
  return null;
end $$;
create trigger chapters_stats after insert or update or delete on public.chapters
  for each row execute function public.on_chapter_change();

-- rating rata-rata dari review
create or replace function public.on_review_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid := coalesce(new.comic_id, old.comic_id);
begin
  update public.comics set
    rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from public.reviews
                             where comic_id = cid and not is_hidden), 0),
    rating_count = (select count(*) from public.reviews where comic_id = cid and not is_hidden)
  where id = cid;
  return null;
end $$;
create trigger reviews_stats after insert or update or delete on public.reviews
  for each row execute function public.on_review_change();

-- jumlah bookmark
create or replace function public.on_bookmark_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.comics set bookmark_count = bookmark_count + 1 where id = new.comic_id;
  else
    update public.comics set bookmark_count = greatest(bookmark_count - 1, 0) where id = old.comic_id;
  end if;
  return null;
end $$;
create trigger bookmarks_stats after insert or delete on public.bookmarks
  for each row execute function public.on_bookmark_change();

-- jumlah komentar per post
create or replace function public.on_comment_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger comments_stats after insert or delete on public.comments
  for each row execute function public.on_comment_change();

-- jumlah like
create or replace function public.on_like_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end;
        t public.like_target := coalesce(new.target_type, old.target_type);
        i uuid := coalesce(new.target_id, old.target_id);
begin
  if t = 'post' then
    update public.posts set like_count = greatest(like_count + d, 0) where id = i;
  elsif t = 'comment' then
    update public.comments set like_count = greatest(like_count + d, 0) where id = i;
  else
    update public.reviews set like_count = greatest(like_count + d, 0) where id = i;
  end if;
  return null;
end $$;
create trigger likes_stats after insert or delete on public.likes
  for each row execute function public.on_like_change();

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles        enable row level security;
alter table public.genres          enable row level security;
alter table public.comics          enable row level security;
alter table public.comic_genres    enable row level security;
alter table public.chapters        enable row level security;
alter table public.chapter_images  enable row level security;
alter table public.bookmarks       enable row level security;
alter table public.reading_history enable row level security;
alter table public.reviews         enable row level security;
alter table public.posts           enable row level security;
alter table public.poll_options    enable row level security;
alter table public.poll_votes      enable row level security;
alter table public.comments        enable row level security;
alter table public.likes           enable row level security;
alter table public.notifications   enable row level security;
alter table public.reports         enable row level security;

-- profiles
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
-- insert via trigger, delete via cascade dari auth.users (tidak ada policy = ditolak)

-- katalog (publik baca, admin tulis)
create policy genres_read on public.genres for select using (true);
create policy genres_admin on public.genres for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy comics_read on public.comics for select using (is_published or public.is_staff());
create policy comics_admin on public.comics for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy comic_genres_read on public.comic_genres for select
  using (exists (select 1 from public.comics c where c.id = comic_id));
create policy comic_genres_admin on public.comic_genres for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy chapters_read on public.chapters for select using (
  ((is_published and published_at <= now()) or public.is_staff())
  and exists (select 1 from public.comics c where c.id = comic_id));
create policy chapters_admin on public.chapters for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy chapter_images_read on public.chapter_images for select using (
  exists (select 1 from public.chapters ch where ch.id = chapter_id));
create policy chapter_images_admin on public.chapter_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- data pribadi
create policy bookmarks_own on public.bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy history_own on public.reading_history for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_read   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
-- notifications: insert hanya dari server (service role / fungsi security definer)

-- review
create policy reviews_read on public.reviews for select using (not is_hidden or user_id = auth.uid() or public.is_staff());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and public.can_write());
create policy reviews_update on public.reviews for update to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());
create policy reviews_delete on public.reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- komunitas
create policy posts_read on public.posts for select using (not is_hidden or user_id = auth.uid() or public.is_staff());
create policy posts_insert on public.posts for insert to authenticated with check (
  user_id = auth.uid() and public.can_write()
  and (category <> 'pengumuman' or public.is_staff())
  and not is_pinned and not is_locked and not is_hidden);
create policy posts_update on public.posts for update to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());
create policy posts_delete on public.posts for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy poll_options_read on public.poll_options for select using (true);
create policy poll_options_insert on public.poll_options for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));
create policy poll_votes_read on public.poll_votes for select to authenticated using (user_id = auth.uid());
create policy poll_votes_insert on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and public.can_write());

create policy comments_read on public.comments for select using (not is_hidden or user_id = auth.uid() or public.is_staff());
create policy comments_insert on public.comments for insert to authenticated with check (
  user_id = auth.uid() and public.can_write() and not is_hidden
  and exists (select 1 from public.posts p where p.id = post_id and not p.is_locked and not p.is_hidden));
create policy comments_update on public.comments for update to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy likes_read on public.likes for select to authenticated using (user_id = auth.uid());
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_write());
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

-- laporan
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and public.can_write());
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());
create policy reports_update on public.reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('covers',   'covers',   true,  5242880, array['image/jpeg','image/png','image/webp']),
  ('avatars',  'avatars',  true,  2097152, array['image/jpeg','image/png','image/webp']),
  ('chapters', 'chapters', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- cover & gambar chapter: hanya admin yang boleh upload/ubah/hapus
create policy "covers admin write"   on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and public.is_admin());
create policy "covers admin update"  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and public.is_admin());
create policy "covers admin delete"  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and public.is_admin());

create policy "chapters admin write"  on storage.objects for insert to authenticated
  with check (bucket_id = 'chapters' and public.is_admin());
create policy "chapters admin update" on storage.objects for update to authenticated
  using (bucket_id = 'chapters' and public.is_admin());
create policy "chapters admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chapters' and public.is_admin());

-- avatar: user hanya boleh menulis di folder bernama user id sendiri (avatars/<uid>/file)
create policy "avatars own write"  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
