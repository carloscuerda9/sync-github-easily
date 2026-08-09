-- 001_player_tag_history.sql
create table if not exists public.player_tag_history (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.profiles(id) on delete cascade,
  club_id        uuid references public.clubs(id) on delete set null,
  color          text not null check (color in ('green','yellow','orange','red')),
  previous_color text check (previous_color in ('green','yellow','orange','red')),
  set_by         uuid references public.profiles(id) on delete set null,
  set_at         timestamptz not null default now(),
  reason         text
);

create index if not exists idx_ptagh_player_setat
  on public.player_tag_history (player_id, set_at desc);

create index if not exists idx_ptagh_club_setat
  on public.player_tag_history (club_id, set_at desc);

create index if not exists idx_ptagh_color
  on public.player_tag_history (club_id, color, set_at desc);

alter table public.player_tag_history enable row level security;

drop policy if exists "Owner full access player_tag_history" on public.player_tag_history;
create policy "Owner full access player_tag_history"
  on public.player_tag_history for all to authenticated
  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));

drop policy if exists "Physios view club tag history" on public.player_tag_history;
create policy "Physios view club tag history"
  on public.player_tag_history for select to authenticated
  using (has_role(auth.uid(),'physio') and same_club(auth.uid(), player_id));

drop policy if exists "Coaches view club tag history" on public.player_tag_history;
create policy "Coaches view club tag history"
  on public.player_tag_history for select to authenticated
  using (has_role(auth.uid(),'coach') and same_club(auth.uid(), player_id));

drop policy if exists "Players view own tag history" on public.player_tag_history;
create policy "Players view own tag history"
  on public.player_tag_history for select to authenticated
  using (player_id = auth.uid());