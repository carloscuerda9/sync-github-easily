import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/admin/citas")({ component: () => <ComingSoon title="Todas las citas" desc="Vista global de citas de la plataforma." /> });
