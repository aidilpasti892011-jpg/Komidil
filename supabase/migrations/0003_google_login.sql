-- =====================================================================
-- KOMIDIL - Login Google
-- Jalankan SETELAH 0001 dan 0002. Aman dijalankan ulang.
-- Profil otomatis: username dari email (atau nama), nama tampilan dan
-- foto dari akun Google. Username dijamin unik dan sesuai aturan.
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := meta ->> 'username';
  shown text := nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '');
  avatar text := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
  base text;
  uname text;
  tries int := 0;
begin
  if wanted is null or wanted !~ '^[A-Za-z0-9_]{3,20}$' then
    -- login Google: ambil dari bagian depan email
    base := regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^A-Za-z0-9_]', '', 'g');
    if length(base) < 3 then
      base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;
    wanted := left(base, 20);
  end if;
  uname := wanted;

  if shown is null then shown := wanted; end if;
  shown := left(shown, 40);
  if avatar is not null and avatar !~ '^https://' then avatar := null; end if;

  loop
    begin
      insert into public.profiles (id, username, display_name, avatar_url)
      values (new.id, uname, shown, avatar);
      exit;
    exception when unique_violation then
      tries := tries + 1;
      uname := left(wanted, 14) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);
      if tries > 5 then
        uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
        insert into public.profiles (id, username, display_name, avatar_url)
        values (new.id, uname, shown, avatar);
        exit;
      end if;
    end;
  end loop;
  return new;
end $$;
