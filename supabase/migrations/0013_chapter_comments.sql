-- KOMIDIL: Chapter Comments, Photos, Reactions & Stickers
-- Migration 0013

-- 1. STORAGE BUCKETS
insert into storage.buckets
(id, name, public, file_size_limit, allowed_mime_types)
values
('comment-photos', 'comment-photos', false, 5242880,
 array['image/jpeg','image/png','image/webp']),
('sticker-submissions', 'sticker-submissions', false, 5242880,
 array['image/jpeg','image/png','image/webp']),
('stickers', 'stickers', true, 2097152,
 array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
 public = excluded.public,
 file_size_limit = excluded.file_size_limit,
 allowed_mime_types = excluded.allowed_mime_types;

-- 2. OFFICIAL STICKERS
create table public.chapter_stickers (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 40),
 image_path text not null unique,
 is_active boolean not null default false,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);

-- 3. USER STICKER SUBMISSIONS
create table public.chapter_sticker_submissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 image_path text not null unique,
 description text check (char_length(description) <= 200),
 status text not null default 'pending'
   check (status in ('pending','approved','rejected')),
 moderated_by uuid references public.profiles(id) on delete set null,
 moderated_at timestamptz,
 created_at timestamptz not null default now()
);

create index chapter_sticker_submissions_user_idx
on public.chapter_sticker_submissions(user_id, created_at desc);

-- 4. CHAPTER COMMENTS
create table public.chapter_comments (
 id uuid primary key default gen_random_uuid(),
 chapter_id uuid not null references public.chapters(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 parent_id uuid references public.chapter_comments(id) on delete cascade,
 body text check (body is null or char_length(body) <= 2000),
 photo_path text,
 sticker_id uuid references public.chapter_stickers(id) on delete set null,
 is_hidden boolean not null default false,
 like_count integer not null default 0 check (like_count >= 0),
 created_at timestamptz not null default now(),
 constraint chapter_comment_content_check check (
   coalesce(char_length(trim(body)), 0) > 0
   or photo_path is not null
   or sticker_id is not null
 )
);

create index chapter_comments_chapter_idx
on public.chapter_comments(chapter_id, created_at);

create index chapter_comments_parent_idx
on public.chapter_comments(parent_id, created_at);

-- 5. COMMENT LIKES
create table public.chapter_comment_likes (
 comment_id uuid not null references public.chapter_comments(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (comment_id, user_id)
);

-- 6. COMMENT REPORTS
create table public.chapter_comment_reports (
 id uuid primary key default gen_random_uuid(),
 comment_id uuid not null references public.chapter_comments(id) on delete cascade,
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check (char_length(reason) between 3 and 100),
 detail text check (char_length(detail) <= 1000),
 status text not null default 'open'
   check (status in ('open','reviewing','resolved','dismissed')),
 resolved_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique (comment_id, reporter_id)
);

create index chapter_comment_reports_status_idx
on public.chapter_comment_reports(status, created_at desc);

-- 7. VALIDATE COMMENT PARENT, STICKER AND PHOTO
create or replace function public.validate_chapter_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent_chapter uuid;
  parent_hidden boolean;
  sticker_active boolean;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Login diperlukan';
  end if;

  -- A reply must belong to the same chapter.
  if new.parent_id is not null then
    select chapter_id, is_hidden
    into parent_chapter, parent_hidden
    from public.chapter_comments
    where id = new.parent_id;

    if not found
       or parent_chapter <> new.chapter_id
       or parent_hidden then
      raise exception 'Komentar induk tidak valid';
    end if;
  end if;

  -- Only active official stickers may be used.
  if new.sticker_id is not null then
    select is_active
    into sticker_active
    from public.chapter_stickers
    where id = new.sticker_id;

    if not found or not sticker_active then
      raise exception 'Stiker tidak tersedia';
    end if;
  end if;

  -- A user may only attach a photo from their own folder.
  if new.photo_path is not null then
    if left(new.photo_path, length(current_user_id::text) + 1)
       <> current_user_id::text || '/' then
      raise exception 'Foto bukan milik akun ini';
    end if;
  end if;

  return new;
end;
$$;

create trigger chapter_comment_validate
before insert or update of parent_id, chapter_id, sticker_id, photo_path
on public.chapter_comments
for each row
execute function public.validate_chapter_comment();


-- 8. AUTOMATIC COMMENT LIKE COUNTER
create or replace function public.update_chapter_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.chapter_comments
    set like_count = like_count + 1
    where id = new.comment_id;

    return new;
  else
    update public.chapter_comments
    set like_count = greatest(like_count - 1, 0)
    where id = old.comment_id;

    return old;
  end if;
end;
$$;

create trigger chapter_comment_like_stats
after insert or delete on public.chapter_comment_likes
for each row
execute function public.update_chapter_comment_like_count();


-- 9. ENABLE ROW LEVEL SECURITY
alter table public.chapter_stickers enable row level security;
alter table public.chapter_sticker_submissions enable row level security;
alter table public.chapter_comments enable row level security;
alter table public.chapter_comment_likes enable row level security;
alter table public.chapter_comment_reports enable row level security;

-- 10. OFFICIAL STICKER POLICIES
create policy chapter_stickers_read
on public.chapter_stickers for select
using (is_active or public.is_staff());

create policy chapter_stickers_admin_insert
on public.chapter_stickers for insert to authenticated
with check (public.is_admin());

create policy chapter_stickers_admin_update
on public.chapter_stickers for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy chapter_stickers_admin_delete
on public.chapter_stickers for delete to authenticated
using (public.is_admin());

-- 11. STICKER SUBMISSION POLICIES
create policy sticker_submissions_read
on public.chapter_sticker_submissions for select to authenticated
using (user_id = auth.uid() or public.is_staff());

create policy sticker_submissions_insert
on public.chapter_sticker_submissions for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_write()
  and status = 'pending'
  and moderated_by is null
  and moderated_at is null
);

create policy sticker_submissions_admin_update
on public.chapter_sticker_submissions for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 12. CHAPTER COMMENT POLICIES
create policy chapter_comments_read
on public.chapter_comments for select
using (
  (not is_hidden or user_id = auth.uid() or public.is_staff())
  and exists (
    select 1
    from public.chapters ch
    where ch.id = chapter_id
  )
);

create policy chapter_comments_insert
on public.chapter_comments for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_write()
  and not is_hidden
  and like_count = 0
  and exists (
    select 1
    from public.chapters ch
    where ch.id = chapter_id
  )
);

