-- =====================================================================
-- KOMIDIL tahap 10: pencarian pintar + filter lanjutan
-- Jalankan setelah 0001-0007. Aman diulang.
-- Cari di judul, judul alternatif, author, artist. Toleran typo (pg_trgm).
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- 1) Teks pencarian per komik, dijaga trigger
alter table public.comics add column if not exists search_text text not null default '';

create or replace function public.comics_search_text() returns trigger
language plpgsql as $$
begin
  new.search_text := lower(
    coalesce(new.title, '') || ' ' || coalesce(array_to_string(new.alt_titles, ' '), '') || ' ' ||
    coalesce(new.author, '') || ' ' || coalesce(new.artist, ''));
  return new;
end $$;

drop trigger if exists comics_search_text on public.comics;
create trigger comics_search_text
  before insert or update of title, alt_titles, author, artist on public.comics
  for each row execute function public.comics_search_text();

update public.comics set search_text = lower(
  coalesce(title, '') || ' ' || coalesce(array_to_string(alt_titles, ' '), '') || ' ' ||
  coalesce(author, '') || ' ' || coalesce(artist, ''));

create index if not exists comics_search_trgm_idx
  on public.comics using gin (search_text extensions.gin_trgm_ops);
create index if not exists comics_follower_idx on public.comics (follower_count desc);
create index if not exists comic_genres_genre_idx on public.comic_genres (genre_id, comic_id);

-- 2) Pencarian + filter. SECURITY INVOKER: RLS tetap berlaku (komik tidak terbit tidak ikut).
--    Mengembalikan id berurutan + total hasil; data kartu diambil lagi oleh aplikasi.
--    p_sort: rel | up | pop | r | az | new | fol
create or replace function public.search_comics(
  p_q          text    default '',
  p_type       text    default null,
  p_status     text    default null,
  p_genres     text[]  default '{}',
  p_all_genres boolean default false,
  p_min_rating numeric default 0,
  p_sort       text    default 'up',
  p_limit      integer default 8,
  p_offset     integer default 0
) returns table (id uuid, total bigint)
language plpgsql stable set search_path = public, extensions as $$
declare
  q     text    := left(lower(btrim(coalesce(p_q, ''))), 60);
  esc   text    := replace(replace(replace(left(lower(btrim(coalesce(p_q, ''))), 60), '\', '\\'), '%', '\%'), '_', '\_');
  take  integer := least(greatest(coalesce(p_limit, 8), 1), 97);
  skip  integer := greatest(coalesce(p_offset, 0), 0);
  gs    text[]  := coalesce(p_genres, '{}');
  sortk text    := coalesce(p_sort, 'up');
begin
  if cardinality(gs) > 5 then gs := gs[1:5]; end if;
  if sortk = 'rel' and q = '' then sortk := 'up'; end if;

  return query
  select s.id, count(*) over ()
  from (
    select c.id, c.title, c.pop_score, c.rating_avg, c.follower_count, c.created_at, c.last_chapter_at,
      case when q = '' then 0::real else (
        (case when lower(c.title) = q then 4
              when lower(c.title) like esc || '%' escape '\' then 3
              when lower(c.title) like '%' || esc || '%' escape '\' then 2
              when c.search_text like '%' || esc || '%' escape '\' then 1
              else 0 end)
        + word_similarity(q, c.search_text))::real end as rel
    from public.comics c
    where (q = '' or c.search_text like '%' || esc || '%' escape '\' or word_similarity(q, c.search_text) >= 0.45)
      and (coalesce(p_type, '')   = '' or c.type::text   = p_type)
      and (coalesce(p_status, '') = '' or c.status::text = p_status)
      and c.rating_avg >= coalesce(p_min_rating, 0)
      and (cardinality(gs) = 0 or (
            select count(distinct g.slug)
            from public.comic_genres cg join public.genres g on g.id = cg.genre_id
            where cg.comic_id = c.id and g.slug = any (gs)
          ) >= case when p_all_genres then cardinality(gs) else 1 end)
  ) s
  order by
    case when sortk = 'rel' then s.rel end desc nulls last,
    case when sortk = 'pop' then s.pop_score end desc nulls last,
    case when sortk = 'r'   then s.rating_avg end desc nulls last,
    case when sortk = 'fol' then s.follower_count end desc nulls last,
    case when sortk = 'new' then s.created_at end desc nulls last,
    case when sortk = 'az'  then s.title end asc,
    case when sortk not in ('rel', 'pop', 'r', 'fol', 'new', 'az') then s.last_chapter_at end desc nulls last,
    s.title asc
  limit take offset skip;
end $$;
revoke all on function public.search_comics(text, text, text, text[], boolean, numeric, text, integer, integer) from public;
grant execute on function public.search_comics(text, text, text, text[], boolean, numeric, text, integer, integer) to anon, authenticated;

-- 3) Saran saat mengetik (maks 6)
create or replace function public.suggest_comics(p_q text)
returns table (slug text, title text, type text)
language plpgsql stable set search_path = public, extensions as $$
declare
  q   text := left(lower(btrim(coalesce(p_q, ''))), 60);
  esc text := replace(replace(replace(left(lower(btrim(coalesce(p_q, ''))), 60), '\', '\\'), '%', '\%'), '_', '\_');
begin
  if char_length(q) < 2 then return; end if;
  return query
  select c.slug, c.title, c.type::text
  from public.comics c
  where c.search_text like '%' || esc || '%' escape '\' or word_similarity(q, c.search_text) >= 0.5
  order by (lower(c.title) like esc || '%' escape '\') desc, word_similarity(q, c.search_text) desc, c.pop_score desc
  limit 6;
end $$;
revoke all on function public.suggest_comics(text) from public;
grant execute on function public.suggest_comics(text) to anon, authenticated;
