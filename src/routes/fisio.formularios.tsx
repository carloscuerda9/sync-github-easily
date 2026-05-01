import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/fisio/formularios")({ component: () => <ComingSoon title="Formularios" desc="Crear formularios externos y asignarlos a jugadores." /> });
