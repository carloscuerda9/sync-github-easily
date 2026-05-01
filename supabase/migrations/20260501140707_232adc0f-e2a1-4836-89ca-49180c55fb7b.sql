REVOKE EXECUTE ON FUNCTION public.dispatch_push_notification(uuid, text, text, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.user_wants_notification(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_message_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_appointment_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_form_assignment_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_document_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_invoice_change() FROM anon, authenticated, public;