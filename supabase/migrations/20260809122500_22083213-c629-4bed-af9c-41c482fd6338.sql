-- Owner helpers
CREATE OR REPLACE FUNCTION public.owner_email()
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT 'carloscuerdarenedo@gmail.com'::text $$;

CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND lower(email) = public.owner_email()) $$;

REVOKE ALL ON FUNCTION public.is_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.owner_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_email() TO authenticated, service_role;

-- Auto-provision owner on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  IF lower(NEW.email) IN ('admin@wefixyou.com', 'wefixyouftp@gmail.com', public.owner_email()) THEN
    _role := 'superadmin';
    _status := 'approved';
  ELSE
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'player');
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

-- Owner bypasses profile update restrictions
CREATE OR REPLACE FUNCTION public.enforce_profile_update_restrictions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF public.is_owner(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF public.is_owner(OLD.id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No puedes cambiar tu rol';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'No puedes cambiar el estado de tu cuenta';
  END IF;
  IF NEW.club_id IS DISTINCT FROM OLD.club_id THEN
    RAISE EXCEPTION 'No puedes cambiar tu club';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'No puedes cambiar la identidad de tu perfil';
  END IF;

  RETURN NEW;
END;
$function$;

-- Owner bypass in other restriction triggers
CREATE OR REPLACE FUNCTION public.enforce_appointment_update_restrictions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF public.is_owner(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.player_id IS DISTINCT FROM OLD.player_id
     OR NEW.physio_id IS DISTINCT FROM OLD.physio_id THEN
    RAISE EXCEPTION 'No se pueden reasignar las citas';
  END IF;
  IF OLD.physio_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  IF OLD.player_id = auth.uid() THEN
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Los jugadores solo pueden cancelar sus citas';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text <> 'cancelled' THEN
      RAISE EXCEPTION 'Los jugadores solo pueden cancelar sus citas';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'No autorizado para modificar esta cita';
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_invoice_update_restrictions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF public.is_owner(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.physio_id IS DISTINCT FROM OLD.physio_id
     OR NEW.player_id IS DISTINCT FROM OLD.player_id THEN
    RAISE EXCEPTION 'No se puede reasignar una factura';
  END IF;
  IF OLD.physio_id = auth.uid() THEN
    IF OLD.status::text = 'paid' AND (
         NEW.amount IS DISTINCT FROM OLD.amount
         OR NEW.currency IS DISTINCT FROM OLD.currency
         OR NEW.concept IS DISTINCT FROM OLD.concept
       ) THEN
      RAISE EXCEPTION 'No se puede modificar el importe de una factura pagada';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.player_id = auth.uid() THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.concept IS DISTINCT FROM OLD.concept
       OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
       OR NEW.pdf_url IS DISTINCT FROM OLD.pdf_url
       OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Players can only update the payment status of their invoices';
    END IF;
    IF NEW.status::text <> 'paid' THEN
      RAISE EXCEPTION 'Players can only mark their invoices as paid';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_injury_report_update_restrictions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF public.is_owner(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'physio'::public.app_role)
     AND public.same_club(auth.uid(), OLD.player_id) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.player_id IS DISTINCT FROM OLD.player_id THEN
      RAISE EXCEPTION 'No se puede reasignar un parte de lesión';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.player_id = auth.uid() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.club_id IS DISTINCT FROM OLD.club_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'No puedes modificar la identidad del parte de lesión';
    END IF;
    IF NEW.reviewed IS DISTINCT FROM OLD.reviewed THEN
      RAISE EXCEPTION 'Solo el fisioterapeuta puede marcar el parte como revisado';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'No autorizado para modificar este parte de lesión';
END;
$function$;

-- Storage access for owner
CREATE OR REPLACE FUNCTION public.can_access_document_path(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN public.is_owner(auth.uid()) THEN true
      WHEN split_part(_path, '/', 1) = '' THEN false
      WHEN (split_part(_path, '/', 1))::uuid = auth.uid() THEN true
      WHEN public.has_role(auth.uid(), 'physio'::public.app_role)
           AND public.same_club(auth.uid(), (split_part(_path, '/', 1))::uuid) THEN true
      WHEN public.has_role(auth.uid(), 'superadmin'::public.app_role)
           AND split_part(_path, '/', 2) = 'facturas' THEN EXISTS (
             SELECT 1 FROM public.physio_invoices pi
             WHERE pi.file_path = _path AND pi.admin_id = auth.uid()
           )
      WHEN public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN true
      ELSE false
    END
$function$;

-- Full power policies for the owner
CREATE POLICY "Owner full access profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access clubs" ON public.clubs FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access appointments" ON public.appointments FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access sessions" ON public.sessions FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access injuries" ON public.injuries FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access injury_reports" ON public.injury_reports FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access player_leaves" ON public.player_leaves FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access player_tags" ON public.player_tags FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access documents" ON public.documents FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access forms" ON public.forms FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access form_assignments" ON public.form_assignments FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access messages" ON public.messages FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access physio_invoices" ON public.physio_invoices FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access registration_questions" ON public.registration_questions FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access app_config" ON public.app_config FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner full access push_subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

-- Hide the owner from everyone else
DROP POLICY IF EXISTS "Superadmin views all profiles" ON public.profiles;
CREATE POLICY "Superadmin views all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role) AND NOT public.is_owner(id));

DROP POLICY IF EXISTS "Superadmin updates any profile" ON public.profiles;
CREATE POLICY "Superadmin updates any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role) AND NOT public.is_owner(id));

DROP POLICY IF EXISTS "Physios view admins" ON public.profiles;
CREATE POLICY "Physios view admins" ON public.profiles FOR SELECT TO authenticated
  USING (role = 'superadmin'::public.app_role AND status = 'approved'::public.account_status
         AND public.has_role(auth.uid(), 'physio'::public.app_role) AND NOT public.is_owner(id));

DROP POLICY IF EXISTS "Superadmin manages roles" ON public.user_roles;
CREATE POLICY "Superadmin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role) AND NOT public.is_owner(user_id))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role) AND NOT public.is_owner(user_id));

DROP POLICY IF EXISTS "Superadmin views all messages" ON public.messages;
CREATE POLICY "Superadmin views all messages" ON public.messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role)
         AND NOT public.is_owner(sender_id) AND NOT public.is_owner(receiver_id));

DROP POLICY IF EXISTS "Superadmin views all documents" ON public.documents;
CREATE POLICY "Superadmin views all documents" ON public.documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role)
         AND NOT public.is_owner(uploader_id) AND NOT public.is_owner(recipient_id));