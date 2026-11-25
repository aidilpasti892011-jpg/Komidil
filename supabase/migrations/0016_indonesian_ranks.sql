-- KOMIDIL: 10 Indonesian community ranks
-- XP pengguna tetap dipertahankan.

alter table public.profiles
  drop column rank_level;

alter table public.profiles
  add column rank_level smallint
  generated always as (
    case
      when xp >= 30000 then 9
      when xp >= 15000 then 8
      when xp >= 8000 then 7
      when xp >= 5000 then 6
      when xp >= 3000 then 5
      when xp >= 1500 then 4
      when xp >= 700 then 3
      when xp >= 300 then 2
      when xp >= 100 then 1
      else 0
    end
  ) stored;
