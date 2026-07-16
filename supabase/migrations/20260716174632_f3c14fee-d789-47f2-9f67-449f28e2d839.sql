
CREATE POLICY "Players view their own tags"
  ON public.player_tags FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());