create policy chapter_comments_owner_delete
on public.chapter_comments for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy chapter_comments_admin_update
on public.chapter_comments for update to authenticated
using (public.is_admin())
with check (public.is_admin());


-- 13. COMMENT LIKE POLICIES
create policy chapter_comment_likes_read
on public.chapter_comment_likes for select to authenticated
using (true);

create policy chapter_comment_likes_insert
on public.chapter_comment_likes for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_write()
  and exists (
    select 1
    from public.chapter_comments c
    where c.id = comment_id
      and not c.is_hidden
  )
);

create policy chapter_comment_likes_delete
on public.chapter_comment_likes for delete to authenticated
using (user_id = auth.uid());

-- 14. COMMENT REPORT POLICIES
create policy chapter_comment_reports_insert
on public.chapter_comment_reports for insert to authenticated
with check (
  reporter_id = auth.uid()
  and public.can_write()
  and exists (
    select 1
    from public.chapter_comments c
    where c.id = comment_id
      and c.user_id <> auth.uid()
      and not c.is_hidden
  )
);

create policy chapter_comment_reports_read
on public.chapter_comment_reports for select to authenticated
using (reporter_id = auth.uid() or public.is_staff());

create policy chapter_comment_reports_admin_update
on public.chapter_comment_reports for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 15. COMMENT PHOTO STORAGE
create policy comment_photos_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comment-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_write()
);

drop policy if exists comment_photos_authenticated_read on storage.objects;

