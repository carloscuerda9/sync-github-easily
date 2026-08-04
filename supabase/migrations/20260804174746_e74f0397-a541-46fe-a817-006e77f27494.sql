DROP POLICY IF EXISTS "Physios manage their own player tags" ON public.player_tags;
CREATE POLICY "Physios manage club player tags"
ON public.player_tags FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'physio'::public.app_role) AND public.same_club(auth.uid(), player_id))
WITH CHECK (physio_id = auth.uid() AND public.has_role(auth.uid(), 'physio'::public.app_role) AND public.same_club(auth.uid(), player_id));