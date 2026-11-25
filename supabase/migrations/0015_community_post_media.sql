-- KOMIDIL: media untuk post komunitas

alter table public.posts
  add column if not exists photo_path text,
  add column if not exists sticker_id uuid
    references public.chapter_stickers(id) on delete restrict;

alter table public.posts
  drop constraint if exists posts_body_check;
ALTER TABLE public.posts ALTER COLUMN body DROP NOT NULL;

alter table public.posts
  add constraint posts_body_or_media_check check (
    (body is not null and char_length(trim(body)) between 1 and 5000)
    or photo_path is not null
    or sticker_id is not null
  );

insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values
  ('community-post-photos', 'community-post-photos', false, 5242880,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

create policy community_post_photo_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-post-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_write()
);

create policy community_post_photo_read
on storage.objects for select to authenticated
using (
  bucket_id = 'community-post-photos'
  and exists (
    select 1 from public.posts p
    where p.photo_path = storage.objects.name
      and (not p.is_hidden or p.user_id = auth.uid() or public.is_staff())
  )
);

create policy community_post_photo_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-post-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
