import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout, type NavItem } from "@/components/AppLayout";
import { Receipt, Users, CalendarDays, MessageSquare, History } from "lucide-react";
import { useIsOwner } from "@/lib/owner";

const baseItems: NavItem[] = [
  { to: "/admin/facturas", label: "Facturas", icon: Receipt },
];

const ownerItems: NavItem[] = [
  { to: "/admin/facturas", label: "Facturas", icon: Receipt },
  { to: "/admin/usuarios", label: "Usuarios", icon: Users },
  { to: "/admin/citas", label: "Citas", icon: CalendarDays },
  { to: "/admin/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/admin/historico", label: "Histórico", icon: History },
];

function AdminLayout() {
  const isOwner = useIsOwner();
  return (
    <RoleGuard role="superadmin">
      <AppLayout role="superadmin" items={isOwner ? ownerItems : baseItems}>
        <Outlet />
      </AppLayout>
    </RoleGuard>
  );
}

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});
