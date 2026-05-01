import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/fisio/documentos")({ component: () => <ComingSoon title="Documentos" desc="Subir y compartir informes con jugadores." /> });
