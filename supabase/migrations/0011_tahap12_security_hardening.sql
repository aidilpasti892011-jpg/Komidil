-- ============================================================================
-- KOMIDIL Tahap 12 - hardening Client/Server, sesi baca, tamat seri, koleksi
-- Jalankan setelah 0001-0010. Migration additive dan aman dijalankan ulang.
-- Migration lama tidak diubah.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fondasi hardening fungsi SECURITY DEFINER yang diwarisi dari migration lama.
-- Role API tidak boleh membuat objek di public; pg_temp diletakkan paling akhir.
-- ---------------------------------------------------------------------------
revoke create on schema public from public, anon, authenticated, service_role;

do $$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prokind = 'f'
  loop
    execute pg_catalog.format(
      'alter function %I.%I(%s) set search_path = pg_catalog, public, pg_temp',
      r.nspname, r.proname, r.args
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Koleksi: serialisasi create per akun dan update jumlah item secara atomik
-- ---------------------------------------------------------------------------

create or replace function public.collections_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_count integer;
  v_owner uuid;
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if char_length(new.name) < 1 then
    raise exception 'Nama koleksi tidak boleh kosong' using errcode = '23514';
  end if;
  if new.description is not null then
    new.description := nullif(btrim(new.description), '');
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null or new.user_id is distinct from auth.uid() then
      raise exception 'Koleksi tidak ditemukan' using errcode = '42501';
    end if;
    -- Kunci baris profil per pengguna. Transaksi kedua menunggu transaksi pertama,
    -- lalu SELECT COUNT berikutnya melihat koleksi yang sudah committed.
    select p.id into v_owner
    from public.profiles p
    where p.id = new.user_id
    for update;
    if v_owner is null then
      raise exception 'Akun pemilik koleksi tidak ditemukan' using errcode = '23503';
    end if;

    select count(*)::integer into v_count
    from public.collections c
    where c.user_id = new.user_id;
    if v_count >= 20 then
      raise exception 'Maksimal 20 koleksi per akun' using errcode = '23514';
    end if;
    new.item_count := 0;
  else
    new.user_id := old.user_id;
    -- item_count hanya berubah melalui trigger item (nested trigger depth > 1).
    if pg_trigger_depth() = 1 then
      new.item_count := old.item_count;
    end if;
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function public.collections_guard() from public, anon, authenticated;
drop trigger if exists collections_guard on public.collections;
create trigger collections_guard
before insert or update on public.collections
for each row execute function public.collections_guard();

create or replace function public.collection_items_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_count integer;
  v_owner uuid;
begin
  if tg_op = 'INSERT' then
    -- Lock row induk terlebih dahulu. Semua operasi item pada koleksi yang sama
    -- diserialisasi; setelah lock didapat, cek duplikasi dan batas membaca state terbaru.
    select c.item_count, c.user_id into v_count, v_owner
    from public.collections c
    where c.id = new.collection_id
    for update;
    if not found or auth.uid() is null or v_owner is distinct from auth.uid() then
      raise exception 'Koleksi tidak ditemukan' using errcode = '42501';
    end if;

    -- Cegah double insert bahkan saat pemanggil memakai upsert/ignore-duplicates.
    if exists (
      select 1 from public.collection_items i
      where i.collection_id = new.collection_id and i.comic_id = new.comic_id
    ) then
      raise exception 'Komik sudah ada dalam koleksi' using errcode = '23505';
    end if;
    if v_count >= 100 then
      raise exception 'Maksimal 100 komik per koleksi' using errcode = '23514';
    end if;

    update public.collections c
       set item_count = v_count + 1,
           updated_at = clock_timestamp()
     where c.id = new.collection_id;
    return new;
  end if;

  -- DELETE yang bersaing tetap mengunci row koleksi yang sama dan tidak
  -- mengurangi jumlah di bawah nol. Cascade saat koleksi dihapus aman (0 row).
  update public.collections c
     set item_count = greatest(c.item_count - 1, 0),
         updated_at = clock_timestamp()
   where c.id = old.collection_id;
  return old;
end;
$$;

revoke all on function public.collection_items_guard() from public, anon, authenticated;
drop trigger if exists collection_items_guard on public.collection_items;
create trigger collection_items_guard
before insert or delete on public.collection_items
for each row execute function public.collection_items_guard();

-- Samakan counter materialized dengan data item aktual, tanpa menghapus item.
drop trigger if exists collections_guard on public.collections;
update public.collections c
   set item_count = (select count(*)::integer from public.collection_items i where i.collection_id = c.id);
create trigger collections_guard
before insert or update on public.collections
for each row execute function public.collections_guard();

-- Pastikan kebijakan kepemilikan tetap aktif dan tidak ada policy write yang lebih longgar.
drop policy if exists collections_select on public.collections;
drop policy if exists collections_insert on public.collections;
drop policy if exists collections_update on public.collections;
drop policy if exists collections_delete on public.collections;
create policy collections_select on public.collections
  for select to authenticated using (user_id = (select auth.uid()));
create policy collections_insert on public.collections
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_write());
create policy collections_update on public.collections
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_write());
create policy collections_delete on public.collections
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists collection_items_select on public.collection_items;
drop policy if exists collection_items_insert on public.collection_items;
drop policy if exists collection_items_delete on public.collection_items;
create policy collection_items_select on public.collection_items
  for select to authenticated using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid()))
  );
