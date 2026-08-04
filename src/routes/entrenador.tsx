import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout, type NavItem } from "@/components/AppLayout";
import { MessageSquare, HeartPulse } from "lucide-react";

const items: NavItem[] = [
  { to: "/entrenador/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/entrenador/historico", label: "Histórico", icon: HeartPulse },
];

export const Route = createFileRoute("/entrenador")({
  component: () => (
    <RoleGuard role="coach">
      <AppLayout role="coach" items={items}>
        <Outlet />
      </AppLayout>
    </RoleGuard>
  ),
});
