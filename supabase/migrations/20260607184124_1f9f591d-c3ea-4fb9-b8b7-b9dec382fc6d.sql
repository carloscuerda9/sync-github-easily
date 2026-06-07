-- 1) Restrict club code column from being read via the Data API by regular members.
REVOKE SELECT ON public.clubs FROM authenticated;
GRANT SELECT (id, name, created_at, created_by) ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;

-- Secure helper to expose the join code only to physios of the club / superadmins.
CREATE OR REPLACE FUNCTION public.get_club_code(_club_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN (SELECT code FROM public.clubs WHERE id = _club_id)
    WHEN public.has_role(auth.uid(), 'physio'::public.app_role) AND _club_id = public.get_user_club(auth.uid()) THEN (SELECT code FROM public.clubs WHERE id = _club_id)
    ELSE NULL
  END
$$;

GRANT EXECUTE ON FUNCTION public.get_club_code(uuid) TO authenticated;

-- 2) Block players from changing form-assignment fields other than completion status.
CREATE OR REPLACE FUNCTION public.enforce_form_assignment_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The physio who owns the form may manage the assignment freely.
  IF EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = NEW.form_id AND f.physio_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Otherwise (the player) only completed / completed_at may change.
  IF NEW.form_id IS DISTINCT FROM OLD.form_id
     OR NEW.player_id IS DISTINCT FROM OLD.player_id
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
    RAISE EXCEPTION 'Players can only update the completion status of their assignments';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_form_assignment_update_restrictions ON public.form_assignments;
CREATE TRIGGER enforce_form_assignment_update_restrictions
  BEFORE UPDATE ON public.form_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_form_assignment_update_restrictions();