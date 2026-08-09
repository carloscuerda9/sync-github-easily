alter table public.injuries

  add column if not exists club_id             uuid references public.clubs(id) on delete set null,

  add column if not exists mechanism           text,

  add column if not exists expected_return_date date,

  add column if not exists actual_return_date   date,

  add column if not exists match_id            uuid references public.matches(id) on delete set null,

  add column if not exists is_recurrence       boolean not null default false;

alter table public.injuries

  drop constraint if exists injuries_dates_check;

alter table public.injuries

  add constraint injuries_dates_check check (

    (expected_return_date is null or expected_return_date >= injury_date) and

    (actual_return_date   is null or actual_return_date   >= injury_date)

  );

update public.injuries i

set club_id = p.club_id

from public.profiles p

where p.id = i.player_id and i.club_id is null;

create index if not exists idx_injuries_club_date

  on public.injuries (club_id, injury_date desc);

create index if not exists idx_injuries_bodypart

  on public.injuries (club_id, body_part, injury_date desc);