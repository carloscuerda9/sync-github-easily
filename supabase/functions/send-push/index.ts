// Web Push delivery + VAPID public key endpoint.
// Receives webhook calls from Postgres dispatch_push_notification() and
// sends Web Push notifications to all subscriptions of the target user.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@wefixyou.com";
const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // Public endpoint: return VAPID public key so the client can subscribe.
  if (req.method === "GET" || url.pathname.endsWith("/public-key")) {
    return new Response(JSON.stringify({ publicKey: VAPID_PUBLIC_KEY }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST = webhook from Postgres trigger
  const incomingSecret = req.headers.get("x-webhook-secret");
  if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { user_id?: string; kind?: string; title?: string; body?: string; href?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { user_id, kind, title, body, href } = payload;
  if (!user_id || !title) {
    return new Response(JSON.stringify({ error: "missing fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user_id);

  if (error) {
    console.error("DB error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const notification = JSON.stringify({
    title,
    body: body ?? "",
    href: href ?? "/",
    kind: kind ?? "generic",
  });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notification,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = subscription expired/unsubscribed → clean up
        if (status === 404 || status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("push error", status, err);
        }
      }
    }),
  );

  return new Response(JSON.stringify({ sent, removed, total: subs?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
