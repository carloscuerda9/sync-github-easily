CREATE TABLE public.match_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  match_date date NOT NULL,
  opponent text,
  competition text,
  minutes_played integer NOT NULL DEFAULT 0,
  started boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_minutes_range CHECK (minutes_played >= 0 AND minutes_played <= 200)
);

CREATE UNIQUE INDEX match_minutes_unique_entry
  ON public.match_minutes (player_id, match_date, coalesce(opponent, ''));
CREATE INDEX match_minutes_player_idx ON public.match_minutes (player_id, match_date DESC);
CREATE INDEX match_minutes_club_idx ON public.match_minutes (club_id, match_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_minutes TO authenticated;
GRANT ALL ON public.match_minutes TO service_role;

ALTER TABLE public.match_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access match_minutes" ON public.match_minutes
  FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Players read own match minutes" ON public.match_minutes
  FOR SELECT TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Staff read club match minutes" ON public.match_minutes
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'physio'::public.app_role)
      OR public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
    AND public.same_club(auth.uid(), player_id)
  );

CREATE POLICY "Staff insert club match minutes" ON public.match_minutes
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'physio'::public.app_role)
      OR public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
    AND public.same_club(auth.uid(), player_id)
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Staff update club match minutes" ON public.match_minutes
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'physio'::public.app_role)
      OR public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
    AND public.same_club(auth.uid(), player_id)
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'physio'::public.app_role)
      OR public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
    AND public.same_club(auth.uid(), player_id)
  );

CREATE POLICY "Staff delete club match minutes" ON public.match_minutes
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'physio'::public.app_role)
      OR public.has_role(auth.uid(), 'coach'::public.app_role)
      OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
    AND public.same_club(auth.uid(), player_id)
  );

CREATE TRIGGER match_minutes_updated_at
  BEFORE UPDATE ON public.match_minutes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();