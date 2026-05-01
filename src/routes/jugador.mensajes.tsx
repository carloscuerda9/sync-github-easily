import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/jugador/mensajes")({ component: () => <ComingSoon title="Mensajes" desc="Chat directo con tu fisio, con adjuntos e historial." /> });
