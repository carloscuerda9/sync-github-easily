DROP POLICY IF EXISTS "Physios view player injuries" ON public.injuries;
CREATE POLICY "Physios view player injuries"
ON public.injuries
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'physio'::public.app_role)
  AND public.same_club(auth.uid(), player_id)
);

DROP POLICY IF EXISTS "Physios create injuries" ON public.injuries;
CREATE POLICY "Physios create injuries"
ON public.injuries
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'physio'::public.app_role)
  AND physio_id = auth.uid()
  AND public.same_club(auth.uid(), player_id)
);

CREATE INDEX IF NOT EXISTS idx_injuries_player_date ON public.injuries (player_id, injury_date DESC);