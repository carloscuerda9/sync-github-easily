-- 006_match_minutes_extend.sql

alter table public.match_minutes

  add column if not exists match_id        uuid references public.matches(id) on delete cascade,

  add column if not exists dorsal          smallint check (dorsal between 1 and 99),

  add column if not exists entro_min       smallint check (entro_min between 0 and 200),

  add column if not exists salio_min       smallint check (salio_min between 0 and 200),

  add column if not exists minutos_amarilla smallint not null default 0

                                            check (minutos_amarilla between 0 and 200),

  add column if not exists motivo_salida   text check (motivo_salida in

      ('tactico','lesion','conmocion_hia','tarjeta_roja','tarjeta_amarilla',

       'fin_partido','otro')),

  add column if not exists tramos          jsonb;

create unique index if not exists match_minutes_match_player_uk

  on public.match_minutes (match_id, player_id) where match_id is not null;

create index if not exists idx_mm_match on public.match_minutes (match_id);