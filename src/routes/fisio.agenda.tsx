import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/fisio/agenda")({ component: () => <ComingSoon title="Agenda" desc="Calendario con citas, aprobaciones y notas de sesión." /> });
