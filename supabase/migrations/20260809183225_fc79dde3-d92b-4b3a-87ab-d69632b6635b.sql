drop index if exists public.match_minutes_match_player_uk;

create unique index if not exists match_minutes_match_player_uk
  on public.match_minutes (match_id, player_id);