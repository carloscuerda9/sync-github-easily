import { createFileRoute } from "@tanstack/react-router";
import { NotificationSettings } from "@/components/NotificationSettings";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/fisio/perfil")({
  component: PerfilFisio,
});

function PerfilFisio() {
  const { profile, club } = useAuth();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">Gestiona tus datos y preferencias.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Datos de la cuenta</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div><span className="text-muted-foreground">Nombre:</span> {profile?.full_name ?? "—"}</div>
          <div><span className="text-muted-foreground">Email:</span> {profile?.email}</div>
          {profile?.phone && <div><span className="text-muted-foreground">Teléfono:</span> {profile.phone}</div>}
          {club && <div><span className="text-muted-foreground">Club:</span> {club.name} ({club.code})</div>}
        </CardContent>
      </Card>
      <NotificationSettings />
    </div>
  );
}
