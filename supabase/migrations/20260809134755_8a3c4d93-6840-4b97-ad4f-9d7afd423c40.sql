create table if not exists public.matches (

  id                uuid primary key default gen_random_uuid(),

  club_id           uuid not null references public.clubs(id) on delete cascade,

  fecha             date not null,

  rival             text not null,

  competicion       text,

  jornada           text,

  local_visitante   text check (local_visitante in ('local','visitante')),

  resultado_favor   integer check (resultado_favor  >= 0),

  resultado_contra  integer check (resultado_contra >= 0),

  acta_ref          text,

  duracion_min      integer not null default 80 check (duracion_min between 1 and 200),

  created_by        uuid references public.profiles(id) on delete set null,

  created_at        timestamptz not null default now(),

  updated_at        timestamptz not null default now()

);

create unique index if not exists matches_club_acta_uk

  on public.matches (club_id, acta_ref) where acta_ref is not null;

create index if not exists idx_matches_club_fecha

  on public.matches (club_id, fecha desc);

alter table public.matches enable row level security;

drop policy if exists "Owner full access matches" on public.matches;

create policy "Owner full access matches"

  on public.matches for all to authenticated

  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));

drop policy if exists "Staff read club matches" on public.matches;

create policy "Staff read club matches"

  on public.matches for select to authenticated

  using (

    club_id = get_user_club(auth.uid()) and is_approved(auth.uid())

    and (has_role(auth.uid(),'physio') or has_role(auth.uid(),'coach')

         or has_role(auth.uid(),'superadmin'))

  );

drop policy if exists "Staff insert club matches" on public.matches;

create policy "Staff insert club matches"

  on public.matches for insert to authenticated

  with check (

    club_id = get_user_club(auth.uid()) and is_approved(auth.uid())

    and created_by = auth.uid()

    and (has_role(auth.uid(),'physio') or has_role(auth.uid(),'coach')

         or has_role(auth.uid(),'superadmin'))

  );

drop policy if exists "Staff update club matches" on public.matches;

create policy "Staff update club matches"

  on public.matches for update to authenticated

  using (

    club_id = get_user_club(auth.uid()) and is_approved(auth.uid())

    and (has_role(auth.uid(),'physio') or has_role(auth.uid(),'coach')

         or has_role(auth.uid(),'superadmin'))

  )

  with check (club_id = get_user_club(auth.uid()));