-- Fix: SELECT de forms para jugadores asignados (la subselect estaba mal)
DROP POLICY IF EXISTS "Players view assigned forms via assignments" ON public.forms;
CREATE POLICY "Players view assigned forms via assignments"
ON public.forms
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.form_assignments fa
    WHERE fa.form_id = forms.id AND fa.player_id = auth.uid()
  )
);

-- Reforzar: el fisio sólo puede gestionar asignaciones para jugadores de su club
DROP POLICY IF EXISTS "Physios manage assignments" ON public.form_assignments;
CREATE POLICY "Physios manage assignments"
ON public.form_assignments
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_assignments.form_id AND f.physio_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_assignments.form_id
      AND f.physio_id = auth.uid()
      AND public.same_club(auth.uid(), form_assignments.player_id)
  )
);

-- Permitir al jugador marcar como completado SU asignación
DROP POLICY IF EXISTS "Players complete own assignment" ON public.form_assignments;
CREATE POLICY "Players complete own assignment"
ON public.form_assignments
FOR UPDATE TO authenticated
USING (player_id = auth.uid())
WITH CHECK (player_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_form_assignments_player ON public.form_assignments (player_id, completed);
CREATE INDEX IF NOT EXISTS idx_form_assignments_form ON public.form_assignments (form_id);