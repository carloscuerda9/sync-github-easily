-- Extend appointment notifications to notify physio to fill treatment after completion
CREATE OR REPLACE FUNCTION public.on_appointment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _scheduled TEXT;
BEGIN
  _scheduled := to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Madrid', 'DD/MM/YYYY HH24:MI');

  IF TG_OP = 'INSERT' THEN
    IF public.user_wants_notification(NEW.physio_id, 'appointments') THEN
      PERFORM public.dispatch_push_notification(
        NEW.physio_id, 'appointment',
        'Nueva solicitud de cita', _scheduled, '/fisio/agenda'
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify player about status change
    IF public.user_wants_notification(NEW.player_id, 'appointments') THEN
      PERFORM public.dispatch_push_notification(
        NEW.player_id, 'appointment',
        CASE NEW.status::text
          WHEN 'confirmed' THEN 'Cita confirmada'
          WHEN 'cancelled' THEN 'Cita cancelada'
          WHEN 'completed' THEN 'Cita completada'
          ELSE 'Estado de cita actualizado'
        END,
        _scheduled, '/jugador/citas'
      );
    END IF;

    -- Notify physio to fill treatment when appointment marked completed
    IF NEW.status::text = 'completed'
       AND public.user_wants_notification(NEW.physio_id, 'treatments') THEN
      PERFORM public.dispatch_push_notification(
        NEW.physio_id, 'appointment',
        'Rellena el tratamiento',
        'Registra lo realizado en la cita del ' || _scheduled,
        '/fisio/historico'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;