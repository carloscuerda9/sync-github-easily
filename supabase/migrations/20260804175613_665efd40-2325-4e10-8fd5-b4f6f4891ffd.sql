CREATE TYPE public.physio_invoice_type AS ENUM ('material', 'sesion_privada_fisio', 'sesion_privada_medico', 'otro');

CREATE TABLE public.physio_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  physio_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  invoice_type public.physio_invoice_type NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  invoice_date date NOT NULL,
  description text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.physio_invoices TO authenticated;
GRANT ALL ON public.physio_invoices TO service_role;

ALTER TABLE public.physio_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Physios manage own uploaded invoices"
ON public.physio_invoices FOR ALL TO authenticated
USING (physio_id = auth.uid())
WITH CHECK (physio_id = auth.uid() AND public.has_role(auth.uid(), 'physio'::public.app_role) AND public.has_role(admin_id, 'superadmin'::public.app_role));

CREATE POLICY "Assigned admin views invoices"
ON public.physio_invoices FOR SELECT TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'superadmin'::public.app_role));

CREATE TRIGGER physio_invoices_updated_at
BEFORE UPDATE ON public.physio_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_physio_invoices_admin ON public.physio_invoices(admin_id);
CREATE INDEX idx_physio_invoices_physio ON public.physio_invoices(physio_id);
CREATE UNIQUE INDEX idx_physio_invoices_path ON public.physio_invoices(file_path);

CREATE POLICY "Physios view admins"
ON public.profiles FOR SELECT TO authenticated
USING (role = 'superadmin'::public.app_role AND status = 'approved'::public.account_status AND public.has_role(auth.uid(), 'physio'::public.app_role));

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
      WHEN public.has_role(auth.uid(), 'superadmin'::public.app_role)
           AND split_part(_path, '/', 2) = 'facturas' THEN EXISTS (
             SELECT 1 FROM public.physio_invoices pi
             WHERE pi.file_path = _path AND pi.admin_id = auth.uid()
           )
      WHEN public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN true
      ELSE false
    END
$function$;