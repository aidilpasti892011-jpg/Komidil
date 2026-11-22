-- ============================================================================
-- KOMIDIL 0012 - Semua moderasi terpusat pada Super Admin tunggal
-- Jalankan SETELAH 0001-0011. Aman dijalankan ulang.
-- Moderator boleh melihat konten/laporan untuk konteks, tetapi tidak dapat
-- menyembunyikan, menampilkan, mengunci, menyematkan, menghapus konten orang
-- lain, atau mengubah status laporan. Hanya role admin tunggal yang berwenang.
-- ============================================================================

-- Flag moderasi pada post hanya dapat diubah Super Admin.
create or replace function public.protect_post_flags() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.is_hidden := old.is_hidden;
    new.is_pinned := old.is_pinned;
    new.is_locked := old.is_locked;
    new.category := old.category;
    new.user_id := old.user_id;
    new.like_count := old.like_count;
    new.comment_count := old.comment_count;
    new.created_at := old.created_at;
    new.comic_id := old.comic_id;
  end if;
  return new;
end $$;

-- Flag moderasi pada komentar hanya dapat diubah Super Admin.
create or replace function public.protect_comment_flags() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.is_hidden := old.is_hidden;
    new.user_id := old.user_id;
    new.post_id := old.post_id;
    new.parent_id := old.parent_id;
    new.like_count := old.like_count;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

-- Flag moderasi pada review hanya dapat diubah Super Admin.
create or replace function public.protect_review_flags() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.is_hidden := old.is_hidden;
    new.user_id := old.user_id;
    new.comic_id := old.comic_id;
    new.like_count := old.like_count;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

-- Pengguna tetap dapat mengedit/menghapus konten miliknya sendiri.
-- Admin dapat mengelola seluruh konten; moderator tidak mendapat bypass.
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (
  user_id = auth.uid() and public.can_write()
  and (category <> 'pengumuman' or public.is_admin())
  and not is_pinned and not is_locked and not is_hidden);
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Laporan boleh dibaca staff, tetapi hanya Super Admin yang dapat memprosesnya.
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

comment on policy reports_update on public.reports is
  'Hanya Super Admin tunggal yang dapat mengubah status laporan.';
