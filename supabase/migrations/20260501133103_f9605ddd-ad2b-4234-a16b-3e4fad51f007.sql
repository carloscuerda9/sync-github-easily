-- Performance indices for invoices listings
CREATE INDEX IF NOT EXISTS idx_invoices_physio_issued ON public.invoices(physio_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_player_issued ON public.invoices(player_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_appointment ON public.invoices(appointment_id);

-- Allow players to mark their own invoice as paid (status update only)
CREATE POLICY "Players mark own invoice paid"
ON public.invoices
FOR UPDATE
TO authenticated
USING (player_id = auth.uid())
WITH CHECK (player_id = auth.uid());