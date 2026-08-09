create or replace view public.v_dash_squad_status
with (security_invoker = true) as
select p.id as player_id, p.club_id, p.full_name,
       coalesce(t.color,'sin_estado')                as color_actual,
       tp.valid_from                                  as color_desde,
       round(extract(epoch from (now() - tp.valid_from))/86400.0, 1) as dias_en_color_actual,
       coalesce(mm.min_28d, 0)                        as min_28d,
       coalesce(mm.min_7d, 0)                         as min_7d,
       inj.lesion_activa
from public.profiles p
left join public.player_tags t on t.player_id = p.id
left join public.v_player_tag_periods tp
       on tp.player_id = p.id and tp.periodo_abierto
left join lateral (
  select sum(minutes_played) filter (where match_date >= current_date - 28) as min_28d,
         sum(minutes_played) filter (where match_date >= current_date -  7) as min_7d
  from public.match_minutes m where m.player_id = p.id
) mm on true
left join lateral (
  select true as lesion_activa from public.injuries i
  where i.player_id = p.id and i.actual_return_date is null
  order by i.injury_date desc limit 1
) inj on true
where p.role = 'player' and p.status = 'approved';

create or replace view public.v_dash_tag_stability
with (security_invoker = true) as
select tp.player_id, tp.club_id, p.full_name,
       count(*)                                                as cambios_totales,
       count(*) filter (where tp.color in ('orange','red'))     as episodios_riesgo,
       round(sum(tp.dias_en_color) filter (where tp.color = 'red')::numeric, 1)    as dias_rojo,
       round(sum(tp.dias_en_color) filter (where tp.color = 'orange')::numeric, 1) as dias_naranja,
       round(sum(tp.dias_en_color) filter (where tp.color = 'green')::numeric, 1)  as dias_verde,
       round(100.0 * sum(tp.dias_en_color) filter (where tp.color in ('orange','red'))
             / nullif(sum(tp.dias_en_color),0), 1)              as pct_tiempo_riesgo,
       round(avg(tp.dias_en_color) filter
             (where tp.color in ('orange','red') and not tp.periodo_abierto)::numeric, 1)
                                                                as media_dias_recuperacion
from public.v_player_tag_periods tp
join public.profiles p on p.id = tp.player_id
group by tp.player_id, tp.club_id, p.full_name;

create or replace view public.v_dash_workload
with (security_invoker = true) as
with agg as (
  select mm.player_id, mm.club_id,
         sum(mm.minutes_played) filter (where mm.match_date >= current_date -  7) as min_7d,
         sum(mm.minutes_played) filter (where mm.match_date >= current_date - 28) as min_28d,
         sum(mm.minutes_played)                                                   as min_total,
         count(*) filter (where mm.match_date >= current_date - 28)               as partidos_28d,
         count(*)                                                                 as partidos_total,
         sum(mm.minutos_amarilla)                                                 as min_amarilla_total,
         count(*) filter (where mm.motivo_salida = 'conmocion_hia')               as conmociones
  from public.match_minutes mm
  group by mm.player_id, mm.club_id
)
select a.*, p.full_name, t.color as color_actual,
       round(a.min_28d / 4.0, 1)                              as carga_cronica_semanal,
       round(a.min_7d / nullif(a.min_28d / 4.0, 0), 2)        as ratio_agudo_cronico,
       case
         when a.min_28d = 0 then 'sin_datos'
         when a.min_7d / nullif(a.min_28d/4.0,0) > 1.5 then 'pico_carga'
         when a.min_7d / nullif(a.min_28d/4.0,0) < 0.8 then 'subcarga'
         else 'normal'
       end                                                    as estado_carga,
       (t.color in ('orange','red') and a.min_7d > 0)         as juega_en_riesgo
from agg a
join public.profiles p on p.id = a.player_id
left join public.player_tags t on t.player_id = a.player_id;

create or replace view public.v_dash_injuries
with (security_invoker = true) as
select i.id, i.player_id, i.club_id, p.full_name,
       i.injury_date, i.body_part, i.injury_type, i.severity, i.mechanism,
       i.expected_return_date, i.actual_return_date, i.is_recurrence,
       (i.actual_return_date is null)                          as baja_activa,
       coalesce(i.actual_return_date - i.injury_date,
                current_date        - i.injury_date)            as dias_baja,
       case when i.actual_return_date is not null and i.recovery_days is not null
            then (i.actual_return_date - i.injury_date) - i.recovery_days
       end                                                      as desvio_vs_estimado,
       count(*) over (partition by i.player_id, lower(i.body_part)) as veces_misma_zona
from public.injuries i
join public.profiles p on p.id = i.player_id;

create or replace view public.v_dash_load_before_downgrade
with (security_invoker = true) as
select h.player_id, p.full_name, h.club_id,
       h.set_at::date                                          as fecha_cambio,
       h.previous_color, h.color,
       coalesce(sum(mm.minutes_played), 0)                     as min_14d_previos,
       count(mm.id)                                            as partidos_14d_previos
from public.player_tag_history h
join public.profiles p on p.id = h.player_id
left join public.match_minutes mm
       on mm.player_id = h.player_id
      and mm.match_date between (h.set_at::date - 14) and h.set_at::date
where h.color in ('orange','red')
  and (h.previous_color is null or h.previous_color in ('green','yellow'))
group by h.player_id, p.full_name, h.club_id, h.set_at, h.previous_color, h.color;

grant select on public.v_dash_squad_status,
                public.v_dash_tag_stability,
                public.v_dash_workload,
                public.v_dash_injuries,
                public.v_dash_load_before_downgrade
  to authenticated;