
CREATE TYPE public.leave_type AS ENUM ('deportiva', 'medica');

CREATE TABLE public.player_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  physio_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.leave_type NOT NULL,
  reason TEXT,
  document_url TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_leaves TO authenticated;
GRANT ALL ON public.player_leaves TO service_role;

ALTER TABLE public.player_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Physios manage leaves in their club"
  ON public.player_leaves FOR ALL
  USING (
    public.has_role(auth.uid(), 'physio'::public.app_role)
    AND public.same_club(auth.uid(), player_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'physio'::public.app_role)
    AND public.same_club(auth.uid(), player_id)
    AND physio_id = auth.uid()
  );

CREATE POLICY "Players can view their own leaves"
  ON public.player_leaves FOR SELECT
  USING (player_id = auth.uid());

CREATE TRIGGER trg_player_leaves_updated_at
  BEFORE UPDATE ON public.player_leaves
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_player_leaves_player ON public.player_leaves(player_id);
CREATE INDEX idx_player_leaves_type ON public.player_leaves(type);
