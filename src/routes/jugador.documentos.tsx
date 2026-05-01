import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/jugador/documentos")({ component: () => <ComingSoon title="Documentos" desc="Informes, planes de ejercicios y notas médicas compartidas por tu fisio." /> });