create policy comment_photos_authenticated_read
on storage.objects for select to authenticated
using (
  bucket_id = 'comment-photos'
  and exists (
    select 1
    from public.chapter_comments c
    where c.photo_path = storage.objects.name
      and (
        not c.is_hidden
        or c.user_id = auth.uid()
        or public.is_staff()
      )
  )
);

create policy comment_photos_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'comment-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 16. PRIVATE STICKER SUBMISSION STORAGE
create policy sticker_submission_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sticker-submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_write()
);

create policy sticker_submission_owner_staff_read
on storage.objects for select to authenticated
using (
  bucket_id = 'sticker-submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff()
  )
);

create policy sticker_submission_owner_staff_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'sticker-submissions'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff()
  )
);

-- 17. APPROVED STICKER STORAGE
create policy stickers_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'stickers'
  and public.is_admin()
);

create policy stickers_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'stickers'
  and public.is_admin()
)
with check (
  bucket_id = 'stickers'
  and public.is_admin()
);

create policy stickers_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'stickers'
  and public.is_admin()
);

-- 18. TABLE PRIVILEGES
grant select on public.chapter_stickers to anon, authenticated;
grant insert, update, delete on public.chapter_stickers to authenticated;

grant select, insert, update on public.chapter_sticker_submissions to authenticated;

grant select, insert, update, delete on public.chapter_comments to authenticated;
grant select on public.chapter_comments to anon;

grant select, insert, delete on public.chapter_comment_likes to authenticated;

grant select, insert, update on public.chapter_comment_reports to authenticated;


-- 20. VALIDATE STICKER SUBMISSION FILE
create or replace function public.validate_chapter_sticker_submission()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Pengajuan bukan milik akun ini';
  end if;

  if new.status <> 'pending'
     or new.moderated_by is not null
     or new.moderated_at is not null then
    raise exception 'Pengajuan baru harus berstatus pending';
  end if;

  if left(new.image_path, length(auth.uid()::text) + 1)
     <> auth.uid()::text || '/' then
    raise exception 'File bukan milik akun ini';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'sticker-submissions'
      and name = new.image_path
  ) then
    raise exception 'File stiker tidak ditemukan';
  end if;

  return new;
end;
$$;

create trigger chapter_sticker_submission_validate
before insert on public.chapter_sticker_submissions
for each row
execute function public.validate_chapter_sticker_submission();


-- 21. VALIDATE NEW COMMENT REPORTS
create or replace function public.validate_chapter_comment_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'Pelapor tidak valid';
  end if;

  if new.status <> 'open' or new.resolved_by is not null then
    raise exception 'Laporan baru harus berstatus open';
  end if;

  if not exists (
    select 1
    from public.chapter_comments c
    where c.id = new.comment_id
      and c.user_id <> auth.uid()
      and not c.is_hidden
  ) then
    raise exception 'Komentar tidak dapat dilaporkan';
  end if;

  return new;
end;
$$;

create trigger chapter_comment_report_validate
before insert on public.chapter_comment_reports
for each row
execute function public.validate_chapter_comment_report();


-- 22. FINAL PHOTO VALIDATION
create or replace function public.validate_chapter_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent_chapter uuid;
  parent_hidden boolean;
  sticker_active boolean;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Login diperlukan';
  end if;

  if new.parent_id is not null then
    select chapter_id, is_hidden
    into parent_chapter, parent_hidden
    from public.chapter_comments
    where id = new.parent_id;

    if not found
       or parent_chapter <> new.chapter_id
       or parent_hidden then
      raise exception 'Komentar induk tidak valid';
    end if;
  end if;

  if new.sticker_id is not null then
    select is_active
    into sticker_active
    from public.chapter_stickers
    where id = new.sticker_id;

    if not found or not sticker_active then
      raise exception 'Stiker tidak tersedia';
    end if;
  end if;
  if tg_op = 'INSERT' and new.user_id <> current_user_id then
    raise exception 'Komentar bukan milik akun ini';
  end if;

  if new.photo_path is not null then
    if left(new.photo_path, length(new.user_id::text) + 1)
       <> (new.user_id::text || '/') then
      raise exception 'Foto bukan milik akun komentar';
    end if;

    if not exists (
      select 1
      from storage.objects
      where bucket_id = 'comment-photos'
        and name = new.photo_path
    ) then
      raise exception 'File foto tidak ditemukan';
    end if;
  end if;

  return new;