create policy collection_items_insert on public.collection_items
  for insert to authenticated with check (
    public.can_write()
    and exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.comics m where m.id = comic_id)
  );
create policy collection_items_delete on public.collection_items
  for delete to authenticated using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Progres maksimum chapter yang dilaporkan melalui RPC sesi, bukan kolom history yang dapat di-upsert klien.
-- Nilai awal untuk data lama 0 karena progres historis tidak bisa diverifikasi ulang.
alter table public.reading_log
  add column if not exists max_progress numeric(4,3) not null default 0
  check (max_progress between 0 and 1);

-- 2) Sesi baca server-side. chapter_views tetap dipakai untuk view count saja.
-- ---------------------------------------------------------------------------

create table if not exists public.reading_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  chapter_id         uuid not null references public.chapters(id) on delete cascade,
  comic_id           uuid not null references public.comics(id) on delete cascade,
  started_at         timestamptz not null default clock_timestamp(),
  last_progress_at   timestamptz,
  max_progress       numeric(4,3) not null default 0 check (max_progress between 0 and 1),
  completed_at       timestamptz,
  validated_at       timestamptz,
  expires_at         timestamptz not null default (clock_timestamp() + interval '2 hours'),
  created_at         timestamptz not null default clock_timestamp()
);
alter table public.reading_sessions add column if not exists validated_at timestamptz;
create index if not exists reading_sessions_user_open_idx
  on public.reading_sessions (user_id, expires_at) where completed_at is null;
create index if not exists reading_sessions_chapter_idx
  on public.reading_sessions (chapter_id, started_at desc);
alter table public.reading_sessions enable row level security;
revoke all on table public.reading_sessions from public, anon, authenticated;

create or replace function public.start_reading_session(p_chapter uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_comic uuid;
  v_session uuid;
  v_open integer;
begin
  if v_user is null or p_chapter is null then return null; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user
      and not (p.is_suspended and (p.suspended_until is null or p.suspended_until >= clock_timestamp()))
  ) then return null; end if;

  select ch.comic_id into v_comic
  from public.chapters ch
  join public.comics c on c.id = ch.comic_id
  where ch.id = p_chapter
    and ch.is_published
    and ch.published_at <= now()
    and c.is_published
    and exists (select 1 from public.chapter_images i where i.chapter_id = ch.id);
  if v_comic is null then return null; end if;

  -- Batasi sesi terbuka agar endpoint start tidak dapat dipakai memenuhi tabel.
  perform pg_advisory_xact_lock(hashtextextended('komidil:reading-session:' || v_user::text, 0));
  delete from public.reading_sessions s
   where s.user_id = v_user
     and (s.expires_at <= clock_timestamp() or s.completed_at < clock_timestamp() - interval '1 day');
  select count(*)::integer into v_open
  from public.reading_sessions s
  where s.user_id = v_user and s.completed_at is null and s.expires_at > clock_timestamp();
  if v_open >= 10 then return null; end if;

  insert into public.reading_sessions (user_id, chapter_id, comic_id)
  values (v_user, p_chapter, v_comic)
  returning id into v_session;
  return v_session;
end;
$$;

drop function if exists public.record_reading_progress(uuid, numeric);
create function public.record_reading_progress(p_session uuid, p_progress numeric)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_rows integer := 0;
  v_history_rows integer := 0;
  v_badges jsonb := '[]'::jsonb;
