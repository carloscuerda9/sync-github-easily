CREATE TABLE public.injury_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  club_id uuid,
  context text NOT NULL,
  match_location text,
  moment text NOT NULL,
  action_type text NOT NULL,
  body_part text NOT NULL,
  previous_same_injury boolean NOT NULL DEFAULT false,
  can_continue boolean NOT NULL DEFAULT false,
  was_attended boolean NOT NULL DEFAULT false,
  attended_by text,
  observations text,
  file_url text,
  file_type text,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.injury_reports TO authenticated;
GRANT ALL ON public.injury_reports TO service_role;

ALTER TABLE public.injury_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players manage own injury reports"
  ON public.injury_reports FOR SELECT TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Players create own injury reports"
  ON public.injury_reports FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid() AND club_id = public.get_user_club(auth.uid()));

CREATE POLICY "Players update own injury reports"
  ON public.injury_reports FOR UPDATE TO authenticated
  USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());

CREATE POLICY "Physios view club injury reports"
  ON public.injury_reports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'physio'::public.app_role)
    AND public.is_approved(auth.uid())
    AND club_id IS NOT NULL
    AND club_id = public.get_user_club(auth.uid())
  );

CREATE POLICY "Physios update club injury reports"
  ON public.injury_reports FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'physio'::public.app_role)
    AND public.is_approved(auth.uid())
    AND club_id IS NOT NULL
    AND club_id = public.get_user_club(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'physio'::public.app_role)
    AND club_id = public.get_user_club(auth.uid())
  );

CREATE INDEX idx_injury_reports_club ON public.injury_reports (club_id, created_at DESC);
CREATE INDEX idx_injury_reports_player ON public.injury_reports (player_id, created_at DESC);

CREATE TRIGGER set_injury_reports_updated_at
  BEFORE UPDATE ON public.injury_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();