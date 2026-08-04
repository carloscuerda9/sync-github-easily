import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout, type NavItem } from "@/components/AppLayout";
import { Receipt } from "lucide-react";

const items: NavItem[] = [
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
