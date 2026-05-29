-- Create policies for startup_visits
drop policy if exists "startup_visits_insert" on public.startup_visits;
create policy "startup_visits_insert" on public.startup_visits for insert with check (auth.uid() = visitor_uid);

drop policy if exists "startup_visits_select" on public.startup_visits;
create policy "startup_visits_select" on public.startup_visits for select using (
  exists (
    select 1 from public.startups
    where id = startup_id and owner_uid = auth.uid()
  ) or public.is_admin()
);
