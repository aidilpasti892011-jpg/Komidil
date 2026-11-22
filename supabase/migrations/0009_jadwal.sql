-- =====================================================================
-- KOMIDIL tahap 11: jadwal rilis
-- Jalankan setelah 0001-0008. Aman diulang.
-- Chapter terjadwal (published_at di masa depan) disembunyikan RLS dari publik,
-- jadi kalender memakai RPC SECURITY DEFINER yang hanya membuka metadata
-- (komik, rentang nomor chapter, jam rilis). Judul chapter dan gambar TIDAK ikut.
-- Hari dihitung WIB (Asia/Jakarta).
-- =====================================================================

create index if not exists chapters_published_at_idx
  on public.chapters (published_at) where is_published;

create or replace function public.release_schedule(p_days integer default 7)
returns table (
  comic_id      uuid,
  slug          text,
  title         text,
  type          public.comic_type,
  cover_url     text,
  cover_hue     smallint,
  first_number  numeric,
  last_number   numeric,
  chapter_count integer,
  release_at    timestamptz,
  released      boolean,
  wib_day       date
)
language sql stable security definer set search_path = public as $$
  with win as (
    select ((date_trunc('day', now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta') as s,
           least(greatest(coalesce(p_days, 7), 1), 8) as n
  ),
  rows_ as (
    select ch.comic_id as cid, ch.number as num, ch.published_at as pub,
           (ch.published_at at time zone 'Asia/Jakarta')::date as d
    from win
    join public.chapters ch
      on ch.is_published
     and ch.published_at >= win.s
     and ch.published_at <  win.s + make_interval(days => win.n)
  )
  select c.id, c.slug, c.title, c.type, c.cover_url, c.cover_hue,
         min(r.num), max(r.num), count(*)::int,
         coalesce(min(r.pub) filter (where r.pub > now()), max(r.pub)),
         bool_and(r.pub <= now()),
         r.d
  from rows_ r
  join public.comics c on c.id = r.cid and c.is_published
  group by c.id, c.slug, c.title, c.type, c.cover_url, c.cover_hue, r.d
  order by 12, 10
  limit 300;
$$;

revoke all on function public.release_schedule(integer) from public;
grant execute on function public.release_schedule(integer) to anon, authenticated;
