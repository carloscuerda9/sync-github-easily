-- Tabla de suscripciones push
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Habilitar pg_net para que la base de datos pueda llamar al endpoint de push
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Tabla de configuración interna (URL del endpoint y secreto del webhook)
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin manages app_config"
  ON public.app_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Función central que dispara el webhook hacia /api/public/push
CREATE OR REPLACE FUNCTION public.dispatch_push_notification(
  _user_id UUID,
  _kind TEXT,
  _title TEXT,
  _body TEXT,
  _href TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _endpoint TEXT;
  _secret TEXT;
BEGIN
  SELECT value INTO _endpoint FROM public.app_config WHERE key = 'push_endpoint_url';
  SELECT value INTO _secret FROM public.app_config WHERE key = 'push_webhook_secret';

  IF _endpoint IS NULL OR _secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM extensions.http_post(
    url := _endpoint,
    body := jsonb_build_object(
      'user_id', _user_id,
      'kind', _kind,
      'title', _title,
      'body', _body,
      'href', _href
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', _secret
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- nunca bloquear el INSERT principal
  RAISE WARNING 'dispatch_push_notification failed: %', SQLERRM;
END;
$$;

-- Helper para leer la preferencia de notificación de un usuario
CREATE OR REPLACE FUNCTION public.user_wants_notification(_user_id UUID, _key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (profile_data->'notifications'->>_key)::boolean,
    true
  )
  FROM public.profiles WHERE id = _user_id
$$;

-- Trigger: nuevo mensaje
CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender_name TEXT;
BEGIN
  IF NOT public.user_wants_notification(NEW.receiver_id, 'messages') THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(full_name, email) INTO _sender_name FROM public.profiles WHERE id = NEW.sender_id;
  PERFORM public.dispatch_push_notification(
    NEW.receiver_id, 'message',
    'Nuevo mensaje de ' || COALESCE(_sender_name, 'alguien'),
    LEFT(NEW.content, 120),
    '/jugador/mensajes'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_push
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.on_message_insert();

-- Trigger: nueva cita / cambio de estado
CREATE OR REPLACE FUNCTION public.on_appointment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _scheduled TEXT;
BEGIN
  _scheduled := to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Madrid', 'DD/MM/YYYY HH24:MI');

  IF TG_OP = 'INSERT' THEN
    -- Nueva solicitud: notificar al fisio
    IF public.user_wants_notification(NEW.physio_id, 'appointments') THEN
      PERFORM public.dispatch_push_notification(
        NEW.physio_id, 'appointment',
        'Nueva solicitud de cita', _scheduled, '/fisio/agenda'
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Cambio de estado: notificar al jugador
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
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointments_push
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.on_appointment_change();

-- Trigger: nuevo formulario asignado
CREATE OR REPLACE FUNCTION public.on_form_assignment_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title TEXT;
BEGIN
  IF NOT public.user_wants_notification(NEW.player_id, 'forms') THEN RETURN NEW; END IF;
  SELECT title INTO _title FROM public.forms WHERE id = NEW.form_id;
  PERFORM public.dispatch_push_notification(
    NEW.player_id, 'form',
    'Nuevo formulario',
    COALESCE(_title, 'Tienes un cuestionario por completar'),
    '/jugador/formularios'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_form_assignments_push
AFTER INSERT ON public.form_assignments
FOR EACH ROW EXECUTE FUNCTION public.on_form_assignment_insert();

-- Trigger: nuevo documento
CREATE OR REPLACE FUNCTION public.on_document_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _href TEXT;
BEGIN
  IF NOT public.user_wants_notification(NEW.recipient_id, 'documents') THEN RETURN NEW; END IF;
  SELECT CASE WHEN role = 'physio' THEN '/fisio/documentos' ELSE '/jugador/documentos' END
    INTO _href FROM public.profiles WHERE id = NEW.recipient_id;
  PERFORM public.dispatch_push_notification(
    NEW.recipient_id, 'document',
    'Nuevo documento', NEW.title, COALESCE(_href, '/jugador/documentos')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_documents_push
AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.on_document_insert();

-- Trigger: factura emitida (status -> sent)
CREATE OR REPLACE FUNCTION public.on_invoice_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status::text = 'sent')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text = 'sent') THEN
    IF public.user_wants_notification(NEW.player_id, 'invoices') THEN
      PERFORM public.dispatch_push_notification(
        NEW.player_id, 'invoice',
        'Nueva factura',
        NEW.amount::text || ' ' || NEW.currency,
        '/jugador/facturas'
      );
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text = 'paid' THEN
    IF public.user_wants_notification(NEW.physio_id, 'invoices') THEN
      PERFORM public.dispatch_push_notification(
        NEW.physio_id, 'invoice',
        'Factura cobrada',
        NEW.amount::text || ' ' || NEW.currency,
        '/fisio/facturacion'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoices_push
AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.on_invoice_change();