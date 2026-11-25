-- Notifikasi Like komunitas
create or replace function public.notify_community_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
  post_id uuid;
  hidden boolean;
begin
  if new.target_type = 'post' then
    select user_id, id, is_hidden
    into author, post_id, hidden
    from public.posts
    where id = new.target_id;

  elsif new.target_type = 'comment' then
    select user_id, comments.post_id, is_hidden
    into author, post_id, hidden
    from public.comments
    where id = new.target_id;
  else
    return null;
  end if;

  if author is null or hidden or author = new.user_id then
    return null;
  end if;

  insert into public.notifications
    (user_id, type, title, body, link)
  values (
    author,
    'like',
    'Like baru',
    case
      when new.target_type = 'post'
        then 'Seseorang menyukai postinganmu.'
      else 'Seseorang menyukai komentarmu.'
    end,
    '/komunitas/' || post_id
  );

  return null;
end;
$$;

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify
after insert on public.likes
for each row execute function public.notify_community_like();

revoke all on function public.notify_community_like()
from public, anon, authenticated;

grant select, update, delete
on public.notifications to authenticated;
