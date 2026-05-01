import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/jugador/mensajes")({
  component: () => (
    <MessagesView
      contactRole="physio"
      emptyTitle="Selecciona un fisio"
      emptyDesc="Escríbele a cualquiera de los fisios de tu club desde la lista de la izquierda."
    />
  ),
});
