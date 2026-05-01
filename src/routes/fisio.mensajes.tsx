import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/fisio/mensajes")({ component: () => <ComingSoon title="Mensajes" desc="Chat con jugadores, con adjuntos." /> });
