import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/fisio/mensajes")({
  component: () => (
    <MessagesView
      contactRole="player"
      emptyTitle="Selecciona un jugador"
      emptyDesc="Comunícate con cualquier jugador de tu club desde la lista de la izquierda."
    />
  ),
});
