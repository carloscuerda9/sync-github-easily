-- 1) Harden owner identification: require BOTH the fixed account id AND the owner email
CREATE OR REPLACE FUNCTION public.owner_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$ SELECT 'db033ca5-8c30-45d1-b022-5c41f1bab199'::uuid $$;

REVOKE ALL ON FUNCTION public.owner_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = public.owner_id()
     AND EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = _user_id AND lower(p.email) = public.owner_email()
     )
$$;

-- 2) match_minutes: explicit club scoping, approved staff only, non-null club on both sides
CREATE OR REPLACE FUNCTION public.staff_shares_club_with(_staff_id uuid, _player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles s
    JOIN public.profiles p ON p.club_id = s.club_id
    WHERE s.id = _staff_id
      AND p.id = _player_id
      AND s.club_id IS NOT NULL
      AND p.club_id IS NOT NULL
      AND s.status = 'approved'
      AND (
        public.has_role(_staff_id, 'physio'::public.app_role)
        OR public.has_role(_staff_id, 'coach'::public.app_role)
        OR public.has_role(_staff_id, 'superadmin'::public.app_role)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.staff_shares_club_with(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_shares_club_with(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Staff read club match minutes" ON public.match_minutes;
DROP POLICY IF EXISTS "Staff insert club match minutes" ON public.match_minutes;
DROP POLICY IF EXISTS "Staff update club match minutes" ON public.match_minutes;
DROP POLICY IF EXISTS "Staff delete club match minutes" ON public.match_minutes;

CREATE POLICY "Staff read club match minutes"
ON public.match_minutes FOR SELECT TO authenticated
USING (public.staff_shares_club_with(auth.uid(), player_id));

CREATE POLICY "Staff insert club match minutes"
ON public.match_minutes FOR INSERT TO authenticated
WITH CHECK (
  public.staff_shares_club_with(auth.uid(), player_id)
  AND recorded_by = auth.uid()
  AND club_id IS NOT DISTINCT FROM public.get_user_club(auth.uid())
);

CREATE POLICY "Staff update club match minutes"
ON public.match_minutes FOR UPDATE TO authenticated
USING (public.staff_shares_club_with(auth.uid(), player_id))
WITH CHECK (
  public.staff_shares_club_with(auth.uid(), player_id)
  AND club_id IS NOT DISTINCT FROM public.get_user_club(auth.uid())
);

CREATE POLICY "Staff delete club match minutes"
ON public.match_minutes FOR DELETE TO authenticated
USING (public.staff_shares_club_with(auth.uid(), player_id));