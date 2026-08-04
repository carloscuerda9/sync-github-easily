import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/fisio/mensajes")({
  component: () => (
    <MessagesView
      contactRole={["player", "coach"]}
      emptyTitle="Selecciona un contacto"
      emptyDesc="Comunícate con los jugadores y entrenadores de tu club desde la lista de la izquierda."
    />
  ),
});
