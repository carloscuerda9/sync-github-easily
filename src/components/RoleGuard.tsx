import { useAuth, type AppRole } from "@/lib/auth-context";
import { Navigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import type { ReactNode } from "react";

interface RoleGuardProps {
  role: AppRole;
  children: ReactNode;
}

export function RoleGuard({ role, children }: RoleGuardProps) {
  const { profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) return <Navigate to="/login" />;

  if (profile.status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mb-4 flex justify-center"><Logo /></div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Cuenta en revisión</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta está pendiente de aprobación por el equipo de We Fix You.
            Recibirás un aviso cuando esté lista.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={() => signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  if (profile.status === "rejected") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-destructive">Cuenta rechazada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta no ha sido aprobada. Si crees que es un error, contacta con soporte.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={() => signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  if (profile.role !== role) {
    if (profile.role === "superadmin") return <Navigate to="/admin" />;
    if (profile.role === "physio") return <Navigate to="/fisio" />;
    return <Navigate to="/jugador" />;
  }

  return <>{children}</>;
}
