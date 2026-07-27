DROP POLICY IF EXISTS "Users send messages" ON public.messages;
CREATE POLICY "Users send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      same_club(auth.uid(), receiver_id)
      OR has_role(auth.uid(), 'superadmin'::app_role)
      OR has_role(receiver_id, 'superadmin'::app_role)
    )
  );