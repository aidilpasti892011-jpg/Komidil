-- =====================================================================
-- KOMIDIL - Langkah 6: Komunitas (polling, balasan, anti-spam, notifikasi)
-- Jalankan SETELAH 0001, 0002, 0003. Aman dijalankan ulang.
-- =====================================================================

-- 1) Kolom hitungan/waktu tidak boleh diubah user lewat API (hanya trigger).
create or replace function public.protect_post_flags() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_staff() then
    new.is_hidden := old.is_hidden;  new.is_pinned := old.is_pinned;
    new.is_locked := old.is_locked;  new.category  := old.category;
    new.user_id   := old.user_id;    new.like_count := old.like_count;
    new.comment_count := old.comment_count; new.created_at := old.created_at;
    new.comic_id := old.comic_id;
  end if;
  return new;
end $$;

create or replace function public.protect_comment_flags() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_staff() then
    new.is_hidden := old.is_hidden; new.user_id := old.user_id; new.post_id := old.post_id;
    new.parent_id := old.parent_id; new.like_count := old.like_count; new.created_at := old.created_at;
  end if;
  return new;
end $$;

create or replace function public.protect_review_flags() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_staff() then
    new.is_hidden := old.is_hidden; new.user_id := old.user_id; new.comic_id := old.comic_id;
    new.like_count := old.like_count; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists reviews_protect on public.reviews;
create trigger reviews_protect before update on public.reviews
  for each row execute function public.protect_review_flags();

-- 2) Anti-spam: batas posting per user (staff dikecualikan).
create or replace function public.limit_post_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if (select count(*) from public.posts where user_id = new.user_id and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Terlalu banyak postingan. Tunggu beberapa menit.';
  end if;
  return new;
end $$;
drop trigger if exists posts_rate on public.posts;
create trigger posts_rate before insert on public.posts
  for each row execute function public.limit_post_rate();

-- 3) Komentar: balasan maksimal 1 tingkat, harus di post yang sama, batas per menit.
create or replace function public.check_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare pp record;
begin
  if new.parent_id is not null then
    select post_id, parent_id into pp from public.comments where id = new.parent_id;
    if not found or pp.post_id <> new.post_id or pp.parent_id is not null then
      raise exception 'Balasan tidak valid.';
    end if;
  end if;
  if not public.is_staff() and
     (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Terlalu cepat. Tunggu sebentar sebelum berkomentar lagi.';
  end if;
  return new;
end $$;
drop trigger if exists comments_check on public.comments;
create trigger comments_check before insert on public.comments
  for each row execute function public.check_comment();

-- 4) Polling: opsi 2-6 hanya di post kategori polling; vote 1x per post, hitungan lewat trigger.
create or replace function public.check_poll_option() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.posts where id = new.post_id and category = 'polling') then
    raise exception 'Opsi hanya untuk post polling.';
  end if;
  if (select count(*) from public.poll_options where post_id = new.post_id) >= 6 then
    raise exception 'Maksimal 6 opsi.';
  end if;
  if (select created_at from public.posts where id = new.post_id) < now() - interval '2 minutes' then
    raise exception 'Opsi tidak bisa ditambah setelah polling dibuat.';
  end if;
  return new;
end $$;
drop trigger if exists poll_option_check on public.poll_options;
create trigger poll_option_check before insert on public.poll_options
  for each row execute function public.check_poll_option();

create or replace function public.on_poll_vote() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.poll_options where id = new.option_id and post_id = new.post_id) then
    raise exception 'Opsi tidak cocok dengan polling.';
  end if;
  if exists (select 1 from public.posts where id = new.post_id and (is_locked or is_hidden)) then
    raise exception 'Polling sudah ditutup.';
  end if;
  update public.poll_options set votes = votes + 1 where id = new.option_id;
  return new;
end $$;
drop trigger if exists poll_vote_count on public.poll_votes;
create trigger poll_vote_count before insert on public.poll_votes
  for each row execute function public.on_poll_vote();
-- vote tidak boleh diubah/dihapus user (tidak ada policy update/delete = ditolak)

-- 5) Notifikasi balasan/komentar (hanya lewat fungsi security definer).
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; parent_author uuid; snippet text := left(new.body, 120);
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, type, title, body, link)
    values (owner, 'comment', 'Komentar baru di post kamu', snippet, '/komunitas/' || new.post_id);
  end if;
  if new.parent_id is not null then
    select user_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.user_id and parent_author is distinct from owner then
      insert into public.notifications (user_id, type, title, body, link)
      values (parent_author, 'reply', 'Ada balasan untuk komentarmu', snippet, '/komunitas/' || new.post_id);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

-- 6) Indeks untuk daftar komunitas
create index if not exists posts_list_idx on public.posts (category, is_pinned desc, created_at desc);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists reviews_recent_idx on public.reviews (created_at desc);
