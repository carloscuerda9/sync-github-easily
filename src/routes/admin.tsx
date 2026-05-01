import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout, type NavItem } from "@/components/AppLayout";
import { LayoutDashboard, Users, ClipboardList, Calendar, Receipt } from "lucide-react";

const items: NavItem[] = [
  { to: "/admin", label: "Resumen", icon: LayoutDashboard },
  { to: "/admin/usuarios", label: "Usuarios", icon: Users },
  { to: "/admin/preguntas", label: "Preguntas", icon: ClipboardList },
  { to: "/admin/citas", label: "Citas", icon: Calendar },
  { to: "/admin/facturas", label: "Facturas", icon: Receipt },
];

export const Route = createFileRoute("/admin")({
  component: () => (
    <RoleGuard role="superadmin">
      <AppLayout role="superadmin" items={items}>
        <Outlet />
      </AppLayout>
    </RoleGuard>
  ),
});
