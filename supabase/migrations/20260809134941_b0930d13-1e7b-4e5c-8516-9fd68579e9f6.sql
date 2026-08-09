drop policy if exists "Players read own club matches" on public.matches;

create policy "Players read own club matches"

  on public.matches for select to authenticated

  using (

    exists (select 1 from public.match_minutes mm

            where mm.match_id = matches.id and mm.player_id = auth.uid())

  );