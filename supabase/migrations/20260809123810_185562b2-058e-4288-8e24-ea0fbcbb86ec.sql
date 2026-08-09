UPDATE public.match_minutes SET opponent = '' WHERE opponent IS NULL;
ALTER TABLE public.match_minutes ALTER COLUMN opponent SET DEFAULT '';
ALTER TABLE public.match_minutes ALTER COLUMN opponent SET NOT NULL;
DROP INDEX IF EXISTS public.match_minutes_unique_entry;
CREATE UNIQUE INDEX match_minutes_unique_entry
  ON public.match_minutes (player_id, match_date, opponent);