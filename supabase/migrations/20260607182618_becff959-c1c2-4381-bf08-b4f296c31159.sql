-- 1) Injuries: ensure physio still in same club as the player to update
DROP POLICY IF EXISTS "Physios update own injuries" ON public.injuries;
CREATE POLICY "Physios update own injuries"
ON public.injuries
FOR UPDATE
TO authenticated
USING (physio_id = auth.uid() AND same_club(auth.uid(), player_id))
WITH CHECK (physio_id = auth.uid() AND same_club(auth.uid(), player_id));

-- 2) Invoices: prevent players from modifying anything other than marking as paid
CREATE OR REPLACE FUNCTION public.enforce_invoice_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The owning physio may manage the invoice freely
  IF NEW.physio_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- The player may only mark their own invoice as paid (status + paid_at)
  IF OLD.player_id = auth.uid() THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.concept IS DISTINCT FROM OLD.concept
       OR NEW.physio_id IS DISTINCT FROM OLD.physio_id
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
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

DROP TRIGGER IF EXISTS enforce_invoice_update_restrictions ON public.invoices;
CREATE TRIGGER enforce_invoice_update_restrictions
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_update_restrictions();