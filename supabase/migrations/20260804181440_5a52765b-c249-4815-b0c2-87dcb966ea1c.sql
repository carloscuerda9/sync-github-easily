CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role;
  _status public.account_status;
  _full_name TEXT;
  _phone TEXT;
  _profile_data JSONB;
  _club_id UUID;
  _club_code TEXT;
  _club_name TEXT;
  _new_code TEXT;
BEGIN
  IF NEW.email IN ('admin@wefixyou.com', 'wefixyouftp@gmail.com') THEN
    _role := 'superadmin';
    _status := 'approved';
  ELSE
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'player');
    -- Never trust client metadata for privileged roles
    IF _role NOT IN ('player', 'physio', 'coach') THEN
      _role := 'player';
    END IF;
    IF _role IN ('player', 'coach') THEN
      _status := 'approved';
    ELSE
      _status := 'pending';
    END IF;
  END IF;

  _full_name := NEW.raw_user_meta_data->>'full_name';
  _phone := NEW.raw_user_meta_data->>'phone';
  _profile_data := COALESCE(NEW.raw_user_meta_data->'profile_data', '{}'::jsonb);
  _club_code := upper(NULLIF(NEW.raw_user_meta_data->>'club_code', ''));
  _club_name := NULLIF(NEW.raw_user_meta_data->>'club_name', '');

  IF _role = 'physio' THEN
    IF _club_code IS NOT NULL THEN
      SELECT id INTO _club_id FROM public.clubs WHERE code = _club_code;
      IF _club_id IS NULL THEN
        RAISE EXCEPTION 'Código de club no válido: %', _club_code;
      END IF;
    ELSIF _club_name IS NOT NULL THEN
      LOOP
        _new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs WHERE code = _new_code);
      END LOOP;
      INSERT INTO public.clubs (name, code, created_by)
      VALUES (_club_name, _new_code, NEW.id)
      RETURNING id INTO _club_id;
    ELSE
      RAISE EXCEPTION 'Los fisioterapeutas deben crear un club o unirse con un código';
    END IF;
  ELSIF _role IN ('player', 'coach') THEN
    IF _club_code IS NULL THEN
      RAISE EXCEPTION 'Debes introducir un código de club';
    END IF;
    SELECT id INTO _club_id FROM public.clubs WHERE code = _club_code;
    IF _club_id IS NULL THEN
      RAISE EXCEPTION 'Código de club no válido: %', _club_code;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role, status, profile_data, club_id)
  VALUES (NEW.id, NEW.email, _full_name, _phone, _role, _status, _profile_data, _club_id);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  RETURN NEW;
END;
$function$;

-- Lock down SECURITY DEFINER / internal functions
REVOKE ALL ON FUNCTION public.dispatch_push_notification(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_wants_notification(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_appointment_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_document_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_form_assignment_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_invoice_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_message_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_form_assignment_update_restrictions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_invoice_update_restrictions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_profile_update_restrictions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Helper functions used by RLS: signed-in users only, never anonymous
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.same_club(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_club(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_club_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.physio_treats_player(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_document_path(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_club_by_code(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.same_club(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_club(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.physio_treats_player(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_document_path(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_club_by_code(text) TO authenticated;

-- Configuration table: no direct Data API access for app users
REVOKE ALL ON TABLE public.app_config FROM anon, authenticated;
GRANT ALL ON TABLE public.app_config TO service_role;