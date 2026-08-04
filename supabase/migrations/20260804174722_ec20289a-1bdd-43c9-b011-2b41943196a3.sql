DELETE FROM public.player_tags t
USING public.player_tags o
WHERE t.player_id = o.player_id
  AND (t.updated_at, t.id) < (o.updated_at, o.id);

ALTER TABLE public.player_tags DROP CONSTRAINT IF EXISTS player_tags_physio_id_player_id_key;
DROP INDEX IF EXISTS public.player_tags_physio_id_player_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS player_tags_player_id_key ON public.player_tags (player_id);