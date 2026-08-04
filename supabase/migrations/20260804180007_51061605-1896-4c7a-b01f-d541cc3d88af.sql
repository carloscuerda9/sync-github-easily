CREATE OR REPLACE FUNCTION public.enforce_profile_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No puedes cambiar tu rol';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'No puedes cambiar el estado de tu cuenta';
  END IF;

  IF NEW.club_id IS DISTINCT FROM OLD.club_id THEN
    RAISE EXCEPTION 'No puedes cambiar tu club';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'No puedes cambiar la identidad de tu perfil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_update_restrictions ON public.profiles;
CREATE TRIGGER enforce_profile_update_restrictions
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update_restrictions();