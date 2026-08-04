-- 1) Column-level protection for injury_reports updates by players
CREATE OR REPLACE FUNCTION public.enforce_injury_report_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Physio in the same club may manage the report (incl. reviewed flag)
  IF public.has_role(auth.uid(), 'physio'::public.app_role)
     AND public.same_club(auth.uid(), OLD.player_id) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.player_id IS DISTINCT FROM OLD.player_id THEN
      RAISE EXCEPTION 'No se puede reasignar un parte de lesión';
    END IF;
    RETURN NEW;
  END IF;

  -- The owning player may edit their own report but not review-state/identity
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
$$;

REVOKE ALL ON FUNCTION public.enforce_injury_report_update_restrictions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_injury_report_update_restrictions ON public.injury_reports;
CREATE TRIGGER enforce_injury_report_update_restrictions
BEFORE UPDATE ON public.injury_reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_injury_report_update_restrictions();

-- 2) Club isolation on invoice creation
DROP POLICY IF EXISTS "Physios create invoices" ON public.invoices;
CREATE POLICY "Physios create invoices"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  physio_id = auth.uid()
  AND public.has_role(auth.uid(), 'physio'::public.app_role)
  AND public.same_club(auth.uid(), player_id)
);