CREATE TABLE public.player_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  physio_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_groups TO authenticated;
GRANT ALL ON public.player_groups TO service_role;
ALTER TABLE public.player_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Physios manage groups of their club"
ON public.player_groups FOR ALL TO authenticated
USING (
  public.is_owner(auth.uid())
  OR (public.has_role(auth.uid(), 'physio'::public.app_role) AND club_id = public.get_user_club(auth.uid()))
)
WITH CHECK (
  public.is_owner(auth.uid())
  OR (public.has_role(auth.uid(), 'physio'::public.app_role) AND club_id = public.get_user_club(auth.uid()) AND physio_id = auth.uid())
);

CREATE TRIGGER player_groups_updated_at BEFORE UPDATE ON public.player_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.player_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.player_groups(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_group_members TO authenticated;
GRANT ALL ON public.player_group_members TO service_role;
ALTER TABLE public.player_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Physios manage members of their club groups"
ON public.player_group_members FOR ALL TO authenticated
USING (
  public.is_owner(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.player_groups g
    WHERE g.id = group_id
      AND public.has_role(auth.uid(), 'physio'::public.app_role)
      AND g.club_id = public.get_user_club(auth.uid())
  )
)
WITH CHECK (
  public.is_owner(auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM public.player_groups g
      WHERE g.id = group_id
        AND public.has_role(auth.uid(), 'physio'::public.app_role)
        AND g.club_id = public.get_user_club(auth.uid())
    )
    AND public.same_club(auth.uid(), player_id)
  )
);