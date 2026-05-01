import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/admin/facturas")({ component: () => <ComingSoon title="Todas las facturas" desc="Vista global de facturas y revenue." /> });
