CREATE OR REPLACE FUNCTION public.can_access_document_path(_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN split_part(_path, '/', 1) = '' THEN false
      WHEN (split_part(_path, '/', 1))::uuid = auth.uid() THEN true
      WHEN public.has_role(auth.uid(), 'physio'::public.app_role)
           AND public.same_club(auth.uid(), (split_part(_path, '/', 1))::uuid) THEN true
      WHEN public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN true
      ELSE false
    END
$function$;