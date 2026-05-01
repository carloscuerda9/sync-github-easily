import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout, type NavItem } from "@/components/AppLayout";
import { Calendar, MessageSquare, FileText, ClipboardList, Activity } from "lucide-react";

const items: NavItem[] = [
  { to: "/jugador", label: "Inicio", icon: Activity },
  { to: "/jugador/citas", label: "Citas", icon: Calendar },
  { to: "/jugador/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/jugador/documentos", label: "Documentos", icon: FileText },
  { to: "/jugador/formularios", label: "Formularios", icon: ClipboardList },
];

export const Route = createFileRoute("/jugador")({
  component: () => (
    <RoleGuard role="player">
      <AppLayout role="player" items={items}>
        <Outlet />
      </AppLayout>
    </RoleGuard>
  ),
});

// re-export so child route file has a parent
export { Link };
