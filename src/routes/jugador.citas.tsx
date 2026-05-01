import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/jugador/citas")({ component: () => <ComingSoon title="Reservar cita" desc="Verás aquí la lista de fisios disponibles, podrás elegir fecha, hora y tipo de sesión, y gestionar tus citas." /> });
