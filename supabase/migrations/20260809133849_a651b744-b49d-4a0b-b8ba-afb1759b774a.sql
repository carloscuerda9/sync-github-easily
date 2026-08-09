-- 002_trigger_tag_history.sql
create or replace function public.fn_player_tags_to_history()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_club_id uuid;
  v_prev    text;
begin
  -- Solo registrar si el color cambia realmente
  if TG_OP = 'UPDATE' and NEW.color is not distinct from OLD.color then
    return NEW;
  end if;

  -- Guarda de seguridad: si no hay perfil, no rompemos la operación original
  if not exists (select 1 from public.profiles where id = NEW.player_id) then
    return NEW;
  end if;

  select club_id into v_club_id from public.profiles where id = NEW.player_id;

  v_prev := case when TG_OP = 'UPDATE' then OLD.color else null end;

  insert into public.player_tag_history
    (player_id, club_id, color, previous_color, set_by, set_at)
  values
    (NEW.player_id, v_club_id, NEW.color, v_prev,
     coalesce(NEW.physio_id, auth.uid()), coalesce(NEW.updated_at, now()));

  return NEW;
end;
$$;

drop trigger if exists trg_player_tags_history on public.player_tags;
create trigger trg_player_tags_history
  after insert or update on public.player_tags
  for each row execute function public.fn_player_tags_to_history();