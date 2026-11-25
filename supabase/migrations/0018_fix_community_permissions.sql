-- KOMIDIL: Fix community table privileges

grant select, insert, delete
on public.likes to authenticated;

grant select
on public.comments to anon, authenticated;

grant insert, update, delete
on public.comments to authenticated;
