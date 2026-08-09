create or replace view public.v_player_tag_periods
with (security_invoker = true) as
with base as (
  select h.id, h.player_id, h.club_id, h.color, h.previous_color,
         h.set_by, h.reason, h.set_at as valid_from,
         lead(h.set_at) over (partition by h.player_id order by h.set_at) as next_at
  from public.player_tag_history h
)
select b.id, b.player_id, b.club_id, b.color, b.previous_color,
       b.set_by, b.reason,
       b.valid_from,
       coalesce(b.next_at, now()) as valid_to,
       (b.next_at is null)        as periodo_abierto,
       round(extract(epoch from (coalesce(b.next_at, now()) - b.valid_from))
             / 86400.0, 2)        as dias_en_color
from base b;