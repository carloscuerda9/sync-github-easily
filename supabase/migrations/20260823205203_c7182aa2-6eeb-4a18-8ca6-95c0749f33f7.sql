-- 1) Revoke public/anon EXECUTE on trigger-only SECURITY DEFINER function
REVOKE ALL ON FUNCTION public.fn_player_tags_to_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_player_tags_to_history() FROM anon;
REVOKE ALL ON FUNCTION public.fn_player_tags_to_history() FROM authenticated;

-- 2) documents: allow uploader to fix metadata only
CREATE OR REPLACE FUNCTION public.enforce_document_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_owner(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.uploader_id IS DISTINCT FROM OLD.uploader_id
     OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.file_url IS DISTINCT FROM OLD.file_url
     OR NEW.file_type IS DISTINCT FROM OLD.file_type
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo se pueden editar el título y la descripción del documento';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_document_update_restrictions ON public.documents;
CREATE TRIGGER enforce_document_update_restrictions
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_document_update_restrictions();

DROP POLICY IF EXISTS "Uploader updates document metadata" ON public.documents;
CREATE POLICY "Uploader updates document metadata"
ON public.documents
FOR UPDATE
TO authenticated
USING (uploader_id = auth.uid())
WITH CHECK (uploader_id = auth.uid());

GRANT UPDATE ON public.documents TO authenticated;

-- 3) Align foreign keys to public.profiles
DELETE FROM public.player_leaves pl
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pl.player_id)
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pl.physio_id);

DELETE FROM public.player_tags pt
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pt.player_id)
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pt.physio_id);

ALTER TABLE public.player_leaves DROP CONSTRAINT IF EXISTS player_leaves_physio_id_fkey;
ALTER TABLE public.player_leaves DROP CONSTRAINT IF EXISTS player_leaves_player_id_fkey;
ALTER TABLE public.player_leaves
  ADD CONSTRAINT player_leaves_physio_id_fkey FOREIGN KEY (physio_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT player_leaves_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.player_tags DROP CONSTRAINT IF EXISTS player_tags_physio_id_fkey;
ALTER TABLE public.player_tags DROP CONSTRAINT IF EXISTS player_tags_player_id_fkey;
ALTER TABLE public.player_tags
  ADD CONSTRAINT player_tags_physio_id_fkey FOREIGN KEY (physio_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT player_tags_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;