end;
$$;

-- 23. STAFF MODERATION POLICIES AND SAFE UPDATE PERMISSIONS

-- Moderators and admins can add official stickers.
drop policy if exists chapter_stickers_admin_insert
on public.chapter_stickers;

create policy chapter_stickers_staff_insert
on public.chapter_stickers
for insert to authenticated
with check (public.is_staff());

-- Only staff can upload approved sticker assets.
drop policy if exists stickers_admin_insert
on storage.objects;

create policy stickers_staff_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'stickers'
  and public.is_staff()
);

-- Sticker submissions: moderation by staff only.
drop policy if exists sticker_submissions_admin_update
on public.chapter_sticker_submissions;

create policy sticker_submissions_staff_update
on public.chapter_sticker_submissions
for update to authenticated
using (public.is_staff())
with check (public.is_staff());

revoke update on table public.chapter_sticker_submissions
from authenticated;

grant update (status)
on table public.chapter_sticker_submissions
to authenticated;

-- Comments: staff may change visibility only.
drop policy if exists chapter_comments_admin_update
on public.chapter_comments;

create policy chapter_comments_staff_update
on public.chapter_comments
for update to authenticated
using (public.is_staff())
with check (public.is_staff());

revoke update on table public.chapter_comments
from authenticated;

grant update (is_hidden)
on table public.chapter_comments
to authenticated;

-- Reports: staff may change report status only.
drop policy if exists chapter_comment_reports_admin_update
on public.chapter_comment_reports;

create policy chapter_comment_reports_staff_update
on public.chapter_comment_reports
for update to authenticated
using (public.is_staff())
with check (public.is_staff());

revoke update on table public.chapter_comment_reports
from authenticated;

grant update (status)
on table public.chapter_comment_reports
to authenticated;

-- 24. MODERATION AUDIT VALIDATION

create or replace function public.guard_chapter_sticker_moderation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Akses moderasi diperlukan';
  end if;

  if old.status <> 'pending' then
    raise exception 'Pengajuan ini sudah dimoderasi';
  end if;

  if new.status not in ('approved', 'rejected') then
    raise exception 'Status moderasi tidak valid';
  end if;

  new.moderated_by := auth.uid();
  new.moderated_at := now();

  return new;
end;
$$;

create trigger chapter_sticker_moderation_guard
before update on public.chapter_sticker_submissions
for each row
execute function public.guard_chapter_sticker_moderation();

create or replace function public.guard_chapter_comment_report()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Akses moderasi diperlukan';
  end if;

  if old.status in ('resolved', 'dismissed') then
    raise exception 'Laporan sudah diselesaikan';
  end if;

  if new.status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Status laporan tidak valid';
  end if;

  if new.status = 'reviewing' then
    new.resolved_by := null;
  else
    new.resolved_by := auth.uid();
  end if;

  return new;
end;
$$;

create trigger chapter_comment_report_moderation_guard
before update on public.chapter_comment_reports
for each row
execute function public.guard_chapter_comment_report();

-- 25. VALIDATE OFFICIAL STICKER ASSET

create or replace function public.validate_chapter_sticker_asset()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Akses moderasi diperlukan';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'stickers'
      and name = new.image_path
  ) then
    raise exception 'File stiker resmi tidak ditemukan';
  end if;

  new.created_by := auth.uid();

  return new;
end;
$$;

create trigger chapter_sticker_asset_validate
before insert on public.chapter_stickers
for each row
execute function public.validate_chapter_sticker_asset();


-- 26. ALLOW STAFF TO ACTIVATE OFFICIAL STICKERS
drop policy if exists chapter_stickers_admin_update
on public.chapter_stickers;

create policy chapter_stickers_staff_update
on public.chapter_stickers
for update to authenticated
using (public.is_staff())
with check (public.is_staff());

revoke update on public.chapter_stickers from authenticated;

grant update (is_active)
on public.chapter_stickers to authenticated;
