import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/jugador/historial")({ component: () => <ComingSoon title="Mi historial" desc="Línea temporal completa de lesiones, sesiones y progreso." /> });
