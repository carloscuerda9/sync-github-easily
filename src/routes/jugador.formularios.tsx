import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/jugador/formularios")({ component: () => <ComingSoon title="Formularios" desc="Cuestionarios y consentimientos asignados por tu fisio." /> });
