-- 1. Create clubs table
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- 2. Add club_id to profiles
ALTER TABLE public.profiles ADD COLUMN club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

-- 3. Security definer helper to get user's club_id (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_club(_user_id uuid)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT club_id FROM public.profiles WHERE id = _user_id
$$;

-- 4. Helper to check if two users share a club
CREATE OR REPLACE FUNCTION public.same_club(_user_a uuid, _user_b uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles a
    JOIN public.profiles b ON a.club_id = b.club_id
    WHERE a.id = _user_a AND b.id = _user_b AND a.club_id IS NOT NULL
  )
$$;

-- 5. Helper to lookup club by code (for registration, bypasses RLS)
CREATE OR REPLACE FUNCTION public.find_club_by_code(_code TEXT)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name FROM public.clubs WHERE code = upper(_code) LIMIT 1
$$;

-- 6. RLS for clubs
CREATE POLICY "Members view own club"
  ON public.clubs FOR SELECT TO authenticated
  USING (id = public.get_user_club(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmin manages clubs"
  ON public.clubs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Anyone can read minimal club info via find_club_by_code (no direct RLS needed beyond above; function is SECURITY DEFINER)

-- 7. Update handle_new_user to set club_id from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role;
  _status public.account_status;
  _full_name TEXT;
  _phone TEXT;
  _profile_data JSONB;
  _club_id UUID;
  _club_code TEXT;
  _club_name TEXT;
  _new_code TEXT;
BEGIN
  IF NEW.email = 'admin@wefixyou.com' THEN
    _role := 'superadmin';
    _status := 'approved';
  ELSE
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'player');
    IF _role = 'player' THEN
      _status := 'approved';
    ELSE
      _status := 'pending';
    END IF;
  END IF;

  _full_name := NEW.raw_user_meta_data->>'full_name';
  _phone := NEW.raw_user_meta_data->>'phone';
  _profile_data := COALESCE(NEW.raw_user_meta_data->'profile_data', '{}'::jsonb);
  _club_code := upper(NULLIF(NEW.raw_user_meta_data->>'club_code', ''));
  _club_name := NULLIF(NEW.raw_user_meta_data->>'club_name', '');

  -- Resolve club
  IF _role = 'physio' THEN
    IF _club_code IS NOT NULL THEN
      SELECT id INTO _club_id FROM public.clubs WHERE code = _club_code;
      IF _club_id IS NULL THEN
        RAISE EXCEPTION 'Código de club no válido: %', _club_code;
      END IF;
    ELSIF _club_name IS NOT NULL THEN
      -- Generate unique 6-char uppercase code
      LOOP
        _new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs WHERE code = _new_code);
      END LOOP;
      INSERT INTO public.clubs (name, code, created_by)
      VALUES (_club_name, _new_code, NEW.id)
      RETURNING id INTO _club_id;
    ELSE
      RAISE EXCEPTION 'Los fisioterapeutas deben crear un club o unirse con un código';
    END IF;
  ELSIF _role = 'player' THEN
    IF _club_code IS NULL THEN
      RAISE EXCEPTION 'Los jugadores deben introducir un código de club';
    END IF;
    SELECT id INTO _club_id FROM public.clubs WHERE code = _club_code;
    IF _club_id IS NULL THEN
      RAISE EXCEPTION 'Código de club no válido: %', _club_code;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role, status, profile_data, club_id)
  VALUES (NEW.id, NEW.email, _full_name, _phone, _role, _status, _profile_data, _club_id);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Update profiles RLS policies for club isolation
DROP POLICY IF EXISTS "Players can view physios" ON public.profiles;
DROP POLICY IF EXISTS "Physios view their players" ON public.profiles;

CREATE POLICY "Players view physios in same club"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    role = 'physio'
    AND status = 'approved'
    AND public.has_role(auth.uid(), 'player')
    AND club_id IS NOT NULL
    AND club_id = public.get_user_club(auth.uid())
  );

CREATE POLICY "Physios view players in same club"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    role = 'player'
    AND public.has_role(auth.uid(), 'physio')
    AND club_id IS NOT NULL
    AND club_id = public.get_user_club(auth.uid())
  );
