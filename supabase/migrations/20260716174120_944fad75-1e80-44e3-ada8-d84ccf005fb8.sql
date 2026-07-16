
CREATE TABLE public.player_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  physio_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color TEXT NOT NULL CHECK (color IN ('green','yellow','orange','red')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (physio_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_tags TO authenticated;
GRANT ALL ON public.player_tags TO service_role;

ALTER TABLE public.player_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Physios manage their own player tags"
  ON public.player_tags FOR ALL
  TO authenticated
  USING (physio_id = auth.uid() AND public.has_role(auth.uid(), 'physio'::public.app_role))
  WITH CHECK (
    physio_id = auth.uid()
    AND public.has_role(auth.uid(), 'physio'::public.app_role)
    AND public.same_club(auth.uid(), player_id)
  );

CREATE TRIGGER player_tags_set_updated_at
  BEFORE UPDATE ON public.player_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
