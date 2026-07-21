DROP POLICY IF EXISTS "Physios manage own forms" ON public.forms;
CREATE POLICY "Physios manage own forms" ON public.forms
  FOR ALL TO authenticated
  USING (physio_id = auth.uid())
  WITH CHECK (physio_id = auth.uid());