import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/admin/preguntas")({ component: () => <ComingSoon title="Preguntas de registro" desc="Editor de preguntas configurables para jugadores y fisios." /> });