begin
  if v_user is null or p_session is null or p_progress is null or p_progress < 0 or p_progress > 1 then
    return jsonb_build_object('accepted', false, 'badges', '[]'::jsonb);
  end if;

  -- Progres boleh terus diperbarui setelah XP sesi diklaim sampai sesi kedaluwarsa,
  -- agar penyelesaian chapter >=95% tetap dapat direkam secara monotonik.
  update public.reading_sessions s
     set max_progress = greatest(s.max_progress, p_progress),
         last_progress_at = clock_timestamp()
   where s.id = p_session
     and s.user_id = v_user
     and s.expires_at > clock_timestamp()
     and exists (
       select 1 from public.profiles p
       where p.id = v_user
         and not (p.is_suspended and (p.suspended_until is null or p.suspended_until >= clock_timestamp()))
     )
     and exists (
       select 1 from public.chapters ch
       join public.comics c on c.id = ch.comic_id
       where ch.id = s.chapter_id
         and ch.comic_id = s.comic_id
         and ch.is_published
         and ch.published_at <= now()
         and c.id = s.comic_id
         and c.is_published
         and exists (select 1 from public.chapter_images i where i.chapter_id = ch.id)
     );
  if not found then
    return jsonb_build_object('accepted', false, 'badges', '[]'::jsonb);
  end if;

  -- Progress log permanen hanya boleh dinaikkan setelah syarat sesi divalidasi.
  -- Trigger menyegarkan flag tamat sebelum badge dihitung.
  update public.reading_log l
     set max_progress = p_progress
   where l.user_id = v_user
     and l.chapter_id = (select rs.chapter_id from public.reading_sessions rs where rs.id = p_session)
     and l.max_progress < p_progress
     and exists (
       select 1 from public.reading_sessions rs
       where rs.id = p_session and rs.validated_at is not null
     );
  get diagnostics v_rows = row_count;

  -- Setelah sesi divalidasi, sinkronkan progress history dari checkpoint sesi
  -- supaya flag seri tamat dan badge memakai satu progres maksimum yang sama.
  update public.reading_history h
     set progress = greatest(h.progress, p_progress)
   where h.user_id = v_user
     and h.chapter_id = (select rs.chapter_id from public.reading_sessions rs where rs.id = p_session)
     and h.comic_id = (select rs.comic_id from public.reading_sessions rs where rs.id = p_session)
     and h.progress < p_progress
     and exists (
       select 1 from public.reading_sessions rs
       where rs.id = p_session and rs.validated_at is not null
     );
  get diagnostics v_history_rows = row_count;

  if v_rows > 0 or v_history_rows > 0 then
    v_badges := coalesce(public._sync_achievements(v_user), '[]'::jsonb);
  end if;

  return jsonb_build_object('accepted', true, 'badges', v_badges);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Pisahkan: chapter tercatat dibaca, chapter terbaru tercapai, seri tamat resmi
-- ---------------------------------------------------------------------------

alter table public.reading_history
  add column if not exists reached_latest_chapter boolean not null default false;

create or replace function public.is_latest_published_chapter(p_comic uuid, p_chapter uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.comics c
    join public.chapters ch on ch.comic_id = c.id
    where c.id = p_comic
      and c.is_published
      and ch.id = p_chapter
      and ch.is_published
      and ch.published_at <= now()
      and ch.number = (
        select max(last_ch.number)
        from public.chapters last_ch
        where last_ch.comic_id = c.id
          and last_ch.is_published
          and last_ch.published_at <= now()
      )
  );
$$;

