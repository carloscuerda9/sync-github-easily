import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Supabase Auth OAuth namespace is still beta; wrap the consent methods locally
// so this route compiles without guessing internal module shapes.
type OAuthAuthorizationDetails = {
  client?: { name?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type SupabaseAuthOAuth = {
  getAuthorizationDetails: (authorizationId: string) => Promise<{ data?: OAuthAuthorizationDetails | null; error?: Error | null }>;
  approveAuthorization: (authorizationId: string) => Promise<{ data?: { redirect_url?: string; redirect_to?: string } | null; error?: Error | null }>;
  denyAuthorization: (authorizationId: string) => Promise<{ data?: { redirect_url?: string; redirect_to?: string } | null; error?: Error | null }>;
};

const oauth = (supabase.auth as unknown as { oauth?: SupabaseAuthOAuth }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/login", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    if (!oauth) throw new Error("OAuth no está disponible en este cliente");
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-4">
      <p className="text-destructive">
        No se pudo cargar la solicitud de autorización: {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    if (!oauth) {
      setError("OAuth no está disponible en este cliente");
      return;
    }
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No se recibió URL de redirección.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold">
          Conectar {details?.client?.name ?? "una app"} a tu cuenta
        </h1>
        <p className="mt-2 text-muted-foreground">
          Esto permite que {details?.client?.name ?? "la app"} use WE FIX YOU como tú.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Tendrá acceso a tus citas, mensajes y datos de club según tu rol.
        </p>
        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={busy}
            onClick={() => decide(true)}
          >
            Aprobar
          </button>
          <button
            className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Rechazar
          </button>
        </div>
      </div>
    </main>
  );
}
