create or replace function public.normalize_name(_txt text)

returns text language sql immutable as $$

  select nullif(btrim(regexp_replace(

    upper(translate(coalesce(_txt,''),

      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',

      'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),

    '[^A-Z0-9]+', ' ', 'g')), '')

$$;

create table if not exists public.player_aliases (

  id               uuid primary key default gen_random_uuid(),

  club_id          uuid not null references public.clubs(id) on delete cascade,

  player_id        uuid not null references public.profiles(id) on delete cascade,

  alias_raw        text not null,

  alias_normalized text generated always as (public.normalize_name(alias_raw)) stored,

  source           text not null default 'aprendido'

                   check (source in ('declarado','aprendido','corregido')),

  confidence       numeric(4,3) check (confidence between 0 and 1),

  created_by       uuid references public.profiles(id) on delete set null,

  created_at       timestamptz not null default now()

);

create unique index if not exists player_aliases_club_norm_uk

  on public.player_aliases (club_id, alias_normalized);

create index if not exists idx_aliases_player on public.player_aliases (player_id);

alter table public.player_aliases enable row level security;

drop policy if exists "Owner full access player_aliases" on public.player_aliases;

create policy "Owner full access player_aliases"

  on public.player_aliases for all to authenticated

  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));

drop policy if exists "Staff manage club aliases" on public.player_aliases;

create policy "Staff manage club aliases"

  on public.player_aliases for all to authenticated

  using (staff_shares_club_with(auth.uid(), player_id))

  with check (staff_shares_club_with(auth.uid(), player_id)

              and club_id = get_user_club(auth.uid()));

drop policy if exists "Players manage own aliases" on public.player_aliases;

create policy "Players manage own aliases"

  on public.player_aliases for all to authenticated

  using (player_id = auth.uid())

  with check (player_id = auth.uid() and club_id = get_user_club(auth.uid()));