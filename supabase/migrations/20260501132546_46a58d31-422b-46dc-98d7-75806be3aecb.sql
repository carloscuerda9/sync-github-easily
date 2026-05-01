-- Bucket privado
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: ¿el usuario actual está implicado en este path? (path = "<player_id>/...")
-- Permitido si soy el jugador (path[1] = mi id) o si soy fisio del mismo club que ese jugador.
CREATE OR REPLACE FUNCTION public.can_access_document_path(_path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN split_part(_path, '/', 1) = '' THEN false
      WHEN (split_part(_path, '/', 1))::uuid = auth.uid() THEN true
      WHEN public.has_role(auth.uid(), 'physio'::public.app_role)
           AND public.same_club(auth.uid(), (split_part(_path, '/', 1))::uuid) THEN true
      ELSE false
    END
$$;

-- Storage policies (bucket 'documents')
DROP POLICY IF EXISTS "documents_select" ON storage.objects;
CREATE POLICY "documents_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.can_access_document_path(name));

DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
CREATE POLICY "documents_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.can_access_document_path(name));

DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
CREATE POLICY "documents_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.can_access_document_path(name) AND owner = auth.uid());

-- Reforzar RLS de la tabla documents (mismo club)
DROP POLICY IF EXISTS "Users upload documents" ON public.documents;
CREATE POLICY "Users upload documents"
ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
  uploader_id = auth.uid()
  AND public.same_club(auth.uid(), recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_recipient_created ON public.documents (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_uploader_created ON public.documents (uploader_id, created_at DESC);