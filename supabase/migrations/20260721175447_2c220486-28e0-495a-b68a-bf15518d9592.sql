GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_assignments TO authenticated;
GRANT ALL ON public.form_assignments TO service_role;