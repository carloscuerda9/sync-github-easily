INSERT INTO public.app_config (key, value) VALUES
  ('push_endpoint_url', 'https://ifschpokjtzwbxiskyfx.supabase.co/functions/v1/send-push'),
  ('push_webhook_secret', 'whsec_6f3e9b8a2c4d1e7f5a8b9c0d2e4f6a8b1c3d5e7f9a2b4c6d8e0f1a3b5c7d9e1f')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();