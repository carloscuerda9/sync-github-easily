import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout, type NavItem } from "@/components/AppLayout";
import { Calendar, Users, MessageSquare, FileText, Receipt } from "lucide-react";

const items: NavItem[] = [
  { to: "/fisio", label: "Inicio", icon: Calendar },
  { to: "/fisio/jugadores", label: "Jugadores", icon: Users },
  { to: "/fisio/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/fisio/formularios", label: "Forms", icon: FileText },
  { to: "/fisio/facturacion", label: "Facturas", icon: Receipt },
];

export const Route = createFileRoute("/fisio")({
  component: () => (
    <RoleGuard role="physio">
      <AppLayout role="physio" items={items}>
        <Outlet />
      </AppLayout>
    </RoleGuard>
  ),
});
