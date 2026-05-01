import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LogOut, Copy, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/lib/notifications-context";
import type { ReactNode, ComponentType } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface AppLayoutProps {
  role: AppRole;
  items: NavItem[];
  children: ReactNode;
}

export function AppLayout({ role, items, children }: AppLayoutProps) {
  const { profile, club, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const copyClubCode = async () => {
    if (!club) return;
    try {
      await navigator.clipboard.writeText(club.code);
      toast.success("Código copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <div className="border-b border-border p-4"><Logo /></div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.to)
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        {club && (
          <div className="border-t border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3 w-3" /> Club
            </div>
            <div className="mt-1 truncate text-sm font-semibold">{club.name}</div>
            {role === "physio" && (
              <button
                type="button"
                onClick={copyClubCode}
                className="mt-1.5 flex w-full items-center justify-between rounded-md border border-dashed border-primary/40 bg-background px-2 py-1.5 text-left transition-colors hover:bg-primary/5"
                aria-label="Copiar código del club"
              >
                <span className="font-mono text-sm font-bold tracking-widest text-primary">{club.code}</span>
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        <div className="border-t border-border p-4">
          <div className="mb-2 truncate text-sm font-medium">{profile?.full_name ?? profile?.email}</div>
          <div className="mb-3 truncate text-xs text-muted-foreground">{profile?.email}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex w-full flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <Logo compact />
            {club && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs font-semibold">{club.name}</div>
                {role === "physio" && (
                  <button
                    type="button"
                    onClick={copyClubCode}
                    className="font-mono text-[10px] font-bold tracking-widest text-primary"
                  >
                    {club.code}
                  </button>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-border bg-background md:hidden">
          {items.slice(0, 5).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium",
                isActive(item.to) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="leading-tight">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
