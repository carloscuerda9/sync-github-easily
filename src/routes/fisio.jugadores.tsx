import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/fisio/jugadores")({ component: () => <ComingSoon title="Mis jugadores" desc="Listado de pacientes con ficha completa y seguimiento." /> });
