-- Owner can edit their own comment body.
create policy chapter_comments_owner_update
on public.chapter_comments
for update to authenticated
using (
  user_id = auth.uid()
  and public.can_write()
)
with check (
  user_id = auth.uid()
  and public.can_write()
);

grant update (body)
on public.chapter_comments to authenticated;

-- Only admin can moderate comment visibility.
drop policy if exists chapter_comments_staff_update
on public.chapter_comments;

create policy chapter_comments_admin_update
on public.chapter_comments
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.guard_comment_visibility()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.is_hidden is distinct from new.is_hidden
     and not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah visibilitas komentar';
  end if;
  return new;
end;
$$;

create trigger chapter_comment_visibility_guard
before update on public.chapter_comments
for each row
execute function public.guard_comment_visibility();
