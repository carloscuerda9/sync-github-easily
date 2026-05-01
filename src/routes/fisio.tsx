import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout, type NavItem } from "@/components/AppLayout";
import { Calendar, Users, MessageSquare, Receipt, Home } from "lucide-react";

const items: NavItem[] = [
  { to: "/fisio", label: "Inicio", icon: Home },
  { to: "/fisio/agenda", label: "Agenda", icon: Calendar },
  { to: "/fisio/jugadores", label: "Jugadores", icon: Users },
  { to: "/fisio/mensajes", label: "Mensajes", icon: MessageSquare },
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
