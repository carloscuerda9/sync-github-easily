-- Endurecer INSERT/UPDATE de appointments para forzar mismo club
DROP POLICY IF EXISTS "Players create appointments" ON public.appointments;
CREATE POLICY "Players create appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  player_id = auth.uid()
  AND public.has_role(auth.uid(), 'player'::public.app_role)
  AND public.same_club(auth.uid(), physio_id)
);

-- Permitir a fisios crear citas para jugadores de su club (útil para agenda)
DROP POLICY IF EXISTS "Physios create appointments" ON public.appointments;
CREATE POLICY "Physios create appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  physio_id = auth.uid()
  AND public.has_role(auth.uid(), 'physio'::public.app_role)
  AND public.same_club(auth.uid(), player_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_appointments_player_scheduled ON public.appointments (player_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_physio_scheduled ON public.appointments (physio_id, scheduled_at DESC);