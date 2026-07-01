-- Allow public (unauthenticated) reads on season_earnings so the public Standings page works.
drop policy if exists "Auth read season_earnings" on public.season_earnings;
create policy "Public read season_earnings" on public.season_earnings for select using (true);
