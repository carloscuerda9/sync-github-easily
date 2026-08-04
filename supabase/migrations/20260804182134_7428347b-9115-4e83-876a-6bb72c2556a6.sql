-- 1. Appointments column-level guard
CREATE OR REPLACE FUNCTION public.enforce_appointment_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Identity of the appointment can never change
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.player_id IS DISTINCT FROM OLD.player_id
     OR NEW.physio_id IS DISTINCT FROM OLD.physio_id THEN
    RAISE EXCEPTION 'No se pueden reasignar las citas';
  END IF;

  -- The owning physio may manage the rest of the appointment freely
  IF OLD.physio_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- The player may only cancel their own appointment
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
$$;

REVOKE ALL ON FUNCTION public.enforce_appointment_update_restrictions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_appointment_update_restrictions ON public.appointments;
CREATE TRIGGER enforce_appointment_update_restrictions
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_update_restrictions();

-- Pin ownership in the update policies as well
DROP POLICY IF EXISTS "Physios update own appointments" ON public.appointments;
CREATE POLICY "Physios update own appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (physio_id = auth.uid())
WITH CHECK (physio_id = auth.uid());

DROP POLICY IF EXISTS "Players update own appointments" ON public.appointments;
CREATE POLICY "Players update own appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (player_id = auth.uid())
WITH CHECK (player_id = auth.uid() AND status IN ('requested'::public.appointment_status, 'cancelled'::public.appointment_status));

-- 2. Invoices: also lock down what the owning physio may change
CREATE OR REPLACE FUNCTION public.enforce_invoice_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Nobody may reassign an invoice to a different physio or player
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.physio_id IS DISTINCT FROM OLD.physio_id
     OR NEW.player_id IS DISTINCT FROM OLD.player_id THEN
    RAISE EXCEPTION 'No se puede reasignar una factura';
  END IF;

  -- The owning physio may manage the invoice, but not rewrite a paid invoice
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

  -- The player may only mark their own invoice as paid (status + paid_at)
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
$$;

REVOKE ALL ON FUNCTION public.enforce_invoice_update_restrictions() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Physios update own invoices" ON public.invoices;
CREATE POLICY "Physios update own invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (physio_id = auth.uid())
WITH CHECK (physio_id = auth.uid());

DROP POLICY IF EXISTS "Players mark own invoice paid" ON public.invoices;
CREATE POLICY "Players mark own invoice paid"
ON public.invoices FOR UPDATE TO authenticated
USING (player_id = auth.uid())
WITH CHECK (player_id = auth.uid() AND status = 'paid'::public.invoice_status);

-- 3. player_leaves: scope policies to authenticated
DROP POLICY IF EXISTS "Physios manage leaves in their club" ON public.player_leaves;
CREATE POLICY "Physios manage leaves in their club"
ON public.player_leaves FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'physio'::public.app_role) AND public.same_club(auth.uid(), player_id))
WITH CHECK (public.has_role(auth.uid(), 'physio'::public.app_role) AND public.same_club(auth.uid(), player_id) AND physio_id = auth.uid());

DROP POLICY IF EXISTS "Players can view their own leaves" ON public.player_leaves;
CREATE POLICY "Players can view their own leaves"
ON public.player_leaves FOR SELECT TO authenticated
USING (player_id = auth.uid());

-- 4. Revoke unused SECURITY DEFINER functions from app roles
REVOKE ALL ON FUNCTION public.find_club_by_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon, authenticated;