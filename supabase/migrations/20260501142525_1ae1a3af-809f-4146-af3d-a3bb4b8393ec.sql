INSERT INTO public.app_config (key, value) VALUES
  ('push_endpoint_url', 'https://ifschpokjtzwbxiskyfx.supabase.co/functions/v1/send-push'),
  ('push_webhook_secret', 'REDACTED_ROTATED_SECRET')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();