create or replace function public.is_valid_finished_read(
  p_user uuid, p_comic uuid, p_chapter uuid, p_progress numeric
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(
    p_progress >= 0.95
    and exists (
      select 1 from public.comics c
      where c.id = p_comic
        and c.status = 'completed'::public.comic_status
        and c.is_published
    )
    and public.is_latest_published_chapter(p_comic, p_chapter)
    and exists (
      select 1 from public.reading_log l
      where l.user_id = p_user
        and l.comic_id = p_comic
        and l.chapter_id = p_chapter
        and l.max_progress >= 0.95
    ), false
  );
$$;

create or replace function public.reading_history_finish_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.chapters ch
    where ch.id = new.chapter_id and ch.comic_id = new.comic_id
  ) then
    raise exception 'Chapter tidak cocok dengan komik pada riwayat baca' using errcode = '23514';
  end if;
  new.reached_latest_chapter := public.is_latest_published_chapter(new.comic_id, new.chapter_id);
  new.is_finished := public.is_valid_finished_read(new.user_id, new.comic_id, new.chapter_id, new.progress);
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.refresh_finished_for_comic(p_user uuid, p_comic uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.reading_history h
     set reached_latest_chapter = public.is_latest_published_chapter(h.comic_id, h.chapter_id),
         is_finished = public.is_valid_finished_read(h.user_id, h.comic_id, h.chapter_id, h.progress)
   where h.user_id = p_user and h.comic_id = p_comic;
end;
$$;

create or replace function public.reading_log_refresh_finished()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  perform public.refresh_finished_for_comic(new.user_id, new.comic_id);
  return new;
end;
$$;

drop trigger if exists reading_history_finish_guard on public.reading_history;
create trigger reading_history_finish_guard
before insert or update on public.reading_history
for each row execute function public.reading_history_finish_guard();

drop trigger if exists reading_log_refresh_finished on public.reading_log;
drop trigger if exists reading_log_progress_refresh_finished on public.reading_log;
create trigger reading_log_refresh_finished
after insert on public.reading_log
for each row execute function public.reading_log_refresh_finished();
create trigger reading_log_progress_refresh_finished
after update of max_progress on public.reading_log
for each row execute function public.reading_log_refresh_finished();

create or replace function public.comic_refresh_finished()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.reading_history h
     set reached_latest_chapter = public.is_latest_published_chapter(h.comic_id, h.chapter_id),
         is_finished = public.is_valid_finished_read(h.user_id, h.comic_id, h.chapter_id, h.progress)
   where h.comic_id = new.id;
  return new;
end;
$$;

drop trigger if exists comics_refresh_finished on public.comics;
create trigger comics_refresh_finished
after update of status, is_published on public.comics
for each row execute function public.comic_refresh_finished();

create or replace function public.chapter_refresh_finished()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.reading_history h
       set reached_latest_chapter = public.is_latest_published_chapter(h.comic_id, h.chapter_id),
           is_finished = public.is_valid_finished_read(h.user_id, h.comic_id, h.chapter_id, h.progress)
     where h.comic_id = old.comic_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.comic_id is distinct from new.comic_id then
    update public.reading_history h
       set reached_latest_chapter = public.is_latest_published_chapter(h.comic_id, h.chapter_id),
           is_finished = public.is_valid_finished_read(h.user_id, h.comic_id, h.chapter_id, h.progress)
     where h.comic_id = old.comic_id;
  end if;
  update public.reading_history h
     set reached_latest_chapter = public.is_latest_published_chapter(h.comic_id, h.chapter_id),
         is_finished = public.is_valid_finished_read(h.user_id, h.comic_id, h.chapter_id, h.progress)
   where h.comic_id = new.comic_id;
  return new;
end;
$$;

drop trigger if exists chapters_refresh_finished on public.chapters;
create trigger chapters_refresh_finished
after insert or delete or update of comic_id, number, is_published, published_at on public.chapters
for each row execute function public.chapter_refresh_finished();

-- Rapikan nilai is_finished lama yang sebelumnya hanya bergantung pada chapter terakhir.
update public.reading_history h
   set reached_latest_chapter = public.is_latest_published_chapter(h.comic_id, h.chapter_id),
       is_finished = public.is_valid_finished_read(h.user_id, h.comic_id, h.chapter_id, h.progress)
 where h.reached_latest_chapter is distinct from public.is_latest_published_chapter(h.comic_id, h.chapter_id)
    or h.is_finished is distinct from public.is_valid_finished_read(h.user_id, h.comic_id, h.chapter_id, h.progress);
comment on column public.reading_history.reached_latest_chapter is
  'True bila chapter pada riwayat adalah chapter terbit terbaru komik; tidak berarti seri resmi sudah tamat.';
comment on column public.reading_history.is_finished is
  'True hanya bila komik resmi completed, chapter terbaru tercapai, history progress >=95%, dan reading_log.max_progress >=95%.';

-- ---------------------------------------------------------------------------
-- 4) Selesaikan sesi secara atomik: validasi, log, XP, badge dalam satu transaksi
-- ---------------------------------------------------------------------------

