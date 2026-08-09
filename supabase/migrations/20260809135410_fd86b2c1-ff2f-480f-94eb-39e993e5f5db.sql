alter function public.normalize_name(text) set search_path to 'public';

grant select, insert, update, delete on public.matches            to authenticated;

grant select, insert, update, delete on public.player_aliases     to authenticated;

grant select                          on public.player_tag_history to authenticated;

grant select                          on public.v_player_tag_periods to authenticated;