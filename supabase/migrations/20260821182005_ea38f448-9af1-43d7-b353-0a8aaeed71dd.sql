CREATE TABLE public.taping_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id),
  week_start date NOT NULL,
  zones text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taping_requests TO authenticated;
GRANT ALL ON public.taping_requests TO service_role;

ALTER TABLE public.taping_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players manage own taping requests"
ON public.taping_requests FOR ALL TO authenticated
USING (player_id = auth.uid())
WITH CHECK (player_id = auth.uid() AND club_id IS NOT DISTINCT FROM public.get_user_club(auth.uid()));

CREATE POLICY "Staff view club taping requests"
ON public.taping_requests FOR SELECT TO authenticated
USING (public.staff_shares_club_with(auth.uid(), player_id) OR public.is_owner(auth.uid()));

CREATE POLICY "Owner manages taping requests"
ON public.taping_requests FOR ALL TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

CREATE TRIGGER taping_requests_updated_at
BEFORE UPDATE ON public.taping_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_taping_requests_club_week ON public.taping_requests (club_id, week_start);