create or replace function public.complete_reading_session(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.reading_sessions%rowtype;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_history_updated integer := 0;
  v_xp integer := 0;
  v_badges jsonb := '[]'::jsonb;
begin
  if v_user is null or p_session is null or not exists (
    select 1 from public.profiles p
    where p.id = v_user
      and not (p.is_suspended and (p.suspended_until is null or p.suspended_until >= clock_timestamp()))
  ) then
    return jsonb_build_object('accepted', false, 'xp', 0, 'badges', '[]'::jsonb);
  end if;

  select * into v_session
  from public.reading_sessions s
  where s.id = p_session and s.user_id = v_user
  for update;
  if not found
     or v_session.completed_at is not null
     or v_session.expires_at <= clock_timestamp()
     or v_session.started_at > clock_timestamp() - interval '30 seconds'
     or v_session.max_progress < 0.6
     or v_session.last_progress_at is null
     or v_session.last_progress_at < v_session.started_at + interval '25 seconds' then
    return jsonb_build_object('accepted', false, 'xp', 0, 'badges', '[]'::jsonb);
  end if;

  -- Konten harus tetap publik/terbit dan masih memiliki gambar saat klaim.
  if not exists (
    select 1 from public.chapters ch
    join public.comics c on c.id = ch.comic_id
    where ch.id = v_session.chapter_id
      and ch.comic_id = v_session.comic_id
      and ch.is_published
      and ch.published_at <= now()
      and c.is_published
      and exists (select 1 from public.chapter_images i where i.chapter_id = ch.id)
  ) then
    update public.reading_sessions
       set completed_at = clock_timestamp()
     where id = v_session.id;
    return jsonb_build_object('accepted', false, 'xp', 0, 'badges', '[]'::jsonb);
  end if;

  update public.reading_sessions
     set completed_at = clock_timestamp(),
         validated_at = clock_timestamp()
   where id = v_session.id;

  insert into public.reading_log (user_id, chapter_id, comic_id, max_progress)
  values (v_user, v_session.chapter_id, v_session.comic_id, v_session.max_progress)
  on conflict (user_id, chapter_id) do nothing;
  get diagnostics v_inserted = row_count;

  -- Progress log permanen hanya boleh dinaikkan setelah durasi sesi lolos.
  -- Ini juga memperbarui max_progress untuk log lama tanpa membuat XP kedua.
  update public.reading_log l
     set max_progress = v_session.max_progress
   where l.user_id = v_user
     and l.chapter_id = v_session.chapter_id
     and l.max_progress < v_session.max_progress;
  get diagnostics v_updated = row_count;

  -- Riwayat progres diselaraskan setelah sesi dan reading_log valid, bukan
  -- dari input upsert client saja. Trigger history menghitung ulang is_finished.
  update public.reading_history h
     set progress = greatest(h.progress, v_session.max_progress)
   where h.user_id = v_user
     and h.comic_id = v_session.comic_id
     and h.chapter_id = v_session.chapter_id
     and h.progress < v_session.max_progress;
  get diagnostics v_history_updated = row_count;

  if v_inserted = 1 then
    -- XP boleh 0 bila batas harian tercapai; reading_log tetap tercatat.
    v_xp := public.award_xp(v_user, 'read', v_session.chapter_id);
  end if;
  if v_inserted = 1 or v_updated > 0 or v_history_updated > 0 then
    -- Sinkronisasi juga diperlukan bila sesi baru menyempurnakan log chapter lama.
    v_badges := coalesce(public._sync_achievements(v_user), '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'accepted', (v_inserted = 1),
    'xp', coalesce(v_xp, 0),
    'badges', coalesce(v_badges, '[]'::jsonb)
  );
end;
$$;

-- Fungsi lama tidak lagi boleh dipakai: keduanya memanfaatkan timestamp chapter_views lama.
-- Tetap dipertahankan dengan signature lama untuk mencegah ketergantungan DB yang rusak.
create or replace function public.claim_chapter_xp(p_chapter uuid, p_progress numeric)
returns integer
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$ select 0 $$;

create or replace function public.log_chapter_read(p_chapter uuid, p_progress numeric)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$ select '[]'::jsonb $$;

revoke all on function public.start_reading_session(uuid) from public, anon, authenticated;
revoke all on function public.record_reading_progress(uuid, numeric) from public, anon, authenticated;
revoke all on function public.complete_reading_session(uuid) from public, anon, authenticated;
grant execute on function public.start_reading_session(uuid) to authenticated;
grant execute on function public.record_reading_progress(uuid, numeric) to authenticated;
grant execute on function public.complete_reading_session(uuid) to authenticated;
revoke all on function public.claim_chapter_xp(uuid, numeric) from public, anon, authenticated;
revoke all on function public.log_chapter_read(uuid, numeric) from public, anon, authenticated;

revoke all on function public.is_latest_published_chapter(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_valid_finished_read(uuid, uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.reading_history_finish_guard() from public, anon, authenticated;
revoke all on function public.refresh_finished_for_comic(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reading_log_refresh_finished() from public, anon, authenticated;
revoke all on function public.comic_refresh_finished() from public, anon, authenticated;
revoke all on function public.chapter_refresh_finished() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Catatan batasan: progres visual tetap merupakan sinyal dari browser.
-- ---------------------------------------------------------------------------
comment on table public.reading_sessions is
  'Sesi baca dibuat server dengan waktu database; klaim XP hanya sekali, minimal 30 detik, checkpoint progres >=60%, konten masih publik. validated_at hanya diisi setelah syarat sesi lolos; progres maksimum chapter disimpan di reading_log. Nilai progres tetap input browser dan bukan bukti kriptografis bahwa halaman benar-benar dilihat.';
comment on column public.reading_sessions.max_progress is
  'Nilai progres maksimum yang dilaporkan browser dan disimpan monotonik oleh RPC ke sesi serta reading_log; tidak dapat membuktikan pixel/gambar benar-benar dilihat.';

-- ---------------------------------------------------------------------------
-- 6) XP tidak boleh diubah melalui UPDATE langsung dari client.
--    Hanya fungsi trusted award/revoke/restore yang menyalakan marker transaksi
--    internal tepat sebelum UPDATE; trigger selalu menolak perubahan lainnya.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_xp_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.xp is distinct from old.xp
     and pg_catalog.current_setting('komidil.allow_xp_write', true) is distinct from 'on' then
    raise exception 'XP hanya dapat diubah melalui mekanisme server' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_xp_write() from public, anon, authenticated;
drop trigger if exists profiles_xp_write_guard on public.profiles;
create trigger profiles_xp_write_guard
before update of xp on public.profiles
for each row execute function public.guard_profile_xp_write();

-- Pertahankan aturan XP lama (unique event, cap harian, suspend check, revoke ledger),
-- sekaligus aktifkan marker internal untuk trigger penjaga kolom profiles.xp.
create or replace function public.award_xp(p_user uuid, p_kind text, p_src uuid, p_actor uuid default null)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
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

  if not exists (
    select 1 from public.profiles
    where id = p_user
      and not (is_suspended and (suspended_until is null or suspended_until >= now()))
  ) then
    return 0;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('xp:' || p_user::text));
  select coalesce(sum(amount) filter (where kind = p_kind), 0),
         coalesce(sum(amount), 0)
    into used_kind, used_all
  from public.xp_events
  where user_id = p_user and day = d;

  g := least(r_rule.amount, r_rule.daily_cap - used_kind, day_cap - used_all);
  if g <= 0 then return 0; end if;

  insert into public.xp_events (user_id, kind, src, actor, amount, day)
  values (p_user, p_kind, p_src, act, g, d)
  on conflict (user_id, kind, src, actor) do nothing
  returning id into new_id;
  if new_id is null then return 0; end if;

  perform pg_catalog.set_config('komidil.allow_xp_write', 'on', true);
  update public.profiles set xp = xp + g where id = p_user;
  perform pg_catalog.set_config('komidil.allow_xp_write', 'off', true);
  return g;
end;
$$;
revoke all on function public.award_xp(uuid, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.revoke_xp(p_src uuid, p_user uuid default null, p_kind text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  perform pg_catalog.set_config('komidil.allow_xp_write', 'on', true);
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
  perform pg_catalog.set_config('komidil.allow_xp_write', 'off', true);
end;
$$;
revoke all on function public.revoke_xp(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.restore_xp(p_src uuid, p_user uuid default null, p_kind text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  perform pg_catalog.set_config('komidil.allow_xp_write', 'on', true);
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
  perform pg_catalog.set_config('komidil.allow_xp_write', 'off', true);
end;
$$;
revoke all on function public.restore_xp(uuid, uuid, text) from public, anon, authenticated;

